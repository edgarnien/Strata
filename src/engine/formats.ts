import type { Fit, FormatId, Size } from './types';

export interface FormatDef {
  id: FormatId;
  icon: string;
  label: string;
  /** null = derived from the first clip (ORIGINAL). */
  size: Size | null;
}

export const FORMATS: readonly FormatDef[] = [
  { id: '9:16', icon: '▯', label: '9:16', size: { width: 1080, height: 1920 } },
  { id: '4:5', icon: '▯', label: '4:5', size: { width: 1080, height: 1350 } },
  { id: '16:9', icon: '▭', label: '16:9', size: { width: 1920, height: 1080 } },
  { id: 'original', icon: '□', label: 'ORIGINAL', size: null },
];

export const ORIGINAL_MAX_EDGE = 2000;

export function formatDef(id: FormatId): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function outputSize(id: FormatId, firstImage: Size | null): Size | null {
  const def = formatDef(id);
  if (def.size) return def.size;
  if (!firstImage) return null;
  const maxEdge = Math.max(firstImage.width, firstImage.height);
  // Integer maths (v × 2000 / maxEdge) avoids 3024 → 1499.999… rounding; H.264 needs even dimensions.
  const scaled = (v: number) => (maxEdge > ORIGINAL_MAX_EDGE ? Math.floor((v * ORIGINAL_MAX_EDGE) / maxEdge) : Math.floor(v));
  const even = (v: number) => Math.max(2, scaled(v) & ~1);
  return { width: even(firstImage.width), height: even(firstImage.height) };
}

export function fitFor(id: FormatId): Fit {
  return id === 'original' ? 'contain' : 'cover';
}

export function pixelLabel(size: Size | null): string {
  return size ? `${size.width} × ${size.height}` : '—';
}
