import { describe, expect, it } from 'vitest';
import { cycleDuration, frameCount, positionAt, totalDuration } from '../../src/engine/timeline';

describe('durations', () => {
  it('cycle is 6 s divided by speed', () => {
    expect(cycleDuration(1)).toBe(6);
    expect(cycleDuration(2)).toBe(3);
  });
  it('total = loops × images × cycle', () => {
    expect(totalDuration({ imageCount: 1, loops: 2, speed: 1 })).toBe(12);
    expect(totalDuration({ imageCount: 3, loops: 2, speed: 1 })).toBe(36);
    expect(totalDuration({ imageCount: 1, loops: 3, speed: 2 })).toBe(9);
    expect(totalDuration({ imageCount: 1, loops: 1, speed: 10 })).toBeCloseTo(0.6);
    expect(totalDuration({ imageCount: 0, loops: 2, speed: 1 })).toBe(0);
  });
  it('frameCount rounds up to whole frames at 30 fps', () => {
    expect(frameCount(12)).toBe(360);
    expect(frameCount(totalDuration({ imageCount: 1, loops: 1, speed: 10 }))).toBe(18);
    expect(frameCount(1.01)).toBe(31);
  });
});

describe('positionAt', () => {
  const three = { imageCount: 3, loops: 2, speed: 1 };
  it('starts at the first clip', () => {
    expect(positionAt(0, three)).toEqual({ cycle: 0, imageIndex: 0, nextImageIndex: 1, progress: 0, frameIndex: 0 });
  });
  it('walks through the clips cycle by cycle and wraps', () => {
    const p = positionAt(13, three);
    expect(p.cycle).toBe(2);
    expect(p.imageIndex).toBe(2);
    expect(p.nextImageIndex).toBe(0);
    expect(p.progress).toBeCloseTo(1 / 6);
    expect(positionAt(18.5, three).imageIndex).toBe(0);
  });
  it('hits exact cycle boundaries on 30 fps frame times', () => {
    const p = positionAt(180 / 30, three);
    expect(p.cycle).toBe(1);
    expect(p.progress).toBe(0);
    expect(positionAt(5 / 30, three).frameIndex).toBe(5);
  });
  it('clamps t to the last frame instead of overflowing', () => {
    const p = positionAt(999, three);
    expect(p.cycle).toBe(5);
    expect(p.progress).toBeLessThan(1);
  });
  it('treats zero images like one', () => {
    expect(positionAt(1, { imageCount: 0, loops: 1, speed: 1 }).imageIndex).toBe(0);
  });
});
