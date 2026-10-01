export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** How an image is placed in the output frame: cropped to fill, or letterboxed. */
export type Fit = 'cover' | 'contain';

export const FORMAT_IDS = ['9:16', '4:5', '16:9', 'original'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const MOTION_IDS = ['buildUp', 'impulse', 'wave', 'fade', 'glitch', 'reveal'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

/** Movement of the stroke layer on top of the transition (the photo always stays still). */
export const MOVE_IDS = ['off', 'depth', 'slide', 'step', 'cascade', 'zipper', 'comb'] as const;
export type MoveId = (typeof MOVE_IDS)[number];

export const MODES = ['photo', 'video'] as const;
export type Mode = (typeof MODES)[number];

/** Anything the renderer can draw: a photo, a playing <video>, a decoded video frame or a canvas. */
export type DrawSource = ImageBitmap | HTMLVideoElement | VideoFrame | HTMLCanvasElement | OffscreenCanvas;

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
  mode: Mode;
  /** Video: length of one stroke phase (building up or falling away), in seconds. */
  dauer: number;
  /** Video: the first shot starts covered and the strokes fall away. */
  intro: boolean;
  /** Video: the strokes build up and cover the last frame. */
  outro: boolean;
  /** Video: keep the clips' sound. */
  audio: boolean;
}
