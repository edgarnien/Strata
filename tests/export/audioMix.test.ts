import { describe, expect, it } from 'vitest';
import { layout } from '../../src/engine/videoTimeline';
import { MIX_RATE, addInto, addShotSound, createMix, planarSlice, resample, shotGain, toStereo } from '../../src/export/audioMix';

const f32 = (...v: number[]) => Float32Array.from(v);
const lay = (imgMask: boolean) => layout({
  clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5, imgMask, intro: false, outro: false,
});

describe('toStereo', () => {
  it('doubles mono, keeps stereo and drops extra channels', () => {
    const m = f32(1, 2);
    expect(toStereo([m])).toEqual([m, m]);
    const l = f32(1), r = f32(2), c = f32(3);
    expect(toStereo([l, r, c])).toEqual([l, r]);
  });
});

describe('resample', () => {
  it('leaves matching rates alone and interpolates linearly', () => {
    const p = f32(0, 1);
    expect(resample(p, 48_000, 48_000)).toBe(p);
    expect([...resample(p, 24_000, 48_000)]).toEqual([0, 0.5, 1, 1]);
  });
});

describe('shotGain', () => {
  it('cuts hard at a colour cut', () => {
    expect(shotGain(lay(false), 0, 2.99)).toBe(1);
    expect(shotGain(lay(false), 0, 3)).toBe(0);
    expect(shotGain(lay(false), 1, 3)).toBe(1);
  });
  it('crossfades linearly across an IMG MASK overlap', () => {
    const l = lay(true); // shot a [0, 3), shot b [2, 4)
    expect(shotGain(l, 0, 2.25)).toBeCloseTo(0.75, 9);
    expect(shotGain(l, 1, 2.25)).toBeCloseTo(0.25, 9);
    expect(shotGain(l, 0, 1)).toBe(1);
    expect(shotGain(l, 1, 3.5)).toBe(1);
  });
});

describe('addInto / planarSlice', () => {
  it('adds a chunk at its output time, scaled, and leaves silence elsewhere', () => {
    const mix = createMix(1, 4); // 4 frames at 4 Hz
    addInto(mix, [f32(1, 1), f32(2, 2)], 0.5, () => 0.5, 4);
    addInto(mix, [f32(1), f32(1)], 0.75, () => 1, 4);
    expect([...mix[0]]).toEqual([0, 0, 0.5, 1.5]);
    expect([...mix[1]]).toEqual([0, 0, 1, 2]);
  });
  it('drops samples outside the mix', () => {
    const mix = createMix(0.5, 4);
    addInto(mix, [f32(1, 1, 1), f32(1, 1, 1)], -0.25, () => 1, 4);
    expect([...mix[0]]).toEqual([1, 1]);
  });
  it('slices the mix into one planar buffer, left then right', () => {
    const mix: [Float32Array, Float32Array] = [f32(1, 2, 3), f32(4, 5, 6)];
    expect([...planarSlice(mix, 1, 3)]).toEqual([2, 3, 5, 6]);
  });
});

describe('addShotSound', () => {
  it('joins consecutive 44.1 kHz packets without overlap or gap', () => {
    const rate = 44_100;
    const mix = createMix(0.2);
    const chunks = [0, 1, 2, 3].map((i) => ({
      planes: [new Float32Array(1024).fill(1)], sampleRate: rate, timestamp: (i * 1024) / rate,
    }));
    addShotSound(mix, chunks, 0, () => 1);
    const span = Math.round((4 * 1024 * MIX_RATE) / rate);
    const left = [...mix[0].subarray(0, span)];
    expect(Math.max(...left)).toBeLessThanOrEqual(1);
    expect(Math.min(...left)).toBe(1); // no zero gap inside the span
    expect(mix[0][span]).toBe(0);
  });
});
