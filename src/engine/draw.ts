import type { Bar, Ctx2D, Fit } from './types';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function drawFitted(ctx: Ctx2D, img: ImageBitmap, width: number, height: number, fit: Fit): void {
  if (fit === 'contain') {
    const scale = Math.min(width / img.width, height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return;
  }
  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (imgAspect > targetAspect) {
    sw = img.height * targetAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetAspect;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

export function fillBars(ctx: Ctx2D, bars: readonly Bar[], color: string, count = bars.length): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const b = bars[i];
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
}

/** Draws `img` only inside the union of `bars` (IMG MASK reveal). */
export function clipDraw(ctx: Ctx2D, bars: readonly Bar[], img: ImageBitmap, width: number, height: number, fit: Fit): void {
  if (bars.length === 0) return;
  ctx.save();
  ctx.beginPath();
  for (const b of bars) ctx.rect(b.x, b.y, b.width, b.height);
  ctx.clip();
  drawFitted(ctx, img, width, height, fit);
  ctx.restore();
}

/** Draws `img` inside one bar at the given opacity. */
export function drawInBar(ctx: Ctx2D, bar: Bar, img: ImageBitmap, width: number, height: number, fit: Fit, alpha: number): void {
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
