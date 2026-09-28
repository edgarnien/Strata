export function normalizeHex(input: string): string | null {
  const hex = `#${input.trim().replace(/^#/, '')}`.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** Inner radius (as a share of the wheel radius) of the black/white centre. */
export const WHEEL_INNER = 0.3;

export interface WheelPick {
  hex: string;
  hue: number | null;
  saturation: number | null;
  /** Cursor position relative to the wheel centre. */
  cursor: { x: number; y: number };
}

/** Colour under (dx, dy) relative to the wheel centre. brightness 0–100 (100 = pure hue). */
export function pickFromWheel(dx: number, dy: number, radius: number, brightness: number): WheelPick {
  const inner = radius * WHEEL_INNER;
  const dist = Math.hypot(dx, dy);
  if (dist <= inner) {
    const left = dx < 0;
    return { hex: left ? '#000000' : '#FFFFFF', hue: null, saturation: null, cursor: { x: (left ? -1 : 1) * radius * 0.15, y: 0 } };
  }
  const clamped = Math.min(dist, radius);
  const k = clamped / dist;
  let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const saturation = Math.min(100, ((clamped - inner) / (radius - inner)) * 100);
  return { hex: hslToHex(hue, saturation, brightness / 2), hue, saturation, cursor: { x: dx * k, y: dy * k } };
}
