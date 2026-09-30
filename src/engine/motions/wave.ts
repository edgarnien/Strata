import { barNoise, clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import type { Bar } from '../types';
import { earliest, paceLevel } from './pace';
import type { Motion } from './types';

const SALT = 0x3a1e;
const SCATTER = 0.45;

/** An organic wave front sweeps across the frame from a random side (and back). */
export const wave: Motion = {
  id: 'wave',
  label: 'WAVE',
  icon: '∿',
  covered: 'middle',
  draw(ctx, f) {
    const rng = rngFor(f.seed, f.cycle, SALT);
    const direction = Math.floor(rng() * 4);
    const freq1 = 1.8 + rng() * 1.4;
    const freq2 = 4.0 + rng() * 2.5;
    const amp1 = 0.06 + rng() * 0.06;
    const amp2 = 0.03 + rng() * 0.03;
    const phase0 = rng() * Math.PI * 2;
    // How far along the sweep a bar sits: position across the frame, bent by the wavy front,
    // frayed by per-bar noise.
    const arrival = (bar: Bar) => {
      const u = bar.x / f.width;
      const v = bar.y / f.height;
      const [along, perp] = direction === 0 ? [u, v] : direction === 1 ? [1 - u, v] : direction === 2 ? [v, u] : [1 - v, u];
      const disp = amp1 * Math.sin(perp * freq1 * Math.PI * 2 + phase0) + amp2 * Math.sin(perp * freq2 * Math.PI * 2 - phase0 * 1.3);
      return along + disp + barNoise(bar) * SCATTER;
    };
    const visible = earliest(f.bars, paceLevel(f.progress, f.imgMask), arrival, f.lead, f.rim);
    if (f.imgMask) clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, visible, f.color);
  },
};
