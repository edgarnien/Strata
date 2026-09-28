import { renderFrame, renderStill, type Scene } from '../engine/render';

/** t = animation time on screen, or null to export the still of `stillIndex`. */
export async function exportPng(scene: Scene, t: number | null, stillIndex: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(scene.width, scene.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  if (t === null) renderStill(ctx, scene, stillIndex);
  else renderFrame(ctx, scene, t);
  return canvas.convertToBlob({ type: 'image/png' });
}
