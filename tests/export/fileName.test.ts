import { describe, expect, it } from 'vitest';
import { exportFileName } from '../../src/export/save';

describe('exportFileName', () => {
  const when = new Date(2026, 8, 28, 14, 32);
  it('encodes format and local time', () => {
    expect(exportFileName('9:16', 'mp4', when)).toBe('strata-9x16-20260928-1432.mp4');
    expect(exportFileName('16:9', 'png', when)).toBe('strata-16x9-20260928-1432.png');
    expect(exportFileName('original', 'png', when)).toBe('strata-original-20260928-1432.png');
  });
  it('zero-pads months, days, hours and minutes', () => {
    expect(exportFileName('4:5', 'mp4', new Date(2027, 0, 3, 4, 5))).toBe('strata-4x5-20270103-0405.mp4');
  });
});
