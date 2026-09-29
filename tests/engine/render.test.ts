import { describe, expect, it } from 'vitest';
import { imgMaskOn, renderFrame, renderStill, sceneDuration, type ImageLayer, type Scene } from '../../src/engine/render';
import type { Settings } from '../../src/engine/types';
import { RecordingCtx, TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

// Clip b has a different look (odd bars) from a and c (even bars).
const layer = (id: string): ImageLayer => ({
  bitmap: fakeImage(id),
  strokeBars: testBars().filter((_, i) => i % 2 === (id === 'b' ? 1 : 0)),
  gridBars: testBars(),
});

/** "x,y" of every bar outline in the calls, sorted. */
const rects = (calls: string[]) => calls.filter((c) => c.startsWith('rect ')).map((c) => c.split(' ').slice(1, 3).join(',')).sort();
const lookOf = (id: string) => rects(layer(id).strokeBars.map((b) => `rect ${b.x} ${b.y}`));
/** The calls of the stroke fill (one path). */
const strokes = (calls: string[]) => calls.slice(calls.indexOf('beginPath'), calls.findIndex((c) => c.startsWith('fill ')) + 1);

function scene(ids = ['a', 'b', 'c'], s: Partial<Settings> = {}, seed = 7): Scene {
  return { width: 100, height: 300, fit: 'cover', seed, layers: ids.map(layer), settings: { ...TEST_SETTINGS, ...s } };
}

describe('renderFrame', () => {
  it('shows the clip that the timeline selects', () => {
    const sc = scene();
    const at = (t: number) => renderFrame(new RecordingCtx().asCtx(), sc, t);
    expect(at(0)).toBe(0);
    expect(at(6.5)).toBe(1);
    expect(at(13)).toBe(2);
    expect(sceneDuration(sc)).toBe(18);
  });

  it('marks the clip that is on screen once colour strokes hand over to it', () => {
    const at = (t: number) => renderFrame(new RecordingCtx().asCtx(), scene(), t);
    expect(at(2.9)).toBe(0);
    expect(at(3.5)).toBe(1);
    expect(at(16)).toBe(0); // the last clip hands back to the first
  });

  it('paints black, then the current clip, then the motion', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(['a']), 1.5));
    expect(calls[0]).toBe('clearRect 0 0 100 300');
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(calls[2]).toMatch(/^drawImage a /);
    expect(count(calls, 'rect ')).toBe(25); // BUILD UP at p = 0.25 → half of 50 stroke bars
  });

  it('ignores IMG MASK with a single clip', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(['a'], { imgMask: true }), 1.5));
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(count(calls, 'clip')).toBe(0);
  });

  it('IMG MASK with several clips reveals the next clip over the current one', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(['a', 'b'], { imgMask: true }), 3));
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(calls[2]).toMatch(/^drawImage a /);
    expect(count(calls, 'drawImage b')).toBe(1);
  });

  it('IMG MASK shows the next clip in the look first, then everywhere', () => {
    const sc = scene(['a', 'b'], { imgMask: true });
    expect(rects(record((ctx) => renderFrame(ctx, sc, 3)))).toEqual(lookOf('a')); // halfway: the look (50 of 100 bars)
    expect(count(record((ctx) => renderFrame(ctx, sc, 5.99)), 'rect ')).toBe(99);
  });

  it('is deterministic per seed and changes with it', () => {
    const one = record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5));
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5))).toEqual(one);
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 2), 1.5))).not.toEqual(one);
  });

  it('does nothing without clips', () => {
    expect(renderFrame(new RecordingCtx().asCtx(), scene([]), 0)).toBe(-1);
  });
});

describe('a single clip', () => {
  it('only ever reaches its look', () => {
    const peak = record((ctx) => renderFrame(ctx, scene(['a']), 3));
    expect(peak[2]).toMatch(/^drawImage a /);
    expect(rects(peak)).toEqual(lookOf('a'));
  });
});

describe('several clips with colour strokes', () => {
  it('pass the look, then cover the whole frame', () => {
    expect(rects(record((ctx) => renderFrame(ctx, scene(), 1.5)))).toEqual(lookOf('a'));
    expect(count(record((ctx) => renderFrame(ctx, scene(), 2.99)), 'rect ')).toBe(99);
  });

  it('hand over to the next clip under full cover and fall away through its look', () => {
    const full = record((ctx) => renderFrame(ctx, scene(), 3));
    expect(full[2]).toMatch(/^drawImage b /);
    expect(count(full, 'rect ')).toBe(100);
    const half = record((ctx) => renderFrame(ctx, scene(), 4.5));
    expect(half[2]).toMatch(/^drawImage b /);
    expect(rects(half)).toEqual(lookOf('b'));
  });

  it('meet the next cycle without a cut, and the last clip loops back to the first', () => {
    const sc = scene();
    expect(record((ctx) => renderFrame(ctx, sc, 6 - 1e-4))).toEqual(record((ctx) => renderFrame(ctx, sc, 6)));
    expect(record((ctx) => renderFrame(ctx, sc, 18 - 1e-4))).toEqual(record((ctx) => renderFrame(ctx, sc, 0)));
  });

  it('REVEAL is covered at the ends of its cycle, so it hands over there', () => {
    const sc = scene(['a', 'b', 'c'], { motion: 'reveal' });
    const end = record((ctx) => renderFrame(ctx, sc, 6 - 1e-4));
    const start = record((ctx) => renderFrame(ctx, sc, 6));
    expect(end[2]).toMatch(/^drawImage a /);
    expect(start[2]).toMatch(/^drawImage b /);
    expect(count(strokes(end), 'rect ')).toBe(100);
    expect(count(strokes(start), 'rect ')).toBe(100);
    expect(renderFrame(new RecordingCtx().asCtx(), sc, 3.5)).toBe(0);
  });
});

describe('renderStill', () => {
  it('draws every stroke bar of the selected clip in the stroke colour', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b'], { color: '#FF0000' }), 1));
    expect(calls[2]).toMatch(/^drawImage b /);
    expect(count(calls, 'rect ')).toBe(50);
    expect(calls.at(-1)).toBe('fill #FF0000 1.000');
  });
  it('IMG MASK shows the next clip inside the look, with no stroke colour', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b', 'c'], { imgMask: true, color: '#FF0000' }), 1));
    expect(calls[2]).toMatch(/^drawImage b /);
    expect(rects(calls)).toEqual(lookOf('b'));
    expect(calls.at(-3)).toBe('clip');
    expect(calls.at(-2)).toMatch(/^drawImage c /);
    expect(calls.some((c) => c.includes('#FF0000'))).toBe(false);
  });
});

describe('imgMaskOn', () => {
  it('needs the setting and a next clip to reveal', () => {
    expect(imgMaskOn({ imgMask: true }, 2)).toBe(true);
    expect(imgMaskOn({ imgMask: true }, 1)).toBe(false);
    expect(imgMaskOn({ imgMask: false }, 3)).toBe(false);
  });
});
