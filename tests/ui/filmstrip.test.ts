import { describe, expect, it } from 'vitest';
import { stripTiles } from '../../src/ui/filmstrip';

describe('stripTiles', () => {
  it('fills the clip with frames at their own aspect, spread over the whole clip', () => {
    // 9:16 frames, 44 px high → 24.75 px wide; a 100 px clip needs 5 tiles.
    const t = stripTiles(100, 44, 10, 9 / 16);
    expect(t.tileWidth).toBeCloseTo(24.75, 9);
    expect(t.frames).toEqual([1, 3, 5, 7, 9]);
  });
  it('shows at least one frame and never asks for frames the strip lacks', () => {
    expect(stripTiles(4, 44, 3, 16 / 9).frames).toEqual([1]);
    expect(stripTiles(2000, 44, 3, 1).frames.every((f) => f >= 0 && f < 3)).toBe(true);
  });
});
