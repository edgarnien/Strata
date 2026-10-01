import type { FrameInput } from '../../src/engine/motions/types';
import type { Bar, Ctx2D, Settings } from '../../src/engine/types';

/** Minimal 2D context that records every drawing call as a string. */
export class RecordingCtx {
  calls: string[] = [];
  fillStyle = '#000000';
  globalAlpha = 1;
  private stack: { fillStyle: string; globalAlpha: number }[] = [];

  save(): void {
    this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha });
    this.calls.push('save');
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) { this.fillStyle = s.fillStyle; this.globalAlpha = s.globalAlpha; }
    this.calls.push('restore');
  }
  beginPath(): void { this.calls.push('beginPath'); }
  rect(x: number, y: number, w: number, h: number): void { this.calls.push(`rect ${x} ${y} ${w} ${h}`); }
  clip(): void { this.calls.push('clip'); }
  translate(x: number, y: number): void { this.calls.push(`translate ${x.toFixed(2)} ${y.toFixed(2)}`); }
  scale(x: number, y: number): void { this.calls.push(`scale ${x.toFixed(3)} ${y.toFixed(3)}`); }
  fill(): void { this.calls.push(`fill ${this.fillStyle} ${this.globalAlpha.toFixed(3)}`); }
  clearRect(x: number, y: number, w: number, h: number): void { this.calls.push(`clearRect ${x} ${y} ${w} ${h}`); }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(`fillRect ${x} ${y} ${w} ${h} ${this.fillStyle} ${this.globalAlpha.toFixed(3)}`);
  }
  drawImage(img: unknown, ...args: number[]): void {
    this.calls.push(`drawImage ${(img as { id: string }).id} ${args.map((a) => a.toFixed(2)).join(' ')} ${this.globalAlpha.toFixed(3)}`);
  }
  asCtx(): Ctx2D {
    return this as unknown as Ctx2D;
  }
}

export function fakeImage(id: string, width = 100, height = 300): ImageBitmap {
  return { id, width, height, close() {} } as unknown as ImageBitmap;
}

export function testBars(cols = 10, rows = 10, w = 10, h = 30): Bar[] {
  const bars: Bar[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) bars.push({ x: c * w, y: r * h, width: w, height: h });
  return bars;
}

/** A frame input; unless `lead` is given, every bar belongs to the look. */
export function frame(over: Partial<FrameInput> = {}): FrameInput {
  const bars = over.bars ?? testBars();
  return {
    width: 100,
    height: 300,
    fit: 'cover',
    bars,
    lead: bars.length,
    progress: 0.5,
    cycle: 0,
    frameIndex: 0,
    seed: 1,
    color: '#FFFFFF',
    image: fakeImage('cur'),
    nextImage: fakeImage('next'),
    imgMask: false,
    ...over,
  };
}

export function record(draw: (ctx: Ctx2D) => void): string[] {
  const r = new RecordingCtx();
  draw(r.asCtx());
  return r.calls;
}

export const count = (calls: string[], prefix: string) => calls.filter((c) => c.startsWith(prefix)).length;

export const TEST_SETTINGS: Settings = {
  size: 80, stretch: 0, threshold: 35, removeFront: false, sensitivity: 50, color: '#FFFFFF',
  imgMask: false, motion: 'buildUp', speed: 1, loops: 1, format: '9:16', move: 'off',
};

export const barKey = (bar: Bar): string => `${bar.x},${bar.y}`;

/**
 * How much of each bar (keyed by barKey) a motion covers: stroke fills, plus next-image draws
 * clipped to bars; draws of the current image (REVEAL clearing a bar) count against it.
 */
export function coverageByBar(draw: (ctx: Ctx2D) => void): Map<string, number> {
  let pending: string[] = [];
  let clipped: string[] = [];
  const covered = new Map<string, number>();
  const add = (keys: string[], v: number) => {
    for (const k of keys) covered.set(k, (covered.get(k) ?? 0) + v);
  };
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    save() {},
    restore() { ctx.globalAlpha = 1; },
    clearRect() {},
    beginPath() { pending = []; },
    rect(x: number, y: number) { pending.push(`${x},${y}`); },
    clip() { clipped = pending; },
    fill() { add(pending, ctx.globalAlpha); },
    fillRect(x: number, y: number) { add([`${x},${y}`], ctx.globalAlpha); },
    drawImage(img: { id: string }) {
      add(clipped, (img.id === 'cur' ? -1 : 1) * ctx.globalAlpha);
      clipped = [];
    },
  };
  draw(ctx as unknown as Ctx2D);
  return covered;
}

/** Share of `bars` a motion covers (see coverageByBar). */
export function coverage(draw: (ctx: Ctx2D) => void, bars: number): number {
  let sum = 0;
  for (const v of coverageByBar(draw).values()) sum += v;
  return sum / bars;
}
