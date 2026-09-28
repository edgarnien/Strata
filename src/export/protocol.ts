import type { Scene } from '../engine/render';

export type ToWorker =
  | { type: 'start'; scene: Scene; fps: number }
  | { type: 'cancel' };

export type FromWorker =
  | { type: 'progress'; value: number }
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
