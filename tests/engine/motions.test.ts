import { describe, expect, it } from 'vitest';
import { MOTIONS, motionById } from '../../src/engine/motions';
import type { MotionId } from '../../src/engine/types';
import { RecordingCtx, count, frame, record } from './helpers';

describe('registry', () => {
  it('lists the six motions in menu order', () => {
    expect(MOTIONS.map((m) => m.label)).toEqual(['BUILD UP', 'IMPULSE', 'WAVE', 'FADE', 'GLITCH', 'REVEAL']);
  });
  it('falls back to BUILD UP for unknown ids', () => {
    expect(motionById('nope' as MotionId).id).toBe('buildUp');
  });
});

describe('every motion', () => {
  for (const motion of MOTIONS) {
    for (const imgMask of [false, true]) {
      for (const progress of [0.1, 0.4, 0.7, 0.95]) {
        it(`${motion.label} imgMask=${imgMask} p=${progress} is deterministic and leaves the context clean`, () => {
          const f = frame({ progress, imgMask, cycle: 3, frameIndex: 17, seed: 99 });
          const r = new RecordingCtx();
          motion.draw(r.asCtx(), f);
          expect(r.calls).toEqual(record((ctx) => motion.draw(ctx, f)));
          expect(count(r.calls, 'save')).toBe(count(r.calls, 'restore'));
          expect(r.globalAlpha).toBe(1);
        });
      }
    }
  }
});

describe('seeded motions', () => {
  for (const id of ['impulse', 'wave', 'glitch'] as const) {
    it(`${id} changes with the seed`, () => {
      const m = motionById(id);
      const a = record((ctx) => m.draw(ctx, frame({ progress: 0.3, seed: 1 })));
      const b = record((ctx) => m.draw(ctx, frame({ progress: 0.3, seed: 2 })));
      expect(a).not.toEqual(b);
    });
  }
});
