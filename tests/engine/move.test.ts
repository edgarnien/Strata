import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEPTH_MIN, depthScale } from '../../src/engine/move';
import { renderFrame, type ImageLayer, type Scene } from '../../src/engine/render';
import type { Settings } from '../../src/engine/types';
import { TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

// The colour swatch for leading-edge accents is a small OffscreenCanvas, which Node lacks.
class FakeCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const g = globalThis as { OffscreenCanvas?: unknown };
const real = g.OffscreenCanvas;
beforeAll(() => { g.OffscreenCanvas = FakeCanvas; });
afterAll(() => { g.OffscreenCanvas = real; });

const layer = (id: string): ImageLayer => ({
  bitmap: fakeImage(id),
  strokeBars: testBars().filter((_, i) => i % 2 === 0),
  gridBars: testBars(),
});
const scene = (s: Partial<Settings>, ids = ['a', 'b']): Scene =>
  ({ width: 100, height: 300, fit: 'cover', seed: 7, layers: ids.map(layer), settings: { ...TEST_SETTINGS, ...s } });
const scales = (calls: string[]) => calls.filter((c) => c.startsWith('scale ')).map((c) => Number(c.split(' ')[1]));

describe('depthScale', () => {
  it('moves the clip back to DEPTH_MIN and rests at both ends', () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(1)).toBeCloseTo(DEPTH_MIN);
    expect(depthScale(0.01)).toBeGreaterThan(0.999);
    expect(depthScale(0.99)).toBeLessThan(DEPTH_MIN + 0.001);
  });
});

describe('MOVE DEPTH, whole picture', () => {
  const sc = scene({ move: 'depth' });

  it('starts at rest: the clip full-size, no strokes yet', () => {
    const calls = record((ctx) => renderFrame(ctx, sc, 0));
    expect(scales(calls).every((k) => k === 1)).toBe(true);
    expect(calls.some((c) => c.startsWith('drawImage a'))).toBe(true);
    expect(count(calls, 'rect ')).toBe(0);
  });

  it('shrinks the current clip while the next one builds in front, with colour accents at the edge', () => {
    const calls = record((ctx) => renderFrame(ctx, sc, 3));
    expect(scales(calls)[0]).toBeLessThan(0.9);
    expect(count(calls, 'drawImage b')).toBeGreaterThan(0);
    expect(count(calls, 'drawImage undefined')).toBeGreaterThan(0); // the colour swatch
  });

  it('ends with the next clip filling the frame, which is where the next cycle starts', () => {
    const end = record((ctx) => renderFrame(ctx, sc, 6 - 1e-4));
    expect(end.filter((c) => c.startsWith('drawImage b')).at(-1)).toMatch(/1\.000$/);
    expect(count(end, 'rect ')).toBeGreaterThanOrEqual(99);
    const next = record((ctx) => renderFrame(ctx, sc, 6));
    expect(scales(next).every((k) => k === 1)).toBe(true);
    expect(next.some((c) => c.startsWith('drawImage b'))).toBe(true);
    expect(count(next, 'rect ')).toBe(0);
  });

  it('IMG MASK leaves out the colour accents', () => {
    const calls = record((ctx) => renderFrame(ctx, scene({ move: 'depth', imgMask: true }), 3));
    expect(count(calls, 'drawImage undefined')).toBe(0);
  });
});

describe('MOVE DEPTH, strokes only', () => {
  it('keeps the photo still and moves the strokes, which sit in place at their peak', () => {
    const strokesOnly = scene({ move: 'depth', moveStrokes: true }, ['a']);
    const still = scene({}, ['a']);
    const sorted = (calls: string[]) => [...calls].sort();
    expect(sorted(record((ctx) => renderFrame(ctx, strokesOnly, 3)))).toEqual(sorted(record((ctx) => renderFrame(ctx, still, 3))));
    const rising = record((ctx) => renderFrame(ctx, strokesOnly, 1.5));
    expect(rising).not.toEqual(record((ctx) => renderFrame(ctx, still, 1.5)));
    expect(count(rising, 'scale ')).toBe(0);
    expect(rising[2]).toBe(record((ctx) => renderFrame(ctx, still, 1.5))[2]); // the photo, untouched
  });
});

describe('MOVE SLIDE, whole picture', () => {
  it('rests at the start and ends on the next clip in place', () => {
    const sc = scene({ move: 'slide' });
    expect(count(record((ctx) => renderFrame(ctx, sc, 0)), 'rect ')).toBe(0);
    const end = record((ctx) => renderFrame(ctx, sc, 6 - 1e-4));
    expect(end.filter((c) => c.startsWith('translate')).at(-1)).toBe('translate 0.00 0.00');
  });
});

describe('MOVE builds from the inside out', () => {
  // Test grid: 10 × 10 bars of 10 × 30 in a 100 × 300 frame; the outer ring is columns / rows 0 and 9.
  // SLIDE with strokes only shifts the outlines sideways, so there only the top and bottom rows count.
  const onRim = (c: string, rowsOnly: boolean) => {
    const [, x, y] = c.split(' ').map(Number);
    return y === 0 || y === 270 || (!rowsOnly && (x === 0 || x === 90));
  };
  for (const [move, moveStrokes] of [['depth', false], ['slide', false], ['slide', true]] as const) {
    it(`${move}${moveStrokes ? ' (strokes)' : ''} leaves the edge of the frame for the end`, () => {
      const sc = scene({ move, moveStrokes });
      const middle = record((ctx) => renderFrame(ctx, sc, moveStrokes ? 1.5 : 3)).filter((c) => c.startsWith('rect '));
      expect(middle.length).toBeGreaterThan(20);
      expect(middle.filter((c) => onRim(c, moveStrokes))).toEqual([]);
      const end = record((ctx) => renderFrame(ctx, sc, moveStrokes ? 2.99 : 5.99)).filter((c) => c.startsWith('rect '));
      expect(end.filter((c) => onRim(c, moveStrokes)).length).toBeGreaterThan(moveStrokes ? 8 : 20);
    });
  }
});
