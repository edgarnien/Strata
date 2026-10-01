import { FORMATS, outputSize, pixelLabel } from '../engine/formats';
import { MOTIONS } from '../engine/motions';
import { MOVES } from '../engine/move';
import type { FormatId, MotionId, MoveId, Settings } from '../engine/types';
import { dauerLimit } from '../engine/videoTimeline';
import { RANGES, type RangeKey } from '../state/settings';
import { effect } from '../state/signal';
import { colorLocked, firstSourceSize, images, markers, patchSettings, settings, timelineInput, videoClips } from '../state/store';
import { normalizeHex } from '../util/color';
import { formatClock } from '../util/time';
import { colorWheel } from './colorWheel';
import { h } from './dom';
import { dropdown } from './dropdown';
import { anchorPopover } from './popover';

const label = (text: string, value?: HTMLElement | null) =>
  h('div', { class: 'field__label' }, h('span', {}, text), value ?? null);

export function sliderControl(opts: { label: string; key: RangeKey; readout?: (v: number) => string }): HTMLElement {
  const { min, max, step } = RANGES[opts.key];
  const input = h('input', { class: 'range', type: 'range', min, max, step, 'aria-label': opts.label });
  const value = opts.readout ? h('span', { class: 'field__value' }) : null;
  input.addEventListener('input', () => {
    const patch: Partial<Settings> = {};
    patch[opts.key] = Number(input.value);
    patchSettings(patch);
  });
  effect([settings], () => {
    const v = settings.get()[opts.key];
    if (Number(input.value) !== v) input.value = String(v);
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
    if (value && opts.readout) value.textContent = opts.readout(v);
  });
  return h('div', { class: 'field' }, label(opts.label, value), input);
}

export function loopsControl(): HTMLElement {
  const { min, max } = RANGES.loops;
  const value = h('span', { class: 'stepper__value', 'aria-live': 'polite' });
  const step = (d: number) => patchSettings({ loops: Math.min(max, Math.max(min, settings.get().loops + d)) });
  const minus = h('button', { class: 'btn stepper__btn', type: 'button', 'aria-label': 'Fewer loops', onclick: () => step(-1) }, '−');
  const plus = h('button', { class: 'btn stepper__btn', type: 'button', 'aria-label': 'More loops', onclick: () => step(1) }, '+');
  effect([settings], () => {
    const loops = settings.get().loops;
    value.textContent = `${loops}×`;
    minus.disabled = loops <= min;
    plus.disabled = loops >= max;
  });
  return h('div', { class: 'field field--inline' }, label('LOOPS'), h('div', { class: 'stepper' }, minus, value, plus));
}

export function removeControl(): HTMLElement {
  const side = (removeFront: boolean, text: string) => {
    const btn = h('button', { class: 'btn', type: 'button', onclick: () => patchSettings({ removeFront }) }, text);
    effect([settings], () => btn.setAttribute('aria-pressed', String(settings.get().removeFront === removeFront)));
    return btn;
  };
  return h('div', { class: 'field' },
    label('REMOVE'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Remove' }, side(false, 'BACK'), side(true, 'FRONT')),
    sliderControl({ label: 'SENSITIVITY', key: 'sensitivity' }));
}

export function colorControl(): HTMLElement {
  const input = h('input', { class: 'hex', type: 'text', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Hex colour' });
  const swatch = h('button', { class: 'swatch', type: 'button', 'aria-label': 'Open colour wheel' });
  const wheel = colorWheel((hex) => patchSettings({ color: hex }));
  const pop = h('div', { class: 'popover' }, wheel.el);
  pop.popover = 'auto';
  swatch.popoverTargetElement = pop;
  anchorPopover(pop, swatch, { beside: () => swatch.closest<HTMLElement>('.sidebar') });

  input.addEventListener('input', () => {
    const hex = normalizeHex(input.value);
    if (hex) patchSettings({ color: hex });
  });
  input.addEventListener('change', () => {
    if (!normalizeHex(input.value)) input.value = settings.get().color;
  });
  effect([settings], () => {
    const c = settings.get().color;
    if (document.activeElement !== input) input.value = c;
    swatch.style.setProperty('--swatch', c);
    wheel.set(c);
  });
  const hint = h('span', {});
  const field = h('div', { class: 'field' }, label('COLOR', hint), h('div', { class: 'color' }, swatch, input, pop));
  effect([settings, images, videoClips, markers], () => {
    const locked = colorLocked();
    field.classList.toggle('is-disabled', locked);
    hint.textContent = locked ? 'OFF · IMG MASK' : '';
    input.disabled = locked;
    swatch.disabled = locked;
    if (locked && pop.matches(':popover-open')) pop.hidePopover();
  });
  return field;
}

type SwitchKey = 'imgMask' | 'intro' | 'outro' | 'audio';

function switchField(text: string, key: SwitchKey): HTMLElement {
  const toggle = h('button', {
    class: 'switch',
    type: 'button',
    role: 'switch',
    'aria-label': text.toLowerCase(),
    onclick: () => {
      const patch: Partial<Settings> = {};
      patch[key] = !settings.get()[key];
      patchSettings(patch);
    },
  });
  effect([settings], () => toggle.setAttribute('aria-checked', String(settings.get()[key])));
  return h('div', { class: 'field field--inline' }, label(text), toggle);
}

export const imgMaskControl = (): HTMLElement => switchField('IMG MASK', 'imgMask');
export const introOutroControl = (): HTMLElement => h('div', { class: 'field' }, switchField('INTRO', 'intro'), switchField('OUTRO', 'outro'));
export const audioControl = (): HTMLElement => switchField('SOUND', 'audio');

/** DURATION: one stroke phase in seconds, the same for every cut; says when a short shot caps it. */
export function dauerControl(): HTMLElement {
  const field = sliderControl({ label: 'DURATION', key: 'dauer', readout: (v) => `${v.toFixed(1)} s` });
  const hint = h('p', { class: 'field__hint' });
  effect([settings, videoClips, markers], () => {
    const limit = dauerLimit(timelineInput());
    const capped = settings.get().dauer > limit.max;
    hint.hidden = !capped;
    if (capped) hint.textContent = `MAX ${limit.max.toFixed(2)} S · SHORT SHOT AT ${formatClock(limit.axisAt ?? 0)}`;
  });
  field.append(hint);
  return field;
}

export function motionControl(): HTMLElement {
  return dropdown<MotionId>({
    label: 'MOTION',
    options: () => MOTIONS.map((m) => ({ value: m.id, icon: m.icon, label: m.label })),
    value: () => settings.get().motion,
    onSelect: (motion) => patchSettings({ motion }),
    deps: [settings],
  });
}

/** MOVE: how the stroke layer moves while it builds up and falls away. */
export function moveControl(): HTMLElement {
  return dropdown<MoveId>({
    label: 'MOVE',
    options: () => MOVES.map((m) => ({ value: m.id, icon: m.icon, label: m.label })),
    value: () => settings.get().move,
    onSelect: (move) => patchSettings({ move }),
    deps: [settings],
  });
}

export function formatControl(): HTMLElement {
  return dropdown<FormatId>({
    label: 'FORMAT',
    options: () => {
      const first = firstSourceSize();
      return FORMATS.map((f) => ({ value: f.id, icon: f.icon, label: f.label, detail: pixelLabel(outputSize(f.id, first)) }));
    },
    value: () => settings.get().format,
    onSelect: (format) => patchSettings({ format }),
    deps: [settings, images, videoClips],
  });
}
