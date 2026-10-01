import { motionById } from '../engine/motions';
import { randomSeed } from '../engine/rng';
import { totalDuration } from '../engine/timeline';
import { layout } from '../engine/videoTimeline';
import { effect } from '../state/signal';
import { activeTool, hasContent, images, markers, playhead, playing, seed, settings, timelineInput, videoClips } from '../state/store';
import { formatClock } from '../util/time';
import { h } from './dom';

export function mountTransport(root: HTMLElement): void {
  const play = h('button', { class: 'transport__play', type: 'button', onclick: () => playing.set(!playing.get()) });
  const motion = h('button', {
    class: 'transport__motion',
    type: 'button',
    onclick: () => {
      activeTool.set('motion');
      if (matchMedia('(width > 768px)').matches) {
        document.querySelector<HTMLElement>('#sidebar [data-tool="motion"] .dd__button')?.click();
      }
    },
  });
  const shuffle = h('button', {
    class: 'transport__shuffle',
    type: 'button',
    title: 'Shuffle',
    'aria-label': 'Shuffle the random pattern',
    onclick: () => seed.set(randomSeed()),
  }, '⤮');
  const info = h('span', { class: 'transport__info' });
  root.append(play, motion, shuffle, info);

  effect([playing], () => {
    const on = playing.get();
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
  });
  const showInfo = () => {
    const s = settings.get();
    if (s.mode === 'video') {
      info.textContent = `${formatClock(playhead.get())} / ${formatClock(layout(timelineInput(s)).duration)}`;
      return;
    }
    const count = images.get().length;
    info.textContent = `${s.loops}× · ${totalDuration({ imageCount: count, loops: s.loops, speed: s.speed }).toFixed(1)} s`;
  };
  effect([settings, images, videoClips, markers], () => {
    const m = motionById(settings.get().motion);
    root.hidden = !hasContent();
    motion.textContent = `${m.icon} ${m.label}`;
    showInfo();
  });
  playhead.subscribe(showInfo);
}
