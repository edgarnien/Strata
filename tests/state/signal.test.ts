import { describe, expect, it, vi } from 'vitest';
import { effect, signal } from '../../src/state/signal';

describe('signal', () => {
  it('notifies subscribers on change, not on identical values', () => {
    const s = signal(1);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(2);
    s.set(2);
    s.update((v) => v + 1);
    expect(fn.mock.calls).toEqual([[2], [3]]);
    expect(s.get()).toBe(3);
  });
  it('stops notifying after unsubscribe', () => {
    const s = signal('a');
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.set('b');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('effect', () => {
  it('runs immediately and on every dependency change until stopped', () => {
    const a = signal(1);
    const b = signal(1);
    const fn = vi.fn();
    const stop = effect([a, b], fn);
    a.set(2);
    b.set(2);
    stop();
    a.set(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
