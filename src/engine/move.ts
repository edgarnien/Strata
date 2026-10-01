import type { MoveId } from './types';

export const MOVES: readonly { id: MoveId; icon: string; label: string }[] = [
  { id: 'off', icon: '·', label: 'OFF' },
  { id: 'depth', icon: '⧉', label: 'DEPTH' },
  { id: 'slide', icon: '⇠', label: 'SLIDE' },
  { id: 'step', icon: '⇤', label: 'STEP' },
  { id: 'rise', icon: '⇡', label: 'RISE' },
  { id: 'cascade', icon: '⌸', label: 'CASCADE' },
  { id: 'zipper', icon: '⇋', label: 'ZIPPER' },
];

/** How far back the stroke layer starts (DEPTH): its scale before it comes forward. */
export const DEPTH_MIN = 0.6;
/** How far (share of the frame width) the stroke layer travels while it slides (SLIDE). */
export const SLIDE_SHIFT = 0.35;
/** How far the stroke layer travels up (RISE), as a share of the frame height. */
export const RISE_SHIFT = 0.6;
/** How much later the last column of CASCADE settles than the first (share of the move). */
export const CASCADE_STAGGER = 0.5;
/** How far the rows start apart (ZIPPER), as a share of the frame width. */
export const ZIPPER_SHIFT = 0.5;

/** 0 → 1 with a soft start and stop, so every move rests at both ends. */
export function ease(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
