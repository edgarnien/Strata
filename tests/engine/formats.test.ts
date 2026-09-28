import { describe, expect, it } from 'vitest';
import { FORMATS, fitFor, outputSize, pixelLabel } from '../../src/engine/formats';

describe('outputSize', () => {
  it('uses fixed sizes for the social formats', () => {
    expect(outputSize('9:16', null)).toEqual({ width: 1080, height: 1920 });
    expect(outputSize('4:5', null)).toEqual({ width: 1080, height: 1350 });
    expect(outputSize('16:9', null)).toEqual({ width: 1920, height: 1080 });
  });
  it('original follows the first clip, capped at 2000 px and even', () => {
    expect(outputSize('original', { width: 3024, height: 4032 })).toEqual({ width: 1500, height: 2000 });
    expect(outputSize('original', { width: 1001, height: 777 })).toEqual({ width: 1000, height: 776 });
    expect(outputSize('original', { width: 6000, height: 4000 })).toEqual({ width: 2000, height: 1332 });
    expect(outputSize('original', { width: 1, height: 1 })).toEqual({ width: 2, height: 2 });
  });
  it('original without an image has no size', () => {
    expect(outputSize('original', null)).toBeNull();
  });
});

describe('format metadata', () => {
  it('lists 9:16 first and ORIGINAL last', () => {
    expect(FORMATS.map((f) => f.label)).toEqual(['9:16', '4:5', '16:9', 'ORIGINAL']);
    expect(FORMATS.map((f) => f.icon)).toEqual(['▯', '▯', '▭', '□']);
  });
  it('crops fixed formats and letterboxes original', () => {
    expect(fitFor('9:16')).toBe('cover');
    expect(fitFor('original')).toBe('contain');
  });
  it('formats pixel labels', () => {
    expect(pixelLabel({ width: 1080, height: 1920 })).toBe('1080 × 1920');
    expect(pixelLabel(null)).toBe('—');
  });
});
