import { barNoise, clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import type { Bar } from '../types';
import { earliest, paceLevel } from './pace';
import type { Motion } from './types';

const SALT = 0x1a7;
const MAX_DELAY = 0.22;

/** 2–3 shock waves expand from random centres, then the field contracts back into them. */
export const impulse: Motion = {
  id: 'impulse',
  label: 'IMPULSE',
  icon: '◎',
  draw(ctx, f) {
    const rng = rngFor(f.seed, f.cycle, SALT);
    const count = rng() > 0.45 ? 3 : 2;
    const origins = Array.from({ length: count }, (_, i) => ({
      x: f.width * (0.15 + rng() * 0.7),
      y: f.height * (0.15 + rng() * 0.7),
      delay: i === 0 ? 0 : rng() * MAX_DELAY,
    }));
    const maxR = Math.hypot(f.width, f.height);
    const scatter = maxR * 0.16;
    // A bar is hit by the wave that reaches it first; later waves start as if from further away.
    const arrival = (bar: Bar) =>
      barNoise(bar) * scatter + Math.min(...origins.map((o) => Math.hypot(bar.x - o.x, bar.y - o.y) + o.delay * maxR));
    const visible = earliest(f.bars, paceLevel(f.progress, f.imgMask), arrival);
    if (f.imgMask) clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, visible, f.color);
  },
};
