import { describe, expect, it } from 'vitest';
import { gridBars } from '../../src/engine/analyze';
import { MOTIONS } from '../../src/engine/motions';
import { mulberry32, shuffled } from '../../src/engine/rng';
import { barKey, coverageByBar, frame } from './helpers';

// With several clips a motion covers the whole frame: the clip's look (its stroke bars, first
// `lead` bars) comes first, the rest of the grid after it.
const W = 1080;
const H = 1920;
const bars = shuffled(gridBars(W, H, { cols: 27, rows: 16 }), mulberry32(5));
const lead = 172; // ≈ 40 % of the 432 bars
const look = new Set(bars.slice(0, lead).map(barKey));

function split(motionIndex: number, progress: number, imgMask: boolean): { look: number; rest: number } {
  const motion = MOTIONS[motionIndex];
  let inLook = 0;
  let inRest = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const f = frame({ width: W, height: H, bars, lead, progress, seed, cycle: seed, imgMask });
    for (const [key, v] of coverageByBar((ctx) => motion.draw(ctx, f))) {
      if (look.has(key)) inLook += v;
      else inRest += v;
    }
  }
  return { look: inLook / (6 * lead), rest: inRest / (6 * (bars.length - lead)) };
}

describe('every motion reaches the look before it fills the rest of the frame', () => {
  MOTIONS.forEach((motion, m) => {
    // REVEAL starts covered and clears the rest of the grid first, so its look sits at the other end.
    const colourLevel = motion.id === 'reveal' ? 1 - lead / bars.length : lead / bars.length;
    it(`${motion.label} with colour strokes`, () => {
      const colour = split(m, colourLevel / 2, false);
      expect(colour.look).toBeGreaterThan(0.85);
      expect(colour.rest).toBeLessThan(0.1);
    });
    it(`${motion.label} with IMG MASK`, () => {
      const mask = split(m, lead / bars.length, true);
      expect(mask.look).toBeGreaterThan(0.85);
      expect(mask.rest).toBeLessThan(0.1);
    });
  });
});

describe('strokes fall away in reverse, so they pass the look again', () => {
  MOTIONS.forEach((motion) => {
    it(`${motion.label}`, () => {
      const at = (progress: number) =>
        coverageByBar((ctx) => motion.draw(ctx, frame({ width: W, height: H, bars, lead, progress, seed: 3, cycle: 3, frameIndex: 40 })));
      const rising = at(0.3);
      const falling = at(0.7);
      expect([...falling.keys()].sort()).toEqual([...rising.keys()].sort());
      for (const [key, v] of rising) expect(falling.get(key)).toBeCloseTo(v, 6);
    });
  });
});
