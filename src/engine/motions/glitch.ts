import { clipDraw, fillBars } from '../draw';
import { rngFor, shuffled } from '../rng';
import type { Bar } from '../types';
import type { Motion } from './types';

const SALT = 0x611;
const FRINGE = 8;

/** Bars snap in (and out) in a random order with a flickering leading edge. */
export const glitch: Motion = {
  id: 'glitch',
  label: 'GLITCH',
  icon: '▦',
  draw(ctx, f) {
    const order = shuffled(f.bars, rngFor(f.seed, f.cycle, SALT));
    const flicker = rngFor(f.seed, f.cycle, f.frameIndex, SALT);
    const total = order.length;
    if (total === 0) return;

    if (f.imgMask) {
      const target = Math.floor(total * f.progress);
      const visible = order.slice(0, target);
      for (let i = target; i < Math.min(target + FRINGE, total); i++) if (flicker() > 0.6) visible.push(order[i]);
      clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const visible: Bar[] = [];
    if (f.progress < 0.5) {
      const target = Math.floor(total * f.progress * 2);
      visible.push(...order.slice(0, target));
      for (let i = target; i < Math.min(target + FRINGE, total); i++) if (flicker() > 0.6) visible.push(order[i]);
    } else {
      const hidden = Math.floor(total * (f.progress - 0.5) * 2);
      visible.push(...order.slice(hidden));
      for (let i = Math.max(0, hidden - FRINGE); i < hidden; i++) if (flicker() > 0.7) visible.push(order[i]);
    }
    fillBars(ctx, visible, f.color);
  },
};
