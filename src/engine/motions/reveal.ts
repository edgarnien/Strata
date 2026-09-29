import { clipDraw, drawInBar, fillBars } from '../draw';
import type { Bar } from '../types';
import { paceLevel, ramp } from './pace';
import type { Motion } from './types';

const WAVE_WIDTH = 0.15;

/**
 * Colour: every bar starts coloured and turns clear, the rest of the grid before the look, then
 * closes again in reverse. IMG MASK: the next clip fades in bar by bar, the look first.
 */
export const reveal: Motion = {
  id: 'reveal',
  label: 'REVEAL',
  icon: '◌',
  covered: 'ends',
  draw(ctx, f) {
    const total = f.bars.length;
    const level = paceLevel(f.progress, f.imgMask);
    const image = f.imgMask ? f.nextImage : f.image;
    if (!f.imgMask) fillBars(ctx, f.bars, f.color);
    const full: Bar[] = [];
    f.bars.forEach((bar, i) => {
      const pos = f.imgMask ? i / total : 1 - (i + 1) / total;
      const alpha = ramp(level, pos, WAVE_WIDTH);
      if (alpha >= 1) full.push(bar);
      else if (alpha > 0) drawInBar(ctx, bar, image, f.width, f.height, f.fit, alpha);
    });
    // Fully drawn bars share one clip path, so they meet without seams.
    clipDraw(ctx, full, image, f.width, f.height, f.fit);
  },
};
