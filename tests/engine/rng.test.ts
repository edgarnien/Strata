import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, rngFor, shuffled } from '../../src/engine/rng';

const take = (rng: () => number, n: number) => Array.from({ length: n }, rng);

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(take(mulberry32(42), 5)).toEqual(take(mulberry32(42), 5));
  });
  it('differs for different seeds', () => {
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
  });
  it('stays in [0, 1)', () => {
    for (const v of take(mulberry32(7), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed / rngFor', () => {
  it('is order-sensitive', () => {
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });
  it('rngFor is deterministic per argument list', () => {
    expect(take(rngFor(9, 3, 1), 3)).toEqual(take(rngFor(9, 3, 1), 3));
    expect(take(rngFor(9, 3, 1), 3)).not.toEqual(take(rngFor(9, 4, 1), 3));
  });
});

describe('shuffled', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  it('returns a permutation without touching the input', () => {
    const out = shuffled(items, mulberry32(5));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
    expect(out).not.toEqual(items);
  });
  it('is deterministic for the same rng seed', () => {
    expect(shuffled(items, mulberry32(5))).toEqual(shuffled(items, mulberry32(5)));
  });
});
