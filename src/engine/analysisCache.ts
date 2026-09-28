import { barGrid, buildForegroundMask, gridBars, maskSize, selectStrokeBars, type ForegroundMask, type PixelData } from './analyze';
import { rasterize } from './raster';
import type { ImageLayer } from './render';
import type { Fit, Settings, Size } from './types';

interface Entry {
  pixelsKey: string;
  full: PixelData;
  small: PixelData;
  maskKey?: string;
  mask?: ForegroundMask;
  barsKey?: string;
  layer?: ImageLayer;
}

/**
 * Staged cache per image: pixels (format) → mask (sensitivity) → bars (size, stretch,
 * threshold, side). A slider only recomputes the stages after it.
 */
export class AnalysisCache {
  private entries = new Map<string, Entry>();

  layer(id: string, bitmap: ImageBitmap, size: Size, fit: Fit, s: Settings): ImageLayer {
    const pixelsKey = `${size.width}x${size.height}:${fit}`;
    let e = this.entries.get(id);
    if (!e || e.pixelsKey !== pixelsKey) {
      e = { pixelsKey, full: rasterize(bitmap, size, fit), small: rasterize(bitmap, maskSize(size.width, size.height), fit) };
      this.entries.set(id, e);
    }
    const maskKey = String(s.sensitivity);
    if (!e.mask || e.maskKey !== maskKey) {
      e.mask = buildForegroundMask(e.small, s.sensitivity);
      e.maskKey = maskKey;
      e.barsKey = undefined;
    }
    const barsKey = `${s.size}:${s.stretch}:${s.threshold}:${s.removeFront}`;
    if (!e.layer || e.barsKey !== barsKey) {
      const grid = barGrid(size.width, size.height, s.size, s.stretch);
      e.layer = {
        bitmap,
        gridBars: gridBars(size.width, size.height, grid),
        strokeBars: selectStrokeBars(e.full, e.mask, grid, s.threshold, s.removeFront),
      };
      e.barsKey = barsKey;
    }
    return e.layer;
  }

  forget(id: string): void {
    this.entries.delete(id);
  }
}
