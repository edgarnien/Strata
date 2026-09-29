import { describe, expect, it } from 'vitest';
import { renderFrame, renderStill, sceneDuration, type ImageLayer, type Scene } from '../../src/engine/render';
import type { Settings } from '../../src/engine/types';
import { RecordingCtx, TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

const layer = (id: string): ImageLayer => ({
  bitmap: fakeImage(id),
  strokeBars: testBars().filter((_, i) => i % 2 === 0),
  gridBars: testBars(),
});

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

  it('paints black, then the current clip, then the motion', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(), 1.5));
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

  it('is deterministic per seed and changes with it', () => {
    const one = record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5));
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5))).toEqual(one);
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 2), 1.5))).not.toEqual(one);
  });

  it('does nothing without clips', () => {
    expect(renderFrame(new RecordingCtx().asCtx(), scene([]), 0)).toBe(-1);
  });
});

describe('renderStill', () => {
  it('draws every stroke bar of the selected clip in the stroke colour', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b'], { color: '#FF0000' }), 1));
    expect(calls[2]).toMatch(/^drawImage b /);
    expect(count(calls, 'rect ')).toBe(50);
    expect(calls.at(-1)).toBe('fill #FF0000 1.000');
  });
  it('IMG MASK shows the next clip behind the strokes', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b'], { imgMask: true }), 0));
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(calls[2]).toMatch(/^drawImage b /);
  });
});
