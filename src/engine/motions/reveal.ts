import { clamp01, drawInBar, fillBars } from '../draw';
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
      f.bars.forEach((bar, i) => {
        const pos = i / total;
        const barAlpha = clamp01((appear - pos) / WAVE_WIDTH);
        if (barAlpha <= 0) return;
        const clearAlpha = f.progress > 0.5 ? clamp01((settle - pos) / WAVE_WIDTH) : 0;
        const pixAlpha = barAlpha * (1 - clearAlpha);
        if (pixAlpha > 0) drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, pixAlpha);
        if (clearAlpha > 0) drawInBar(ctx, bar, f.nextImage, f.width, f.height, f.fit, barAlpha * clearAlpha);
      });
      return;
    }
    // 0→0.5: coloured bars turn clear one by one; 0.5→1: they close again.
    const revealing = f.progress <= 0.5;
    const phase = revealing ? f.progress * 2 : (f.progress - 0.5) * 2;
    fillBars(ctx, f.bars, f.color);
    f.bars.forEach((bar, i) => {
      const t = (phase - i / total) / WAVE_WIDTH;
      const clearAlpha = revealing ? clamp01(t) : clamp01(1 - t);
      if (clearAlpha > 0) drawInBar(ctx, bar, f.image, f.width, f.height, f.fit, clearAlpha);
    });
  },
};
