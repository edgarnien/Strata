import { describe, expect, it } from 'vitest';
import { barOrder } from '../../src/engine/strokes';
import { barKey, testBars } from './helpers';

const look = { strokeBars: testBars().filter((_, i) => i % 2 === 0), gridBars: testBars() };

describe('barOrder', () => {
  it('puts the look first and, with whole, the rest of the grid after it', () => {
    const o = barOrder(look, true, 1, 0);
    expect(o.lead).toBe(50);
    expect(o.bars).toHaveLength(100);
    const lookKeys = new Set(look.strokeBars.map(barKey));
    expect(o.bars.slice(0, 50).every((b) => lookKeys.has(barKey(b)))).toBe(true);
    expect(barOrder(look, false, 1, 0).bars).toHaveLength(50);
  });
  it('is stable per seed and salt and differs between salts', () => {
    const a = barOrder(look, true, 1, 0).bars.map(barKey);
    expect(barOrder(look, true, 1, 0).bars.map(barKey)).toEqual(a);
    expect(barOrder(look, true, 1, 1).bars.map(barKey)).not.toEqual(a);
  });
});
