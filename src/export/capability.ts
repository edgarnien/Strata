import { canEncodeVideo } from 'mediabunny';

export async function videoExportSupported(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') {
    return false;
  }
  try {
    const size = { width: 1080, height: 1920 };
    return (await canEncodeVideo('avc', size)) || (await canEncodeVideo('hevc', size));
  } catch {
    return false;
  }
}
