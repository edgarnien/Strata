import { describe, expect, it } from 'vitest';
import { isAcceptedVideo } from '../../src/video/accept';

describe('isAcceptedVideo', () => {
  it('accepts MP4, MOV and WEBM by type or, without a type, by extension', () => {
    expect(isAcceptedVideo({ type: 'video/mp4', name: 'a.mp4' })).toBe(true);
    expect(isAcceptedVideo({ type: 'video/quicktime', name: 'IMG_0001.MOV' })).toBe(true);
    expect(isAcceptedVideo({ type: 'video/webm', name: 'a.webm' })).toBe(true);
    expect(isAcceptedVideo({ type: '', name: 'clip.MOV' })).toBe(true);
  });
  it('rejects images and other video containers', () => {
    expect(isAcceptedVideo({ type: 'image/png', name: 'a.png' })).toBe(false);
    expect(isAcceptedVideo({ type: 'video/x-msvideo', name: 'a.avi' })).toBe(false);
    expect(isAcceptedVideo({ type: '', name: 'a.avi' })).toBe(false);
  });
});
