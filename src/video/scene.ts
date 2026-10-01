import { AnalysisCache } from '../engine/analysisCache';
import { fitFor, outputSize } from '../engine/formats';
import { lookFrames, type FrameRef, type VideoLooks, type VideoProjectScene } from '../engine/renderVideo';
import type { BarLook } from '../engine/strokes';
import { layout } from '../engine/videoTimeline';
import { effect, signal } from '../state/signal';
import { markers, seed, settings, timelineInput, videoClips } from '../state/store';
import { toast } from '../ui/toast';
import { frameAt } from './media';

const cache = new AnalysisCache();
const keyOf = (f: FrameRef) => `${f.clipId}@${Math.round(f.time * 1e4)}`;

/** The current video scene; rebuilt (async) whenever clips, markers or settings change. */
export const videoScene = signal<VideoProjectScene | null>(null);

export async function buildVideoScene(): Promise<VideoProjectScene | null> {
  const clips = videoClips.get();
  if (clips.length === 0) return null;
  const s = settings.get();
  const size = outputSize(s.format, { width: clips[0].width, height: clips[0].height });
  if (!size) return null;
  const fit = fitFor(s.format);
  const lay = layout(timelineInput(s));
  const frames = lookFrames(lay);
  const used = new Set<string>();
  const look = async (f: FrameRef): Promise<BarLook> => {
    const key = keyOf(f);
    used.add(key);
    const source = cache.needsPixels(key, size, fit) ? await frameAt(f.clipId, f.time, size, fit) : null;
    return cache.look(key, source, size, fit, s);
  };
  const looks: VideoLooks = {
    intro: frames.intro && (await look(frames.intro)),
    outro: frames.outro && (await look(frames.outro)),
    transitions: [],
  };
  for (const t of frames.transitions) looks.transitions.push({ before: await look(t.before), after: await look(t.after) });
  cache.prune((id) => used.has(id));
  return { width: size.width, height: size.height, fit, settings: s, seed: seed.get(), layout: lay, looks };
}

/** Keeps `videoScene` current in video mode; a build that got overtaken is thrown away. */
export function watchVideoScene(): void {
  let generation = 0;
  effect([settings, videoClips, markers, seed], () => {
    if (settings.get().mode !== 'video') return;
    const gen = ++generation;
    buildVideoScene().then(
      (scene) => {
        if (gen === generation) videoScene.set(scene);
      },
      (err: unknown) => {
        if (gen === generation) toast(`Video frames could not be read: ${err instanceof Error ? err.message : String(err)}`, 'error');
      },
    );
  });
}
