import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, parseSettings, saveSettings } from '../../src/state/settings';

describe('parseSettings', () => {
  it('returns defaults for missing input', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.format).toBe('9:16');
    expect(DEFAULT_SETTINGS.loops).toBe(2);
  });
  it('keeps valid values', () => {
    const custom = { ...DEFAULT_SETTINGS, size: 40, motion: 'wave', format: '4:5', speed: 2.5, loops: 5, removeFront: true, color: '#00FF00' };
    expect(parseSettings(custom)).toEqual(custom);
  });
  it('replaces invalid or out-of-range values with defaults', () => {
    const parsed = parseSettings({ format: '21:9', speed: 'fast', size: 500, color: 'red', motion: 'motion1', loops: 0, imgMask: 'yes' });
    expect(parsed).toEqual(DEFAULT_SETTINGS);
  });
  it('normalises colours and snaps to slider steps', () => {
    expect(parseSettings({ color: 'ff00aa' }).color).toBe('#FF00AA');
    expect(parseSettings({ speed: 2.3 }).speed).toBe(2.5);
    expect(parseSettings({ size: 40.4 }).size).toBe(40);
  });
});

describe('load / save', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };
  it('round-trips through storage', () => {
    const store = memory();
    saveSettings({ ...DEFAULT_SETTINGS, loops: 7 }, store);
    expect(loadSettings(store).loops).toBe(7);
  });
  it('survives broken JSON, throwing storage and missing storage', () => {
    expect(loadSettings({ getItem: () => '{nope' })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, { setItem: () => { throw new Error('full'); } })).not.toThrow();
  });
  it('uses the v2 key only', () => {
    expect(STORAGE_KEY).toBe('strata:v2');
    expect(loadSettings({ getItem: (k: string) => (k === 'pixelToolSettings' ? '{"aspectRatio":"original"}' : null) }).format).toBe('9:16');
  });
});
