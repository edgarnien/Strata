import type { FormatId } from '../engine/types';

export function exportFileName(format: FormatId, ext: 'mp4' | 'png', date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `strata-${format.replace(':', 'x')}-${stamp}.${ext}`;
}

export function canShare(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Must be called from a user gesture (tap on SAVE / SHARE). */
export async function shareFile(file: File): Promise<void> {
  await navigator.share({ files: [file] });
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
