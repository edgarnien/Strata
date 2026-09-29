import { clipDraw, fillBars } from '../draw';
import { paceLevel } from './pace';
import type { Motion } from './types';

/** Bars pile up to the full set in the first half of the cycle, then fall away again. */
export const buildUp: Motion = {
  id: 'buildUp',
  label: 'BUILD UP',
  icon: '↑',
  draw(ctx, f) {
    const count = Math.floor(paceLevel(f.progress, f.imgMask) * f.bars.length);
    if (f.imgMask) clipDraw(ctx, f.bars.slice(0, count), f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, f.bars, f.color, count);
  },
};
