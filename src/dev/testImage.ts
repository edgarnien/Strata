/** A synthetic "photo" – light backdrop, dark subject, coloured accent – for browser checks. */
export async function makeTestImage(accent = '#b33', width = 1200, height = 1600): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  ctx.fillStyle = '#e8e4dc';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.59, width * 0.275, height * 0.325, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(width * 0.35, height * 0.325, width * 0.3, height * 0.15);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new File([blob], `test-${accent.replace('#', '')}.png`, { type: 'image/png' });
}
