import type { Bar, Ctx2D, Fit, MotionId } from '../types';

export interface FrameInput {
  width: number;
  height: number;
  fit: Fit;
  /** Already shuffled with the scene seed; the full grid when imgMask is on. */
  bars: readonly Bar[];
  progress: number;
  cycle: number;
  frameIndex: number;
  seed: number;
  color: string;
  image: ImageBitmap;
  nextImage: ImageBitmap;
  imgMask: boolean;
}

export interface Motion {
  id: MotionId;
  label: string;
  icon: string;
  draw(ctx: Ctx2D, f: FrameInput): void;
}
