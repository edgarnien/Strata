import { motionById } from '../engine/motions';
import {
  axisLength, clipAt, clipOffsets, layout, outputTimeOf, strokeSpans, validMarkerTime, videoPositionAt, type Marker,
} from '../engine/videoTimeline';
import { effect } from '../state/signal';
import { markers, playhead, playing, selectedMarker, settings, timelineInput, videoClips, type VideoClipEntry } from '../state/store';
import { formatClock } from '../util/time';
import { removeVideoClip, moveVideoClip } from '../video/clipImport';
import { addMarker, moveMarker, removeMarker } from '../video/markers';
import { h } from './dom';
import { stripTiles } from './filmstrip';
import { toast } from './toast';

const LONG_PRESS_MS = 300;
const FRAME = 1 / 30;

/**
 * Video timeline: clips back to back by length, cuts as filled diamonds, markers as open ones
 * (drag to move, tap to select, × or Delete to remove), the playhead to scrub, where strokes sit hatched.
 * A long press on a clip drags it to a new place.
 */
export function mountTimeline(root: HTMLElement, pickFiles: () => void): void {
  const track = h('div', { class: 'tl__track' });
  const head = h('div', { class: 'tl__head', 'aria-hidden': 'true' });
  const addMarkerBtn = h('button', { class: 'btn btn--ghost btn--pill tl__btn', type: 'button', onclick: () => addAtPlayhead() }, '+ MARKER');
  const addClipBtn = h('button', { class: 'btn btn--ghost btn--pill tl__btn', type: 'button', onclick: pickFiles }, '+ CLIP');
  root.append(track, h('div', { class: 'tl__bar' }, addMarkerBtn, addClipBtn));

  let selectedClip: string | null = null;
  let dragging = false;

  const lay = () => layout(timelineInput());
  const covered = () => motionById(settings.get().motion).covered;
  const axisFrom = (clientX: number) => {
    const r = track.getBoundingClientRect();
    return (Math.min(1, Math.max(0, (clientX - r.left) / r.width))) * axisLength(videoClips.get());
  };
  const pct = (x: number) => `${(x / Math.max(1e-9, axisLength(videoClips.get()))) * 100}%`;
  const seekAxis = (x: number) => {
    const c = clipAt(videoClips.get(), x);
    if (c) playhead.set(outputTimeOf(lay(), c.clipId, c.time));
  };

  const placeHead = () => {
    const l = lay();
    if (l.shots.length === 0) return;
    const pos = videoPositionAt(playhead.get(), l, covered());
    head.style.left = pct((clipOffsets(videoClips.get()).get(pos.shot.clipId) ?? 0) + pos.shot.sourceTime);
  };

  function addAtPlayhead(): void {
    const l = lay();
    if (l.shots.length === 0) return;
    const pos = videoPositionAt(playhead.get(), l, covered());
    const next = addMarker(timelineInput(), pos.shot.clipId, pos.shot.sourceTime);
    if (!next) {
      toast('No room for a marker here – the shots beside it would be too short', 'error');
      return;
    }
    playing.set(false);
    markers.set(next);
    selectedMarker.set(next[next.length - 1].id);
  }

  const dropIndex = (clientX: number, dragged: HTMLElement) => {
    let index = 0;
    track.querySelectorAll<HTMLElement>('.tl__clip').forEach((el) => {
      if (el === dragged) return;
      const r = el.getBoundingClientRect();
      if (clientX > r.left + r.width / 2) index++;
    });
    return index;
  };

  // Track: tap = select clip + seek, drag = scrub, long press on a clip = reorder.
  track.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.tl__marker, .tl__remove')) return;
    track.setPointerCapture(e.pointerId);
    playing.set(false);
    const clipEl = target.closest<HTMLElement>('.tl__clip');
    const startX = e.clientX;
    let mode: 'press' | 'scrub' | 'reorder' = 'press';
    const timer = window.setTimeout(() => {
      if (mode !== 'press' || !clipEl) return;
      mode = 'reorder';
      dragging = true;
      clipEl.classList.add('is-dragging');
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
    const move = (ev: PointerEvent) => {
      if (mode === 'press' && Math.abs(ev.clientX - startX) > 4) {
        mode = 'scrub';
        clearTimeout(timer);
      }
      if (mode === 'scrub') seekAxis(axisFrom(ev.clientX));
      else if (mode === 'reorder' && clipEl) clipEl.style.translate = `${ev.clientX - startX}px 0`;
    };
    const up = (ev: PointerEvent) => {
      clearTimeout(timer);
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', up);
      track.removeEventListener('pointercancel', up);
      if (mode === 'reorder' && clipEl) {
        dragging = false;
        clipEl.style.translate = '';
        clipEl.classList.remove('is-dragging');
        if (ev.type === 'pointerup') moveVideoClip(Number(clipEl.dataset.index), dropIndex(ev.clientX, clipEl));
        render();
        return;
      }
      if (ev.type === 'pointercancel') return;
      seekAxis(axisFrom(ev.clientX));
      if (mode === 'press') {
        selectedClip = clipEl?.dataset.id ?? null;
        selectedMarker.set(null);
        render();
      }
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
  });

  const markerEl = (m: Marker, left: string, isSelected: boolean) => {
    const el = h('button', {
      class: `tl__marker${isSelected ? ' is-selected' : ''}`,
      type: 'button',
      'data-id': m.id,
      style: `left: ${left}`,
      'aria-label': `Marker at ${formatClock(m.time)} in ${videoClips.get().find((c) => c.id === m.clipId)?.name ?? 'clip'}`,
    });
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      playing.set(false);
      const clip = videoClips.get().find((c) => c.id === m.clipId);
      if (!clip) return;
      const base = clipOffsets(videoClips.get()).get(m.clipId) ?? 0;
      const rest = { ...timelineInput(), markers: markers.get().filter((x) => x.id !== m.id) };
      const startX = e.clientX;
      let time: number | null = null;
      const move = (ev: PointerEvent) => {
        if (time === null && Math.abs(ev.clientX - startX) <= 4) return;
        dragging = true;
        // Only the dot moves while dragging; the scene is rebuilt once, on release.
        const valid = validMarkerTime(rest, m.clipId, Math.min(clip.duration, Math.max(0, axisFrom(ev.clientX) - base)));
        if (valid === null) return;
        time = valid;
        el.style.left = pct(base + valid);
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        dragging = false;
        if (time !== null) markers.set(moveMarker(timelineInput(), m.id, time));
        else selectedMarker.set(selectedMarker.get() === m.id ? null : m.id);
        render();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        markers.set(removeMarker(markers.get(), m.id));
        selectedMarker.set(null);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        markers.set(moveMarker(timelineInput(), m.id, m.time + (e.key === 'ArrowLeft' ? -FRAME : FRAME)));
      }
    });
    return el;
  };

  /** Frames at their own aspect, as many as fit the clip's current width. */
  const fillStrip = (strip: HTMLElement, c: VideoClipEntry) => {
    const { width, height } = strip.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const t = stripTiles(width, height, c.stripFrames, c.width / c.height);
    const last = Math.max(1, c.stripFrames - 1);
    strip.replaceChildren(...t.frames.map((f) => h('span', {
      class: 'tl__tile',
      style: `width: ${t.tileWidth}px; background-image: url("${c.stripUrl}"); background-size: ${t.tileWidth * c.stripFrames}px 100%; background-position-x: ${(f / last) * 100}%`,
    })));
  };
  const fillStrips = () => {
    const clips = videoClips.get();
    track.querySelectorAll<HTMLElement>('.tl__clip').forEach((el) => {
      const c = clips.find((x) => x.id === el.dataset.id);
      const strip = el.querySelector<HTMLElement>('.tl__strip');
      if (c && strip) fillStrip(strip, c);
    });
  };

  const render = () => {
    if (dragging) return;
    const clips = videoClips.get();
    root.hidden = settings.get().mode !== 'video' || clips.length === 0;
    if (root.hidden) return;
    const offsets = clipOffsets(clips);
    const l = lay();
    const sel = selectedMarker.get();
    const list = markers.get();
    const selected = list.find((m) => m.id === sel);
    // Rebuilding the track destroys the focused marker; remember it so keyboard nudging can continue.
    const active = document.activeElement;
    const focusedId = active instanceof HTMLElement && track.contains(active) ? active.closest<HTMLElement>('.tl__marker')?.dataset.id : undefined;
    const children: (HTMLElement | null)[] = [
      ...clips.map((c, i) => h('div', {
        class: `tl__clip${c.id === selectedClip ? ' is-selected' : ''}`,
        'data-index': i,
        'data-id': c.id,
        style: `flex-grow: ${c.duration}`,
      },
      h('div', { class: 'tl__strip' }),
      c.id === selectedClip
        ? h('button', {
          class: 'tl__remove',
          type: 'button',
          'aria-label': `Remove ${c.name}`,
          onclick: () => {
            selectedClip = null;
            removeVideoClip(i);
          },
        }, '×')
        : null)),
      ...clips.slice(1).map((c) => h('span', { class: 'tl__cut', style: `left: ${pct(offsets.get(c.id) ?? 0)}` })),
      ...strokeSpans(l, clips).map((s) => h('span', { class: 'tl__strokes', style: `left: ${pct(s.from)}; width: ${pct(s.to - s.from)}` })),
      ...list.map((m) => markerEl(m, pct((offsets.get(m.clipId) ?? 0) + m.time), m.id === sel)),
      selected
        ? h('button', {
          class: 'tl__remove tl__remove--marker',
          type: 'button',
          style: `left: ${pct((offsets.get(selected.clipId) ?? 0) + selected.time)}`,
          'aria-label': 'Remove marker',
          onclick: () => {
            markers.set(removeMarker(markers.get(), selected.id));
            selectedMarker.set(null);
          },
        }, '×')
        : null,
      head,
    ];
    track.replaceChildren(...children.filter((el): el is HTMLElement => el !== null));
    if (focusedId) track.querySelector<HTMLElement>(`.tl__marker[data-id="${focusedId}"]`)?.focus();
    fillStrips();
    placeHead();
  };

  // A click anywhere outside the timeline, or Esc, lets go of the selected clip and marker.
  const deselect = () => {
    if (selectedClip === null && selectedMarker.get() === null) return;
    selectedClip = null;
    selectedMarker.set(null);
    render();
  };
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target as Node)) deselect();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') deselect();
  });

  effect([settings, videoClips, markers, selectedMarker], render);
  new ResizeObserver(fillStrips).observe(track);
  playhead.subscribe(placeHead);
}
