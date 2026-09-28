import { effect } from '../state/signal';
import { exporting, images } from '../state/store';
import { h } from './dom';
import { GROUP_LABELS, TOOLS, type GroupId } from './tools';

export function mountSidebar(root: HTMLElement, openExport: () => void): void {
  root.append(h('div', { class: 'sidebar__logo' }, 'STRATA'));
  const groups = new Map<GroupId, HTMLElement>();
  for (const tool of TOOLS) {
    let group = groups.get(tool.group);
    if (!group) {
      const heading = GROUP_LABELS[tool.group];
      group = h('section', { class: `group group--${tool.group}` }, heading ? h('h2', { class: 'group__label' }, heading) : null);
      groups.set(tool.group, group);
      root.append(group);
    }
    const el = tool.build();
    el.dataset.tool = tool.id;
    group.append(el);
    const visible = tool.visible;
    if (visible) effect([images], () => { el.hidden = !visible(); });
  }
  const exportBtn = h('button', { class: 'btn btn--solid sidebar__export', type: 'button', onclick: openExport }, 'EXPORT');
  root.append(exportBtn);
  effect([images, exporting], () => {
    exportBtn.disabled = images.get().length === 0 || exporting.get();
  });
}
