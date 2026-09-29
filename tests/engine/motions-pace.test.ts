import { describe, expect, it } from 'vitest';
import { gridBars } from '../../src/engine/analyze';
import { MOTIONS } from '../../src/engine/motions';
import { mulberry32, shuffled } from '../../src/engine/rng';
import { coverage, frame } from './helpers';

// A realistic 9:16 grid, shuffled like the scene's bar order.
const W = 1080;
const H = 1920;
const bars = shuffled(gridBars(W, H, { cols: 27, rows: 16 }), mulberry32(5));

/** Share of the bars a motion shows at `progress`, averaged over seeds. */
function shown(motionIndex: number, progress: number, imgMask: boolean): number {
  const motion = MOTIONS[motionIndex];
  let sum = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const f = frame({ width: W, height: H, bars, progress, seed, cycle: seed, imgMask });
    const c = coverage((ctx) => motion.draw(ctx, f), bars.length);
    // REVEAL clears coloured bars instead of adding them.
    sum += motion.id === 'reveal' && !imgMask ? 1 - c : c;
  }
  return sum / 8;
}

// SPEED has to mean the same for every motion: strokes build up over the first half of a cycle
// and fall away over the second; IMG MASK reveals the next clip over the whole cycle.
const COLOUR = [[0, 0], [0.25, 0.5], [0.5, 1], [0.75, 0.5], [0.999, 0]];
const MASK = [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [0.999, 1]];

describe('every motion keeps the same pace', () => {
  MOTIONS.forEach((motion, m) => {
    it(`${motion.label} with colour strokes`, () => {
      for (const [p, level] of COLOUR) expect(Math.abs(shown(m, p, false) - level), `p = ${p}`).toBeLessThan(0.12);
    });
    it(`${motion.label} with IMG MASK`, () => {
      for (const [p, level] of MASK) expect(Math.abs(shown(m, p, true) - level), `p = ${p}`).toBeLessThan(0.12);
    });
  });
});
