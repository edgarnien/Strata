import { drawFitted, fillBars } from './draw';
import { motionById } from './motions';
import { hashSeed, mulberry32, shuffled } from './rng';
import { positionAt, totalDuration } from './timeline';
import type { Bar, Ctx2D, Fit, Settings } from './types';

export interface ImageLayer {
  bitmap: ImageBitmap;
  /** Bars that carry a stroke (after REMOVE and THRESHOLD). */
  strokeBars: Bar[];
  /** Every cell of the grid – IMG MASK reveals through all of them. */
  gridBars: Bar[];
}

export interface Scene {
  width: number;
  height: number;
  fit: Fit;
  layers: ImageLayer[];
  settings: Settings;
  seed: number;
}

const ORDER_SALT = 0xba5;
const orderCache = new WeakMap<Bar[], { key: number; order: Bar[] }>();

/** Bar order for one clip; identical for every loop so loops repeat exactly. */
function barOrder(bars: readonly Bar[], seed: number, imageIndex: number): Bar[] {
  const key = hashSeed(seed, imageIndex, ORDER_SALT);
  const hit = orderCache.get(bars as Bar[]);
  if (hit?.key === key) return hit.order;
  const order = shuffled(bars, mulberry32(key));
  orderCache.set(bars as Bar[], { key, order });
  return order;
}

export function imgMaskActive(scene: Scene): boolean {
  return scene.settings.imgMask && scene.layers.length >= 2;
}

export function sceneDuration(scene: Scene): number {
  const { loops, speed } = scene.settings;
  return totalDuration({ imageCount: scene.layers.length, loops, speed });
}

function paintBase(ctx: Ctx2D, scene: Scene, image: ImageBitmap): void {
  const { width, height, fit } = scene;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  drawFitted(ctx, image, width, height, fit);
}

/** Draws the animation at time t (seconds). Returns the index of the clip shown, or −1. */
export function renderFrame(ctx: Ctx2D, scene: Scene, t: number): number {
  const n = scene.layers.length;
  if (n === 0) return -1;
  const s = scene.settings;
  const pos = positionAt(t, { imageCount: n, loops: s.loops, speed: s.speed });
  const cur = scene.layers[pos.imageIndex];
  const next = scene.layers[pos.nextImageIndex];
  const imgMask = imgMaskActive(scene);

  paintBase(ctx, scene, cur.bitmap);
  motionById(s.motion).draw(ctx, {
    width: scene.width,
    height: scene.height,
    fit: scene.fit,
    bars: barOrder(imgMask ? cur.gridBars : cur.strokeBars, scene.seed, pos.imageIndex),
    progress: pos.progress,
    cycle: pos.cycle,
    frameIndex: pos.frameIndex,
    seed: scene.seed,
    color: s.color,
    image: cur.bitmap,
    nextImage: next.bitmap,
    imgMask,
  });
  return pos.imageIndex;
}

/** The static stroke picture of one clip (animation stopped). */
export function renderStill(ctx: Ctx2D, scene: Scene, index: number): void {
  const n = scene.layers.length;
  if (n === 0) return;
  const i = Math.min(Math.max(0, index), n - 1);
  const imgMask = imgMaskActive(scene);
  paintBase(ctx, scene, scene.layers[imgMask ? (i + 1) % n : i].bitmap);
  fillBars(ctx, scene.layers[i].strokeBars, scene.settings.color);
}
