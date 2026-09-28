import { effect, type Signal } from '../state/signal';
import { h } from './dom';
import { anchorPopover } from './popover';

export interface DropdownOption<T extends string> {
  value: T;
  icon: string;
  label: string;
  detail?: string;
}

/** Label above, a button showing only the current choice, and a popover listbox. */
export function dropdown<T extends string>(cfg: {
  label: string;
  options: () => readonly DropdownOption<T>[];
  value: () => T;
  onSelect: (value: T) => void;
  deps: readonly Signal<unknown>[];
}): HTMLElement {
  const button = h('button', { class: 'btn dd__button', type: 'button', 'aria-haspopup': 'listbox' });
  const list = h('div', { class: 'popover dd__list', role: 'listbox', 'aria-label': cfg.label });
  list.popover = 'auto';
  button.popoverTargetElement = list;

  effect(cfg.deps, () => {
    const current = cfg.value();
    const options = cfg.options();
    const sel = options.find((o) => o.value === current);
    button.setAttribute('aria-label', `${cfg.label}: ${sel?.label ?? ''}`);
    button.replaceChildren(...[
      h('span', { 'aria-hidden': 'true' }, sel?.icon ?? ''),
      h('span', {}, sel?.label ?? ''),
      sel?.detail ? h('span', { class: 'dd__detail' }, sel.detail) : null,
      h('span', { class: 'dd__caret', 'aria-hidden': 'true' }, '▾'),
    ].filter((child) => child !== null));
    list.replaceChildren(...options.map((o) =>
      h('button', {
        class: 'dd__option',
        type: 'button',
        role: 'option',
        'aria-selected': String(o.value === current),
        onclick: () => {
          cfg.onSelect(o.value);
          list.hidePopover();
          button.focus();
        },
      },
      h('span', { 'aria-hidden': 'true' }, o.value === current ? '✓' : ''),
      h('span', { class: 'dd__icon', 'aria-hidden': 'true' }, o.icon),
      h('span', {}, o.label),
      h('span', { class: 'dd__detail' }, o.detail ?? ''))));
  });

  anchorPopover(list, button, {
    matchWidth: true,
    onOpen: () => list.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
  });
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...list.querySelectorAll<HTMLElement>('.dd__option')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });

  return h('div', { class: 'field' }, h('div', { class: 'field__label' }, h('span', {}, cfg.label)), button, list);
}
