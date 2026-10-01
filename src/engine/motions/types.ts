import type { Bar, Ctx2D, DrawSource, Fit, MotionId } from '../types';

export interface FrameInput {
  width: number;
  height: number;
  fit: Fit;
  /**
   * Already shuffled with the scene seed. The first `lead` bars are the clip's look (its stroke
   * bars); with several clips the rest of the grid follows, so the strokes can cover the frame.
   */
  bars: readonly Bar[];
  lead: number;
  progress: number;
  cycle: number;
  frameIndex: number;
  seed: number;
  color: string;
  image: DrawSource;
  nextImage: DrawSource;
  imgMask: boolean;
}

export interface Motion {
  id: MotionId;
  label: string;
  icon: string;
  /**
   * Where colour strokes cover the whole frame, so a chain of clips can change clip unseen:
   * halfway through the cycle, or at its ends for a motion that starts covered.
   */
  covered: 'middle' | 'ends';
  draw(ctx: Ctx2D, f: FrameInput): void;
}
