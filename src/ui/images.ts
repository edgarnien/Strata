import { images, patchSettings, playing, selected, settings, type ImageEntry } from '../state/store';
import { moveItem } from '../util/array';
import { forgetImage } from './scene';
import { toast } from './toast';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
let nextId = 0;

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file); // older engines reject the options bag
  }
}

export async function addImageFiles(files: Iterable<File>): Promise<void> {
  const added: ImageEntry[] = [];
  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) {
      toast(`${file.name}: please use PNG, JPG or WEBP`, 'error');
      continue;
    }
    try {
      const bitmap = await decode(file);
      added.push({ id: `img${++nextId}`, name: file.name, bitmap, thumbUrl: URL.createObjectURL(file) });
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
