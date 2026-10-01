import { describe, expect, it } from 'vitest';
import type { VideoTimelineInput } from '../../src/engine/videoTimeline';
import { addMarker, forgetClipMarkers, moveMarker, removeMarker } from '../../src/video/markers';

const base = (markers: VideoTimelineInput['markers'] = []): VideoTimelineInput => ({
  clips: [{ id: 'a', duration: 6 }, { id: 'b', duration: 2 }], markers, dauer: 0.5, imgMask: false, intro: false, outro: false,
});

describe('markers', () => {
  it('adds a marker on the nearest valid frame', () => {
    expect(addMarker(base(), 'a', 2.013, 'm1')).toEqual([{ id: 'm1', clipId: 'a', time: 2 }]);
  });
  it('refuses a marker in a clip with no room', () => {
    expect(addMarker({ ...base(), clips: [{ id: 'a', duration: 0.9 }] }, 'a', 0.45, 'm1')).toBeNull();
  });
  it('moves a marker but never onto another one or too close to it', () => {
    const start = base([{ id: 'm1', clipId: 'a', time: 2 }, { id: 'm2', clipId: 'a', time: 4 }]);
    const moved = moveMarker(start, 'm1', 4);
    const m1 = moved.find((m) => m.id === 'm1');
    expect(m1?.time).not.toBe(4);
    expect(Math.abs((m1?.time ?? 0) - 4)).toBeGreaterThanOrEqual(1 - 1e-9);
  });
  it('keeps the markers when the id is unknown', () => {
    const start = base([{ id: 'm1', clipId: 'a', time: 2 }]);
    expect(moveMarker(start, 'zz', 3)).toBe(start.markers);
  });
  it('removes one marker or every marker of a clip', () => {
    const list = [{ id: 'm1', clipId: 'a', time: 2 }, { id: 'm2', clipId: 'b', time: 1 }];
    expect(removeMarker(list, 'm1')).toEqual([list[1]]);
    expect(forgetClipMarkers(list, 'b')).toEqual([list[0]]);
  });
});
