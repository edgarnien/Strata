import { imgMaskOn } from '../engine/render';
import { randomSeed } from '../engine/rng';
import type { Settings, Size } from '../engine/types';
import type { Marker, VideoTimelineInput } from '../engine/videoTimeline';
import { loadSettings, saveSettings } from './settings';
import { signal } from './signal';

export interface ImageEntry {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  thumbUrl: string;
}

export interface VideoClipEntry {
  id: string;
  name: string;
  file: File;
  /** Object URL the preview's <video> elements play. */
  url: string;
  /** Source length in seconds. */
  duration: number;
  /** Display size, rotation already applied. */
  width: number;
  height: number;
  hasAudio: boolean;
  /** Object URL of a strip of small frames for the timeline. */
  stripUrl: string;
  /** How many frames the strip holds, side by side at the clip's aspect. */
  stripFrames: number;
}

export type ToolId =
  | 'size' | 'stretch' | 'threshold' | 'remove' | 'color' | 'imgMask'
  | 'motion' | 'move' | 'speed' | 'loops' | 'format'
  | 'dauer' | 'introOutro' | 'audio';

export const settings = signal<Settings>(loadSettings());
export const images = signal<readonly ImageEntry[]>([]);
/** Clip picked in the clip strip (shown while paused). */
export const selected = signal(0);
export const playing = signal(false);
/** Clip currently on screen while playing. */
export const shownClip = signal(0);
export const seed = signal(randomSeed());
export const activeTool = signal<ToolId>('size');
export const exporting = signal(false);

export const videoClips = signal<readonly VideoClipEntry[]>([]);
export const markers = signal<readonly Marker[]>([]);
/** Output time under the playhead in video mode, in seconds. */
export const playhead = signal(0);
export const selectedMarker = signal<string | null>(null);

export function timelineInput(s: Settings = settings.get()): VideoTimelineInput {
  return {
    clips: videoClips.get().map((c) => ({ id: c.id, duration: c.duration })),
    markers: markers.get(),
    dauer: s.dauer,
    // IMG MASK only pairs photos; between video clips its look is too busy.
    imgMask: false,
    intro: s.intro,
    outro: s.outro,
  };
}

/** Whether the active mode has anything to show. */
export function hasContent(): boolean {
  return settings.get().mode === 'photo' ? images.get().length > 0 : videoClips.get().length > 0;
}

/** Size of the first clip of the active mode – ORIGINAL takes it over. */
export function firstSourceSize(): Size | null {
  if (settings.get().mode === 'photo') return images.get()[0]?.bitmap ?? null;
  const clip = videoClips.get()[0];
  return clip ? { width: clip.width, height: clip.height } : null;
}

/** IMG MASK reveals the next clip instead of drawing strokes, so the stroke colour has no say. */
export function colorLocked(): boolean {
  const s = settings.get();
  return s.mode === 'photo' && imgMaskOn(s, images.get().length);
}

export function videoMode(): boolean {
  return settings.get().mode === 'video';
}

export function patchSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

settings.subscribe((s) => saveSettings(s));
