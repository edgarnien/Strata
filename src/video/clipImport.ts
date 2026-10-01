import { markers, playhead, playing, selectedMarker, videoClips, type VideoClipEntry } from '../state/store';
import { toast } from '../ui/toast';
import { moveItem } from '../util/array';
import { isAcceptedVideo } from './accept';
import { forgetClipMarkers } from './markers';
import { ClipError, closeClip, filmstrip, openClip } from './media';

let nextId = 0;

export async function addVideoFiles(files: Iterable<File>): Promise<void> {
  const added: VideoClipEntry[] = [];
  for (const file of files) {
    if (!isAcceptedVideo(file)) {
      toast(`${file.name}: please use MP4, MOV or WEBM`, 'error');
      continue;
    }
    const id = `vid${++nextId}`;
    try {
      const probe = await openClip(id, file);
      const stripUrl = await filmstrip(id, probe.duration);
      added.push({ id, name: file.name, file, url: URL.createObjectURL(file), stripUrl, ...probe });
    } catch (err) {
      closeClip(id);
      toast(`${file.name} ${err instanceof ClipError ? err.message : 'could not be loaded'}`, 'error');
    }
  }
  if (added.length) videoClips.update((list) => [...list, ...added]);
}

export function removeVideoClip(index: number): void {
  const list = videoClips.get();
  const entry = list[index];
  if (!entry) return;
  playing.set(false);
  const next = list.filter((_, i) => i !== index);
  markers.set(forgetClipMarkers(markers.get(), entry.id));
  selectedMarker.set(null);
  videoClips.set(next);
  if (next.length === 0) playhead.set(0);
  // Release resources only after the store no longer references the clip.
  closeClip(entry.id);
  URL.revokeObjectURL(entry.url);
  URL.revokeObjectURL(entry.stripUrl);
}

export function moveVideoClip(from: number, to: number): void {
  const list = videoClips.get();
  if (!list[from]) return;
  videoClips.set(moveItem(list, from, to));
}
