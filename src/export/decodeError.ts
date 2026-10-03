/**
 * The message for a clip that failed to decode. A file that can no longer be read (moved,
 * deleted, or a temporary drag-and-drop copy that is gone) gets a hint instead of the browser's
 * bare "network error".
 */
export function decodeErrorMessage(name: string, err: unknown): string {
  const unreadable = (err instanceof TypeError && /network error/i.test(err.message))
    || (err instanceof DOMException && err.name === 'NotReadableError');
  if (unreadable) return `${name} can no longer be read – the original file was moved or deleted. Add the clip again.`;
  return `${name} could not be decoded: ${err instanceof Error ? err.message : String(err)}`;
}
