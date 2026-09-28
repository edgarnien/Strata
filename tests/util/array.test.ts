import { describe, expect, it } from 'vitest';
import { moveItem } from '../../src/util/array';

describe('moveItem', () => {
  const list = ['a', 'b', 'c'] as const;
  it('moves forward and backward', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b']);
  });
  it('clamps the target and ignores invalid sources', () => {
    expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 5, 0)).toEqual(['a', 'b', 'c']);
  });
  it('never mutates the input', () => {
    moveItem(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
