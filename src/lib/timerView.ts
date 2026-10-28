/**
 * Pure view-model builder for the Timer screen, so the component only renders.
 */
import type { ActiveTimer, Category, Entry } from '../types';
import { getActiveCategories, findCategory } from './categories';
import {
  MS_PER_MINUTE,
  formatClock,
  formatDuration,
  getElapsedMs,
  getRingProgress,
  getTodayTotalsByCategory,
} from './time';

export interface CategoryButtonView {
  id: string;
  name: string;
  color: string;
  todayLabel: string;
  isRunning: boolean;
  dailyGoalMinutes?: number;
  dailyGoalProgress?: number;
}

export interface TimerView {
  isRunning: boolean;
  clock: string;
  categoryName: string | null;
  color: string | null;
  ringFraction: number;
  goalReached: boolean;
  goalLabel: string | null;
  buttons: CategoryButtonView[];
  previousCategory: Category | null;
}

export function buildTimerView(
  categories: readonly Category[],
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  now: number,
  previousCategoryId?: string | null,
): TimerView {
  const totals = getTodayTotalsByCategory(entries, activeTimer, now);
  const buttons = getActiveCategories(categories).map((c) => {
    const todayMs = totals[c.id] ?? 0;
    const goalMins = c.dailyGoalMinutes;
    const progress =
      goalMins !== undefined && goalMins > 0
        ? Math.min(1, todayMs / (goalMins * MS_PER_MINUTE))
        : undefined;

    return {
      id: c.id,
      name: c.name,
      color: c.color,
      todayLabel: formatDuration(todayMs),
      isRunning: activeTimer?.categoryId === c.id,
      dailyGoalMinutes: goalMins,
      dailyGoalProgress: progress,
    };
  });

  let previousCategory: Category | null = null;
  if (activeTimer && previousCategoryId) {
    const prev = findCategory(categories, previousCategoryId);
    if (prev && !prev.archived) {
      previousCategory = prev;
    }
  }

  if (!activeTimer) {
    return {
      isRunning: false,
      clock: formatClock(0),
      categoryName: null,
      color: null,
      ringFraction: 0,
      goalReached: false,
      goalLabel: null,
      buttons,
      previousCategory: null,
    };
  }

  const category = findCategory(categories, activeTimer.categoryId);
  const elapsed = getElapsedMs(activeTimer.startedAt, now);
  const ring = getRingProgress(elapsed, activeTimer.goalMinutes);
  return {
    isRunning: true,
    clock: formatClock(elapsed),
    categoryName: category?.name ?? 'Unknown',
    color: category?.color ?? '#64748b',
    ringFraction: ring.fraction,
    goalReached: ring.goalReached,
    goalLabel: activeTimer.goalMinutes ? formatDuration(activeTimer.goalMinutes * MS_PER_MINUTE) : null,
    buttons,
    previousCategory,
  };
}
