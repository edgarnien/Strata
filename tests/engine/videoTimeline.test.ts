import { describe, expect, it } from 'vitest';
import {
  axisLength, clipAt, dauerLimit, layout, outputTimeOf, shotSpans, validMarkerTime, type VideoTimelineInput,
} from '../../src/engine/videoTimeline';

const clip = (id: string, duration: number) => ({ id, duration });
const mk = (clipId: string, time: number, id = `${clipId}@${time}`) => ({ id, clipId, time });
export const input = (over: Partial<VideoTimelineInput> = {}): VideoTimelineInput => ({
  clips: [clip('a', 3), clip('b', 2)], markers: [], dauer: 0.5, imgMask: false, intro: false, outro: false, ...over,
});

describe('shotSpans', () => {
  it('splits clips at their markers, in play order', () => {
    const spans = shotSpans(input({ clips: [clip('a', 6), clip('b', 2)], markers: [mk('a', 4), mk('a', 2)] }));
    expect(spans.map((s) => [s.clipId, s.sourceStart, s.sourceEnd])).toEqual([
      ['a', 0, 2], ['a', 2, 4], ['a', 4, 6], ['b', 0, 2],
    ]);
  });
  it('ignores markers on the clip edges or outside it', () => {
    expect(shotSpans(input({ clips: [clip('a', 6)], markers: [mk('a', 0), mk('a', 6), mk('a', 7)] }))).toHaveLength(1);
  });
});

describe('layout', () => {
  it('puts colour shots back to back', () => {
    const lay = layout(input());
    expect(lay.shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 5]]);
    expect(lay.duration).toBe(5);
    expect(lay.imgMask).toBe(false);
  });
  it('overlaps shots by 2 · D with IMG MASK', () => {
    const lay = layout(input({ imgMask: true }));
    expect(lay.shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [2, 4]]);
    expect(lay.duration).toBe(4);
  });
  it('ignores IMG MASK without a cut', () => {
    const lay = layout(input({ clips: [clip('a', 3)], imgMask: true }));
    expect(lay.imgMask).toBe(false);
    expect(lay.duration).toBe(3);
  });
  it('snaps cuts to the 30 fps grid', () => {
    const lay = layout(input({ clips: [clip('a', 1.01), clip('b', 1)] }));
    expect(lay.shots[1].start).toBe(1);
    expect(lay.duration).toBe(2);
  });
  it('caps D so a short clip keeps its stroke phases apart', () => {
    expect(layout(input({ clips: [clip('a', 3), clip('b', 0.6), clip('c', 3)] })).dauer).toBeCloseTo(0.3, 9);
  });
  it('flips the lane only where IMG MASK shows two stretches of one clip at once', () => {
    const over = { clips: [clip('a', 6), clip('b', 2)], markers: [mk('a', 2), mk('a', 4)] };
    expect(layout(input({ ...over, imgMask: true })).shots.map((s) => s.lane)).toEqual([0, 1, 0, 0]);
    expect(layout(input(over)).shots.map((s) => s.lane)).toEqual([0, 0, 0, 0]);
  });
});

describe('dauerLimit', () => {
  it('names where the shortest shot starts on the clip axis', () => {
    expect(dauerLimit(input({ clips: [clip('a', 3), clip('b', 0.6)] }))).toEqual({ max: 0.6, axisAt: 3 });
  });
  it('counts intro and outro', () => {
    expect(dauerLimit(input({ clips: [clip('a', 1)], intro: true, outro: true }))).toEqual({ max: 0.5, axisAt: 0 });
  });
  it('is unlimited when nothing needs room', () => {
    expect(dauerLimit(input({ clips: [clip('a', 1)] }))).toEqual({ max: Infinity, axisAt: null });
  });
});

describe('validMarkerTime', () => {
  const one = (over: Partial<VideoTimelineInput> = {}) => input({ clips: [clip('a', 6)], ...over });
  it('snaps to the frame grid', () => {
    expect(validMarkerTime(one(), 'a', 2.013)).toBe(2);
  });
  it('moves away from a cut that is too close', () => {
    // 2.5 would leave a 0.5 s shot between two cuts; it needs 2 · D = 1 s.
    expect(validMarkerTime(one({ markers: [mk('a', 2)] }), 'a', 2.5)).toBe(3);
  });
  it('never returns the time of an existing marker', () => {
    expect(validMarkerTime(one({ markers: [mk('a', 3)] }), 'a', 3)).not.toBe(3);
  });
  it('gives up on a clip with no room and on unknown clips', () => {
    expect(validMarkerTime(input({ clips: [clip('a', 0.9)] }), 'a', 0.45)).toBeNull();
    expect(validMarkerTime(one(), 'zz', 1)).toBeNull();
  });
});

describe('clip axis', () => {
  it('lays clips back to back by source length and maps both ways', () => {
    const clips = [clip('a', 3), clip('b', 2)];
    expect(axisLength(clips)).toBe(5);
    expect(clipAt(clips, 4)).toEqual({ clipId: 'b', time: 1 });
    expect(clipAt(clips, 99)).toEqual({ clipId: 'b', time: 2 });
    expect(clipAt([], 1)).toBeNull();
  });
  it('turns a clip time into output time, also across IMG MASK overlaps', () => {
    expect(outputTimeOf(layout(input()), 'b', 1)).toBe(4);
    expect(outputTimeOf(layout(input({ imgMask: true })), 'b', 1)).toBe(3);
  });
});
