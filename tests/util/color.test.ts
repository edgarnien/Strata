import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, normalizeHex, pickFromWheel, wheelPoint } from '../../src/util/color';

describe('normalizeHex', () => {
  it('accepts six hex digits with or without #', () => {
    expect(normalizeHex('#abc123')).toBe('#ABC123');
    expect(normalizeHex(' ABC123 ')).toBe('#ABC123');
  });
  it('rejects anything else', () => {
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345G')).toBeNull();
  });
});

describe('hsvToHex', () => {
  it('converts primaries, white and black', () => {
    expect(hsvToHex(0, 100, 100)).toBe('#FF0000');
    expect(hsvToHex(120, 100, 100)).toBe('#00FF00');
    expect(hsvToHex(90, 100, 100)).toBe('#80FF00');
    expect(hsvToHex(210, 0, 100)).toBe('#FFFFFF');
    expect(hsvToHex(210, 80, 0)).toBe('#000000');
  });
  it('saturation mixes the hue with white, value darkens', () => {
    expect(hsvToHex(240, 50, 100)).toBe('#8080FF');
    expect(hsvToHex(0, 100, 50)).toBe('#800000');
  });
});

describe('hexToHsv', () => {
  it('reads hue, saturation and value', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(hexToHsv('#00FF00')).toEqual({ h: 120, s: 100, v: 100 });
    expect(hexToHsv('#FFFFFF')).toEqual({ h: 0, s: 0, v: 100 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
  });
  it('round-trips through hsvToHex', () => {
    for (const hex of ['#8080FF', '#12AB9C', '#FF3B30', '#7F7F7F', '#010203']) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });
});

describe('pickFromWheel', () => {
  it('the centre is unsaturated, the rim fully saturated', () => {
    expect(pickFromWheel(0, 0, 100).saturation).toBe(0);
    expect(pickFromWheel(100, 0, 100)).toEqual({ hue: 0, saturation: 100 });
    expect(pickFromWheel(50, 0, 100).saturation).toBe(50);
  });
  it('hue runs clockwise from the right (y points down)', () => {
    expect(pickFromWheel(0, 100, 100).hue).toBe(90);
    expect(pickFromWheel(-100, 0, 100).hue).toBe(180);
    expect(pickFromWheel(0, -100, 100).hue).toBe(270);
  });
  it('clamps points outside the wheel to the rim', () => {
    expect(pickFromWheel(200, 0, 100)).toEqual({ hue: 0, saturation: 100 });
  });
});

describe('wheelPoint', () => {
  it('is the inverse of pickFromWheel on a unit wheel', () => {
    const p = wheelPoint(90, 50);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0.5);
    const q = pickFromWheel(wheelPoint(200, 70).x * 100, wheelPoint(200, 70).y * 100, 100);
    expect(q.hue).toBeCloseTo(200);
    expect(q.saturation).toBeCloseTo(70);
  });
});
