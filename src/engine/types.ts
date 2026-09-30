export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** How an image is placed in the output frame: cropped to fill, or letterboxed. */
export type Fit = 'cover' | 'contain';

export const FORMAT_IDS = ['9:16', '4:5', '16:9', 'original'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const MOTION_IDS = ['buildUp', 'impulse', 'wave', 'fade', 'glitch', 'reveal'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

/** Movement on top of the transition: none, the clip moving back into the frame, or sliding left. */
export const MOVE_IDS = ['off', 'depth', 'slide'] as const;
export type MoveId = (typeof MOVE_IDS)[number];

/** Anything the transitions draw from: a clip, or a plain colour swatch. */
export type Picture = ImageBitmap | OffscreenCanvas;

export interface Size {
  width: number;
  height: number;
}

/** One stroke cell of the bar grid, in output pixels. */
export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  size: number;
  stretch: number;
  threshold: number;
  removeFront: boolean;
  sensitivity: number;
  color: string;
  imgMask: boolean;
  motion: MotionId;
  speed: number;
  loops: number;
  format: FormatId;
  move: MoveId;
  /** MOVE shifts only the stroke layer and leaves the photo still (readable text). */
  moveStrokes: boolean;
}
