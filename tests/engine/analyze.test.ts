import { describe, expect, it } from 'vitest';
import {
  barGrid,
  buildForegroundMask,
  gridBars,
  maskSize,
  selectStrokeBars,
  type PixelData,
} from '../../src/engine/analyze';
import type { Bar } from '../../src/engine/types';

interface Rect { x: number; y: number; w: number; h: number }

function image(width: number, height: number, bg: number, rect?: Rect & { v: number }, alpha = 255): PixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = !!rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const v = rect && inside ? rect.v : bg;
      data.set([v, v, v, alpha], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const overlap = (bar: Bar, r: Rect) => {
  const w = Math.max(0, Math.min(bar.x + bar.width, r.x + r.w) - Math.max(bar.x, r.x));
  const h = Math.max(0, Math.min(bar.y + bar.height, r.y + r.h) - Math.max(bar.y, r.y));
  return (w * h) / (bar.width * bar.height);
};

const RECT: Rect = { x: 30, y: 50, w: 60, h: 100 };
const subject = image(120, 200, 235, { ...RECT, v: 20 });
const grid = barGrid(120, 200, 10, 0); // 12 × 7

describe('grid', () => {
  it('derives bar counts from size and stretch', () => {
    expect(barGrid(1080, 1920, 80, 0)).toEqual({ cols: 14, rows: 8 });
    expect(barGrid(1080, 1920, 80, 100)).toEqual({ cols: 14, rows: 4 });
    expect(grid).toEqual({ cols: 12, rows: 7 });
  });
  it('tiles the full frame without gaps', () => {
    const bars = gridBars(1080, 1920, { cols: 14, rows: 8 });
    expect(bars).toHaveLength(112);
    expect(bars.reduce((a, b) => a + b.width * b.height, 0)).toBe(1080 * 1920);
    expect(Math.max(...bars.map((b) => b.x + b.width))).toBe(1080);
  });
  it('mask size is capped at 256 px', () => {
    expect(maskSize(1080, 1920)).toEqual({ width: 144, height: 256 });
    expect(maskSize(120, 200)).toEqual({ width: 120, height: 200 });
  });
});

describe('buildForegroundMask', () => {
  it('finds the dark subject on a light background', () => {
    const mask = buildForegroundMask(subject, 50);
    const fg = mask.sat[mask.sat.length - 1];
    expect(fg).toBeGreaterThan(RECT.w * RECT.h * 0.85);
    expect(fg).toBeLessThan(RECT.w * RECT.h * 1.15);
  });
});

describe('selectStrokeBars', () => {
  const mask = buildForegroundMask(subject, 50);

  it('REMOVE BACK keeps bars on the subject, REMOVE FRONT the rest', () => {
    const back = selectStrokeBars(subject, mask, grid, 0, false);
    const front = selectStrokeBars(subject, mask, grid, 0, true);
    expect(back.length).toBeGreaterThan(0);
    for (const bar of back) expect(overlap(bar, RECT)).toBeGreaterThanOrEqual(0.4);
    for (const bar of front) expect(overlap(bar, RECT)).toBeLessThanOrEqual(0.6);
    expect(back.length + front.length).toBe(grid.cols * grid.rows);
  });

  it('THRESHOLD removes that share of candidates (max 90 %)', () => {
    const all = selectStrokeBars(subject, mask, grid, 0, true).length;
    expect(selectStrokeBars(subject, mask, grid, 50, true)).toHaveLength(all - Math.floor(all * 0.5));
    expect(selectStrokeBars(subject, mask, grid, 100, true)).toHaveLength(all - Math.floor(all * 0.9));
  });

  it('is deterministic', () => {
    expect(selectStrokeBars(subject, mask, grid, 35, false)).toEqual(selectStrokeBars(subject, mask, grid, 35, false));
  });

  it('survives degenerate images', () => {
    const flat = image(80, 80, 128);
    const flatMask = buildForegroundMask(flat, 50);
    const flatGrid = barGrid(80, 80, 10, 0);
    expect(selectStrokeBars(flat, flatMask, flatGrid, 0, false)).toEqual([]);
    expect(selectStrokeBars(flat, flatMask, flatGrid, 0, true)).toHaveLength(flatGrid.cols * flatGrid.rows);

    const dot = image(1, 1, 200);
    const dotMask = buildForegroundMask(dot, 50);
    expect(dotMask.sat).toHaveLength(4);
    expect(() => selectStrokeBars(dot, dotMask, barGrid(1, 1, 25, 0), 35, false)).not.toThrow();

    const clear = image(40, 40, 0, undefined, 0);
    const clearMask = buildForegroundMask(clear, 50);
    expect(Number.isNaN(clearMask.sat[clearMask.sat.length - 1])).toBe(false);
  });
});
