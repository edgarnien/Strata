import { WHEEL_INNER, hslToHex, pickFromWheel } from '../util/color';
import { h } from './dom';

const SIZE = 200;
const C = SIZE / 2;
const RADIUS = C - 10;

function paintWheel(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let angle = 0; angle < 360; angle++) {
    const start = ((angle - 1) * Math.PI) / 180;
    const end = (angle * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(C, C, RADIUS, start, end);
    ctx.arc(C, C, RADIUS * WHEEL_INNER, end, start, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.fill();
  }
  const inner = RADIUS * WHEEL_INNER;
  ctx.beginPath();
  ctx.arc(C, C, inner, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(C, C, inner, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(C, C, inner, 0, 2 * Math.PI);
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function colorWheel(onPick: (hex: string) => void): { el: HTMLElement; redraw(): void } {
  const canvas = h('canvas', { width: SIZE, height: SIZE, role: 'img', 'aria-label': 'Colour wheel' });
  const brightness = h('input', { class: 'range', type: 'range', min: 0, max: 100, value: 100, 'aria-label': 'Brightness' });
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  base.width = SIZE;
  base.height = SIZE;
  const baseCtx = base.getContext('2d');
  if (!ctx || !baseCtx) throw new Error('2D canvas is not available.');
  paintWheel(baseCtx);

  let cursor: { x: number; y: number } | null = null;
  let hueSat: { hue: number; saturation: number } | null = null;

  const redraw = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(base, 0, 0);
    if (!cursor) return;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const k = SIZE / r.width; // the canvas may be scaled by CSS
    const p = pickFromWheel((e.clientX - r.left) * k - C, (e.clientY - r.top) * k - C, RADIUS, Number(brightness.value));
    cursor = { x: C + p.cursor.x, y: C + p.cursor.y };
    hueSat = p.hue === null || p.saturation === null ? null : { hue: p.hue, saturation: p.saturation };
    onPick(p.hex);
    redraw();
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pick(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (canvas.hasPointerCapture(e.pointerId)) pick(e);
  });
  brightness.addEventListener('input', () => {
    if (hueSat) onPick(hslToHex(hueSat.hue, hueSat.saturation, Number(brightness.value) / 2));
  });

  redraw();
  const el = h('div', { class: 'wheel' }, canvas, h('div', { class: 'field__label' }, h('span', {}, 'BRIGHTNESS')), brightness);
  return { el, redraw };
}
