import { describe, expect, it } from 'vitest';
import { hslToHex, normalizeHex, pickFromWheel } from '../../src/util/color';

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

describe('hslToHex', () => {
  it('converts primaries and greys', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    expect(hslToHex(90, 100, 50)).toBe('#80FF00');
    expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
  });
});

describe('pickFromWheel', () => {
  it('centre halves pick black (left) and white (right)', () => {
    expect(pickFromWheel(-5, 0, 100, 100).hex).toBe('#000000');
    expect(pickFromWheel(5, 0, 100, 100).hex).toBe('#FFFFFF');
    expect(pickFromWheel(5, 0, 100, 100).hue).toBeNull();
  });
  it('the rim is fully saturated; outside is clamped to the rim', () => {
    expect(pickFromWheel(100, 0, 100, 100).hex).toBe('#FF0000');
    const outside = pickFromWheel(200, 0, 100, 100);
    expect(outside.hex).toBe('#FF0000');
    expect(outside.cursor).toEqual({ x: 100, y: 0 });
  });
  it('brightness scales lightness', () => {
    expect(pickFromWheel(100, 0, 100, 0).hex).toBe('#000000');
  });
});
