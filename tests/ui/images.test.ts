import { beforeEach, describe, expect, it } from 'vitest';
import { images, patchSettings, playing, selected, settings, type ImageEntry } from '../../src/state/store';
import { moveImage, removeImage } from '../../src/ui/images';

const entry = (id: string): ImageEntry => ({
  id,
  name: `${id}.png`,
  bitmap: { width: 10, height: 10, close() {} } as unknown as ImageBitmap,
  thumbUrl: `blob:${id}`,
});
const ids = () => images.get().map((i) => i.id);

beforeEach(() => {
  images.set([entry('a'), entry('b'), entry('c')]);
  selected.set(2);
  playing.set(true);
  patchSettings({ imgMask: true });
});

describe('removeImage', () => {
  it('keeps the selection inside the list', () => {
    removeImage(2);
    expect(ids()).toEqual(['a', 'b']);
    expect(selected.get()).toBe(1);
    expect(playing.get()).toBe(true);
  });
  it('switches IMG MASK off below two clips', () => {
    removeImage(0);
    expect(settings.get().imgMask).toBe(true);
    removeImage(0);
    expect(settings.get().imgMask).toBe(false);
  });
  it('stops playback when the last clip goes', () => {
    removeImage(0);
    removeImage(0);
    removeImage(0);
    expect(images.get()).toEqual([]);
    expect(playing.get()).toBe(false);
    expect(selected.get()).toBe(0);
  });
  it('ignores indices outside the list', () => {
    removeImage(7);
    expect(ids()).toEqual(['a', 'b', 'c']);
  });
});

describe('moveImage', () => {
  it('reorders and keeps the moved clip selected', () => {
    moveImage(0, 2);
    expect(ids()).toEqual(['b', 'c', 'a']);
    expect(selected.get()).toBe(2);
  });
});
