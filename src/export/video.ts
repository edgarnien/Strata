import type { Scene } from '../engine/render';
import type { VideoProjectScene } from '../engine/renderVideo';
import { FPS } from '../engine/timeline';
import type { ClipFile, FromWorker, ToWorker } from './protocol';

/** Longest video-mode export: the MP4 is built in memory. */
export const VIDEO_MAX_SECONDS = 180;

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
  }
}

export interface VideoJob {
  result: Promise<Blob>;
  cancel(): void;
  /** Once done: why the video differs from what was asked for (e.g. no sound), or null. */
  note(): string | null;
}

export function exportVideo(scene: Scene, onProgress: (value: number) => void): VideoJob {
  return run({ type: 'start', scene, fps: FPS }, onProgress);
}

export function exportVideoProject(scene: VideoProjectScene, clips: ClipFile[], onProgress: (value: number) => void): VideoJob {
  return run({ type: 'startProject', scene, clips, fps: FPS }, onProgress);
}

function run(start: ToWorker, onProgress: (value: number) => void): VideoJob {
  const started = performance.now();
  const worker = new Worker(new URL('./video.worker.ts', import.meta.url), { type: 'module' });
  let resolve!: (blob: Blob) => void;
  let reject!: (err: Error) => void;
  const result = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let settled = false;
  let note: string | null = null;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    worker.terminate();
    fn();
  };

  worker.addEventListener('message', (e: MessageEvent<FromWorker>) => {
    if (settled) return; // late messages after cancel/terminate must not revive the dialog
    const m = e.data;
    if (m.type === 'progress') onProgress(m.value);
    else if (m.type === 'done') {
      console.info(`[strata] video export took ${Math.round(performance.now() - started)} ms`);
      note = m.note ?? null;
      settle(() => resolve(new Blob([m.buffer], { type: m.mimeType })));
    } else if (m.type === 'cancelled') settle(() => reject(new ExportCancelled()));
    else settle(() => reject(new Error(m.message)));
  });
  worker.addEventListener('error', (e) => settle(() => reject(new Error(e.message || 'The video worker crashed.'))));
  worker.postMessage(start);

  return {
    result,
    cancel() {
      worker.postMessage({ type: 'cancel' } satisfies ToWorker);
      // If the worker is stuck inside the encoder, don't wait for it.
      setTimeout(() => settle(() => reject(new ExportCancelled())), 1000);
    },
    note: () => note,
  };
}
