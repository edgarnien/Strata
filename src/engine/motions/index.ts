import type { MotionId } from '../types';
import { buildUp } from './buildUp';
import { fade } from './fade';
import { glitch } from './glitch';
import { impulse } from './impulse';
import { reveal } from './reveal';
import type { Motion } from './types';
import { wave } from './wave';

export type { FrameInput, Motion } from './types';

export const MOTIONS: readonly Motion[] = [buildUp, impulse, wave, fade, glitch, reveal];

export function motionById(id: MotionId): Motion {
  return MOTIONS.find((m) => m.id === id) ?? buildUp;
}
