import { barNoise, clamp01, clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import type { Bar } from '../types';
import type { Motion } from './types';

const SALT = 0x1a7;
const EXPAND_END = 0.62;

/** 2–3 shock waves expand from random centres, then the field collapses. */
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
      delay: i === 0 ? 0 : rng() * 0.22,
    }));
    const maxR = Math.hypot(f.width, f.height);
    const scatter = maxR * 0.16;
    const expandRadius = (delay: number, phase: number) =>
      maxR * (1 - Math.pow(1 - clamp01((phase - delay) / (EXPAND_END - delay)), 2.4));
    const reached = (bar: Bar, radiusFor: (delay: number) => number) => {
      const t = barNoise(bar);
      return origins.some((o) => t < (radiusFor(o.delay) - Math.hypot(bar.x - o.x, bar.y - o.y)) / scatter);
    };

    if (f.imgMask) {
      const phase = Math.min(f.progress, EXPAND_END);
      clipDraw(ctx, f.bars.filter((bar) => reached(bar, (d) => expandRadius(d, phase))), f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const expanding = f.progress <= EXPAND_END;
    const collapseR = maxR * Math.pow(1 - (f.progress - EXPAND_END) / (1 - EXPAND_END), 1.6);
    const visible = f.bars.filter((bar) => reached(bar, (d) => (expanding ? expandRadius(d, f.progress) : collapseR)));
    fillBars(ctx, visible, f.color);
  },
};
