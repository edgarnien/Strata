import { renderFrame, renderStill, sceneDuration, type Scene } from '../engine/render';
import { effect } from '../state/signal';
import { images, playing, seed, selected, settings, shownClip } from '../state/store';
import { h } from './dom';
import { addImageFiles } from './images';
import { buildScene } from './scene';

export interface PreviewApi {
  /** Animation time currently on screen, or null while paused. */
  currentTime(): number | null;
}

const PAD = 16;

export function mountPreview(root: HTMLElement, pickFiles: () => void): PreviewApi {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) throw new Error('#preview needs a <canvas>');

  let scene: Scene | null = null;
  let dirty = true;
  let raf = 0;
  let startedAt = 0;
  let lastT: number | null = null;
  let empty: HTMLElement | null = null;

  const fitCanvas = () => {
    if (!scene) return;
    const box = root.getBoundingClientRect();
    const scale = Math.min((box.width - PAD * 2) / scene.width, (box.height - PAD * 2) / scene.height);
    const cssW = Math.max(1, Math.floor(scene.width * scale));
    const cssH = Math.max(1, Math.floor(scene.height * scale));
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

  const draw = (now: number) => {
    raf = 0;
    if (dirty) {
      scene = buildScene();
      dirty = false;
      fitCanvas();
    }
    if (!scene) {
      lastT = null;
      return;
    }
    // Render in output coordinates, scaled down to the preview size.
    const k = canvas.width / scene.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (playing.get()) {
      const t = ((now - startedAt) / 1000) % sceneDuration(scene);
      lastT = t;
      shownClip.set(renderFrame(ctx, scene, t));
      raf = requestAnimationFrame(draw);
    } else {
      lastT = null;
      renderStill(ctx, scene, selected.get());
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const invalidate = () => {
    dirty = true;
    schedule();
  };

  effect([settings, images, seed], invalidate);
  selected.subscribe(schedule);
  playing.subscribe((on) => {
    if (on) startedAt = performance.now();
    schedule();
  });
  new ResizeObserver(invalidate).observe(root);

  // Empty state lives in the DOM only while there are no clips – nothing can shine through later.
  effect([images], () => {
    const hasImages = images.get().length > 0;
    canvas.hidden = !hasImages;
    if (hasImages) {
      empty?.remove();
      empty = null;
    } else if (!empty) {
      empty = h('div', { class: 'empty' },
        h('button', { class: 'btn btn--pill', type: 'button', onclick: pickFiles }, '+ UPLOAD IMAGE'),
        h('span', { class: 'empty__hint' }, 'PNG · JPG · WEBP'));
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
    if (e.dataTransfer?.files.length) void addImageFiles([...e.dataTransfer.files]);
  });

  return { currentTime: () => lastT };
}
