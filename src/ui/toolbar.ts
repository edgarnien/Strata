import { effect } from '../state/signal';
import { activeTool, images } from '../state/store';
import { h } from './dom';
import { TOOLS } from './tools';

/** Mobile: a scrollable icon bar; only the active tool's control is shown in the panel above it. */
export function mountToolbar(bar: HTMLElement, panel: HTMLElement): void {
  for (const tool of TOOLS) {
    const btn = h('button', {
      class: 'tool',
      type: 'button',
      'data-tool-btn': tool.id,
      'aria-pressed': 'false',
      onclick: () => activeTool.set(tool.id),
    }, h('span', { class: 'tool__icon', 'aria-hidden': 'true' }, tool.icon), h('span', {}, tool.label));
    const pane = tool.build();
    pane.dataset.tool = tool.id;
    bar.append(btn);
    panel.append(pane);

    effect([activeTool, images], () => {
      const visible = tool.visible ? tool.visible() : true;
      if (!visible && activeTool.get() === tool.id) {
        activeTool.set('size');
        return;
      }
      const active = visible && activeTool.get() === tool.id;
      btn.hidden = !visible;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      pane.hidden = !active;
    });
  }
  activeTool.subscribe((id) => {
    bar.querySelector<HTMLElement>(`[data-tool-btn="${id}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  });
}
