import { describe, expect, it } from 'vitest';
import { buildUp } from '../../src/engine/motions/buildUp';
import { fade } from '../../src/engine/motions/fade';
import { reveal } from '../../src/engine/motions/reveal';
import { RecordingCtx, count, frame, record } from './helpers';

describe('BUILD UP', () => {
  const fills = (progress: number) => count(record((ctx) => buildUp.draw(ctx, frame({ progress }))), 'fillRect');
  it('rises to all bars at half-cycle and falls back symmetrically', () => {
    expect(fills(0)).toBe(0);
    expect(fills(0.25)).toBe(50);
    expect(fills(0.5)).toBe(100);
    expect(fills(0.75)).toBe(50);
  });
  it('IMG MASK reveals the next image through progress × bars', () => {
    const calls = record((ctx) => buildUp.draw(ctx, frame({ progress: 0.3, imgMask: true })));
    expect(count(calls, 'rect ')).toBe(30);
    expect(count(calls, 'drawImage next')).toBe(1);
    expect(count(calls, 'fillRect')).toBe(0);
  });
});

describe('FADE', () => {
  it('is fully in at half-cycle and gone at the end', () => {
    const mid = record((ctx) => fade.draw(ctx, frame({ progress: 0.5 })));
    expect(mid.filter((c) => c.startsWith('fillRect') && c.endsWith('1.000'))).toHaveLength(100);
    expect(count(record((ctx) => fade.draw(ctx, frame({ progress: 0.999 }))), 'fillRect')).toBe(0);
  });
  it('restores globalAlpha', () => {
    const r = new RecordingCtx();
    fade.draw(r.asCtx(), frame({ progress: 0.3 }));
    expect(r.globalAlpha).toBe(1);
  });
});

describe('REVEAL', () => {
  it('fills every bar and clears the first half at progress 0.25', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25 })));
    expect(count(calls, 'fillRect')).toBe(100);
    expect(count(calls, 'drawImage cur')).toBe(50);
  });
  it('IMG MASK lets the next image appear bar by bar', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25, imgMask: true })));
    expect(count(calls, 'drawImage next')).toBe(50);
    expect(count(calls, 'fillRect')).toBe(0);
  });
});

describe('determinism', () => {
  for (const motion of [buildUp, fade, reveal]) {
    it(`${motion.label} draws identically for identical input`, () => {
      const f = frame({ progress: 0.37 });
      expect(record((ctx) => motion.draw(ctx, f))).toEqual(record((ctx) => motion.draw(ctx, f)));
    });
  }
});
