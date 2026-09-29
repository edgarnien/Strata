import { clipDraw, drawFitted, fillBars } from './draw';
import { motionById } from './motions';
import { hashSeed, mulberry32, shuffled } from './rng';
import { positionAt, totalDuration } from './timeline';
import type { Bar, Ctx2D, Fit, Settings } from './types';

export interface ImageLayer {
  bitmap: ImageBitmap;
  /** Bars that carry a stroke (after REMOVE and THRESHOLD). */
  strokeBars: Bar[];
  /** Every cell of the grid – with several clips the strokes cover all of them. */
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
const REST_SALT = 0x7e5;

interface BarOrder {
  key: string;
  bars: Bar[];
  lead: number;
}
const orderCache = new WeakMap<ImageLayer, BarOrder>();

/**
 * Bar order for one clip, identical for every loop so loops repeat exactly: its look (the stroke
 * bars) first and, with `whole`, the rest of the grid after it.
 */
function barOrder(layer: ImageLayer, whole: boolean, seed: number, imageIndex: number): BarOrder {
  const key = `${seed}:${imageIndex}:${whole}`;
  const hit = orderCache.get(layer);
  if (hit?.key === key) return hit;
  const look = shuffled(layer.strokeBars, mulberry32(hashSeed(seed, imageIndex, ORDER_SALT)));
  let bars = look;
  if (whole) {
    const inLook = new Set(layer.strokeBars.map((b) => `${b.x},${b.y}`));
    const rest = layer.gridBars.filter((b) => !inLook.has(`${b.x},${b.y}`));
    bars = [...look, ...shuffled(rest, mulberry32(hashSeed(seed, imageIndex, REST_SALT)))];
  }
  const order = { key, bars, lead: look.length };
  orderCache.set(layer, order);
  return order;
}

/** IMG MASK needs a next clip to reveal. */
export function imgMaskOn(settings: Pick<Settings, 'imgMask'>, clipCount: number): boolean {
  return settings.imgMask && clipCount >= 2;
}

export function imgMaskActive(scene: Scene): boolean {
  return imgMaskOn(scene.settings, scene.layers.length);
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

/**
 * Draws the animation at time t (seconds). Returns the index of the clip on screen, or −1.
 *
 * A single clip only ever reaches its look. With several clips the strokes go on until they cover
 * the whole frame, so each clip hands over to the next without a cut: colour strokes switch the
 * clip underneath while it is covered, IMG MASK ends each cycle on the fully revealed next clip.
 */
export function renderFrame(ctx: Ctx2D, scene: Scene, t: number): number {
  const n = scene.layers.length;
  if (n === 0) return -1;
  const s = scene.settings;
  const pos = positionAt(t, { imageCount: n, loops: s.loops, speed: s.speed });
  const motion = motionById(s.motion);
  const imgMask = imgMaskActive(scene);
  const chain = n >= 2;
  const handover = chain && !imgMask && motion.covered === 'middle' && pos.progress >= 0.5;
  const index = handover ? pos.nextImageIndex : pos.imageIndex;
  const clip = scene.layers[index];
  const order = barOrder(clip, chain, scene.seed, index);

  paintBase(ctx, scene, clip.bitmap);
  motion.draw(ctx, {
    width: scene.width,
    height: scene.height,
    fit: scene.fit,
    bars: order.bars,
    lead: order.lead,
    progress: pos.progress,
    cycle: pos.cycle,
    frameIndex: pos.frameIndex,
    seed: scene.seed,
    color: s.color,
    image: clip.bitmap,
    nextImage: scene.layers[(index + 1) % n].bitmap,
    imgMask,
  });
  return index;
}

/**
 * The look of one clip while the animation is stopped: its stroke bars in the stroke colour, or
 * with IMG MASK filled with the next clip.
 */
export function renderStill(ctx: Ctx2D, scene: Scene, index: number): void {
  const n = scene.layers.length;
  if (n === 0) return;
  const i = Math.min(Math.max(0, index), n - 1);
  const clip = scene.layers[i];
  paintBase(ctx, scene, clip.bitmap);
  if (imgMaskActive(scene)) clipDraw(ctx, clip.strokeBars, scene.layers[(i + 1) % n].bitmap, scene.width, scene.height, scene.fit);
  else fillBars(ctx, clip.strokeBars, scene.settings.color);
}
