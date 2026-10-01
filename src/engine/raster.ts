import type { PixelData } from './analyze';
import { drawFitted } from './draw';
import type { DrawSource, Fit, Size } from './types';

/** Draws the image the way the output frame shows it and returns its pixels. */
export function rasterize(img: DrawSource, size: Size, fit: Fit): PixelData {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is not available.');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size.width, size.height);
  drawFitted(ctx, img, size.width, size.height, fit);
  const { data, width, height } = ctx.getImageData(0, 0, size.width, size.height);
  return { data, width, height };
}
