import type { MoveId } from './types';

export const MOVES: readonly { id: MoveId; icon: string; label: string }[] = [
  { id: 'off', icon: '·', label: 'OFF' },
  { id: 'depth', icon: '⧉', label: 'DEPTH' },
  { id: 'slide', icon: '⇠', label: 'SLIDE' },
];

/** How small a clip gets as it moves back (DEPTH) – text in it stays large enough to read. */
export const DEPTH_MIN = 0.6;
/** How far (share of the frame width) a clip travels while SLIDE hands over. */
export const SLIDE_SHIFT = 0.35;
/** How far ahead of the picture the colour accents at the strokes' edge run (share of the cycle). */
export const ACCENT_LEAD = 0.08;

/** 0 → 1 with a soft start and stop, so every move rests at both ends. */
export function ease(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Scale of a clip moving back into the frame over its cycle. */
export function depthScale(progress: number): number {
  return 1 - (1 - DEPTH_MIN) * ease(progress);
}

/** Progress of the colour accents: a little ahead of the picture, but level with it at both ends. */
export function accentProgress(progress: number): number {
  return Math.min(1, progress + ACCENT_LEAD * 4 * progress * (1 - progress));
}
