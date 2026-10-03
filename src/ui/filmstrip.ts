/**
 * Which strip frames to show side by side in a timeline clip `width` × `height` px: as many
 * tiles as fit at the frames' own aspect (never stretched), spread evenly over the clip.
 */
export function stripTiles(width: number, height: number, frames: number, aspect: number): { tileWidth: number; frames: number[] } {
  const tileWidth = Math.max(1, height * aspect);
  const count = Math.max(1, Math.ceil(width / tileWidth));
  const last = Math.max(0, frames - 1);
  return {
    tileWidth,
    frames: Array.from({ length: count }, (_, j) => Math.min(last, Math.floor(((j + 0.5) / count) * frames))),
  };
}
