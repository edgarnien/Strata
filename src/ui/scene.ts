import { AnalysisCache } from '../engine/analysisCache';
import { fitFor, outputSize } from '../engine/formats';
import type { Scene } from '../engine/render';
import { images, seed, settings } from '../state/store';

const cache = new AnalysisCache();

/** Current scene from the store, or null without clips. Analysis results are cached. */
export function buildScene(): Scene | null {
  const list = images.get();
  if (list.length === 0) return null;
  const s = settings.get();
  const size = outputSize(s.format, list[0].bitmap);
  if (!size) return null;
  const fit = fitFor(s.format);
  return {
    width: size.width,
    height: size.height,
    fit,
    settings: s,
    seed: seed.get(),
    layers: list.map((img) => cache.layer(img.id, img.bitmap, size, fit, s)),
  };
}

export function forgetImage(id: string): void {
  cache.forget(id);
}
