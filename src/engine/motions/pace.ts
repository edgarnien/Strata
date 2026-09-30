import { clamp01 } from '../draw';
import { shuffled } from '../rng';
import type { Bar } from '../types';

/**
 * Share of the bars a motion shows at `progress`. Colour strokes build up over the first half of
 * the cycle and fall away in reverse over the second; IMG MASK reveals the next clip over the
 * whole cycle. Every motion keeps to it, so SPEED means the same for all of them.
 */
export function paceLevel(progress: number, imgMask: boolean): number {
  if (imgMask) return progress;
  return progress < 0.5 ? progress * 2 : 2 - progress * 2;
}

/** Opacity at `level` of the bar at `pos` (0–1 along the order): bars ramp in over `width`, none at level 0, all at 1. */
export function ramp(level: number, pos: number, width: number): number {
  return clamp01((level * (1 + width) - pos) / width);
}

/** The `level` share of the bars that `arrival` says are reached first; the look (first `lead`) before the rest. */
export function earliest(bars: readonly Bar[], level: number, arrival: (bar: Bar) => number, lead = bars.length): Bar[] {
  const count = Math.floor(level * bars.length);
  if (count <= 0) return [];
  const byArrival = (list: readonly Bar[]) =>
    list.map((bar) => ({ bar, at: arrival(bar) })).sort((a, b) => a.at - b.at).map((b) => b.bar);
  const look = byArrival(bars.slice(0, lead));
  return (count <= lead ? look : [...look, ...byArrival(bars.slice(lead))]).slice(0, count);
}

/** Shuffles the look (first `lead` bars) and the rest separately, so the look stays first. */
export function shuffledInTiers(bars: readonly Bar[], lead: number, rng: () => number): Bar[] {
  return [...shuffled(bars.slice(0, lead), rng), ...shuffled(bars.slice(lead), rng)];
}
