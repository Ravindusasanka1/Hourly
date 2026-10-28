/**
 * Pure timer switching logic (SPEC rule 2). No Date.now(), no id generation:
 * `now` and `newEntryId` are passed in so this is fully deterministic.
 */
import type { ActiveTimer, Entry } from '../types';
import { clampBackdateMs } from './time';

/** Entries shorter than this are treated as accidental taps and discarded. */
export const MIN_ENTRY_MS = 5000;

export interface TimerTransition {
  activeTimer: ActiveTimer;
  /** Entry to append, or null if nothing should be saved. */
  entry: Entry | null;
  /** Category to offer in "Resume" (rule 4). Set on switch, cleared on stop. */
  previousCategoryId: string | null;
}

/** Turn a running timer into an Entry ending at `end`, or null if too short. */
export function closeTimer(activeTimer: ActiveTimer, end: number, newEntryId: string): Entry | null {
  if (!activeTimer) return null;
  if (end - activeTimer.startedAt < MIN_ENTRY_MS) return null;
  return { id: newEntryId, categoryId: activeTimer.categoryId, start: activeTimer.startedAt, end };
}

/** Stop button: stop and save the running timer (if any). */
export function stopTimer(activeTimer: ActiveTimer, now: number, newEntryId: string): TimerTransition {
  return { activeTimer: null, entry: closeTimer(activeTimer, now, newEntryId), previousCategoryId: null };
}

/**
 * Category button tap:
 * - idle: start a timer for the category
 * - same category running: stop and save (backdate ignored)
 * - different category running: stop and save current, start the new one,
 *   remember the old category for Resume.
 *
 * `backdateMs` (rule 3): the switch happened this long ago. It is clamped to
 * the running timer's elapsed time; with no running timer it has no effect.
 */
export function tapCategory(
  activeTimer: ActiveTimer,
  categoryId: string,
  now: number,
  newEntryId: string,
  goalMinutes?: number,
  backdateMs = 0,
): TimerTransition {
  if (activeTimer && activeTimer.categoryId === categoryId) {
    return stopTimer(activeTimer, now, newEntryId);
  }
  const switchAt = now - clampBackdateMs(backdateMs, activeTimer, now);
  const next: NonNullable<ActiveTimer> =
    goalMinutes !== undefined
      ? { categoryId, startedAt: switchAt, goalMinutes }
      : { categoryId, startedAt: switchAt };
  return {
    activeTimer: next,
    entry: closeTimer(activeTimer, switchAt, newEntryId),
    previousCategoryId: activeTimer ? activeTimer.categoryId : null,
  };
}
