import { describe, expect, it } from 'vitest';
import { decodeErrorMessage } from '../../src/export/decodeError';

describe('decodeErrorMessage', () => {
  it('explains a clip whose file can no longer be read', () => {
    const gone = 'IMG_0517.mov can no longer be read – the original file was moved or deleted. Add the clip again.';
    expect(decodeErrorMessage('IMG_0517.mov', new TypeError('network error'))).toBe(gone);
    expect(decodeErrorMessage('IMG_0517.mov', new DOMException('x', 'NotReadableError'))).toBe(gone);
  });
  it('keeps other decode errors as they are, with the clip name', () => {
    expect(decodeErrorMessage('a.mp4', new Error('bad packet'))).toBe('a.mp4 could not be decoded: bad packet');
  });
});
