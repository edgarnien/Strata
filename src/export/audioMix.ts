import type { Layout } from '../engine/videoTimeline';

export const MIX_RATE = 48_000;

/** Left and right channel, planar. */
export type Stereo = [Float32Array, Float32Array];

export function createMix(duration: number, rate = MIX_RATE): Stereo {
  const frames = Math.max(0, Math.ceil(duration * rate));
  return [new Float32Array(frames), new Float32Array(frames)];
}

export function toStereo(planes: readonly Float32Array[]): Stereo {
  if (planes.length === 0) throw new Error('toStereo needs at least one channel');
  return [planes[0], planes[1] ?? planes[0]];
}

/** Linear-interpolation resampling – plenty for the sound under a social video. */
export function resample(plane: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return plane;
  const out = new Float32Array(Math.round((plane.length * to) / from));
  const step = from / to;
  const last = plane.length - 1;
  for (let j = 0; j < out.length; j++) {
    const pos = j * step;
    const i = Math.min(Math.floor(pos), last);
    out[j] = plane[i] + (plane[Math.min(i + 1, last)] - plane[i]) * (pos - i);
  }
  return out;
}

/** Volume of shot `i` at output time t: 0 outside it; with IMG MASK it fades in and out across the overlaps. */
export function shotGain(lay: Layout, i: number, t: number): number {
  const shot = lay.shots[i];
  if (!shot || t < shot.start || t >= shot.end) return 0;
  if (!lay.imgMask) return 1;
  const w = 2 * lay.dauer;
  const next = lay.shots[i + 1];
  let gain = 1;
  if (i > 0 && t < shot.start + w) gain = Math.min(gain, (t - shot.start) / w);
  if (next && t >= next.start) gain = Math.min(gain, 1 - (t - next.start) / w);
  return Math.max(0, gain);
}

/** Adds `chunk` into the mix from output time `at` on, scaled by `gain(t)`. */
export function addInto(mix: Stereo, chunk: Stereo, at: number, gain: (t: number) => number, rate = MIX_RATE): void {
  const offset = Math.round(at * rate);
  for (let j = 0; j < chunk[0].length; j++) {
    const k = offset + j;
    if (k < 0 || k >= mix[0].length) continue;
    const g = gain(k / rate);
    if (g === 0) continue;
    mix[0][k] += chunk[0][j] * g;
    mix[1][k] += chunk[1][j] * g;
  }
}

/** Frames [from, to) of the mix as one f32-planar buffer: the left plane, then the right. */
export function planarSlice(mix: Stereo, from: number, to: number): Float32Array {
  const left = mix[0].subarray(from, to);
  const right = mix[1].subarray(from, to);
  const out = new Float32Array(left.length * 2);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}
