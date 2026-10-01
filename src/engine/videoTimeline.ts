import { FPS } from './timeline';

export interface TimelineClip {
  id: string;
  /** Source length in seconds. */
  duration: number;
}

export interface Marker {
  id: string;
  clipId: string;
  /** Source time inside the clip, on the 30 fps grid. */
  time: number;
}

export interface VideoTimelineInput {
  clips: readonly TimelineClip[];
  markers: readonly Marker[];
  /** D: length of one stroke phase in seconds. */
  dauer: number;
  imgMask: boolean;
  intro: boolean;
  outro: boolean;
}

/** A stretch of one clip between two cuts. */
export interface ShotSpan {
  index: number;
  clipId: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface Shot extends ShotSpan {
  /** Output time the shot starts at, on the 30 fps grid. */
  start: number;
  /** Output time it ends at; with IMG MASK the next shot already starts 2 · D earlier. */
  end: number;
  /**
   * Which of a clip's two preview players shows the shot. It only flips where an IMG MASK overlap
   * shows two stretches of the same clip at once, so a cut inside a clip just keeps playing.
   */
  lane: 0 | 1;
}

export interface Layout {
  shots: Shot[];
  duration: number;
  /** D in use: the setting, capped so no two stroke phases overlap. */
  dauer: number;
  /** IMG MASK in use (it needs at least one cut). */
  imgMask: boolean;
  intro: boolean;
  outro: boolean;
}

export const EPS = 1e-9;

export const snapToFrame = (t: number): number => Math.round(t * FPS) / FPS;

/** The shots in play order: every clip split at its markers. */
export function shotSpans(input: Pick<VideoTimelineInput, 'clips' | 'markers'>): ShotSpan[] {
  const spans: ShotSpan[] = [];
  for (const clip of input.clips) {
    const cuts = [...new Set(input.markers
      .filter((m) => m.clipId === clip.id && m.time > 0 && m.time < clip.duration)
      .map((m) => m.time))].sort((a, b) => a - b);
    let from = 0;
    for (const to of [...cuts, clip.duration]) {
      spans.push({ index: spans.length, clipId: clip.id, sourceStart: from, sourceEnd: to });
      from = to;
    }
  }
  return spans;
}

/**
 * How many D shot `i` of `n` must hold: half a colour transition (D) or a whole IMG MASK overlap
 * (2 · D) at each cut, D for the intro and the outro.
 */
export function demand(i: number, n: number, flags: Pick<VideoTimelineInput, 'imgMask' | 'intro' | 'outro'>): number {
  const join = flags.imgMask && n >= 2 ? 2 : 1;
  const head = i === 0 ? (flags.intro ? 1 : 0) : join;
  const tail = i === n - 1 ? (flags.outro ? 1 : 0) : join;
  return head + tail;
}

/** Where each clip starts on the clip axis (clips back to back by source length). */
export function clipOffsets(clips: readonly TimelineClip[]): Map<string, number> {
  const out = new Map<string, number>();
  let x = 0;
  for (const c of clips) {
    out.set(c.id, x);
    x += c.duration;
  }
  return out;
}

export function axisLength(clips: readonly TimelineClip[]): number {
  return clips.reduce((sum, c) => sum + c.duration, 0);
}

/** The clip and clip time at axis position `x` (clamped to the axis). */
export function clipAt(clips: readonly TimelineClip[], x: number): { clipId: string; time: number } | null {
  if (clips.length === 0) return null;
  let rest = Math.max(0, x);
  for (const c of clips) {
    if (rest < c.duration) return { clipId: c.id, time: rest };
    rest -= c.duration;
  }
  const last = clips[clips.length - 1];
  return { clipId: last.id, time: last.duration };
}

export interface DauerLimit {
  /** Largest D at which no two stroke phases overlap (Infinity if nothing limits it). */
  max: number;
  /** Where the limiting shot starts on the clip axis, or null. */
  axisAt: number | null;
}

export function dauerLimit(input: VideoTimelineInput): DauerLimit {
  const spans = shotSpans(input);
  const offsets = clipOffsets(input.clips);
  let max = Infinity;
  let axisAt: number | null = null;
  spans.forEach((s, i) => {
    const k = demand(i, spans.length, input);
    if (k === 0) return;
    const m = (s.sourceEnd - s.sourceStart) / k;
    if (m < max) {
      max = m;
      axisAt = (offsets.get(s.clipId) ?? 0) + s.sourceStart;
    }
  });
  return { max, axisAt };
}

export function layout(input: VideoTimelineInput): Layout {
  const spans = shotSpans(input);
  const n = spans.length;
  const imgMask = input.imgMask && n >= 2;
  const dauer = Math.min(input.dauer, dauerLimit(input).max);
  const overlap = imgMask ? 2 * dauer : 0;
  const shots: Shot[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    const length = s.sourceEnd - s.sourceStart;
    const prev = shots[i - 1];
    const sameClip = prev?.clipId === s.clipId;
    const lane: 0 | 1 = !prev || !sameClip ? 0 : imgMask ? (prev.lane === 0 ? 1 : 0) : prev.lane;
    shots.push({ ...s, start: snapToFrame(cursor), end: snapToFrame(cursor + length), lane });
    cursor += length - (i < n - 1 ? overlap : 0);
  });
  return { shots, duration: n ? shots[n - 1].end : 0, dauer, imgMask, intro: input.intro, outro: input.outro };
}

/** Output time showing clip time `time` of `clipId` (the first shot of the clip that holds it). */
export function outputTimeOf(lay: Layout, clipId: string, time: number): number {
  const shots = lay.shots.filter((s) => s.clipId === clipId);
  const shot = shots.find((s) => time < s.sourceEnd) ?? shots[shots.length - 1];
  if (!shot) return 0;
  const t = shot.start + (Math.max(shot.sourceStart, time) - shot.sourceStart);
  return Math.min(Math.max(0, t), Math.max(0, lay.duration - 1 / FPS));
}

/** Whether a marker at `t` in `clipId` leaves both shots beside it long enough. */
function markerFits(input: VideoTimelineInput, clipId: string, t: number): boolean {
  const spans = shotSpans({ clips: input.clips, markers: [...input.markers, { id: '', clipId, time: t }] });
  return spans.every((s, i) =>
    s.clipId !== clipId
    || (Math.abs(s.sourceStart - t) > 1e-6 && Math.abs(s.sourceEnd - t) > 1e-6)
    || s.sourceEnd - s.sourceStart >= demand(i, spans.length, input) * input.dauer - EPS);
}

/** Nearest frame-grid time in `clipId` where a new marker fits, or null if the clip has no room. */
export function validMarkerTime(input: VideoTimelineInput, clipId: string, time: number): number | null {
  const clip = input.clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const last = Math.ceil(clip.duration * FPS) - 1;
  const at = Math.round(time * FPS);
  for (let d = 0; d <= last; d++) {
    for (const f of d === 0 ? [at] : [at - d, at + d]) {
      if (f < 1 || f > last) continue;
      const t = f / FPS;
      if (input.markers.some((m) => m.clipId === clipId && Math.abs(m.time - t) < 1e-6)) continue;
      if (markerFits(input, clipId, t)) return t;
    }
  }
  return null;
}

export type Phase = 'none' | 'intro' | 'transition' | 'outro';

export interface ShotRef {
  shotIndex: number;
  clipId: string;
  sourceTime: number;
  lane: 0 | 1;
}

export interface VideoFramePosition {
  /** Fills the frame. */
  shot: ShotRef;
  /** Shown inside the bars during an IMG MASK overlap. */
  next: ShotRef | null;
  phase: Phase;
  /** Transition i sits between shot i and shot i + 1; −1 outside transitions. */
  transitionIndex: number;
  /** Which look the bars follow: the one before the cut or the one after it. */
  side: 'before' | 'after';
  /** 0..1 in the motions' cycle. */
  progress: number;
  /** Seeds the stroke pattern: 0 = intro, i + 1 = transition i, shots.length = outro. */
  cycle: number;
  frameIndex: number;
}

/** Just before a cut the shot shows its own last frame, never the next shot's first. */
const BEFORE_CUT = 1e-3;

function ref(shot: Shot, t: number): ShotRef {
  const time = shot.sourceStart + Math.max(0, t - shot.start);
  return {
    shotIndex: shot.index,
    clipId: shot.clipId,
    lane: shot.lane,
    sourceTime: Math.max(shot.sourceStart, Math.min(time, shot.sourceEnd - BEFORE_CUT)),
  };
}

/** Cycle progress for a stroke phase at u ∈ [−½, ½] around full cover (u = 0). */
function cycleProgress(u: number, covered: 'middle' | 'ends'): number {
  if (covered === 'middle') return 0.5 + u;
  return u < 0 ? 1 + u : u;
}

/**
 * What output time t shows: the shot (and with IMG MASK the next one), and – inside a transition,
 * the intro or the outro – the progress the motions expect, with full cover on the cut.
 */
export function videoPositionAt(t: number, lay: Layout, covered: 'middle' | 'ends'): VideoFramePosition {
  const { shots, duration, dauer } = lay;
  if (shots.length === 0) throw new Error('videoPositionAt needs at least one shot');
  const w = 2 * dauer;
  const tt = Math.min(Math.max(0, t), Math.max(0, duration - 1e-6));
  const frameIndex = Math.floor(tt * FPS + 1e-6);
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].start <= tt + EPS) i++;

  if (lay.imgMask && i > 0 && tt < shots[i].start + w) {
    return {
      shot: ref(shots[i - 1], tt), next: ref(shots[i], tt), phase: 'transition', transitionIndex: i - 1,
      side: 'before', progress: (tt - shots[i].start) / w, cycle: i, frameIndex,
    };
  }
  const shot = ref(shots[i], tt);
  const at = (phase: Phase, u: number, side: 'before' | 'after', transitionIndex: number, cycle: number): VideoFramePosition =>
    ({ shot, next: null, phase, transitionIndex, side, progress: cycleProgress(u, covered), cycle, frameIndex });

  if (!lay.imgMask) {
    if (i > 0 && tt < shots[i].start + dauer) return at('transition', (tt - shots[i].start) / w, 'after', i - 1, i);
    if (i + 1 < shots.length && tt >= shots[i + 1].start - dauer) {
      return at('transition', (tt - shots[i + 1].start) / w, 'before', i, i + 1);
    }
  }
  if (lay.intro && tt < dauer) return at('intro', tt / w, 'after', -1, 0);
  const last = duration - 1 / FPS;
  if (lay.outro && tt >= last - dauer) return at('outro', Math.min(0, (tt - last) / w), 'before', -1, shots.length);
  return { shot, next: null, phase: 'none', transitionIndex: -1, side: 'before', progress: 0, cycle: 0, frameIndex };
}
