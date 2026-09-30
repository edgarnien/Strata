import { imgMaskOn } from '../engine/render';
import { randomSeed } from '../engine/rng';
import type { Settings } from '../engine/types';
import { loadSettings, saveSettings } from './settings';
import { signal } from './signal';

export interface ImageEntry {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  thumbUrl: string;
}

export type ToolId =
  | 'size' | 'stretch' | 'threshold' | 'remove' | 'color' | 'imgMask'
  | 'motion' | 'move' | 'speed' | 'loops' | 'format';

export const settings = signal<Settings>(loadSettings());
export const images = signal<readonly ImageEntry[]>([]);
/** Clip picked in the clip strip (shown while paused). */
export const selected = signal(0);
export const playing = signal(false);
/** Clip currently on screen while playing. */
export const shownClip = signal(0);
export const seed = signal(randomSeed());
export const activeTool = signal<ToolId>('size');
export const exporting = signal(false);

/** IMG MASK reveals the next clip instead of drawing strokes, so the stroke colour has no say. */
export function colorLocked(): boolean {
  return imgMaskOn(settings.get(), images.get().length);
}

export function patchSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

settings.subscribe((s) => saveSettings(s));
