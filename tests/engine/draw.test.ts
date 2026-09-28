import { describe, expect, it } from 'vitest';
import { barNoise, clipDraw, drawFitted, fillBars } from '../../src/engine/draw';
import { fakeImage, record, testBars } from './helpers';

describe('drawFitted', () => {
  it('cover crops the wider source to the target aspect, centred', () => {
    expect(record((ctx) => drawFitted(ctx, fakeImage('a', 200, 100), 100, 100, 'cover'))).toEqual([
      'drawImage a 50.00 0.00 100.00 100.00 0.00 0.00 100.00 100.00 1.000',
    ]);
  });
  it('contain letterboxes the source inside the target', () => {
    expect(record((ctx) => drawFitted(ctx, fakeImage('a', 200, 100), 100, 100, 'contain'))).toEqual([
      'drawImage a 0.00 25.00 100.00 50.00 1.000',
    ]);
  });
});

describe('fillBars / clipDraw', () => {
  it('fills only the first `count` bars', () => {
    expect(record((ctx) => fillBars(ctx, testBars(), '#FF0000', 3))).toEqual([
      'fillRect 0 0 10 30 #FF0000 1.000',
      'fillRect 0 30 10 30 #FF0000 1.000',
      'fillRect 0 60 10 30 #FF0000 1.000',
    ]);
  });
  it('clipDraw is a no-op without bars', () => {
    expect(record((ctx) => clipDraw(ctx, [], fakeImage('n'), 100, 300, 'cover'))).toEqual([]);
  });
  it('clipDraw clips to the bars, then draws the image once', () => {
    const calls = record((ctx) => clipDraw(ctx, testBars(1, 2), fakeImage('n'), 100, 300, 'cover'));
    expect(calls[0]).toBe('save');
    expect(calls.slice(1, 4)).toEqual(['beginPath', 'rect 0 0 10 30', 'rect 0 30 10 30']);
    expect(calls[4]).toBe('clip');
    expect(calls[5]).toMatch(/^drawImage n /);
    expect(calls[6]).toBe('restore');
  });
});

describe('barNoise', () => {
  it('is stable and in [0, 1)', () => {
    for (const bar of testBars(20, 20)) {
      const v = barNoise(bar);
      expect(v).toBe(barNoise({ ...bar }));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
