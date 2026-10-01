import { validMarkerTime, type Marker, type VideoTimelineInput } from '../engine/videoTimeline';

let nextId = 0;
export const newMarkerId = (): string => `mk${++nextId}`;

/** The markers plus one at (clipId, time), moved to the nearest valid frame – or null if the clip has no room. */
export function addMarker(input: VideoTimelineInput, clipId: string, time: number, id = newMarkerId()): Marker[] | null {
  const t = validMarkerTime(input, clipId, time);
  return t === null ? null : [...input.markers, { id, clipId, time: t }];
}

/** The markers with `id` moved inside its own clip to the nearest valid frame; unchanged if there is none. */
export function moveMarker(input: VideoTimelineInput, id: string, time: number): readonly Marker[] {
  const marker = input.markers.find((m) => m.id === id);
  if (!marker) return input.markers;
  const rest = input.markers.filter((m) => m.id !== id);
  const t = validMarkerTime({ ...input, markers: rest }, marker.clipId, time);
  return t === null ? input.markers : [...rest, { ...marker, time: t }];
}

export const removeMarker = (markers: readonly Marker[], id: string): Marker[] => markers.filter((m) => m.id !== id);

export const forgetClipMarkers = (markers: readonly Marker[], clipId: string): Marker[] =>
  markers.filter((m) => m.clipId !== clipId);
