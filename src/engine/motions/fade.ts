import { clamp01, clipDraw, drawInBar } from '../draw';
import type { Motion } from './types';

const FADE_ZONE = 0.2;

/** Strokes fade in over the first half and out over the second, staggered by bar order. */
export const fade: Motion = {
  id: 'fade',
  label: 'FADE',
  icon: '◑',
  draw(ctx, f) {
    const total = f.bars.length;
    if (f.imgMask) {
      clipDraw(ctx, f.bars.filter((_, i) => i / total <= f.progress), f.nextImage, f.width, f.height, f.fit);
      f.bars.forEach((bar, i) => {
        const pos = i / total;
        if (pos <= f.progress || pos > f.progress + FADE_ZONE) return;
        drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, (f.progress + FADE_ZONE - pos) / FADE_ZONE);
      });
      return;
    }
    const fadeIn = f.progress <= 0.5;
    const phase = fadeIn ? f.progress * 2 : (f.progress - 0.5) * 2;
    ctx.fillStyle = f.color;
    f.bars.forEach((bar, i) => {
      const pos = i / total;
      const alpha = fadeIn ? clamp01(1 - (pos - phase) / FADE_ZONE) : clamp01((pos - phase) / FADE_ZONE);
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    });
    ctx.globalAlpha = 1;
  },
};
