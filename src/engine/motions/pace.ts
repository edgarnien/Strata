import type { Bar } from '../types';

/**
 * Share of the bars a motion shows at `progress`. Colour strokes build up over the first half of
 * the cycle and fall away over the second; IMG MASK reveals the next clip over the whole cycle.
 * Every motion keeps to it, so SPEED means the same for all of them.
 */
export function paceLevel(progress: number, imgMask: boolean): number {
  if (imgMask) return progress;
  return progress < 0.5 ? progress * 2 : 2 - progress * 2;
}

/** The `level` share of the bars that `arrival` says are reached first. */
export function earliest(bars: readonly Bar[], level: number, arrival: (bar: Bar) => number): Bar[] {
  const count = Math.floor(level * bars.length);
  if (count <= 0) return [];
  return bars
    .map((bar) => ({ bar, at: arrival(bar) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, count)
    .map((b) => b.bar);
}
