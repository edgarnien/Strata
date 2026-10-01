import type { Mode } from '../engine/types';
import { effect } from '../state/signal';
import { patchSettings, playing, settings } from '../state/store';
import { h } from './dom';

/** PHOTO | VIDEO, Apple style. Switching keeps both projects; it only stops playback. */
export function modeSwitch(): HTMLElement {
  const option = (mode: Mode, text: string) => {
    const btn = h('button', {
      class: 'mode__btn',
      type: 'button',
      onclick: () => {
        if (settings.get().mode === mode) return;
        playing.set(false);
        patchSettings({ mode });
      },
    }, text);
    effect([settings], () => btn.setAttribute('aria-pressed', String(settings.get().mode === mode)));
    return btn;
  };
  return h('div', { class: 'mode', role: 'group', 'aria-label': 'Mode' }, option('photo', 'PHOTO'), option('video', 'VIDEO'));
}
