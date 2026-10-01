import type { Scene } from '../engine/render';
import type { VideoProjectScene } from '../engine/renderVideo';

export interface ClipFile {
  id: string;
  name: string;
  file: File;
  hasAudio: boolean;
}

export type ToWorker =
  | { type: 'start'; scene: Scene; fps: number }
  | { type: 'startProject'; scene: VideoProjectScene; clips: ClipFile[]; fps: number }
  | { type: 'cancel' };

export type FromWorker =
  | { type: 'progress'; value: number }
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string; note?: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
