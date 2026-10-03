import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputVideoTrack } from 'mediabunny';
import type { Fit, Size } from '../engine/types';

interface ClipMedia {
  input: Input;
  video: InputVideoTrack;
  /** Frame grabbers by output size and fit. */
  sinks: Map<string, CanvasSink>;
}
const media = new Map<string, ClipMedia>();

/** A clip that can't be used; the message completes "<file name> …". */
export class ClipError extends Error {}

export interface ClipProbe {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Opens a clip, checks it can be played and keeps it open for frame grabs. */
export async function openClip(id: string, file: File): Promise<ClipProbe> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new ClipError('has no video track');
    if (!(await video.canDecode())) throw new ClipError("uses a video codec this browser can't decode");
    const duration = await input.computeDuration();
    if (!(duration > 0)) throw new ClipError('is empty');
    const audio = await input.getPrimaryAudioTrack();
    const hasAudio = !!audio && (await audio.canDecode());
    media.set(id, { input, video, sinks: new Map() });
    // Display size: rotation from the file (portrait iPhone clips) already applied.
    return { duration, width: await video.getDisplayWidth(), height: await video.getDisplayHeight(), hasAudio };
  } catch (err) {
    input.dispose();
    throw err;
  }
}

/** The frame showing at clip time `time`, scaled and cropped like the output frame. */
export async function frameAt(id: string, time: number, size: Size, fit: Fit): Promise<HTMLCanvasElement | OffscreenCanvas> {
  const m = media.get(id);
  if (!m) throw new Error(`Clip ${id} is not open`);
  const key = `${size.width}x${size.height}:${fit}`;
  let sink = m.sinks.get(key);
  if (!sink) {
    sink = new CanvasSink(m.video, { width: size.width, height: size.height, fit });
    m.sinks.set(key, sink);
  }
  // Before the first frame (some files start slightly after 0) take the first frame.
  const wrapped = (await sink.getCanvas(time)) ?? (await sink.getCanvas(await m.video.getFirstTimestamp()));
  if (!wrapped) throw new Error(`No frame at ${time.toFixed(2)} s`);
  return wrapped.canvas;
}

const STRIP_HEIGHT = 96;
const STRIP_MAX_FRAMES = 40;

export interface Filmstrip {
  /** Object URL of the frames side by side. */
  url: string;
  frames: number;
}

/** One small frame per second of the clip side by side, as an object URL for the timeline. */
export async function filmstrip(id: string, duration: number): Promise<Filmstrip> {
  const m = media.get(id);
  if (!m) throw new Error(`Clip ${id} is not open`);
  const ratio = (await m.video.getDisplayWidth()) / (await m.video.getDisplayHeight());
  const w = Math.max(1, Math.round(STRIP_HEIGHT * ratio));
  const count = Math.min(STRIP_MAX_FRAMES, Math.max(1, Math.ceil(duration)));
  const strip = new OffscreenCanvas(w * count, STRIP_HEIGHT);
  const ctx = strip.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  const sink = new CanvasSink(m.video, { width: w, height: STRIP_HEIGHT, fit: 'cover' });
  const times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);
  let i = 0;
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    if (frame) ctx.drawImage(frame.canvas, i * w, 0);
    i++;
  }
  return { url: URL.createObjectURL(await strip.convertToBlob({ type: 'image/jpeg', quality: 0.7 })), frames: count };
}

export function closeClip(id: string): void {
  const m = media.get(id);
  media.delete(id);
  m?.input.dispose();
}
