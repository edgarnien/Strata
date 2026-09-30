import { clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import { paceLevel, shuffledInTiers } from './pace';
import type { Motion } from './types';

const SALT = 0x611;
const FRINGE = 8;

/** Bars snap in (and back out, in reverse) in a random order with a flickering leading edge. */
export const glitch: Motion = {
  id: 'glitch',
  label: 'GLITCH',
  icon: '▦',
  covered: 'middle',
  draw(ctx, f) {
    const order = shuffledInTiers(f.bars, f.lead, rngFor(f.seed, f.cycle, SALT));
    const flicker = rngFor(f.seed, f.cycle, f.frameIndex, SALT);
    const total = order.length;
    if (total === 0) return;
    const target = Math.floor(total * paceLevel(f.progress, f.imgMask));
    const visible = order.slice(0, target);
    for (let i = target; i < Math.min(target + FRINGE, total); i++) if (flicker() > 0.6) visible.push(order[i]);
    if (f.imgMask) clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, visible, f.color);
  },
};
