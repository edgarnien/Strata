import { MODES, type Mode } from '../engine/types';
import { colorLocked, images, settings, videoMode, type ToolId } from '../state/store';
import {
  audioControl, colorControl, dauerControl, formatControl, imgMaskControl, introOutroControl, loopsControl, motionControl,
  moveControl, removeControl, sliderControl,
} from './controls';

export type GroupId = 'adjust' | 'background' | 'color' | 'motion' | 'format';

export interface ToolDef {
  id: ToolId;
  /** Short label under the icon in the mobile toolbar. */
  label: string;
  icon: string;
  group: GroupId;
  build: () => HTMLElement;
  /** Modes the tool belongs to (default: both). */
  modes?: readonly Mode[];
  visible?: () => boolean;
  /** Greyed out and inert while this returns true. */
  locked?: () => boolean;
}

const PHOTO: readonly Mode[] = ['photo'];
const VIDEO: readonly Mode[] = ['video'];

/** Single source for the desktop sidebar and the mobile toolbar, in toolbar order. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'size', label: 'Size', icon: '▣', group: 'adjust', build: () => sliderControl({ label: 'SIZE', key: 'size' }) },
  { id: 'stretch', label: 'Stretch', icon: '↔', group: 'adjust', build: () => sliderControl({ label: 'STRETCH', key: 'stretch' }) },
  { id: 'threshold', label: 'Thresh.', icon: '◐', group: 'adjust', build: () => sliderControl({ label: 'THRESHOLD', key: 'threshold' }), locked: videoMode },
  { id: 'remove', label: 'Remove', icon: '✂', group: 'background', build: removeControl, locked: videoMode },
  { id: 'color', label: 'Color', icon: '●', group: 'color', build: colorControl, locked: colorLocked },
  { id: 'imgMask', label: 'Img Mask', icon: '◧', group: 'color', build: imgMaskControl, modes: PHOTO, visible: () => images.get().length >= 2 },
  { id: 'introOutro', label: 'Intro', icon: '⬒', group: 'motion', build: introOutroControl, modes: VIDEO },
  { id: 'motion', label: 'Motion', icon: '∿', group: 'motion', build: motionControl },
  { id: 'move', label: 'Move', icon: '⧉', group: 'motion', build: moveControl },
  { id: 'speed', label: 'Speed', icon: '»', group: 'motion', modes: PHOTO, build: () => sliderControl({ label: 'SPEED', key: 'speed', readout: (v) => `${v.toFixed(1)}×` }) },
  { id: 'dauer', label: 'Duration', icon: '»', group: 'motion', build: dauerControl, modes: VIDEO },
  { id: 'loops', label: 'Loops', icon: '⟳', group: 'motion', build: loopsControl, modes: PHOTO },
  { id: 'audio', label: 'Sound', icon: '♪', group: 'motion', build: audioControl, modes: VIDEO },
  { id: 'format', label: 'Format', icon: '▯', group: 'format', build: formatControl },
];

/** Greys a tool's control out and takes it out of reach while the tool is locked. */
export function applyLock(tool: ToolDef, el: HTMLElement): void {
  const locked = tool.locked?.() ?? false;
  el.classList.toggle('is-disabled', locked);
  el.inert = locked;
}

export function toolShown(tool: ToolDef): boolean {
  return (tool.modes ?? MODES).includes(settings.get().mode) && (tool.visible?.() ?? true);
}
