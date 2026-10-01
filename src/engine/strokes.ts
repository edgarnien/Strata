import { drawFitted } from './draw';
import type { Motion } from './motions';
import { paceLevel } from './motions/pace';
import { CASCADE_STAGGER, COMB_SHIFT, DEPTH_MIN, SLIDE_SHIFT, ZIPPER_SHIFT, ease } from './move';
import { hashSeed, mulberry32, shuffled } from './rng';
import type { Bar, Ctx2D, DrawSource, Fit, MoveId, Size } from './types';

/** The bars of one analysed picture: its look and every cell of the grid. */
export interface BarLook {
  /** Bars that carry a stroke (after REMOVE and THRESHOLD). */
  strokeBars: Bar[];
  /** Every cell of the grid – with several clips the strokes cover all of them. */
  gridBars: Bar[];
}

const ORDER_SALT = 0xba5;
const REST_SALT = 0x7e5;

export interface BarOrder {
  key: string;
  bars: Bar[];
  lead: number;
}
const orderCache = new WeakMap<BarLook, BarOrder>();

/**
 * Bar order for one look, identical every time it is asked for so loops repeat exactly: the look
 * (the stroke bars) first and, with `whole`, the rest of the grid after it. `salt` tells apart
 * several uses of the same seed (the clip index in photo mode, the stroke phase in video mode).
 */
export function barOrder(look: BarLook, whole: boolean, seed: number, salt: number): BarOrder {
  const key = `${seed}:${salt}:${whole}`;
  const hit = orderCache.get(look);
  if (hit?.key === key) return hit;
  const first = shuffled(look.strokeBars, mulberry32(hashSeed(seed, salt, ORDER_SALT)));
  let bars = first;
  if (whole) {
    const inLook = new Set(look.strokeBars.map((b) => `${b.x},${b.y}`));
    const rest = look.gridBars.filter((b) => !inLook.has(`${b.x},${b.y}`));
    bars = [...first, ...shuffled(rest, mulberry32(hashSeed(seed, salt, REST_SALT)))];
  }
  const order = { key, bars, lead: first.length };
  orderCache.set(look, order);
  return order;
}

export function paintBase(ctx: Ctx2D, width: number, height: number, fit: Fit, image: DrawSource): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  drawFitted(ctx, image, width, height, fit);
}

/**
 * MOVE: the strokes move as they build up and fall away, over a photo that stays still so text
 * stays readable. DEPTH brings the layer forward and SLIDE slides it in from the right; the grid
 * moves STEP (sideways), CASCADE (columns up one after another), ZIPPER (rows from alternating
 * sides) and COMB (columns from above and below in turn) only move by whole columns and bar heights, so bars always stay aligned to
 * the columns and meet corner on corner. Every move sits in place wherever the strokes are
 * complete, so the look and the hand-over between clips stay put.
 */
export function movedStrokes(ctx: Ctx2D, frame: Size, move: MoveId, motion: Motion, progress: number, imgMask: boolean, grid: Bar[]): Ctx2D {
  const { width: w, height: h } = frame;
  const level = paceLevel(progress, imgMask);
  const startsCovered = !imgMask && motion.covered === 'ends';
  const away = 1 - ease(startsCovered ? 1 - level : level);
  // In from the right / from below while building up, out to the left / upwards while falling away.
  const dir = imgMask || (startsCovered ? progress >= 0.5 : progress < 0.5) ? 1 : -1;
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
    case 'comb':
      return shiftCells(ctx, g, (c) => [0, (c % 2 === 0 ? 1 : -1) * steps(away, COMB_SHIFT * rows)]);
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
