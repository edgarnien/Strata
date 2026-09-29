const MOBILE = '(width <= 768px)';

/**
 * Positions a popover next to its anchor each time it opens: above the anchor on mobile
 * (tools sit at the bottom of the screen), below it on desktop – or, with `beside`, as a
 * flyout to the right of that panel, level with the anchor.
 */
export function anchorPopover(
  pop: HTMLElement,
  anchor: HTMLElement,
  opts: { matchWidth?: boolean; onOpen?: () => void; beside?: () => HTMLElement | null } = {},
): void {
  anchor.setAttribute('aria-expanded', 'false');
  pop.addEventListener('beforetoggle', (e) => {
    if (e.newState === 'open') pop.style.visibility = 'hidden';
  });
  pop.addEventListener('toggle', (e) => {
    anchor.setAttribute('aria-expanded', String(e.newState === 'open'));
    if (e.newState !== 'open') return;
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    const clampTop = (top: number) => Math.max(8, Math.min(top, innerHeight - pop.offsetHeight - 8));
    if (opts.matchWidth) pop.style.width = `${Math.max(r.width, 220)}px`;
    const mobile = matchMedia(MOBILE).matches;
    const beside = mobile ? null : opts.beside?.();
    if (beside) {
      pop.style.left = `${beside.getBoundingClientRect().right + gap * 2}px`;
      pop.style.bottom = 'auto';
      pop.style.top = `${clampTop(r.top - gap * 2)}px`;
    } else {
      pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
      if (mobile) {
        pop.style.top = 'auto';
        pop.style.bottom = `${innerHeight - r.top + gap}px`;
      } else {
        pop.style.bottom = 'auto';
        pop.style.top = `${clampTop(r.bottom + gap)}px`;
      }
    }
    pop.style.visibility = '';
    opts.onOpen?.();
  });
}
