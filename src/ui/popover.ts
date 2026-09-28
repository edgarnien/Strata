const MOBILE = '(width <= 768px)';

/**
 * Positions a popover next to its anchor each time it opens: above the anchor on mobile
 * (tools sit at the bottom of the screen), below it on desktop.
 */
export function anchorPopover(pop: HTMLElement, anchor: HTMLElement, opts: { matchWidth?: boolean; onOpen?: () => void } = {}): void {
  anchor.setAttribute('aria-expanded', 'false');
  pop.addEventListener('beforetoggle', (e) => {
    if (e.newState === 'open') pop.style.visibility = 'hidden';
  });
  pop.addEventListener('toggle', (e) => {
    anchor.setAttribute('aria-expanded', String(e.newState === 'open'));
    if (e.newState !== 'open') return;
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    if (opts.matchWidth) pop.style.width = `${Math.max(r.width, 220)}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    if (matchMedia(MOBILE).matches) {
      pop.style.top = 'auto';
      pop.style.bottom = `${innerHeight - r.top + gap}px`;
    } else {
      pop.style.bottom = 'auto';
      pop.style.top = `${Math.max(8, Math.min(r.bottom + gap, innerHeight - pop.offsetHeight - 8))}px`;
    }
    pop.style.visibility = '';
    opts.onOpen?.();
  });
}
