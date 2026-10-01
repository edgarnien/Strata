import type { Bar, Ctx2D, DrawSource, Fit, Size } from './types';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Pixel size of a source; a <video> element's own width/height are its layout box, not the video. */
export function sourceSize(src: DrawSource): Size {
  if ('videoWidth' in src) return { width: src.videoWidth, height: src.videoHeight };
  if ('displayWidth' in src) return { width: src.displayWidth, height: src.displayHeight };
  return { width: src.width, height: src.height };
}

export function drawFitted(ctx: Ctx2D, img: DrawSource, width: number, height: number, fit: Fit): void {
  const { width: iw, height: ih } = sourceSize(img);
  if (fit === 'contain') {
    const scale = Math.min(width / iw, height / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return;
  }
  const imgAspect = iw / ih;
  const targetAspect = width / height;
  let sw = iw, sh = ih, sx = 0, sy = 0;
  if (imgAspect > targetAspect) {
    sw = ih * targetAspect;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetAspect;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

/**
 * Fills the bars as one path. Filled one by one, neighbours that meet on a fractional device
 * pixel (the scaled-down preview) each cover only part of it and leave a faint seam.
 */
export function fillBars(ctx: Ctx2D, bars: readonly Bar[], color: string, count = bars.length): void {
  if (count <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const b = bars[i];
    ctx.rect(b.x, b.y, b.width, b.height);
  }
  ctx.fill();
}

/** Draws `img` only inside the union of `bars` (IMG MASK reveal). */
export function clipDraw(ctx: Ctx2D, bars: readonly Bar[], img: DrawSource, width: number, height: number, fit: Fit): void {
  if (bars.length === 0) return;
  ctx.save();
  ctx.beginPath();
  for (const b of bars) ctx.rect(b.x, b.y, b.width, b.height);
  ctx.clip();
  drawFitted(ctx, img, width, height, fit);
  ctx.restore();
}

/** Draws `img` inside one bar at the given opacity. */
export function drawInBar(ctx: Ctx2D, bar: Bar, img: DrawSource, width: number, height: number, fit: Fit, alpha: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(bar.x, bar.y, bar.width, bar.height);
  ctx.clip();
  ctx.globalAlpha = alpha;
  drawFitted(ctx, img, width, height, fit);
  ctx.restore();
}

/** Stable per-bar noise in [0, 1) – same hash the legacy animations used. */
export function barNoise(bar: Bar): number {
  const hx = (bar.x * 73856093) >>> 0;
  const hy = (bar.y * 19349663) >>> 0;
  return (((hx ^ hy) * 2654435761) >>> 0) / 0xffffffff;
}
