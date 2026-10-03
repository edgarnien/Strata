import { renderFrame, renderStill, sceneDuration, type Scene } from '../engine/render';
import { renderVideoFrame, videoPosition } from '../engine/renderVideo';
import type { Size } from '../engine/types';
import { effect } from '../state/signal';
import { hasContent, images, playhead, playing, seed, selected, settings, shownClip, videoClips } from '../state/store';
import { VideoPlayer } from '../video/player';
import { videoScene } from '../video/scene';
import { h } from './dom';
import { buildScene } from './scene';

export interface PreviewApi {
  /** Photo mode: animation time currently on screen, or null while paused. */
  currentTime(): number | null;
  /** Video mode: the frame under the playhead at output size, as PNG. */
  videoStill(): Promise<Blob | null>;
}

const PAD = 16;
/** How long the clock waits for a video to start or seek before it runs on without it (s). */
const MAX_WAIT = 0.5;
/** Longest step the clock takes in one frame, so a stalled tab doesn't jump ahead (s). */
const MAX_STEP = 0.1;

export function mountPreview(root: HTMLElement, pickFiles: () => void, addFiles: (files: File[]) => void, videoHost: HTMLElement): PreviewApi {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) throw new Error('#preview needs a <canvas>');

  const player = new VideoPlayer(videoHost);
  let photo: Scene | null = null;
  let size: Size | null = null;
  let dirty = true;
  let raf = 0;
  let startedAt = 0;
  /** Video mode while playing: the clock, its last tick and how long it has waited for the video. */
  let clock = 0;
  let tickedAt = 0;
  let waited = 0;
  let lastT: number | null = null;
  let empty: HTMLElement | null = null;
  let emptyMode = '';

  const isVideo = () => settings.get().mode === 'video';

  const fitCanvas = () => {
    if (!size) return;
    const box = root.getBoundingClientRect();
    const scale = Math.min((box.width - PAD * 2) / size.width, (box.height - PAD * 2) / size.height);
    const cssW = Math.max(1, Math.floor(size.width * scale));
    const cssH = Math.max(1, Math.floor(size.height * scale));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const w = Math.round(cssW * dpr);
    const hgt = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
  };

  /** Returns whether to draw again next frame. */
  const drawPhoto = (now: number): boolean => {
    if (!photo) return false;
    if (playing.get()) {
      const t = ((now - startedAt) / 1000) % sceneDuration(photo);
      lastT = t;
      shownClip.set(renderFrame(ctx, photo, t));
      return true;
    }
    lastT = null;
    renderStill(ctx, photo, selected.get());
    return false;
  };

  const drawVideo = (now: number): boolean => {
    const scene = videoScene.get();
    if (!scene || scene.layout.shots.length === 0) {
      player.pause();
      return false;
    }
    const lay = scene.layout;
    let t = Math.min(playhead.get(), lay.duration);
    if (playing.get()) {
      // The shown video sets the pace; the clock only runs on its own while no video can lead.
      const step = Math.min(MAX_STEP, Math.max(0, (now - tickedAt) / 1000));
      tickedAt = now;
      const lead = player.lead(lay, videoPosition(scene, clock));
      if (typeof lead === 'number') {
        clock = lead;
        waited = 0;
      } else if (lead === 'wait' && waited < MAX_WAIT) {
        waited += step;
      } else {
        clock += step;
      }
      if (clock >= lay.duration) clock = 0;
      t = clock;
      playhead.set(t);
    }
    const pos = videoPosition(scene, t);
    player.sync(scene.layout, pos, t, playing.get(), scene.settings.audio);
    const frames = player.frames(pos);
    if (frames) renderVideoFrame(ctx, scene, pos, frames);
    return playing.get() || player.busy() || !frames;
  };

  const draw = (now: number) => {
    raf = 0;
    if (dirty) {
      photo = isVideo() ? null : buildScene();
      size = isVideo() ? videoScene.get() : photo;
      dirty = false;
      fitCanvas();
    }
    if (!size) {
      lastT = null;
      return;
    }
    // Render in output coordinates, scaled down to the preview size. Each axis scales on its own:
    // the canvas is rounded to whole pixels, and one factor for both left an empty row at the bottom.
    ctx.setTransform(canvas.width / size.width, 0, 0, canvas.height / size.height, 0, 0);
    const again = isVideo() ? drawVideo(now) : drawPhoto(now);
    if (again && !raf) raf = requestAnimationFrame(draw);
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const invalidate = () => {
    dirty = true;
    if (!isVideo()) player.pause();
    schedule();
  };

  effect([settings, images, seed, videoScene], invalidate);
  selected.subscribe(schedule);
  playhead.subscribe(schedule);
  playing.subscribe((on) => {
    if (on) {
      startedAt = performance.now();
      const duration = videoScene.get()?.layout.duration ?? 0;
      clock = playhead.get() >= duration - 1 / 30 ? 0 : playhead.get();
      tickedAt = startedAt;
      waited = 0;
      player.allowSound();
    } else {
      player.pause();
    }
    schedule();
  });
  new ResizeObserver(invalidate).observe(root);

  // Empty state lives in the DOM only while there is nothing to show – nothing can shine through later.
  effect([images, videoClips, settings], () => {
    const has = hasContent();
    const mode = settings.get().mode;
    canvas.hidden = !has;
    if (has || emptyMode !== mode) {
      empty?.remove();
      empty = null;
    }
    if (!has && !empty) {
      emptyMode = mode;
      const video = mode === 'video';
      empty = h('div', { class: 'empty' },
        h('button', { class: 'btn btn--pill', type: 'button', onclick: pickFiles }, video ? '+ UPLOAD VIDEO' : '+ UPLOAD IMAGE'),
        h('span', { class: 'empty__hint' }, video ? 'MP4 · MOV · WEBM' : 'PNG · JPG · WEBP'));
      root.append(empty);
    }
  });

  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('dragover');
  });
  root.addEventListener('dragleave', () => root.classList.remove('dragover'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('dragover');
    if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]);
  });

  return {
    currentTime: () => lastT,
    async videoStill() {
      const scene = videoScene.get();
      if (!scene) return null;
      const pos = videoPosition(scene, playhead.get());
      const frames = player.frames(pos);
      if (!frames) return null;
      const out = new OffscreenCanvas(scene.width, scene.height);
      const octx = out.getContext('2d');
      if (!octx) return null;
      renderVideoFrame(octx, scene, pos, frames);
      return out.convertToBlob({ type: 'image/png' });
    },
  };
}
