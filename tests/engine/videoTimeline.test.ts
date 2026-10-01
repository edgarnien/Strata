import { describe, expect, it } from 'vitest';
import {
  axisLength, clipAt, dauerLimit, layout, outputTimeOf, shotSpans, validMarkerTime, videoPositionAt, type VideoTimelineInput,
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

describe('videoPositionAt – colour strokes', () => {
  const at = (t: number, over: Partial<VideoTimelineInput> = {}, covered: 'middle' | 'ends' = 'middle') =>
    videoPositionAt(t, layout(input(over)), covered);

  it('plays the pure video away from cuts', () => {
    expect(at(1)).toMatchObject({ phase: 'none', next: null, shot: { clipId: 'a', sourceTime: 1 } });
    expect(at(2.4).phase).toBe('none');
  });
  it('builds up before the cut, covers on it and falls away after it', () => {
    expect(at(2.75)).toMatchObject({ phase: 'transition', transitionIndex: 0, side: 'before', progress: 0.25, shot: { clipId: 'a' } });
    expect(at(3)).toMatchObject({ side: 'after', progress: 0.5, shot: { clipId: 'b', sourceTime: 0 } });
    expect(at(3.25)).toMatchObject({ side: 'after', progress: 0.75, shot: { clipId: 'b' } });
  });
  it('puts full cover exactly on the cut frame and the last frame of shot a right before it', () => {
    expect(at(90 / 30).progress).toBe(0.5);
    const before = at(89 / 30);
    expect(before.shot.clipId).toBe('a');
    expect(before.shot.sourceTime).toBeLessThan(3);
  });
  it('never shows the next shot inside a clip before the marker', () => {
    const p = at(2 - 1e-4, { clips: [clip('a', 6)], markers: [mk('a', 2)] });
    expect(p.shot.shotIndex).toBe(0);
    expect(p.shot.sourceTime).toBeLessThanOrEqual(2 - 1e-3);
  });
  it('maps a motion that starts covered so the cut sits at 0 / 1', () => {
    expect(at(2.75, {}, 'ends').progress).toBe(0.75);
    expect(at(3, {}, 'ends').progress).toBe(0);
    expect(at(3.25, {}, 'ends').progress).toBe(0.25);
  });
  it('keeps progress inside [0, 1] for every frame of a capped layout', () => {
    const lay = layout(input({ clips: [clip('a', 3), clip('b', 0.6), clip('c', 3)], intro: true, outro: true }));
    for (let f = 0; f < Math.round(lay.duration * 30); f++) {
      const p = videoPositionAt(f / 30, lay, 'middle');
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('videoPositionAt – IMG MASK', () => {
  it('shows the next shot in the bars over the 2 · D overlap', () => {
    const lay = layout(input({ imgMask: true }));
    expect(videoPositionAt(2.5, lay, 'middle')).toMatchObject({
      phase: 'transition', transitionIndex: 0, side: 'before', progress: 0.5,
      shot: { clipId: 'a', sourceTime: 2.5 }, next: { clipId: 'b', sourceTime: 0.5 },
    });
    expect(videoPositionAt(3, lay, 'middle')).toMatchObject({ phase: 'none', next: null, shot: { clipId: 'b', sourceTime: 1 } });
  });
});

describe('videoPositionAt – intro and outro', () => {
  const lay = layout(input({ clips: [clip('a', 4)], intro: true, outro: true }));
  const last = 4 - 1 / 30;
  it('starts covered and falls away over D', () => {
    expect(videoPositionAt(0, lay, 'middle')).toMatchObject({ phase: 'intro', side: 'after', progress: 0.5, cycle: 0 });
    expect(videoPositionAt(0.25, lay, 'middle').progress).toBe(0.75);
    expect(videoPositionAt(0, lay, 'ends').progress).toBe(0);
  });
  it('builds up over D and covers the last frame', () => {
    expect(videoPositionAt(last, lay, 'middle')).toMatchObject({ phase: 'outro', side: 'before', progress: 0.5, cycle: 1 });
    expect(videoPositionAt(last - 0.25, lay, 'middle').progress).toBeCloseTo(0.25, 9);
    expect(videoPositionAt(2, lay, 'middle').phase).toBe('none');
  });
});
