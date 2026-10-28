import { describe, expect, it } from 'vitest';
import { MIN_ENTRY_MS, closeTimer, stopTimer, tapCategory } from './timer';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('tapCategory', () => {
  it('starts a timer when idle and saves nothing', () => {
    const t = tapCategory(null, 'work', T0, 'e1');
    expect(t.activeTimer).toEqual({ categoryId: 'work', startedAt: T0 });
    expect(t.entry).toBeNull();
  });

  it('attaches the goal when provided', () => {
    const t = tapCategory(null, 'work', T0, 'e1', 25);
    expect(t.activeTimer).toEqual({ categoryId: 'work', startedAt: T0, goalMinutes: 25 });
  });

  it('switching saves the current entry and starts the new one at now', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    const t = tapCategory(running, 'games', T0 + 30 * MIN, 'e1');
    expect(t.entry).toEqual({ id: 'e1', categoryId: 'work', start: T0, end: T0 + 30 * MIN });
    expect(t.activeTimer).toEqual({ categoryId: 'games', startedAt: T0 + 30 * MIN });
  });

  it('tapping the running category stops and saves it', () => {
    const running = { categoryId: 'work', startedAt: T0, goalMinutes: 45 };
    const t = tapCategory(running, 'work', T0 + 10 * MIN, 'e1');
    expect(t.activeTimer).toBeNull();
    expect(t.entry).toEqual({ id: 'e1', categoryId: 'work', start: T0, end: T0 + 10 * MIN });
  });

  it('discards a sub-5s entry on switch but still starts the new timer', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    const t = tapCategory(running, 'games', T0 + MIN_ENTRY_MS - 1, 'e1');
    expect(t.entry).toBeNull();
    expect(t.activeTimer?.categoryId).toBe('games');
  });

  it('discards a sub-5s entry when tapping the running category', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    const t = tapCategory(running, 'work', T0 + 2000, 'e1');
    expect(t.entry).toBeNull();
    expect(t.activeTimer).toBeNull();
  });
});

describe('stopTimer', () => {
  it('stops and saves the running timer', () => {
    const t = stopTimer({ categoryId: 'work', startedAt: T0 }, T0 + 5 * MIN, 'e1');
    expect(t).toEqual({
      activeTimer: null,
      entry: { id: 'e1', categoryId: 'work', start: T0, end: T0 + 5 * MIN },
      previousCategoryId: null,
    });
  });

  it('is a no-op when idle', () => {
    expect(stopTimer(null, T0, 'e1')).toEqual({ activeTimer: null, entry: null, previousCategoryId: null });
  });

  it('keeps an entry of exactly 5 seconds', () => {
    expect(stopTimer({ categoryId: 'work', startedAt: T0 }, T0 + MIN_ENTRY_MS, 'e1').entry).not.toBeNull();
  });
});

describe('backdated switch and resume support', () => {
  it('stores previous category on switch', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    const t = tapCategory(running, 'study', T0 + 10 * MIN, 'e1');
    expect(t.previousCategoryId).toBe('work');
  });

  it('applies backdated switch to entry end and new timer startedAt', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    const t = tapCategory(running, 'study', T0 + 20 * MIN, 'e1', undefined, 5 * MIN);
    expect(t.entry).toEqual({ id: 'e1', categoryId: 'work', start: T0, end: T0 + 15 * MIN });
    expect(t.activeTimer).toEqual({ categoryId: 'study', startedAt: T0 + 15 * MIN });
    expect(t.previousCategoryId).toBe('work');
  });

  it('clamps backdate to elapsed time if backdate exceeds elapsed', () => {
    const running = { categoryId: 'work', startedAt: T0 };
    // Running for 5 minutes, requested backdate 15 minutes
    const t = tapCategory(running, 'study', T0 + 5 * MIN, 'e1', undefined, 15 * MIN);
    expect(t.entry).toBeNull(); // elapsed clamped to 5min, so end = T0 (0 ms duration -> discarded sub-5s)
    expect(t.activeTimer).toEqual({ categoryId: 'study', startedAt: T0 });
  });
});

describe('closeTimer', () => {
  it('returns null when now is before startedAt (clock skew)', () => {
    expect(closeTimer({ categoryId: 'work', startedAt: T0 }, T0 - MIN, 'e1')).toBeNull();
  });

  it('never stores category name or color on the entry', () => {
    const e = closeTimer({ categoryId: 'work', startedAt: T0, goalMinutes: 25 }, T0 + MIN, 'e1');
    expect(Object.keys(e ?? {}).sort()).toEqual(['categoryId', 'end', 'id', 'start']);
  });
});
