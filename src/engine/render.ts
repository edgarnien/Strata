import { clipDraw, drawFitted, fillBars } from './draw';
import { motionById, type Motion } from './motions';
import { paceLevel } from './motions/pace';
import { CASCADE_STAGGER, DEPTH_MIN, RISE_SHIFT, SLIDE_SHIFT, ZIPPER_SHIFT, ease } from './move';
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
  const strokes = s.move === 'off' ? ctx : movedStrokes(ctx, scene, motion, pos.progress, imgMask, clip.gridBars);
  motion.draw(strokes, {
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
 * MOVE: the strokes move as they build up and fall away, over a photo that stays still so text
 * stays readable. DEPTH brings the layer forward and SLIDE slides it in from the right; the grid
 * moves STEP (sideways), RISE (up), CASCADE (columns up one after another) and ZIPPER (rows from
 * alternating sides) only move by whole columns and bar heights, so bars always stay aligned to
 * the columns and meet corner on corner. Every move sits in place wherever the strokes are
 * complete, so the look and the hand-over between clips stay put.
 */
function movedStrokes(ctx: Ctx2D, scene: Scene, motion: Motion, progress: number, imgMask: boolean, grid: Bar[]): Ctx2D {
  const { width: w, height: h } = scene;
  const level = paceLevel(progress, imgMask);
  const startsCovered = !imgMask && motion.covered === 'ends';
  const away = 1 - ease(startsCovered ? 1 - level : level);
  // In from the right / from below while building up, out to the left / upwards while falling away.
  const dir = imgMask || (startsCovered ? progress >= 0.5 : progress < 0.5) ? 1 : -1;
  const move = scene.settings.move;
  if (move === 'depth') {
    const k = 1 - (1 - DEPTH_MIN) * away;
    return placeRects(ctx, (x, y, bw, bh) => [w / 2 + (x - w / 2) * k, h / 2 + (y - h / 2) * k, bw * k, bh * k]);
  }
  if (move === 'slide') {
    const dx = dir * SLIDE_SHIFT * w * away;
    return placeRects(ctx, (x, y, bw, bh) => [x + dx, y, bw, bh]);
  }
  const g = gridEdges(grid, w, h);
  const cols = g.xs.length - 1;
  const rows = g.ys.length - 1;
  const steps = (amount: number, cells: number) => Math.round(amount * Math.max(1, Math.round(cells)));
  switch (move) {
    case 'step':
      return shiftCells(ctx, g, () => [dir * steps(away, SLIDE_SHIFT * cols), 0]);
    case 'rise':
      return shiftCells(ctx, g, () => [0, dir * steps(away, RISE_SHIFT * rows)]);
    case 'cascade':
      return shiftCells(ctx, g, (c) => {
        const lag = (c / Math.max(1, cols - 1)) * CASCADE_STAGGER;
        return [0, dir * steps(Math.min(1, Math.max(0, (away - (1 - lag) + CASCADE_STAGGER) / CASCADE_STAGGER)), rows)];
      });
    default:
      return shiftCells(ctx, g, (_, r) => [(r % 2 === 0 ? 1 : -1) * steps(away, ZIPPER_SHIFT * cols), 0]);
  }
}

/** The context with every bar moved by whole cells: `by(column, row)` gives the shift in columns and rows. */
function shiftCells(ctx: Ctx2D, g: GridEdges, by: (column: number, row: number) => [number, number]): Ctx2D {
  return placeRects(ctx, (x, y, bw, bh) => {
    const c = g.col.get(x);
    const r = g.row.get(y);
    if (c === undefined || r === undefined) return [x, y, bw, bh];
    const [dc, dr] = by(c, r);
    const left = edge(g.xs, c + dc);
    const top = edge(g.ys, r + dr);
    return [left, top, edge(g.xs, c + dc + 1) - left, edge(g.ys, r + dr + 1) - top];
  });
}

type Rect = [number, number, number, number];

interface GridEdges {
  /** Column and row edges, ending with the frame's width / height. */
  xs: number[];
  ys: number[];
  col: Map<number, number>;
  row: Map<number, number>;
}
const edgesCache = new WeakMap<Bar[], GridEdges>();

/** Where the grid's columns and rows start, so bars can move by whole cells. */
function gridEdges(grid: Bar[], w: number, h: number): GridEdges {
  const hit = edgesCache.get(grid);
  if (hit) return hit;
  const xs = [...new Set(grid.map((b) => b.x))].sort((a, b) => a - b).concat(w);
  const ys = [...new Set(grid.map((b) => b.y))].sort((a, b) => a - b).concat(h);
  const g = { xs, ys, col: new Map(xs.map((x, i) => [x, i])), row: new Map(ys.map((y, i) => [y, i])) };
  edgesCache.set(grid, g);
  return g;
}

/** Edge `i` of a grid axis; beyond the frame the cells repeat at their average size. */
function edge(edges: number[], i: number): number {
  const last = edges.length - 1;
  if (i < 0) return (i * edges[last]) / last;
  if (i > last) return edges[last] + ((i - last) * edges[last]) / last;
  return edges[i];
}

/** The context with every bar outline moved by `place`; images still draw where they are. */
function placeRects(ctx: Ctx2D, place: (...r: Rect) => Rect): Ctx2D {
  return new Proxy(ctx, {
    get(target, key) {
      if (key === 'rect') return (...r: Rect) => target.rect(...place(...r));
      if (key === 'fillRect') return (...r: Rect) => target.fillRect(...place(...r));
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      return Reflect.set(target, key, value, target);
    },
  });
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
