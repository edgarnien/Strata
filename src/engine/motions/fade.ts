import { clipDraw, drawInBar, fillBars } from '../draw';
import type { Bar } from '../types';
import { paceLevel, ramp } from './pace';
import type { Motion } from './types';

const FADE_ZONE = 0.2;

/** Strokes (or, with IMG MASK, the next clip) fade in bar by bar, staggered by bar order; they fade out in reverse. */
export const fade: Motion = {
  id: 'fade',
  label: 'FADE',
  icon: '◑',
  covered: 'middle',
  draw(ctx, f) {
    const total = f.bars.length;
    const level = paceLevel(f.progress, f.imgMask);
    const solid: Bar[] = [];
    ctx.fillStyle = f.color;
    f.bars.forEach((bar, i) => {
      const alpha = ramp(level, i / total, FADE_ZONE);
      if (alpha >= 1) {
        solid.push(bar);
      } else if (alpha > 0 && f.imgMask) {
        drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, alpha);
      } else if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
      }
    });
    ctx.globalAlpha = 1;
    // Fully shown bars share one path, so they meet without seams.
    if (f.imgMask) clipDraw(ctx, solid, f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, solid, f.color);
  },
};
