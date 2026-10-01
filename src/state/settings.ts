import { FORMAT_IDS, MOTION_IDS, MOVE_IDS, type Settings } from '../engine/types';
import { normalizeHex } from '../util/color';

export const STORAGE_KEY = 'strata:v2';

export const DEFAULT_SETTINGS: Settings = {
  size: 80,
  stretch: 0,
  threshold: 35,
  removeFront: false,
  sensitivity: 50,
  color: '#FFFFFF',
  imgMask: false,
  motion: 'buildUp',
  speed: 1,
  loops: 2,
  format: '9:16',
  move: 'off',
};

export type RangeKey = 'size' | 'stretch' | 'threshold' | 'sensitivity' | 'speed' | 'loops';

export const RANGES: Record<RangeKey, { min: number; max: number; step: number }> = {
  size: { min: 25, max: 100, step: 1 },
  stretch: { min: 0, max: 100, step: 1 },
  threshold: { min: 0, max: 100, step: 1 },
  sensitivity: { min: 10, max: 100, step: 1 },
  speed: { min: 0.5, max: 10, step: 0.5 },
  loops: { min: 1, max: 10, step: 1 },
};

export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const ranged = (key: RangeKey): number => {
    const v = r[key];
    const { min, max, step } = RANGES[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return d[key];
    return Math.round(v / step) * step;
  };
  const bool = (key: 'removeFront' | 'imgMask'): boolean => (typeof r[key] === 'boolean' ? (r[key] as boolean) : d[key]);
  const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    (options as readonly unknown[]).includes(v) ? (v as T) : fallback;

  return {
    size: ranged('size'),
    stretch: ranged('stretch'),
    threshold: ranged('threshold'),
    removeFront: bool('removeFront'),
    sensitivity: ranged('sensitivity'),
    color: (typeof r.color === 'string' && normalizeHex(r.color)) || d.color,
    imgMask: bool('imgMask'),
    motion: oneOf(r.motion, MOTION_IDS, d.motion),
    speed: ranged('speed'),
    loops: ranged('loops'),
    format: oneOf(r.format, FORMAT_IDS, d.format),
    move: oneOf(r.move, MOVE_IDS, d.move),
  };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = browserStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    // IMG MASK is a per-session choice (legacy never persisted it)
    return { ...parseSettings(raw ? JSON.parse(raw) : null), imgMask: false };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked (private mode): settings just won't persist.
  }
}
