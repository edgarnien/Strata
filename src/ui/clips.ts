import { effect } from '../state/signal';
import { images, playing, selected, settings, shownClip } from '../state/store';
import { h } from './dom';
import { moveImage, removeImage } from './images';

const LONG_PRESS_MS = 300;

/** Thumbnails in play order. Tap = select, × = remove, drag (long-press on touch) = reorder. */
export function mountClips(root: HTMLElement, pickFiles: () => void): void {
  let dragging = false;

  const markCurrent = () => {
    const current = playing.get() ? shownClip.get() : selected.get();
    root.querySelectorAll<HTMLElement>('.clip[data-index]').forEach((el) => {
      el.classList.toggle('is-current', Number(el.dataset.index) === current);
    });
  };

  const dropIndex = (dragged: HTMLElement, clientX: number) => {
    let index = 0;
    root.querySelectorAll<HTMLElement>('.clip[data-index]').forEach((el) => {
      if (el === dragged) return;
      const r = el.getBoundingClientRect();
      if (clientX > r.left + r.width / 2) index++;
    });
    return index;
  };

  const wire = (el: HTMLElement, index: number) => {
    let pointerId = -1;
    let startX = 0;
    let timer = 0;
    let active = false;
    const begin = (e: PointerEvent) => {
      active = true;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      navigator.vibrate?.(10);
    };
    const stop = () => {
      clearTimeout(timer);
      pointerId = -1;
      if (!active) return;
      active = false;
      dragging = false;
      el.classList.remove('is-dragging');
      el.style.translate = '';
    };
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.clip__remove')) return;
      el.setPointerCapture(e.pointerId);
      pointerId = e.pointerId;
      startX = e.clientX;
      if (e.pointerType === 'touch') timer = window.setTimeout(() => begin(e), LONG_PRESS_MS);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!active) {
        if (e.pointerType !== 'touch' && Math.abs(dx) > 4) begin(e);
        else if (e.pointerType === 'touch' && Math.abs(dx) > 8) stop(); // the finger is scrolling the strip
        return;
      }
      el.style.translate = `${dx}px 0`;
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointerId) return;
      const wasDragging = active;
      stop();
      if (wasDragging) moveImage(index, dropIndex(el, e.clientX));
      else selected.set(index);
    });
    el.addEventListener('pointercancel', stop);
    // Once a long-press drag has started, the strip must not scroll under the finger.
    el.addEventListener('touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
    el.addEventListener('keydown', (e) => {
      if (e.target !== el) return; // keys on the nested × button keep their native click
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected.set(index); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeImage(index); }
      else if (e.key === 'ArrowLeft' && index > 0) moveImage(index, index - 1);
      else if (e.key === 'ArrowRight' && index < images.get().length - 1) moveImage(index, index + 1);
    });
  };

  const render = () => {
    if (dragging) return;
    const list = images.get();
    const sel = selected.get();
    const hadFocus = root.contains(document.activeElement);
    root.hidden = list.length === 0 || settings.get().mode !== 'photo';
    root.replaceChildren(
      ...list.map((img, i) => {
        const el = h('div', { class: 'clip', role: 'button', tabindex: 0, 'data-index': i, 'aria-label': `Image ${i + 1}: ${img.name}` },
          h('img', { src: img.thumbUrl, alt: '', draggable: 'false' }),
          i === sel && !playing.get()
            ? h('button', {
              class: 'clip__remove',
              type: 'button',
              'aria-label': `Remove image ${i + 1}`,
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                removeImage(i);
              },
            }, '×')
            : null);
        wire(el, i);
        return el;
      }),
      h('button', { class: 'clip clip--add', type: 'button', 'aria-label': 'Add images', onclick: pickFiles }, '+'),
    );
    markCurrent();
    if (hadFocus) root.querySelector<HTMLElement>(`.clip[data-index="${sel}"]`)?.focus();
  };

  effect([images, selected, playing, settings], render);
  shownClip.subscribe(markCurrent);
}
