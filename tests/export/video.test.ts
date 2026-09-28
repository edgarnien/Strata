import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '../../src/engine/render';
import type { FromWorker } from '../../src/export/protocol';
import { ExportCancelled, exportVideo } from '../../src/export/video';

type Listener = (e: { data: FromWorker }) => void;

/** Minimal stand-in for the real `Worker`: records posts, lets tests emit `message` events. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  terminated = false;
  posted: unknown[] = [];
  private messageListeners: Listener[] = [];
  private errorListeners: Array<(e: unknown) => void> = [];

  constructor(..._args: unknown[]) {
    FakeWorker.instances.push(this);
  }

  postMessage(msg: unknown): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: 'message' | 'error', fn: Listener | ((e: unknown) => void)): void {
    if (type === 'message') this.messageListeners.push(fn as Listener);
    else this.errorListeners.push(fn as (e: unknown) => void);
  }

  emit(data: FromWorker): void {
    for (const fn of this.messageListeners) fn({ data });
  }
}

describe('exportVideo', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('ignores a late progress message after the 1s cancel fallback has settled', async () => {
    vi.useFakeTimers();
    const onProgress = vi.fn();
    const job = exportVideo({} as Scene, onProgress);
    const worker = FakeWorker.instances[0]!;

    job.cancel();
    vi.advanceTimersByTime(1000);
    worker.emit({ type: 'progress', value: 0.5 });

    await expect(job.result).rejects.toThrow(ExportCancelled);
    expect(worker.terminated).toBe(true);
    expect(onProgress).not.toHaveBeenCalledWith(0.5);
  });

  it('still delivers progress that arrives before the job settles', () => {
    const onProgress = vi.fn();
    exportVideo({} as Scene, onProgress);
    const worker = FakeWorker.instances[0]!;

    worker.emit({ type: 'progress', value: 0.25 });

    expect(onProgress).toHaveBeenCalledWith(0.25);
  });

  it('resolves with the finished blob and terminates the worker', async () => {
    const job = exportVideo({} as Scene, () => {});
    const worker = FakeWorker.instances[0]!;

    worker.emit({ type: 'done', buffer: new ArrayBuffer(4), mimeType: 'video/mp4' });

    const blob = await job.result;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('video/mp4');
    expect(worker.terminated).toBe(true);
  });
});
