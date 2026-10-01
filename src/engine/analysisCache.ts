import { barGrid, buildForegroundMask, gridBars, maskSize, selectStrokeBars, type ForegroundMask, type PixelData } from './analyze';
import { rasterize } from './raster';
import type { ImageLayer } from './render';
import type { BarLook } from './strokes';
import type { DrawSource, Fit, Settings, Size } from './types';

interface Entry {
  pixelsKey: string;
  full: PixelData;
  small: PixelData;
  maskKey?: string;
  mask?: ForegroundMask;
  barsKey?: string;
  look?: BarLook;
  layer?: ImageLayer;
}

const pixelsKeyOf = (size: Size, fit: Fit) => `${size.width}x${size.height}:${fit}`;

/**
 * Staged cache per picture: pixels (format) → mask (sensitivity) → bars (size, stretch,
 * threshold, side). A slider only recomputes the stages after it.
 */
export class AnalysisCache {
  private entries = new Map<string, Entry>();

  /** Whether `look` needs the picture again (new picture, or new output size or fit). */
  needsPixels(id: string, size: Size, fit: Fit): boolean {
    return this.entries.get(id)?.pixelsKey !== pixelsKeyOf(size, fit);
  }

  /** Stroke and grid bars of picture `id`; `source` may be null while `needsPixels` is false. */
  look(id: string, source: DrawSource | null, size: Size, fit: Fit, s: Settings): BarLook {
    const pixelsKey = pixelsKeyOf(size, fit);
    let e = this.entries.get(id);
    if (!e || e.pixelsKey !== pixelsKey) {
      if (!source) throw new Error(`No picture for ${id}`);
      e = { pixelsKey, full: rasterize(source, size, fit), small: rasterize(source, maskSize(size.width, size.height), fit) };
      this.entries.set(id, e);
    }
    const maskKey = String(s.sensitivity);
    if (!e.mask || e.maskKey !== maskKey) {
      e.mask = buildForegroundMask(e.small, s.sensitivity);
      e.maskKey = maskKey;
      e.barsKey = undefined;
    }
    const barsKey = `${s.size}:${s.stretch}:${s.threshold}:${s.removeFront}`;
    if (!e.look || e.barsKey !== barsKey) {
      const grid = barGrid(size.width, size.height, s.size, s.stretch);
      e.look = {
        gridBars: gridBars(size.width, size.height, grid),
        strokeBars: selectStrokeBars(e.full, e.mask, grid, s.threshold, s.removeFront),
      };
      e.barsKey = barsKey;
    }
    return e.look;
  }

  layer(id: string, bitmap: ImageBitmap, size: Size, fit: Fit, s: Settings): ImageLayer {
    const look = this.look(id, bitmap, size, fit, s);
    const e = this.entries.get(id);
    if (!e) throw new Error(`No entry for ${id}`);
    // Same object while nothing changed: render caches (bar order, grid edges) key on it.
    if (!e.layer || e.layer.strokeBars !== look.strokeBars || e.layer.bitmap !== bitmap) e.layer = { bitmap, ...look };
    return e.layer;
  }

  forget(id: string): void {
    this.entries.delete(id);
  }

  /** Drops every entry `keep` says no to. */
  prune(keep: (id: string) => boolean): void {
    for (const id of [...this.entries.keys()]) if (!keep(id)) this.entries.delete(id);
  }
}
