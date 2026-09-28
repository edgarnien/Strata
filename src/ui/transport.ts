import { motionById } from '../engine/motions';
import { randomSeed } from '../engine/rng';
import { totalDuration } from '../engine/timeline';
import { effect } from '../state/signal';
import { activeTool, images, playing, seed, settings } from '../state/store';
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
  effect([settings, images], () => {
    const s = settings.get();
    const m = motionById(s.motion);
    const count = images.get().length;
    root.hidden = count === 0;
    motion.textContent = `${m.icon} ${m.label}`;
    info.textContent = `${s.loops}× · ${totalDuration({ imageCount: count, loops: s.loops, speed: s.speed }).toFixed(1)} s`;
  });
}
