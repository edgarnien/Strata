import { images, type ToolId } from '../state/store';
import {
  colorControl, formatControl, imgMaskControl, loopsControl, motionControl, removeControl, resetControl, sliderControl,
} from './controls';

export type GroupId = 'adjust' | 'background' | 'color' | 'motion' | 'format' | 'actions';

export interface ToolDef {
  id: ToolId;
  /** Short label under the icon in the mobile toolbar. */
  label: string;
  icon: string;
  group: GroupId;
  build: () => HTMLElement;
  visible?: () => boolean;
}

/** Desktop group headings; FORMAT carries its own label above the dropdown. */
export const GROUP_LABELS: Record<GroupId, string> = {
  adjust: 'ADJUST',
  background: 'BACKGROUND',
  color: 'COLOR',
  motion: 'MOTION',
  format: '',
  actions: '',
};

/** Single source for the desktop sidebar and the mobile toolbar, in toolbar order. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'size', label: 'Size', icon: '▣', group: 'adjust', build: () => sliderControl({ label: 'SIZE', key: 'size' }) },
  { id: 'stretch', label: 'Stretch', icon: '↔', group: 'adjust', build: () => sliderControl({ label: 'STRETCH', key: 'stretch' }) },
  { id: 'threshold', label: 'Thresh.', icon: '◐', group: 'adjust', build: () => sliderControl({ label: 'THRESHOLD', key: 'threshold' }) },
  { id: 'remove', label: 'Remove', icon: '✂', group: 'background', build: removeControl },
  { id: 'color', label: 'Color', icon: '●', group: 'color', build: colorControl },
  { id: 'imgMask', label: 'Img Mask', icon: '◧', group: 'color', build: imgMaskControl, visible: () => images.get().length >= 2 },
  { id: 'motion', label: 'Motion', icon: '∿', group: 'motion', build: motionControl },
  { id: 'speed', label: 'Speed', icon: '»', group: 'motion', build: () => sliderControl({ label: 'SPEED', key: 'speed', readout: (v) => `${v.toFixed(1)}×` }) },
  { id: 'loops', label: 'Loops', icon: '⟳', group: 'motion', build: loopsControl },
  { id: 'format', label: 'Format', icon: '▯', group: 'format', build: formatControl },
  { id: 'reset', label: 'Reset', icon: '↺', group: 'actions', build: resetControl },
];
