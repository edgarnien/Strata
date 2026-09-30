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

/** The bar order in tiers that keep their turn: the look (first `lead`), the rest, the edge (last `rim`). */
function tiers(bars: readonly Bar[], lead: number, rim: number): Bar[][] {
  const edge = bars.length - rim;
  return [bars.slice(0, Math.min(lead, edge)), bars.slice(Math.min(lead, edge), edge), bars.slice(edge)];
}

/** The `level` share of the bars that `arrival` says are reached first, tier by tier. */
export function earliest(bars: readonly Bar[], level: number, arrival: (bar: Bar) => number, lead = bars.length, rim = 0): Bar[] {
  const count = Math.floor(level * bars.length);
  if (count <= 0) return [];
  const out: Bar[] = [];
  for (const tier of tiers(bars, lead, rim)) {
    if (out.length >= count) break;
    out.push(...tier.map((bar) => ({ bar, at: arrival(bar) })).sort((a, b) => a.at - b.at).map((b) => b.bar));
  }
  return out.slice(0, count);
}

/** Shuffles each tier on its own, so the look stays first and the edge last. */
export function shuffledInTiers(bars: readonly Bar[], lead: number, rng: () => number, rim = 0): Bar[] {
  return tiers(bars, lead, rim).flatMap((tier) => shuffled(tier, rng));
}
