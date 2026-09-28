import type { Bar, Size } from './types';

export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Summed-area table of foreground pixels at mask resolution. */
export interface ForegroundMask {
  sat: Float64Array;
  w: number;
  h: number;
}

export interface Grid {
  cols: number;
  rows: number;
}

export const MASK_MAX_EDGE = 256;

export function maskSize(width: number, height: number): Size {
  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Bars are `size` wide and 3 × size (+ stretch) tall; counts are rounded so bars tile the frame. */
export function barGrid(width: number, height: number, size: number, stretch: number): Grid {
  const barHeight = size * 3 + Math.floor(stretch * 2);
  return {
    cols: Math.max(1, Math.round(width / size)),
    rows: Math.max(1, Math.round(height / barHeight)),
  };
}

export function gridBars(width: number, height: number, grid: Grid): Bar[] {
  const bars: Bar[] = [];
  for (let col = 0; col < grid.cols; col++) {
    const x = Math.round((col * width) / grid.cols);
    const w = Math.round(((col + 1) * width) / grid.cols) - x;
    for (let row = 0; row < grid.rows; row++) {
      const y = Math.round((row * height) / grid.rows);
      const h = Math.round(((row + 1) * height) / grid.rows) - y;
      bars.push({ x, y, width: w, height: h });
    }
  }
  return bars;
}

// Learn background colours from the top/left/right border, flood-fill the connected
// background from the edges, drop tiny foreground specks.
export function buildForegroundMask(px: PixelData, sensitivity: number): ForegroundMask {
  const { width: w, height: h, data } = px;
  const n = w * h;

  const lab = new Float32Array(n * 3);
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  for (let i = 0; i < n; i++) {
    const r = lin(data[i * 4]), g = lin(data[i * 4 + 1]), b = lin(data[i * 4 + 2]);
    const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    lab[i * 3] = 116 * fy - 16;
    lab[i * 3 + 1] = 500 * (fx - fy);
    lab[i * 3 + 2] = 200 * (fy - fz);
  }

  // Bottom edge is left out of the model: subjects (busts, products) usually touch it.
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  const samples: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < ring || x < ring || x >= w - ring) samples.push(y * w + x);
    }
  }

  const k = Math.min(8, samples.length);
  let centers: number[][] = [];
  for (let j = 0; j < k; j++) {
    const i = samples[Math.floor(((j + 0.5) * samples.length) / k)];
    centers.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
  }
  let counts: number[] = new Array(k).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const i of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = (lab[i * 3] - centers[j][0]) ** 2 + (lab[i * 3 + 1] - centers[j][1]) ** 2 + (lab[i * 3 + 2] - centers[j][2]) ** 2;
        if (d < bestD) { bestD = d; best = j; }
      }
      sums[best][0] += lab[i * 3];
      sums[best][1] += lab[i * 3 + 1];
      sums[best][2] += lab[i * 3 + 2];
      counts[best]++;
    }
    centers = centers.map((cen, j) => (counts[j] ? sums[j].map((v) => v / counts[j]) : cen));
  }
  const bgColors = centers.filter((_, j) => counts[j] >= samples.length * 0.03);

  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = Infinity;
    for (const cen of bgColors) {
      const d = (lab[i * 3] - cen[0]) ** 2 + (lab[i * 3 + 1] - cen[1]) ** 2 + (lab[i * 3 + 2] - cen[2]) ** 2;
      if (d < m) m = d;
    }
    dist[i] = Math.sqrt(m);
  }

  // Edge strength: the background fill may not cross object outlines.
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let g = 0;
      for (let ch = 0; ch < 3; ch++) {
        const gx = lab[(i + 1) * 3 + ch] - lab[(i - 1) * 3 + ch];
        const gy = lab[(i + w) * 3 + ch] - lab[(i - w) * 3 + ch];
        g += gx * gx + gy * gy;
      }
      grad[i] = Math.sqrt(g);
    }
  }
  const sortedGrad = Float32Array.from(grad).sort();
  const edgeThreshold = Math.max(10, sortedGrad[Math.floor(n * 0.9)]);

  // Image-adaptive colour tolerance (Otsu on the distance-to-background histogram);
  // the slider only shifts it: 50 = automatic, higher removes more.
  const bins = 128;
  const maxD = 100;
  const hist = new Float64Array(bins);
  for (let i = 0; i < n; i++) hist[Math.min(bins - 1, Math.floor((dist[i] / maxD) * bins))]++;
  let sumAll = 0;
  for (let b = 0; b < bins; b++) sumAll += b * hist[b];
  let wB = 0, sumB = 0, bestVar = -1, bestBin = 0;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (!wB || wB === n) continue;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / (n - wB);
    const between = wB * (n - wB) * (mB - mF) ** 2;
    if (between > bestVar) { bestVar = between; bestBin = b; }
  }
  const autoTol = Math.min(50, Math.max(5, ((bestBin + 1) / bins) * maxD));
  let tol = autoTol * Math.pow(2, (sensitivity - 50) / 50);

  const fillBackground = (tolerance: number): Uint8Array<ArrayBuffer> => {
    const bgMask = new Uint8Array(n);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (bgMask[i] || dist[i] >= tolerance) continue;
      if (grad[i] >= edgeThreshold && dist[i] >= tolerance * 0.35) continue;
      bgMask[i] = 1;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w);
      if (y < h - 1) stack.push(i + w);
    }
    return bgMask;
  };

  // Morphological opening on the foreground: cuts thin bridges to neighbouring background clutter.
  const morph = (src: Uint8Array<ArrayBuffer>, r: number, erode: boolean): Uint8Array<ArrayBuffer> => {
    const tmp = new Uint8Array(n);
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = erode ? 1 : 0;
        for (let d = -r; d <= r; d++) {
          const xx = Math.min(w - 1, Math.max(0, x + d));
          v = erode ? Math.min(v, src[y * w + xx]) : Math.max(v, src[y * w + xx]);
        }
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = erode ? 1 : 0;
        for (let d = -r; d <= r; d++) {
          const yy = Math.min(h - 1, Math.max(0, y + d));
          v = erode ? Math.min(v, tmp[yy * w + x]) : Math.max(v, tmp[yy * w + x]);
        }
        out[y * w + x] = v;
      }
    }
    return out;
  };

  const segment = (tolerance: number): { bgMask: Uint8Array<ArrayBuffer>; fgFrac: number } => {
    const r = Math.max(1, Math.round(Math.min(w, h) / 100));
    let fgMask = new Uint8Array(n);
    const filled = fillBackground(tolerance);
    for (let i = 0; i < n; i++) fgMask[i] = filled[i] ? 0 : 1;
    fgMask = morph(morph(fgMask, r, true), r, false);

    // Keep only the main subject parts: drop components much smaller than the largest one.
    const comps: number[][] = [];
    const seen = new Uint8Array(n);
    for (let s0 = 0; s0 < n; s0++) {
      if (!fgMask[s0] || seen[s0]) continue;
      const comp = [s0];
      seen[s0] = 1;
      for (let q = 0; q < comp.length; q++) {
        const i = comp[q];
        const x = i % w;
        const y = (i - x) / w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of nb) {
          if (j >= 0 && fgMask[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
        }
      }
      comps.push(comp);
    }
    const largest = comps.reduce((m, c) => Math.max(m, c.length), 0);
    const minArea = Math.max(n * 0.004, largest * 0.15);
    const bgMask = new Uint8Array(n).fill(1);
    let kept = 0;
    for (const comp of comps) {
      if (comp.length < minArea) continue;
      for (const i of comp) bgMask[i] = 0;
      kept += comp.length;
    }
    return { bgMask, fgFrac: kept / n };
  };

  // Nudge the tolerance when the result is implausible (almost no subject / almost no background).
  let { bgMask: bg, fgFrac } = segment(tol);
  for (let attempt = 0; attempt < 4 && (fgFrac < 0.04 || fgFrac > 0.92); attempt++) {
    tol *= fgFrac < 0.04 ? 0.6 : 1.6;
    ({ bgMask: bg, fgFrac } = segment(tol));
  }

  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += bg[y * w + x] ? 0 : 1;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  return { sat, w, h };
}

/** True when at least half of the bar lies on the foreground. */
export function barIsForeground(mask: ForegroundMask, fullWidth: number, bar: Bar): boolean {
  const { sat, w, h } = mask;
  const scale = w / fullWidth;
  const x0 = Math.min(w - 1, Math.floor(bar.x * scale));
  const y0 = Math.min(h - 1, Math.floor(bar.y * scale));
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round((bar.x + bar.width) * scale)));
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((bar.y + bar.height) * scale)));
  const W = w + 1;
  const fg = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
  return fg / ((x1 - x0) * (y1 - y0)) >= 0.5;
}

// Bars that carry a stroke: on the chosen side (front/back), minus the darkest share set by
// THRESHOLD. The share is relative to this image's own brightness spread, so every photo
// breaks up similarly.
export function selectStrokeBars(full: PixelData, mask: ForegroundMask, grid: Grid, threshold: number, removeFront: boolean): Bar[] {
  const { width, height, data } = full;
  const candidates: (Bar & { lum: number })[] = [];
  for (const bar of gridBars(width, height, grid)) {
    if (barIsForeground(mask, width, bar) === removeFront) continue;
    const sx = Math.min(bar.x + Math.floor(bar.width / 2), width - 1);
    const sy = Math.min(bar.y + Math.floor(bar.height / 2), height - 1);
    const i = (sy * width + sx) * 4;
    candidates.push({ ...bar, lum: 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] });
  }
  const removeCount = Math.floor(candidates.length * Math.min(0.9, threshold / 100));
  // Score = half brightness rank, half stable per-bar noise → removal follows the image but stays scattered.
  const byLum = candidates.map((_, i) => i).sort((a, b) => candidates[a].lum - candidates[b].lum);
  const score = new Float32Array(candidates.length);
  byLum.forEach((ci, rank) => {
    const c = candidates[ci];
    const noise = (Math.imul(Math.imul(c.x, 73856093) ^ Math.imul(c.y, 19349663), 2654435761) >>> 0) / 0xffffffff;
    score[ci] = (0.5 * rank) / candidates.length + 0.5 * noise;
  });
  const lowest = candidates.map((_, i) => i).sort((a, b) => score[a] - score[b]);
  const removed = new Set(lowest.slice(0, removeCount));
  return candidates.filter((_, i) => !removed.has(i)).map(({ x, y, width: bw, height: bh }) => ({ x, y, width: bw, height: bh }));
}
