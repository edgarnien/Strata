const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

/** For the file picker in video mode. */
export const VIDEO_ACCEPT = ACCEPTED.join(',');

/** Some drag sources report no MIME type; fall back to the file extension. */
export function isAcceptedVideo(file: { type: string; name: string }): boolean {
  return file.type ? ACCEPTED.includes(file.type) : /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}
