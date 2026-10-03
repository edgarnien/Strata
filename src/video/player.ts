import type { VideoFrames } from '../engine/renderVideo';
import type { Layout, VideoFramePosition } from '../engine/videoTimeline';
import { videoClips } from '../state/store';
import { toast } from '../ui/toast';

/** The shown shot's video sets the clock, so it only seeks after a jump this large (s). */
const LEAD_DRIFT = 0.5;
/** Any other playing video catches up by its rate; it seeks only when this far off (s). */
const FOLLOW_DRIFT = 1;
/** Rate change per second of drift while catching up, and the most it may change. */
const CATCH_UP = 2;
const MAX_RATE_SHIFT = 0.5;
/** Line up the next clip this long before it shows (s). */
const PRELOAD = 1.5;
/** A paused video counts as in place within half a frame. */
const STILL_TOLERANCE = 0.5 / 30;

interface Want {
  time: number;
  gain: number;
  play: boolean;
  /** The shot that fills the frame: its video leads the clock while playing. */
  lead: boolean;
}

/**
 * Plays the clips for the preview: up to two hidden <video> elements per clip (one per lane), kept
 * in step with the timeline clock. They also carry the sound, crossfaded across IMG MASK overlaps.
 */
export class VideoPlayer {
  private els = new Map<string, HTMLVideoElement>();
  private soundBlocked = false;

  constructor(private host: HTMLElement) {}

  /** Call from the play gesture: the browser may allow sound again. */
  allowSound(): void {
    this.soundBlocked = false;
  }

  sync(lay: Layout, pos: VideoFramePosition, t: number, playing: boolean, audio: boolean): void {
    this.dropRemovedClips();
    const want = new Map<HTMLVideoElement, Want>();
    const put = (clipId: string, lane: 0 | 1, w: Want) => {
      const el = this.el(clipId, lane);
      if (el && !want.has(el)) want.set(el, w);
    };
    put(pos.shot.clipId, pos.shot.lane, { time: pos.shot.sourceTime, gain: pos.next ? 1 - pos.progress : 1, play: playing, lead: true });
    if (pos.next) put(pos.next.clipId, pos.next.lane, { time: pos.next.sourceTime, gain: pos.progress, play: playing, lead: false });
    const up = lay.shots[pos.shot.shotIndex + (pos.next ? 2 : 1)];
    if (up && up.start - t < PRELOAD) put(up.clipId, up.lane, { time: up.sourceStart, gain: 0, play: false, lead: false });

    const sound = audio && !this.soundBlocked;
    for (const el of this.els.values()) {
      const w = want.get(el);
      if (!w) {
        if (!el.paused) el.pause();
        continue;
      }
      el.muted = !sound || w.gain <= 0;
      el.volume = Math.min(1, Math.max(0, w.gain));
      // A seek takes a while on long-GOP phone footage; seeking at every small drift would never let it play.
      const drift = w.time - el.currentTime;
      const tolerance = !w.play ? STILL_TOLERANCE : w.lead ? LEAD_DRIFT : FOLLOW_DRIFT;
      if (!el.seeking && Math.abs(drift) > tolerance) el.currentTime = w.time;
      const shift = w.play && !w.lead && Math.abs(drift) > STILL_TOLERANCE ? drift * CATCH_UP : 0;
      el.playbackRate = 1 + Math.max(-MAX_RATE_SHIFT, Math.min(MAX_RATE_SHIFT, shift));
      if (w.play && el.paused) this.start(el);
      else if (!w.play && !el.paused) el.pause();
    }
  }

  /**
   * While playing, the output time the shown shot's video has reached – it sets the pace, so the
   * picture never waits on a seek. 'wait' while it is still starting or seeking; null once it has
   * ended (the clock then runs on its own).
   */
  lead(lay: Layout, pos: VideoFramePosition): number | 'wait' | null {
    const el = this.els.get(`${pos.shot.clipId}:${pos.shot.lane}`);
    if (!el) return 'wait';
    if (el.ended) return null;
    if (el.paused || el.seeking || el.readyState < 3) return 'wait';
    const shot = lay.shots[pos.shot.shotIndex];
    return shot.start + (el.currentTime - shot.sourceStart);
  }

  /** The elements for `pos`, or null while one of them has no picture yet. */
  frames(pos: VideoFramePosition): VideoFrames | null {
    const shot = this.els.get(`${pos.shot.clipId}:${pos.shot.lane}`);
    const next = pos.next ? this.els.get(`${pos.next.clipId}:${pos.next.lane}`) : undefined;
    if (!shot || shot.readyState < 2) return null;
    if (pos.next && (!next || next.readyState < 2)) return null;
    return { shot, next: next ?? null };
  }

  /** Still moving to a new spot: draw again shortly. */
  busy(): boolean {
    for (const el of this.els.values()) if (el.seeking) return true;
    return false;
  }

  pause(): void {
    for (const el of this.els.values()) {
      el.pause();
      el.playbackRate = 1;
    }
  }

  private el(clipId: string, lane: 0 | 1): HTMLVideoElement | null {
    const key = `${clipId}:${lane}`;
    let el = this.els.get(key);
    if (!el) {
      const clip = videoClips.get().find((c) => c.id === clipId);
      if (!clip) return null;
      el = document.createElement('video');
      el.src = clip.url;
      el.preload = 'auto';
      el.playsInline = true;
      el.muted = true;
      el.dataset.clip = clipId;
      this.host.append(el);
      this.els.set(key, el);
    }
    return el;
  }

  private start(el: HTMLVideoElement): void {
    el.play().catch((e: unknown) => {
      // Only NotAllowedError means the browser blocked sound; other errors (AbortError, etc.) are expected.
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) return;
      if (el.muted || this.soundBlocked) return;
      this.soundBlocked = true;
      el.muted = true;
      void el.play().catch(() => undefined);
      toast('The browser blocked the sound – the preview plays muted', 'info');
    });
  }

  private dropRemovedClips(): void {
    const ids = new Set(videoClips.get().map((c) => c.id));
    for (const [key, el] of this.els) {
      if (ids.has(el.dataset.clip ?? '')) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
      this.els.delete(key);
    }
  }
}
