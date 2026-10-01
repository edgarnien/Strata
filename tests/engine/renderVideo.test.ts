import { describe, expect, it } from 'vitest';
import { lookFrames, renderVideoFrame, videoPosition, type VideoFrames, type VideoProjectScene } from '../../src/engine/renderVideo';
import type { Settings } from '../../src/engine/types';
import { layout, type VideoTimelineInput } from '../../src/engine/videoTimeline';
import { TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

const even = { strokeBars: testBars().filter((_, i) => i % 2 === 0), gridBars: testBars() };
const odd = { strokeBars: testBars().filter((_, i) => i % 2 === 1), gridBars: testBars() };
const keys = (bars: { x: number; y: number }[]) => bars.map((b) => `${b.x},${b.y}`).sort();
const rects = (calls: string[]) => calls.filter((c) => c.startsWith('rect ')).map((c) => c.split(' ').slice(1, 3).join(',')).sort();

function scene(over: Partial<VideoTimelineInput> = {}, s: Partial<Settings> = {}): VideoProjectScene {
  const input: VideoTimelineInput = {
    clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5,
    imgMask: false, intro: false, outro: false, ...over,
  };
  return {
    width: 100, height: 300, fit: 'cover', seed: 7, settings: { ...TEST_SETTINGS, ...s },
    layout: layout(input), looks: { intro: even, outro: odd, transitions: [{ before: even, after: odd }] },
  };
}
const plain: VideoFrames = { shot: fakeImage('a'), next: null };
const draw = (sc: VideoProjectScene, t: number, frames = plain) => record((ctx) => renderVideoFrame(ctx, sc, videoPosition(sc, t), frames));

describe('renderVideoFrame', () => {
  it('draws only the video away from a cut', () => {
    const calls = draw(scene(), 1);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toMatch(/^drawImage a /);
  });
  it('covers the whole frame on the cut', () => {
    expect(count(draw(scene(), 3), 'rect ')).toBe(100);
  });
  it('builds up from the look before the cut and falls away into the look after it', () => {
    expect(rects(draw(scene(), 2.75))).toEqual(keys(even.strokeBars));
    expect(rects(draw(scene(), 3.25))).toEqual(keys(odd.strokeBars));
  });
  it('IMG MASK draws the next shot inside the bars', () => {
    const calls = draw(scene({ imgMask: true }), 2.5, { shot: fakeImage('a'), next: fakeImage('b') });
    expect(count(calls, 'drawImage b')).toBe(1);
    expect(count(calls, 'clip')).toBe(1);
  });
  it('starts covered with an intro and ends covered with an outro', () => {
    const sc = scene({ intro: true, outro: true });
    expect(count(draw(sc, 0), 'rect ')).toBe(100);
    expect(count(draw(sc, sc.layout.duration - 1 / 30), 'rect ')).toBe(100);
  });
  it('is deterministic per seed', () => {
    expect(draw(scene(), 2.8)).toEqual(draw(scene(), 2.8));
  });
});

describe('lookFrames', () => {
  it('reads each look right at its cut: the last frame before it and the first after it', () => {
    const f = lookFrames(layout({ clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5, imgMask: false, intro: true, outro: false }));
    expect(f.intro).toEqual({ clipId: 'a', time: 0 });
    expect(f.outro).toBeNull();
    expect(f.transitions).toHaveLength(1);
    expect(f.transitions[0].before.clipId).toBe('a');
    expect(f.transitions[0].before.time).toBeCloseTo(2.999, 9);
    expect(f.transitions[0].after).toEqual({ clipId: 'b', time: 0 });
  });
});
