/**
 * Pure time/date helpers (SPEC section 3, rule 2).
 * No React, no Date.now(): `now` is always passed in.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  getDaysInMonth,
  isSameDay,
  isSameYear,
  isValid,
  parse,
  setDate,
  setMonth,
  startOfDay,
  startOfMinute,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';
import type { ActiveTimer, Category, Entry } from '../types';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Weeks start on Monday (date-fns `weekStartsOn`). Single source of truth. */
export const WEEK_STARTS_ON = 1 as const;

/** Without a goal the ring fills over this period and loops (SPEC section 6). */
export const RING_LOOP_MS = 60 * MS_PER_MINUTE;

/** Elapsed = now - startedAt, never negative (SPEC rule 1). */
export function getElapsedMs(startedAt: number, now: number): number {
  return Math.max(0, now - startedAt);
}

/** "1h 25m", or "45m" when under an hour (SPEC rule 11). */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** "HH:MM:SS" for the live timer display only (SPEC rule 11). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Portion of [start, end) that falls inside [rangeStart, rangeEnd). */
export function overlapMs(start: number, end: number, rangeStart: number, rangeEnd: number): number {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
}

/** Local-time bounds of the day containing `now`: [start, end). */
export function getDayRange(now: number): { start: number; end: number } {
  const start = startOfDay(now);
  return { start: start.getTime(), end: addDays(start, 1).getTime() };
}

/**
 * Milliseconds tracked today per categoryId, clipped to today's bounds.
 * The running timer is included with end = now so button totals stay live.
 */
export function getTodayTotalsByCategory(
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  now: number,
): Record<string, number> {
  const { start, end } = getDayRange(now);
  const totals: Record<string, number> = {};
  const add = (categoryId: string, ms: number) => {
    if (ms > 0) totals[categoryId] = (totals[categoryId] ?? 0) + ms;
  };
  for (const e of entries) add(e.categoryId, overlapMs(e.start, e.end, start, end));
  if (activeTimer && now > activeTimer.startedAt) {
    add(activeTimer.categoryId, overlapMs(activeTimer.startedAt, now, start, end));
  }
  return totals;
}

export interface RingProgress {
  /** 0..1 share of the ring to fill. */
  fraction: number;
  goalReached: boolean;
}

/**
 * With a goal: fill elapsed/goal, capped at full once reached.
 * Without a goal: fill over RING_LOOP_MS and loop.
 */
export function getRingProgress(elapsedMs: number, goalMinutes?: number): RingProgress {
  const elapsed = Math.max(0, elapsedMs);
  if (goalMinutes !== undefined && goalMinutes > 0) {
    const goalMs = goalMinutes * MS_PER_MINUTE;
    const reached = elapsed >= goalMs;
    return { fraction: reached ? 1 : elapsed / goalMs, goalReached: reached };
  }
  return { fraction: (elapsed % RING_LOOP_MS) / RING_LOOP_MS, goalReached: false };
}

/* ------------------------------------------------------------------ */
/* Stage 2: backdated switch (rule 3)                                  */
/* ------------------------------------------------------------------ */

/** Clamp a backdate so it never exceeds the running timer's elapsed time. */
export function clampBackdateMs(requestedMs: number, activeTimer: ActiveTimer, now: number): number {
  if (!activeTimer) return 0;
  return Math.min(Math.max(0, requestedMs), getElapsedMs(activeTimer.startedAt, now));
}

/* ------------------------------------------------------------------ */
/* Stage 2: overlap detection (rule 7)                                 */
/* ------------------------------------------------------------------ */

export interface TimeRange {
  start: number;
  end: number;
}

export type Overlap =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'timer'; categoryId: string; start: number; end: number };

/** Half-open ranges: touching edges (a.end === b.start) do not overlap. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Entries (and the running timer, as [startedAt, now]) that overlap `range`.
 * `excludeEntryId` skips the entry being edited. Sorted by start.
 */
export function findOverlaps(
  range: TimeRange,
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  now: number,
  excludeEntryId?: string,
): Overlap[] {
  const result: Overlap[] = [];
  for (const e of entries) {
    if (e.id !== excludeEntryId && rangesOverlap(range, e)) result.push({ kind: 'entry', entry: e });
  }
  if (activeTimer && now > activeTimer.startedAt) {
    const timerRange = { start: activeTimer.startedAt, end: now };
    if (rangesOverlap(range, timerRange)) {
      result.push({ kind: 'timer', categoryId: activeTimer.categoryId, ...timerRange });
    }
  }
  const startOf = (o: Overlap) => (o.kind === 'entry' ? o.entry.start : o.start);
  return result.sort((a, b) => startOf(a) - startOf(b));
}

/* ------------------------------------------------------------------ */
/* Stage 2: History grouping and labels                                */
/* ------------------------------------------------------------------ */

export interface DayGroup {
  /** Local midnight of the day. */
  dayStart: number;
  /** Entries that START on this day, newest first. */
  entries: Entry[];
  /** Tracked time inside this day, clipped (rule 8), from all entries. */
  totalMs: number;
}

/** Group entries under their start day (rule 8), newest day first. */
export function groupEntriesByStartDay(entries: readonly Entry[]): DayGroup[] {
  const byDay = new Map<number, Entry[]>();
  for (const e of entries) {
    const key = startOfDay(e.start).getTime();
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }
  return [...byDay.entries()]
    .map(([dayStart, list]) => {
      const { start, end } = getDayRange(dayStart);
      const totalMs = entries.reduce((sum, e) => sum + overlapMs(e.start, e.end, start, end), 0);
      return { dayStart, entries: [...list].sort((a, b) => b.start - a.start), totalMs };
    })
    .sort((a, b) => b.dayStart - a.dayStart);
}

/** True if the entry runs past the end of its start day. */
export function crossesMidnight(start: number, end: number): boolean {
  return end > getDayRange(start).end;
}

/** "Today", "Yesterday", "Tue, 27 Oct", or "Tue, 27 Oct 2025" for other years. */
export function formatDayLabel(dayStart: number, now: number): string {
  if (isSameDay(dayStart, now)) return 'Today';
  if (isSameDay(dayStart, subDays(now, 1))) return 'Yesterday';
  return format(dayStart, isSameYear(dayStart, now) ? 'EEE, d MMM' : 'EEE, d MMM yyyy');
}

export function formatTime(ms: number): string {
  return format(ms, 'HH:mm');
}

export function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/* ------------------------------------------------------------------ */
/* Stage 2: manual entry form helpers                                  */
/* ------------------------------------------------------------------ */

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeLocal(ms: number): string {
  return format(ms, DATETIME_LOCAL_FORMAT);
}

/** Parse a datetime-local value (local time). Returns null if empty/invalid. */
export function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const d = parse(value.slice(0, 16), DATETIME_LOCAL_FORMAT, new Date(0));
  return isValid(d) ? d.getTime() : null;
}

/** Default range for a new manual entry: the 30 minutes ending now (to the minute). */
export function defaultManualRange(now: number): TimeRange {
  const end = startOfMinute(now).getTime();
  return { start: end - 30 * MS_PER_MINUTE, end };
}

/* ------------------------------------------------------------------ */
/* Stage 3: Stats range helpers, percentages, and bar bins            */
/* ------------------------------------------------------------------ */

export type StatsPeriod = 'day' | 'week' | 'month' | 'year';

/** Returns the local [start, end) epoch bounds for a period containing `referenceDate`. */
export function getPeriodRange(period: StatsPeriod, referenceDate: number): { start: number; end: number } {
  switch (period) {
    case 'day': {
      const s = startOfDay(referenceDate);
      return { start: s.getTime(), end: addDays(s, 1).getTime() };
    }
    case 'week': {
      const s = startOfWeek(referenceDate, { weekStartsOn: WEEK_STARTS_ON });
      return { start: s.getTime(), end: addWeeks(s, 1).getTime() };
    }
    case 'month': {
      const s = startOfMonth(referenceDate);
      return { start: s.getTime(), end: addMonths(s, 1).getTime() };
    }
    case 'year': {
      const s = startOfYear(referenceDate);
      return { start: s.getTime(), end: addYears(s, 1).getTime() };
    }
  }
}

/** Shift `referenceDate` by `delta` periods (+1 or -1). */
export function shiftPeriod(period: StatsPeriod, referenceDate: number, delta: number): number {
  switch (period) {
    case 'day':
      return addDays(referenceDate, delta).getTime();
    case 'week':
      return addWeeks(referenceDate, delta).getTime();
    case 'month':
      return addMonths(referenceDate, delta).getTime();
    case 'year':
      return addYears(referenceDate, delta).getTime();
  }
}

/** Check if navigation forward is allowed (next is disabled at current period containing `now`). */
export function canNavigateNext(period: StatsPeriod, referenceDate: number, now: number): boolean {
  const currentRange = getPeriodRange(period, now);
  const refRange = getPeriodRange(period, referenceDate);
  return refRange.start < currentRange.start;
}

/** Format a human-readable period label for the stats header. */
export function formatPeriodLabel(period: StatsPeriod, referenceDate: number, now: number): string {
  switch (period) {
    case 'day':
      return formatDayLabel(startOfDay(referenceDate).getTime(), now);
    case 'week': {
      const { start, end } = getPeriodRange('week', referenceDate);
      const lastDay = end - 1;
      const startYear = new Date(start).getFullYear();
      const endYear = new Date(lastDay).getFullYear();
      if (startYear === endYear) {
        return `${format(start, 'd MMM')} – ${format(lastDay, 'd MMM yyyy')}`;
      }
      return `${format(start, 'd MMM yyyy')} – ${format(lastDay, 'd MMM yyyy')}`;
    }
    case 'month':
      return format(referenceDate, 'MMMM yyyy');
    case 'year':
      return format(referenceDate, 'yyyy');
  }
}

export interface StatsSummary {
  totalMs: number;
  productiveMs: number;
  wastedMs: number;
  neutralMs: number;
  /** 0..100, productive / (productive + wasted) * 100 */
  productivePercent: number;
  /** 0..100, wasted / (productive + wasted) * 100 */
  wastedPercent: number;
  categoryTotals: Record<string, number>;
  /** 0..100 share of total tracked time */
  categoryShares: Record<string, number>;
}

/**
 * Calculates total tracked time, category breakdowns, and productive/wasted ratios (Rule 10).
 * Clips entries to [rangeStart, rangeEnd) (Rule 8).
 * Treats running timer as virtual entry with end = now (Rule 9).
 */
export function calculateStatsSummary(
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  categories: readonly Category[],
  rangeStart: number,
  rangeEnd: number,
  now: number,
): StatsSummary {
  const categoryMap = new Map<string, Category>();
  for (const c of categories) categoryMap.set(c.id, c);

  const categoryTotals: Record<string, number> = {};
  const addTime = (catId: string, ms: number) => {
    if (ms > 0) {
      categoryTotals[catId] = (categoryTotals[catId] ?? 0) + ms;
    }
  };

  // 1. Process persisted entries
  for (const e of entries) {
    const ms = overlapMs(e.start, e.end, rangeStart, rangeEnd);
    addTime(e.categoryId, ms);
  }

  // 2. Virtual running entry (Rule 9)
  if (activeTimer && now > activeTimer.startedAt) {
    const ms = overlapMs(activeTimer.startedAt, now, rangeStart, rangeEnd);
    addTime(activeTimer.categoryId, ms);
  }

  let totalMs = 0;
  let productiveMs = 0;
  let wastedMs = 0;
  let neutralMs = 0;

  for (const [catId, ms] of Object.entries(categoryTotals)) {
    totalMs += ms;
    const cat = categoryMap.get(catId);
    const catType = cat?.type ?? 'neutral';
    if (catType === 'productive') productiveMs += ms;
    else if (catType === 'wasted') wastedMs += ms;
    else neutralMs += ms;
  }

  // Two kinds of percentages (Rule 10)
  const categoryShares: Record<string, number> = {};
  for (const [catId, ms] of Object.entries(categoryTotals)) {
    categoryShares[catId] = totalMs > 0 ? (ms / totalMs) * 100 : 0;
  }

  const productiveWastedDenominator = productiveMs + wastedMs;
  const productivePercent =
    productiveWastedDenominator > 0 ? (productiveMs / productiveWastedDenominator) * 100 : 0;
  const wastedPercent =
    productiveWastedDenominator > 0 ? (wastedMs / productiveWastedDenominator) * 100 : 0;

  return {
    totalMs,
    productiveMs,
    wastedMs,
    neutralMs,
    productivePercent,
    wastedPercent,
    categoryTotals,
    categoryShares,
  };
}

export interface BarBin {
  label: string;
  start: number;
  end: number;
  categoryMs: Record<string, number>;
  totalMs: number;
}

/**
 * Splits a period into sub-period bins for the stacked bar chart:
 * - Day: 24 hourly bars
 * - Week: 7 day bars (Mon to Sun)
 * - Month: One bar per day of the month
 * - Year: 12 month bars
 */
export function getBarBins(
  period: StatsPeriod,
  referenceDate: number,
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  now: number,
): BarBin[] {
  const bins: BarBin[] = [];

  switch (period) {
    case 'day': {
      const dayStart = startOfDay(referenceDate).getTime();
      for (let h = 0; h < 24; h++) {
        const start = dayStart + h * MS_PER_HOUR;
        const end = start + MS_PER_HOUR;
        bins.push({
          label: `${String(h).padStart(2, '0')}:00`,
          start,
          end,
          categoryMs: {},
          totalMs: 0,
        });
      }
      break;
    }
    case 'week': {
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: WEEK_STARTS_ON });
      for (let d = 0; d < 7; d++) {
        const start = addDays(weekStart, d).getTime();
        const end = addDays(weekStart, d + 1).getTime();
        bins.push({
          label: format(start, 'EEE'),
          start,
          end,
          categoryMs: {},
          totalMs: 0,
        });
      }
      break;
    }
    case 'month': {
      const monthStart = startOfMonth(referenceDate);
      const daysCount = getDaysInMonth(monthStart);
      for (let d = 1; d <= daysCount; d++) {
        const start = setDate(monthStart, d).getTime();
        const end = addDays(start, 1).getTime();
        bins.push({
          label: String(d),
          start,
          end,
          categoryMs: {},
          totalMs: 0,
        });
      }
      break;
    }
    case 'year': {
      const yearStart = startOfYear(referenceDate);
      for (let m = 0; m < 12; m++) {
        const start = setMonth(yearStart, m).getTime();
        const end = addMonths(start, 1).getTime();
        bins.push({
          label: format(start, 'MMM'),
          start,
          end,
          categoryMs: {},
          totalMs: 0,
        });
      }
      break;
    }
  }

  // Populate bins with clipped overlapMs for entries + virtual running timer
  for (const bin of bins) {
    for (const e of entries) {
      const ms = overlapMs(e.start, e.end, bin.start, bin.end);
      if (ms > 0) {
        bin.categoryMs[e.categoryId] = (bin.categoryMs[e.categoryId] ?? 0) + ms;
        bin.totalMs += ms;
      }
    }
    if (activeTimer && now > activeTimer.startedAt) {
      const ms = overlapMs(activeTimer.startedAt, now, bin.start, bin.end);
      if (ms > 0) {
        bin.categoryMs[activeTimer.categoryId] = (bin.categoryMs[activeTimer.categoryId] ?? 0) + ms;
        bin.totalMs += ms;
      }
    }
  }

  return bins;
}

/* ------------------------------------------------------------------ */
/* Trend / Pulse line chart helpers (category & type progress)        */
/* ------------------------------------------------------------------ */

export type TrendFilter =
  | { kind: 'all' }
  | { kind: 'type' }
  | { kind: 'category'; categoryId: string };

export interface TrendDataset {
  id: string;
  label: string;
  color: string;
  /** Duration in hours for each bin (rounded to 3 decimal places for smooth plotting) */
  hoursData: number[];
  /** Raw milliseconds for each bin */
  msData: number[];
  /** Total milliseconds across all bins in the period */
  totalMs: number;
}

export interface TrendSeriesResult {
  labels: string[];
  datasets: TrendDataset[];
  /** Present when a single category with dailyGoalMinutes is selected in Week or Month view */
  dailyGoalHours: number | null;
}

export const TYPE_TREND_META: Record<
  Category['type'],
  { label: string; color: string }
> = {
  productive: { label: 'Productive', color: '#10b981' },
  wasted: { label: 'Wasted', color: '#f43f5e' },
  neutral: { label: 'Neutral', color: '#64748b' },
};

/**
 * Builds pulse/heart-rate line datasets from period bins according to the active filter:
 * - 'all': one line per visible category (non-archived or having tracked time in the bins)
 * - 'type': three lines (Productive, Wasted, Neutral)
 * - 'category': single line for the selected categoryId (+ optional daily goal line in week/month)
 */
export function getTrendSeries(
  filter: TrendFilter,
  bins: readonly BarBin[],
  categories: readonly Category[],
  period: StatsPeriod,
): TrendSeriesResult {
  const labels = bins.map((b) => b.label);
  const toHours = (ms: number) => Number((ms / MS_PER_HOUR).toFixed(3));

  if (filter.kind === 'category') {
    const cat = categories.find((c) => c.id === filter.categoryId);
    if (!cat) {
      return { labels, datasets: [], dailyGoalHours: null };
    }
    const msData = bins.map((b) => b.categoryMs[cat.id] ?? 0);
    const totalMs = msData.reduce((sum, v) => sum + v, 0);
    const dailyGoalHours =
      (period === 'week' || period === 'month') &&
      cat.dailyGoalMinutes !== undefined &&
      cat.dailyGoalMinutes > 0
        ? Number((cat.dailyGoalMinutes / 60).toFixed(3))
        : null;

    return {
      labels,
      datasets: [
        {
          id: cat.id,
          label: cat.name,
          color: cat.color,
          hoursData: msData.map(toHours),
          msData,
          totalMs,
        },
      ],
      dailyGoalHours,
    };
  }

  if (filter.kind === 'type') {
    const categoryMap = new Map<string, Category>();
    for (const c of categories) categoryMap.set(c.id, c);

    const types: readonly Category['type'][] = ['productive', 'wasted', 'neutral'];
    const datasets: TrendDataset[] = types.map((t) => {
      const meta = TYPE_TREND_META[t];
      const msData = bins.map((bin) => {
        let sum = 0;
        for (const [catId, ms] of Object.entries(bin.categoryMs)) {
          const catType = categoryMap.get(catId)?.type ?? 'neutral';
          if (catType === t) sum += ms;
        }
        return sum;
      });
      const totalMs = msData.reduce((s, v) => s + v, 0);
      return {
        id: `type-${t}`,
        label: meta.label,
        color: meta.color,
        hoursData: msData.map(toHours),
        msData,
        totalMs,
      };
    });

    return { labels, datasets, dailyGoalHours: null };
  }

  // filter.kind === 'all'
  const visibleCategories = categories.filter((c) => {
    if (!c.archived) return true;
    return bins.some((b) => (b.categoryMs[c.id] ?? 0) > 0);
  });

  const datasets: TrendDataset[] = visibleCategories.map((cat) => {
    const msData = bins.map((b) => b.categoryMs[cat.id] ?? 0);
    const totalMs = msData.reduce((s, v) => s + v, 0);
    return {
      id: cat.id,
      label: cat.name,
      color: cat.color,
      hoursData: msData.map(toHours),
      msData,
      totalMs,
    };
  });

  return { labels, datasets, dailyGoalHours: null };
}

export interface TrendComparison {
  subjectLabel: string;
  currentMs: number;
  previousMs: number;
  /** currentMs - previousMs */
  deltaMs: number;
  /** Percentage change vs previous period, or null when previousMs === 0 */
  deltaPercent: number | null;
  /** Whether an increase in time is considered desirable (false for 'wasted' categories) */
  increaseIsPositive: boolean;
  comparisonPeriodLabel: string;
}

export function formatComparisonPeriodLabel(period: StatsPeriod): string {
  switch (period) {
    case 'day':
      return 'vs prev day';
    case 'week':
      return 'vs prev week';
    case 'month':
      return 'vs prev month';
    case 'year':
      return 'vs prev year';
  }
}

/**
 * Compares the selected trend target between the current period and the immediately preceding period.
 * - 'all': compares total tracked time
 * - 'type': compares Productive time
 * - 'category': compares that specific category's tracked time
 */
export function calculateTrendComparison(
  filter: TrendFilter,
  period: StatsPeriod,
  referenceDate: number,
  entries: readonly Entry[],
  activeTimer: ActiveTimer,
  categories: readonly Category[],
  now: number,
): TrendComparison {
  const currentRange = getPeriodRange(period, referenceDate);
  const prevRefDate = shiftPeriod(period, referenceDate, -1);
  const prevRange = getPeriodRange(period, prevRefDate);

  const currentSummary = calculateStatsSummary(
    entries,
    activeTimer,
    categories,
    currentRange.start,
    currentRange.end,
    now,
  );
  const prevSummary = calculateStatsSummary(
    entries,
    activeTimer,
    categories,
    prevRange.start,
    prevRange.end,
    now,
  );

  let subjectLabel = 'Total Tracked';
  let currentMs = currentSummary.totalMs;
  let previousMs = prevSummary.totalMs;
  let increaseIsPositive = true;

  if (filter.kind === 'type') {
    subjectLabel = 'Productive Time';
    currentMs = currentSummary.productiveMs;
    previousMs = prevSummary.productiveMs;
    increaseIsPositive = true;
  } else if (filter.kind === 'category') {
    const cat = categories.find((c) => c.id === filter.categoryId);
    subjectLabel = cat?.name ?? 'Category';
    currentMs = currentSummary.categoryTotals[filter.categoryId] ?? 0;
    previousMs = prevSummary.categoryTotals[filter.categoryId] ?? 0;
    increaseIsPositive = cat?.type !== 'wasted';
  }

  const deltaMs = currentMs - previousMs;
  const deltaPercent = previousMs > 0 ? ((currentMs - previousMs) / previousMs) * 100 : null;

  return {
    subjectLabel,
    currentMs,
    previousMs,
    deltaMs,
    deltaPercent,
    increaseIsPositive,
    comparisonPeriodLabel: formatComparisonPeriodLabel(period),
  };
}


