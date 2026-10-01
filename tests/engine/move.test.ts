import { describe, expect, it } from 'vitest';
import { ease } from '../../src/engine/move';
import { renderFrame, type ImageLayer, type Scene } from '../../src/engine/render';
import type { MoveId, Settings } from '../../src/engine/types';
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

for (const move of ['depth', 'slide'] as MoveId[]) {
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
