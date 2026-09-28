import { drawFitted } from '../engine/draw';
import { images, patchSettings, playing, selected, settings, type ImageEntry } from '../state/store';
import { moveItem } from '../util/array';
import { forgetImage } from './scene';
import { toast } from './toast';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
let nextId = 0;

/** Some drag sources report no MIME type; fall back to the file extension. */
export function isAcceptedImage(file: { type: string; name: string }): boolean {
  return file.type ? ACCEPTED.includes(file.type) : /\.(png|jpe?g|webp)$/i.test(file.name);
}

/** ORIGINAL needs ≤ 2000 px on the long edge; cover formats need ≤ 1920 px on the short edge. */
const KEEP_LONG_EDGE = 2000;
const KEEP_SHORT_EDGE = 1920;
const THUMB_SIZE = 96;

/** Scale (≤ 1) that keeps every output format at full quality. */
export function keepScale(width: number, height: number): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return Math.min(1, Math.max(KEEP_LONG_EDGE / long, KEEP_SHORT_EDGE / short));
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file); // older engines reject the options bag
  }
}

async function shrink(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const scale = keepScale(bitmap.width, bitmap.height);
  if (scale >= 1) return bitmap;
  try {
    const small = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * scale),
      resizeHeight: Math.round(bitmap.height * scale),
      resizeQuality: 'high',
    });
    bitmap.close();
    return small;
  } catch {
    return bitmap; // engines without resize options keep the full-size decode
  }
}

async function thumbnail(bitmap: ImageBitmap): Promise<string> {
  const canvas = new OffscreenCanvas(THUMB_SIZE, THUMB_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  drawFitted(ctx, bitmap, THUMB_SIZE, THUMB_SIZE, 'cover');
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 }));
}

export async function addImageFiles(files: Iterable<File>): Promise<void> {
  const added: ImageEntry[] = [];
  for (const file of files) {
    if (!isAcceptedImage(file)) {
      toast(`${file.name}: please use PNG, JPG or WEBP`, 'error');
      continue;
    }
    try {
      const bitmap = await shrink(await decode(file));
      added.push({ id: `img${++nextId}`, name: file.name, bitmap, thumbUrl: await thumbnail(bitmap) });
    } catch {
      toast(`${file.name} could not be loaded`, 'error');
    }
  }
  if (added.length) images.update((list) => [...list, ...added]);
}

export function removeImage(index: number): void {
  const list = images.get();
  const entry = list[index];
  if (!entry) return;
  const next = list.filter((_, i) => i !== index);
  images.set(next);
  selected.set(Math.min(selected.get(), Math.max(0, next.length - 1)));
  if (next.length === 0) playing.set(false);
  if (next.length < 2 && settings.get().imgMask) patchSettings({ imgMask: false });
  // Release resources only after the store no longer references the clip.
  forgetImage(entry.id);
  URL.revokeObjectURL(entry.thumbUrl);
  entry.bitmap.close();
}

export function moveImage(from: number, to: number): void {
  const list = images.get();
  const item = list[from];
  if (!item) return;
  const next = moveItem(list, from, to);
  images.set(next);
  selected.set(next.indexOf(item));
}
