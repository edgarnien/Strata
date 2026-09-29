import { clamp01, clipDraw, drawInBar, fillBars } from '../draw';
import type { Bar } from '../types';
import type { Motion } from './types';

const WAVE_WIDTH = 0.15;

export const reveal: Motion = {
  id: 'reveal',
  label: 'REVEAL',
  icon: '◌',
  draw(ctx, f) {
    const total = f.bars.length;
    if (f.imgMask) {
      // 0→0.5: the next image appears bar by bar; 0.5→1: the bars settle into the clear photo.
      const appear = Math.min(1, f.progress * 2);
      const settle = f.progress > 0.5 ? (f.progress - 0.5) * 2 : 0;
      const opaque: Bar[] = [];
      f.bars.forEach((bar, i) => {
        const pos = i / total;
        const barAlpha = clamp01((appear - pos) / WAVE_WIDTH);
        if (barAlpha <= 0) return;
        const clearAlpha = f.progress > 0.5 ? clamp01((settle - pos) / WAVE_WIDTH) : 0;
        const pixAlpha = barAlpha * (1 - clearAlpha);
        if (pixAlpha >= 1 || barAlpha * clearAlpha >= 1) {
          opaque.push(bar);
          return;
        }
        if (pixAlpha > 0) drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, pixAlpha);
        if (clearAlpha > 0) drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, barAlpha * clearAlpha);
      });
      // Fully shown bars share one clip path, so they meet without seams.
      clipDraw(ctx, opaque, f.nextImage, f.width, f.height, f.fit);
      return;
    }
    // 0→0.5: coloured bars turn clear one by one; 0.5→1: they close again.
    const revealing = f.progress <= 0.5;
    const phase = revealing ? f.progress * 2 : (f.progress - 0.5) * 2;
    fillBars(ctx, f.bars, f.color);
    const clear: Bar[] = [];
    f.bars.forEach((bar, i) => {
      const t = (phase - i / total) / WAVE_WIDTH;
      const clearAlpha = revealing ? clamp01(t) : clamp01(1 - t);
      if (clearAlpha >= 1) clear.push(bar);
      else if (clearAlpha > 0) drawInBar(ctx, bar, f.image, f.width, f.height, f.fit, clearAlpha);
    });
    clipDraw(ctx, clear, f.image, f.width, f.height, f.fit);
  },
};
