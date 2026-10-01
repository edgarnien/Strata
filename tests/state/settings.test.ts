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
  it('never restores IMG MASK across a reload (per-session choice)', () => {
    const store = memory();
    saveSettings({ ...DEFAULT_SETTINGS, imgMask: true, loops: 4 }, store);
    const loaded = loadSettings(store);
    expect(loaded.imgMask).toBe(false);
    expect(loaded.loops).toBe(4);
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

describe('MOVE settings', () => {
  it('keeps a valid move and falls back to OFF otherwise', () => {
    expect(parseSettings({ move: 'depth' }).move).toBe('depth');
    expect(parseSettings({ move: 'spin' }).move).toBe('off');
    expect(parseSettings({ move: 'slide', moveStrokes: true })).not.toHaveProperty('moveStrokes');
  });
});

describe('video settings', () => {
  it('defaults to photo mode with 0.6 s, intro, outro and sound on', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ mode: 'photo', dauer: 0.6, intro: true, outro: true, audio: true });
  });
  it('keeps valid video values and snaps DURATION to 0.1 s without float noise', () => {
    const parsed = parseSettings({ mode: 'video', dauer: 0.63, intro: false, outro: true, audio: false });
    expect(parsed).toMatchObject({ mode: 'video', dauer: 0.6, intro: false, outro: true, audio: false });
    expect(parseSettings({ dauer: 0.7 }).dauer).toBe(0.7);
  });
  it('replaces unknown modes and out-of-range durations', () => {
    expect(parseSettings({ mode: 'audio', dauer: 3 })).toMatchObject({ mode: 'photo', dauer: 0.6 });
  });
  it('fills the new fields when stored settings predate them', () => {
    expect(parseSettings({ size: 40 })).toMatchObject({ size: 40, mode: 'photo', intro: true, outro: true, audio: true });
  });
});
