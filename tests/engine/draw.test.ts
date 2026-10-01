import { describe, expect, it } from 'vitest';
import { barNoise, clipDraw, drawFitted, fillBars, sourceSize } from '../../src/engine/draw';
import type { DrawSource } from '../../src/engine/types';
import { fakeImage, record, testBars } from './helpers';

describe('sourceSize', () => {
  it('reads a video element by its intrinsic size and a video frame by its display size', () => {
    expect(sourceSize({ videoWidth: 1920, videoHeight: 1080, width: 0, height: 0 } as unknown as DrawSource)).toEqual({ width: 1920, height: 1080 });
    expect(sourceSize({ displayWidth: 1080, displayHeight: 1920, codedWidth: 1920 } as unknown as DrawSource)).toEqual({ width: 1080, height: 1920 });
    expect(sourceSize(fakeImage('a', 200, 100))).toEqual({ width: 200, height: 100 });
  });
  it('drawFitted crops a video by its intrinsic size, not its element size', () => {
    const video = { id: 'v', videoWidth: 200, videoHeight: 100, width: 0, height: 0 } as unknown as DrawSource;
    expect(record((ctx) => drawFitted(ctx, video, 100, 100, 'cover'))).toEqual([
      'drawImage v 50.00 0.00 100.00 100.00 0.00 0.00 100.00 100.00 1.000',
    ]);
  });
});

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
  it('fills the first `count` bars as one path, so shared edges get no anti-aliased seam', () => {
    expect(record((ctx) => fillBars(ctx, testBars(), '#FF0000', 3))).toEqual([
      'beginPath',
      'rect 0 0 10 30',
      'rect 0 30 10 30',
      'rect 0 60 10 30',
      'fill #FF0000 1.000',
    ]);
  });
  it('fillBars is a no-op without bars', () => {
    expect(record((ctx) => fillBars(ctx, testBars(), '#FF0000', 0))).toEqual([]);
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
