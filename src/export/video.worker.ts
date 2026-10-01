import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_VERY_HIGH, getFirstEncodableVideoCodec } from 'mediabunny';
import { renderFrame, sceneDuration, type Scene } from '../engine/render';
import { frameCount } from '../engine/timeline';
import { encodeProject } from './projectEncoder';
import type { FromWorker, ToWorker } from './protocol';

let output: Output | null = null;
let cancelled = false;

const post = (msg: FromWorker, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(msg, transfer);

self.addEventListener('message', (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    void output?.cancel();
    return;
  }
  cancelled = false;
  const job = msg.type === 'start'
    ? encode(msg.scene, msg.fps)
    : encodeProject(msg.scene, msg.clips, msg.fps, {
      post,
      isCancelled: () => cancelled,
      setOutput: (o) => { output = o; },
    });
  job.catch((err: unknown) => {
    if (cancelled) post({ type: 'cancelled' });
    else post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
});

async function encode(scene: Scene, fps: number): Promise<void> {
  const { width, height } = scene;
  const codec = await getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height });
  if (!codec) throw new Error("This browser can't encode H.264 or HEVC video.");

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');

  const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  output = out;
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_VERY_HIGH });
  out.addVideoTrack(source, { frameRate: fps });
  await out.start();

  const total = frameCount(sceneDuration(scene), fps);
  for (let f = 0; f < total; f++) {
    if (cancelled) {
      post({ type: 'cancelled' });
      return;
    }
    renderFrame(ctx, scene, f / fps);
    await source.add(f / fps, 1 / fps); // awaiting respects encoder backpressure
    if (f % 10 === 0) post({ type: 'progress', value: f / total });
  }
  await out.finalize();
  output = null;
  const buffer = out.target.buffer;
  if (!buffer) throw new Error('The encoder returned no data.');
  post({ type: 'progress', value: 1 });
  post({ type: 'done', buffer, mimeType: 'video/mp4' }, [buffer]);
}
