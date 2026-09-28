export const BASE_CYCLE_SECONDS = 6;
export const FPS = 30;

export interface TimelineInput {
  imageCount: number;
  loops: number;
  speed: number;
}

export interface FramePosition {
  cycle: number;
  imageIndex: number;
  nextImageIndex: number;
  /** 0 ≤ progress < 1 within the current cycle. */
  progress: number;
  /** t quantised to the 30 fps export grid; drives per-frame randomness. */
  frameIndex: number;
}

export function cycleDuration(speed: number): number {
  return BASE_CYCLE_SECONDS / speed;
}

export function totalDuration({ imageCount, loops, speed }: TimelineInput): number {
  return Math.max(0, imageCount) * loops * cycleDuration(speed);
}

export function frameCount(duration: number, fps = FPS): number {
  return Math.ceil(duration * fps - 1e-9);
}

export function positionAt(t: number, input: TimelineInput): FramePosition {
  const n = Math.max(1, input.imageCount);
  const cd = cycleDuration(input.speed);
  const total = totalDuration({ ...input, imageCount: n });
  // Clamp just inside the last frame; the tiny +1e-9 keeps exact frame times (f / 30) on the right cycle.
  const tt = Math.min(Math.max(0, t), Math.max(0, total - 1e-6));
  const cycle = Math.floor(tt / cd + 1e-9);
  const imageIndex = cycle % n;
  return {
    cycle,
    imageIndex,
    nextImageIndex: (imageIndex + 1) % n,
    progress: Math.max(0, (tt - cycle * cd) / cd),
    frameIndex: Math.floor(tt * FPS + 1e-6),
  };
}
