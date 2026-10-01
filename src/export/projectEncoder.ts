import {
  ALL_FORMATS, AudioSample, AudioSampleSink, AudioSampleSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input,
  Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_VERY_HIGH, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec,
  type WrappedCanvas,
} from 'mediabunny';
import { renderVideoFrame, videoPosition, type VideoProjectScene } from '../engine/renderVideo';
import { frameCount } from '../engine/timeline';
import type { VideoFramePosition } from '../engine/videoTimeline';
import { MIX_RATE, addInto, createMix, planarSlice, resample, shotGain, toStereo, type Stereo } from './audioMix';
import type { ClipFile, FromWorker } from './protocol';

export interface EncodeHooks {
  post(msg: FromWorker, transfer?: Transferable[]): void;
  isCancelled(): boolean;
  setOutput(output: Output | null): void;
}

export class EncodeCancelled extends Error {}

/** Progress share of decoding and mixing the sound. */
const AUDIO_SHARE = 0.1;
const NO_SOUND_NOTE = "Exported without sound – this browser can't encode audio.";

/** Video mode export: decode every clip frame-exact, draw the stroke phases, mix the sound. */
export async function encodeProject(scene: VideoProjectScene, clips: ClipFile[], fps: number, hooks: EncodeHooks): Promise<void> {
  const { width, height } = scene;
  const lay = scene.layout;
  const codec = await getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height });
  if (!codec) throw new Error("This browser can't encode H.264 or HEVC video.");
  const names = new Map(clips.map((c) => [c.id, c.name]));
  const inputs = new Map(clips.map((c) => [c.id, new Input({ source: new BlobSource(c.file), formats: ALL_FORMATS })]));
  const streams = new Map<string, AsyncGenerator<WrappedCanvas | null, void, unknown>>();
  try {
    const wantSound = scene.settings.audio && clips.some((c) => c.hasAudio);
    const audioCodec = wantSound ? await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: MIX_RATE }) : null;
    const note = wantSound && !audioCodec ? NO_SOUND_NOTE : undefined;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available.');
    const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    hooks.setOutput(out);
    const videoSource = new CanvasSource(canvas, { codec, quality: QUALITY_VERY_HIGH });
    out.addVideoTrack(videoSource, { frameRate: fps });
    const audioSource = audioCodec ? new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH }) : null;
    if (audioSource) out.addAudioTrack(audioSource);
    await out.start();

    const mix = audioSource ? await mixSound(scene, clips, inputs, hooks) : null;
    let audioFrame = 0;
    /** Encodes the mix up to output time `until`, in one-second blocks, so sound and picture stay interleaved. */
    const feedSound = async (until: number) => {
      if (!audioSource || !mix) return;
      const end = Math.min(mix[0].length, Math.ceil(until * MIX_RATE));
      while (audioFrame < end) {
        const to = Math.min(end, audioFrame + MIX_RATE);
        const sample = new AudioSample({
          data: planarSlice(mix, audioFrame, to), format: 'f32-planar', numberOfChannels: 2, sampleRate: MIX_RATE, timestamp: audioFrame / MIX_RATE,
        });
        await audioSource.add(sample);
        sample.close();
        audioFrame = to;
      }
    };

    const total = frameCount(lay.duration, fps);
    const positions: VideoFramePosition[] = Array.from({ length: total }, (_, f) => videoPosition(scene, f / fps));
    // One decoder per clip and role, each fed its timestamps in rising order (decodes every packet once).
    const times = new Map<string, number[]>();
    const push = (key: string, t: number) => {
      const list = times.get(key) ?? [];
      list.push(t);
      times.set(key, list);
    };
    for (const p of positions) {
      push(`${p.shot.clipId}:shot`, p.shot.sourceTime);
      if (p.next) push(`${p.next.clipId}:next`, p.next.sourceTime);
    }
    for (const [key, list] of times) {
      const clipId = key.slice(0, key.lastIndexOf(':'));
      const track = await inputs.get(clipId)?.getPrimaryVideoTrack();
      if (!track) throw new Error(`${names.get(clipId) ?? clipId} has no video track`);
      streams.set(key, new CanvasSink(track, { width, height, fit: scene.fit, poolSize: 2 }).canvasesAtTimestamps(list));
    }
    const last = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
    const blank = new OffscreenCanvas(width, height);
    const nextCanvas = async (key: string) => {
      const stream = streams.get(key);
      if (!stream) throw new Error(`No decoder for ${key}`);
      let r: IteratorResult<WrappedCanvas | null, void>;
      try {
        r = await stream.next();
      } catch (err) {
        const clipId = key.slice(0, key.lastIndexOf(':'));
        throw new Error(`${names.get(clipId) ?? clipId} could not be decoded: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Before a clip's first frame there is none yet: keep the previous picture (or black).
      const canvasOut = r.done || !r.value ? (last.get(key) ?? blank) : r.value.canvas;
      last.set(key, canvasOut);
      return canvasOut;
    };

    const base = audioSource ? AUDIO_SHARE : 0;
    for (let f = 0; f < total; f++) {
      if (hooks.isCancelled()) throw new EncodeCancelled();
      const p = positions[f];
      const shot = await nextCanvas(`${p.shot.clipId}:shot`);
      const next = p.next ? await nextCanvas(`${p.next.clipId}:next`) : null;
      renderVideoFrame(ctx, scene, p, { shot, next });
      await feedSound((f + 1) / fps + 1);
      await videoSource.add(f / fps, 1 / fps); // awaiting respects encoder backpressure
      if (f % 10 === 0) hooks.post({ type: 'progress', value: base + (1 - base) * (f / total) });
    }
    await feedSound(Infinity);
    await out.finalize();
    hooks.setOutput(null);
    const buffer = out.target.buffer;
    if (!buffer) throw new Error('The encoder returned no data.');
    hooks.post({ type: 'progress', value: 1 });
    hooks.post({ type: 'done', buffer, mimeType: 'video/mp4', note }, [buffer]);
  } finally {
    for (const s of streams.values()) void s.return(undefined);
    for (const input of inputs.values()) input.dispose();
  }
}

/** Decodes each shot's sound and lays it into one 48 kHz stereo mix at its output time. */
async function mixSound(scene: VideoProjectScene, clips: ClipFile[], inputs: Map<string, Input>, hooks: EncodeHooks): Promise<Stereo> {
  const lay = scene.layout;
  const mix = createMix(lay.duration);
  const withSound = new Set(clips.filter((c) => c.hasAudio).map((c) => c.id));
  for (const [i, shot] of lay.shots.entries()) {
    if (!withSound.has(shot.clipId)) continue;
    const track = await inputs.get(shot.clipId)?.getPrimaryAudioTrack();
    if (!track) continue;
    for await (const sample of new AudioSampleSink(track).samples(shot.sourceStart, shot.sourceEnd)) {
      if (hooks.isCancelled()) {
        sample.close();
        throw new EncodeCancelled();
      }
      const planes: Float32Array[] = [];
      for (let ch = 0; ch < sample.numberOfChannels; ch++) {
        const plane = new Float32Array(sample.numberOfFrames);
        sample.copyTo(plane, { planeIndex: ch, format: 'f32-planar' });
        planes.push(resample(plane, sample.sampleRate, MIX_RATE));
      }
      addInto(mix, toStereo(planes), shot.start + (sample.timestamp - shot.sourceStart), (t) => shotGain(lay, i, t));
      sample.close();
    }
    hooks.post({ type: 'progress', value: (AUDIO_SHARE * (i + 1)) / lay.shots.length });
  }
  return mix;
}
