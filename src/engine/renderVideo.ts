import { motionById } from './motions';
import { hashSeed } from './rng';
import { barOrder, movedStrokes, paintBase, type BarLook } from './strokes';
import type { Ctx2D, DrawSource, Fit, Settings } from './types';
import { BEFORE_CUT, videoPositionAt, type Layout, type VideoFramePosition } from './videoTimeline';

export interface VideoLooks {
  intro: BarLook | null;
  outro: BarLook | null;
  /** Per transition i (shot i → i + 1): the look of the last frame before and the first frame after the cut. */
  transitions: { before: BarLook; after: BarLook }[];
}

export interface VideoProjectScene {
  width: number;
  height: number;
  fit: Fit;
  settings: Settings;
  seed: number;
  layout: Layout;
  looks: VideoLooks;
}

/** The pictures for one output frame: the shot, and during an IMG MASK overlap the next one. */
export interface VideoFrames {
  shot: DrawSource;
  next: DrawSource | null;
}

const PHASE_SALT = 0x51d;

export function videoPosition(scene: VideoProjectScene, t: number): VideoFramePosition {
  return videoPositionAt(t, scene.layout, motionById(scene.settings.motion).covered);
}

function lookFor(scene: VideoProjectScene, pos: VideoFramePosition): BarLook | null {
  switch (pos.phase) {
    case 'intro': return scene.looks.intro;
    case 'outro': return scene.looks.outro;
    case 'transition': return scene.looks.transitions[pos.transitionIndex]?.[pos.side] ?? null;
    default: return null;
  }
}

/**
 * Draws output frame `pos`: the shot, and in a stroke phase the motion on top. The strokes always
 * cover the whole grid (the look first), so the cut, the first and the last frame are fully hidden.
 */
export function renderVideoFrame(ctx: Ctx2D, scene: VideoProjectScene, pos: VideoFramePosition, frames: VideoFrames): void {
  const { width, height, fit, settings: s } = scene;
  paintBase(ctx, width, height, fit, frames.shot);
  const look = lookFor(scene, pos);
  if (!look) return;
  const motion = motionById(s.motion);
  const imgMask = pos.next !== null && frames.next !== null;
  const order = barOrder(look, true, scene.seed, hashSeed(pos.cycle, PHASE_SALT));
  const strokes = s.move === 'off' ? ctx : movedStrokes(ctx, scene, s.move, motion, pos.progress, imgMask, look.gridBars);
  motion.draw(strokes, {
    width,
    height,
    fit,
    bars: order.bars,
    lead: order.lead,
    progress: pos.progress,
    cycle: pos.cycle,
    frameIndex: pos.frameIndex,
    seed: scene.seed,
    color: s.color,
    image: frames.shot,
    nextImage: frames.next ?? frames.shot,
    imgMask,
  });
}

export interface FrameRef {
  clipId: string;
  time: number;
}

/** The clip frames whose looks a layout needs, read right at each cut. */
export function lookFrames(lay: Layout): { intro: FrameRef | null; outro: FrameRef | null; transitions: { before: FrameRef; after: FrameRef }[] } {
  const { shots } = lay;
  const start = (i: number): FrameRef => ({ clipId: shots[i].clipId, time: shots[i].sourceStart });
  const end = (i: number): FrameRef => ({ clipId: shots[i].clipId, time: Math.max(shots[i].sourceStart, shots[i].sourceEnd - BEFORE_CUT) });
  return {
    intro: lay.intro && shots.length ? start(0) : null,
    outro: lay.outro && shots.length ? end(shots.length - 1) : null,
    transitions: shots.slice(1).map((_, i) => ({ before: end(i), after: start(i + 1) })),
  };
}
