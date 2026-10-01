import { describe, expect, it } from 'vitest';
import { ease } from '../../src/engine/move';
import { renderFrame, type ImageLayer, type Scene } from '../../src/engine/render';
import { MOVE_IDS, type Settings } from '../../src/engine/types';
import { TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

const layer = (id: string): ImageLayer => ({
  bitmap: fakeImage(id),
  strokeBars: testBars().filter((_, i) => i % 2 === 0),
  gridBars: testBars(),
});
const scene = (s: Partial<Settings>, ids = ['a', 'b']): Scene =>
  ({ width: 100, height: 300, fit: 'cover', seed: 7, layers: ids.map(layer), settings: { ...TEST_SETTINGS, ...s } });
const sorted = (calls: string[]) => [...calls].sort();
const photo = (calls: string[]) => calls.filter((c) => c.startsWith('drawImage')).slice(0, 1);

describe('ease', () => {
  it('rests at both ends', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.01)).toBeLessThan(0.001);
    expect(ease(0.99)).toBeGreaterThan(0.999);
  });
});

it('offers the stroke moves', () => {
  expect(MOVE_IDS).toEqual(['off', 'depth', 'slide', 'step', 'cascade', 'zipper', 'comb']);
});

for (const move of MOVE_IDS.filter((m) => m !== 'off')) {
  describe(`MOVE ${move.toUpperCase()}`, () => {
    it('moves only the strokes; the photo stays where it is', () => {
      const moving = record((ctx) => renderFrame(ctx, scene({ move }), 1.5));
      const still = record((ctx) => renderFrame(ctx, scene({}), 1.5));
      expect(photo(moving)).toEqual(photo(still));
      expect(count(moving, 'scale ') + count(moving, 'translate ')).toBe(0);
      expect(sorted(moving)).not.toEqual(sorted(still));
    });

    it('puts the strokes in place where they are complete, so the look and the hand-over stay put', () => {
      const peak = (s: Partial<Settings>) => sorted(record((ctx) => renderFrame(ctx, scene(s, ['a']), 3)));
      expect(peak({ move })).toEqual(peak({}));
      const handover = (s: Partial<Settings>) => sorted(record((ctx) => renderFrame(ctx, scene(s), 3)));
      expect(handover({ move })).toEqual(handover({}));
    });

    it('works with IMG MASK too', () => {
      const moving = record((ctx) => renderFrame(ctx, scene({ move, imgMask: true }), 3));
      const still = record((ctx) => renderFrame(ctx, scene({ imgMask: true }), 3));
      expect(photo(moving)).toEqual(photo(still));
      expect(sorted(moving)).not.toEqual(sorted(still));
    });
  });
}

describe('grid moves stay on the grid', () => {
  // Test grid: bars of 10 × 30 – every outline must sit on that grid, at full size, in every frame,
  // so bars only ever meet corner on corner.
  const cells = (rects: string[]) => rects.map((r) => r.split(' ').slice(1).map(Number));
  for (const move of ['step', 'cascade', 'zipper', 'comb'] as const) {
    it(`${move.toUpperCase()} keeps every bar on the grid and visibly moves it`, () => {
      let farthest = 0;
      for (let t = 0.1; t < 6; t += 0.37) {
        const rects = record((ctx) => renderFrame(ctx, scene({ move }), t)).filter((c) => c.startsWith('rect '));
        const still = new Set(record((ctx) => renderFrame(ctx, scene({}), t)).filter((c) => c.startsWith('rect ')));
        for (const [x, y, w, h] of cells(rects)) {
          expect([Math.abs(x % 10), Math.abs(y % 30), w, h]).toEqual([0, 0, 10, 30]); // bars may sit beyond the frame
        }
        farthest = Math.max(farthest, rects.filter((r) => !still.has(r)).length / Math.max(1, rects.length));
      }
      expect(farthest).toBeGreaterThan(0.5); // at some point most visible bars are away from their place
    });
  }

  it('STEP and ZIPPER shift sideways, CASCADE and COMB up and down', () => {
    const at = (move: 'step' | 'cascade' | 'zipper' | 'comb') =>
      record((ctx) => renderFrame(ctx, scene({ move }), 0.9)).filter((c) => c.startsWith('rect '));
    const still = record((ctx) => renderFrame(ctx, scene({}), 0.9)).filter((c) => c.startsWith('rect '));
    const xs = (rects: string[]) => rects.map((r) => r.split(' ')[1]).sort().join();
    const ys = (rects: string[]) => rects.map((r) => r.split(' ')[2]).sort().join();
    expect(ys(at('step'))).toBe(ys(still));
    expect(ys(at('zipper'))).toBe(ys(still));
    expect(xs(at('comb'))).toBe(xs(still));
    expect(xs(at('cascade'))).toBe(xs(still));
  });
});

it('COMB moves neighbouring columns in opposite directions', () => {
  const rects = record((ctx) => renderFrame(ctx, scene({ move: 'comb' }), 0.9)).filter((c) => c.startsWith('rect '));
  const still = record((ctx) => renderFrame(ctx, scene({}), 0.9)).filter((c) => c.startsWith('rect '));
  const shiftOf = (x: number) => {
    const moved = rects.filter((r) => Number(r.split(' ')[1]) === x).map((r) => Number(r.split(' ')[2]));
    const placed = still.filter((r) => Number(r.split(' ')[1]) === x).map((r) => Number(r.split(' ')[2]));
    return Math.sign(Math.min(...moved) - Math.min(...placed));
  };
  const signs = [0, 10, 20, 30].map(shiftOf).filter((v) => Number.isFinite(v) && v !== 0);
  expect(new Set(signs).size).toBe(2);
});
