import { addVideoFiles } from '../video/clipImport';

/** DEV only: loads clips from dev-fixtures/ (made with ffmpeg, see the video-mode plan). */
export async function loadTestVideos(names: string[]): Promise<void> {
  const files = await Promise.all(names.map(async (name) => {
    const res = await fetch(`/dev-fixtures/${name}`);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || (name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4') });
  }));
  await addVideoFiles(files);
}
