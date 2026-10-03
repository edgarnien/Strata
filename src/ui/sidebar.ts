import { effect } from '../state/signal';
import { exporting, hasContent, images, markers, settings, videoClips } from '../state/store';
import { h } from './dom';
import { modeSwitch } from './modeSwitch';
import { TOOLS, applyLock, toolShown, type GroupId } from './tools';

/** Desktop: every control at once, in groups split by hairlines; EXPORT sits at the bottom. */
export function mountSidebar(root: HTMLElement, openExport: () => void): void {
  root.append(h('div', { class: 'sidebar__head' }, h('div', { class: 'sidebar__logo' }, 'STRATA'), modeSwitch()));
  const groups = new Map<GroupId, HTMLElement>();
  for (const tool of TOOLS) {
    let group = groups.get(tool.group);
    if (!group) {
      group = h('section', { class: `group group--${tool.group}` });
      groups.set(tool.group, group);
      root.append(group);
    }
    const el = tool.build();
    el.dataset.tool = tool.id;
    group.append(el);
    effect([settings, images, videoClips, markers], () => {
      el.hidden = !toolShown(tool);
      applyLock(tool, el);
    });
  }
  const exportBtn = h('button', { class: 'btn btn--solid sidebar__export', type: 'button', onclick: openExport }, 'EXPORT');
  root.append(exportBtn);
  effect([images, videoClips, settings, exporting], () => {
    exportBtn.disabled = !hasContent() || exporting.get();
  });
}
