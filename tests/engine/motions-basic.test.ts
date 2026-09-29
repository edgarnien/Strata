import { describe, expect, it } from 'vitest';
import { buildUp } from '../../src/engine/motions/buildUp';
import { fade } from '../../src/engine/motions/fade';
import { fillBars } from '../../src/engine/draw';
import { reveal } from '../../src/engine/motions/reveal';
import { RecordingCtx, count, coverage, frame, record } from './helpers';

describe('BUILD UP', () => {
  const fills = (progress: number) => count(record((ctx) => buildUp.draw(ctx, frame({ progress }))), 'rect ');
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
  it('is fully in at half-cycle, as one seamless path, and gone at the end', () => {
    const mid = record((ctx) => fade.draw(ctx, frame({ progress: 0.5 })));
    expect(count(mid, 'rect ')).toBe(100);
    expect(mid.filter((c) => c.startsWith('fill '))).toEqual(['fill #FFFFFF 1.000']);
    expect(count(mid, 'fillRect')).toBe(0);
    expect(coverage((ctx) => fade.draw(ctx, frame({ progress: 0.999 })), 100)).toBeLessThan(0.01);
  });
  it('draws only the bars still fading one by one', () => {
    const calls = record((ctx) => fade.draw(ctx, frame({ progress: 0.3 })));
    expect(count(calls, 'fillRect')).toBe(20); // the fade zone: a fifth of the bars
    expect(count(calls, 'fill ')).toBe(1);
  });
  it('restores globalAlpha', () => {
    const r = new RecordingCtx();
    fade.draw(r.asCtx(), frame({ progress: 0.3 }));
    expect(r.globalAlpha).toBe(1);
  });
});

describe('REVEAL', () => {
  it('fills every bar and clears about half of them at progress 0.25', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25 })));
    expect(calls.slice(0, 102)).toEqual(record((ctx) => fillBars(ctx, frame().bars, '#FFFFFF')));
    expect(coverage((ctx) => reveal.draw(ctx, frame({ progress: 0.25 })), 100)).toBeCloseTo(0.5, 1);
  });
  it('clears the fully revealed bars with one image draw', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25 })));
    const partial = calls.filter((c) => c.startsWith('drawImage cur') && !c.endsWith('1.000'));
    expect(count(calls, 'drawImage cur')).toBe(partial.length + 1);
  });
  it('IMG MASK lets the next image appear bar by bar, all of it just before the cycle ends', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.999, imgMask: true })));
    expect(count(calls, 'rect ')).toBe(100);
    expect(calls.filter((c) => c.startsWith('drawImage'))).toEqual([
      'drawImage next 0.00 0.00 100.00 300.00 0.00 0.00 100.00 300.00 1.000',
    ]);
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
