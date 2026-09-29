import { hexToHsv, hsvToHex, pickFromWheel, wheelPoint } from '../util/color';
import { h } from './dom';

const PRESETS = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFD60A', '#34C759', '#0A84FF', '#BF5AF2'];

/**
 * HSV wheel (hue around, saturation outwards from white), a brightness slider and quick swatches.
 * Drawn with CSS gradients, so it stays sharp at any pixel density.
 */
export function colorWheel(onPick: (hex: string) => void): { el: HTMLElement; set(hex: string): void } {
  let hsv = { h: 0, s: 0, v: 100 };
  let current = '#FFFFFF';

  const shade = h('div', { class: 'wheel__shade' });
  const thumb = h('div', { class: 'wheel__thumb' });
  const disc = h('div', { class: 'wheel__disc', role: 'img', 'aria-label': 'Colour wheel' }, shade, thumb);
  const brightness = h('input', { class: 'range range--value', type: 'range', min: 0, max: 100, 'aria-label': 'Brightness' });
  const presets = PRESETS.map((hex) => {
    const btn = h('button', {
      class: 'wheel__preset',
      type: 'button',
      title: hex,
      'aria-label': hex,
      onclick: () => {
        hsv = hexToHsv(hex);
        emit();
      },
    });
    btn.style.setProperty('--swatch', hex);
    return btn;
  });

  const render = () => {
    const p = wheelPoint(hsv.h, hsv.s);
    thumb.style.left = `${50 + p.x * 50}%`;
    thumb.style.top = `${50 + p.y * 50}%`;
    thumb.style.setProperty('--swatch', current);
    shade.style.opacity = String(1 - hsv.v / 100);
    brightness.value = String(Math.round(hsv.v));
    brightness.style.setProperty('--hue', hsvToHex(hsv.h, hsv.s, 100));
    for (const btn of presets) btn.setAttribute('aria-pressed', String(btn.title === current));
  };
  const emit = () => {
    current = hsvToHex(hsv.h, hsv.s, hsv.v);
    render();
    onPick(current);
  };

  const pick = (e: PointerEvent) => {
    const r = disc.getBoundingClientRect();
    const radius = r.width / 2;
    const p = pickFromWheel(e.clientX - r.left - radius, e.clientY - r.top - radius, radius);
    hsv = { h: p.hue, s: p.saturation, v: hsv.v };
    emit();
  };
  disc.addEventListener('pointerdown', (e) => {
    disc.setPointerCapture(e.pointerId);
    // Picking a hue on a black wheel would change nothing visible: bring the light back.
    if (hsv.v < 5) hsv.v = 100;
    pick(e);
  });
  disc.addEventListener('pointermove', (e) => {
    if (disc.hasPointerCapture(e.pointerId)) pick(e);
  });
  brightness.addEventListener('input', () => {
    hsv.v = Number(brightness.value);
    emit();
  });

  render();
  const el = h('div', { class: 'wheel' }, disc, brightness, h('div', { class: 'wheel__presets' }, ...presets));
  return {
    el,
    /** Follows a colour set elsewhere (hex field); the echo of the wheel's own pick keeps hue and saturation. */
    set(hex: string) {
      if (hex === current) return;
      current = hex;
      hsv = hexToHsv(hex);
      render();
    },
  };
}
