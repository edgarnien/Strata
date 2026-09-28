import { clipDraw, fillBars } from '../draw';
import type { Motion } from './types';

/** Bars pile up to the full set in the first half of the cycle, then fall away again. */
export const buildUp: Motion = {
  id: 'buildUp',
  label: 'BUILD UP',
  icon: '↑',
  draw(ctx, f) {
    const n = f.bars.length;
    if (f.imgMask) {
      clipDraw(ctx, f.bars.slice(0, Math.floor(f.progress * n)), f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const level = f.progress < 0.5 ? f.progress * 2 : 1 - (f.progress - 0.5) * 2;
    fillBars(ctx, f.bars, f.color, Math.floor(level * n));
  },
};
