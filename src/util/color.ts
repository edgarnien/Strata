export function normalizeHex(input: string): string | null {
  const hex = `#${input.trim().replace(/^#/, '')}`.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/** h 0–360, s and v 0–100. */
export function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return rgbToHex(channel(5), channel(3), channel(1));
}

/** Inverse of hsvToHex; hue and saturation are 0 where they are undefined (greys, black). */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/**
 * Hue and saturation under (dx, dy) relative to the wheel centre: hue runs clockwise from the
 * right (screen y points down), saturation grows from the white centre to the rim.
 */
export function pickFromWheel(dx: number, dy: number, radius: number): { hue: number; saturation: number } {
  let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return { hue, saturation: Math.min(100, (Math.hypot(dx, dy) / radius) * 100) };
}

/** Where a hue/saturation sits on a wheel of radius 1, relative to its centre. */
export function wheelPoint(hue: number, saturation: number): { x: number; y: number } {
  const a = (hue * Math.PI) / 180;
  const r = saturation / 100;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}
