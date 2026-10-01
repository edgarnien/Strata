import { describe, expect, it } from 'vitest';
import { formatClock } from '../../src/util/time';

describe('formatClock', () => {
  it('shows minutes and two-digit seconds, rounded down', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7.9)).toBe('0:07');
    expect(formatClock(83)).toBe('1:23');
    expect(formatClock(-1)).toBe('0:00');
  });
});
