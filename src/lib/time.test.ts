import { describe, expect, it } from 'vitest';
import {
  MS_PER_HOUR,
  MS_PER_MINUTE,
  calculateStatsSummary,
  canNavigateNext,
  clampBackdateMs,
  crossesMidnight,
  defaultManualRange,
  findOverlaps,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatPeriodLabel,
  formatTime,
  formatTimeRange,
  fromDateTimeLocal,
  getBarBins,
  getElapsedMs,
  getPeriodRange,
  getRingProgress,
  getTodayTotalsByCategory,
  groupEntriesByStartDay,
  overlapMs,
  rangesOverlap,
  shiftPeriod,
  toDateTimeLocal,
} from './time';
import type { Category, Entry } from '../types';

describe('formatDuration', () => {
  it('shows minutes only under an hour', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59 * 1000)).toBe('0m');
    expect(formatDuration(45 * MS_PER_MINUTE)).toBe('45m');
    expect(formatDuration(59 * MS_PER_MINUTE + 59_999)).toBe('59m');
  });

  it('shows hours and minutes from one hour', () => {
    expect(formatDuration(MS_PER_HOUR)).toBe('1h 0m');
    expect(formatDuration(MS_PER_HOUR + 25 * MS_PER_MINUTE)).toBe('1h 25m');
    expect(formatDuration(26 * MS_PER_HOUR + 5 * MS_PER_MINUTE)).toBe('26h 5m');
  });

  it('floors partial minutes and clamps negatives', () => {
    expect(formatDuration(25 * MS_PER_MINUTE + 59_000)).toBe('25m');
    expect(formatDuration(-5000)).toBe('0m');
  });
});

describe('formatClock', () => {
  it('formats HH:MM:SS with padding', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(5_000)).toBe('00:00:05');
    expect(formatClock(MS_PER_HOUR + 2 * MS_PER_MINUTE + 3_000)).toBe('01:02:03');
    expect(formatClock(100 * MS_PER_HOUR)).toBe('100:00:00');
  });

  it('floors sub-second values and clamps negatives', () => {
    expect(formatClock(1_999)).toBe('00:00:01');
    expect(formatClock(-1)).toBe('00:00:00');
  });
});

describe('getElapsedMs', () => {
  it('is now - startedAt', () => {
    expect(getElapsedMs(1_000, 61_000)).toBe(60_000);
  });
  it('never goes negative (clock skew)', () => {
    expect(getElapsedMs(10_000, 5_000)).toBe(0);
  });
});

describe('getRingProgress', () => {
  it('fills over 60 minutes and loops without a goal', () => {
    expect(getRingProgress(30 * MS_PER_MINUTE).fraction).toBeCloseTo(0.5);
    expect(getRingProgress(75 * MS_PER_MINUTE).fraction).toBeCloseTo(0.25);
    expect(getRingProgress(75 * MS_PER_MINUTE).goalReached).toBe(false);
  });

  it('fills elapsed/goal and caps at 1 once reached', () => {
    expect(getRingProgress(10 * MS_PER_MINUTE, 40)).toEqual({ fraction: 0.25, goalReached: false });
    expect(getRingProgress(40 * MS_PER_MINUTE, 40)).toEqual({ fraction: 1, goalReached: true });
    expect(getRingProgress(90 * MS_PER_MINUTE, 40)).toEqual({ fraction: 1, goalReached: true });
  });
});

describe('getTodayTotalsByCategory', () => {
  const day = new Date(2026, 9, 28, 0, 0, 0).getTime(); // local midnight
  const at = (h: number, m = 0) => day + h * MS_PER_HOUR + m * MS_PER_MINUTE;
  const entry = (id: string, categoryId: string, start: number, end: number): Entry => ({ id, categoryId, start, end });

  it('sums entries per category for today', () => {
    const entries = [entry('1', 'a', at(9), at(10)), entry('2', 'a', at(11), at(11, 30)), entry('3', 'b', at(12), at(12, 15))];
    expect(getTodayTotalsByCategory(entries, null, at(18))).toEqual({
      a: 90 * MS_PER_MINUTE,
      b: 15 * MS_PER_MINUTE,
    });
  });

  it('clips an entry that started yesterday to today only', () => {
    const entries = [entry('1', 'a', at(-1), at(1))]; // 23:00 yesterday -> 01:00 today
    expect(getTodayTotalsByCategory(entries, null, at(8))).toEqual({ a: MS_PER_HOUR });
  });

  it('ignores entries from other days', () => {
    const entries = [entry('1', 'a', at(-5), at(-4))];
    expect(getTodayTotalsByCategory(entries, null, at(8))).toEqual({});
  });

  it('includes the running timer up to now', () => {
    const totals = getTodayTotalsByCategory([], { categoryId: 'a', startedAt: at(9) }, at(9, 20));
    expect(totals).toEqual({ a: 20 * MS_PER_MINUTE });
  });
});

describe('clampBackdateMs', () => {
  it('returns 0 when there is no active timer', () => {
    expect(clampBackdateMs(5 * MS_PER_MINUTE, null, 1000)).toBe(0);
  });

  it('clamps to elapsed time if requested backdate is larger', () => {
    const timer = { categoryId: 'work', startedAt: 1000 };
    // Elapsed is 3000ms, requested is 5000ms -> should clamp to 3000ms
    expect(clampBackdateMs(5000, timer, 4000)).toBe(3000);
  });

  it('keeps requested backdate if within elapsed', () => {
    const timer = { categoryId: 'work', startedAt: 1000 };
    expect(clampBackdateMs(2000, timer, 4000)).toBe(2000);
  });

  it('clamps negative backdate to 0', () => {
    const timer = { categoryId: 'work', startedAt: 1000 };
    expect(clampBackdateMs(-500, timer, 4000)).toBe(0);
  });
});

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(rangesOverlap({ start: 100, end: 200 }, { start: 150, end: 250 })).toBe(true);
    expect(rangesOverlap({ start: 150, end: 250 }, { start: 100, end: 200 })).toBe(true);
    expect(rangesOverlap({ start: 100, end: 300 }, { start: 150, end: 200 })).toBe(true);
  });

  it('considers touching edges non-overlapping (half-open)', () => {
    expect(rangesOverlap({ start: 100, end: 200 }, { start: 200, end: 300 })).toBe(false);
    expect(rangesOverlap({ start: 200, end: 300 }, { start: 100, end: 200 })).toBe(false);
  });

  it('detects disjoint ranges as non-overlapping', () => {
    expect(rangesOverlap({ start: 100, end: 150 }, { start: 200, end: 250 })).toBe(false);
  });

  it('calculates overlapMs correctly with clipping (Rule 8)', () => {
    // Overlap within bounds
    expect(overlapMs(100, 200, 50, 250)).toBe(100);
    // Clipped at start
    expect(overlapMs(100, 200, 150, 250)).toBe(50);
    // Clipped at end
    expect(overlapMs(100, 200, 50, 150)).toBe(50);
    // Completely outside
    expect(overlapMs(100, 200, 300, 400)).toBe(0);
  });
});

describe('findOverlaps', () => {
  const e1: Entry = { id: '1', categoryId: 'work', start: 100, end: 200 };
  const e2: Entry = { id: '2', categoryId: 'study', start: 250, end: 350 };

  it('finds overlapping entries and sorts by start', () => {
    const overlaps = findOverlaps({ start: 150, end: 300 }, [e2, e1], null, 500);
    expect(overlaps).toEqual([
      { kind: 'entry', entry: e1 },
      { kind: 'entry', entry: e2 },
    ]);
  });

  it('ignores the entry currently being edited via excludeEntryId', () => {
    const overlaps = findOverlaps({ start: 150, end: 300 }, [e1, e2], null, 500, '1');
    expect(overlaps).toEqual([{ kind: 'entry', entry: e2 }]);
  });

  it('includes running timer as an overlap if range intersects [startedAt, now]', () => {
    const timer = { categoryId: 'games', startedAt: 400 };
    const overlaps = findOverlaps({ start: 350, end: 450 }, [e1], timer, 500);
    expect(overlaps).toEqual([
      { kind: 'timer', categoryId: 'games', start: 400, end: 500 },
    ]);
  });

  it('does not include running timer if now <= startedAt', () => {
    const timer = { categoryId: 'games', startedAt: 500 };
    const overlaps = findOverlaps({ start: 450, end: 550 }, [], timer, 500);
    expect(overlaps).toEqual([]);
  });
});

describe('crossesMidnight and groupEntriesByStartDay', () => {
  const day1 = new Date(2026, 9, 28, 0, 0, 0).getTime();
  const day2 = new Date(2026, 9, 29, 0, 0, 0).getTime();

  it('identifies entries crossing midnight', () => {
    expect(crossesMidnight(day1 + 23 * MS_PER_HOUR, day1 + 25 * MS_PER_HOUR)).toBe(true);
    expect(crossesMidnight(day1 + 10 * MS_PER_HOUR, day1 + 12 * MS_PER_HOUR)).toBe(false);
  });

  it('groups entries under start day and sorts days newest first', () => {
    const entryDay1: Entry = { id: '1', categoryId: 'work', start: day1 + 10 * MS_PER_HOUR, end: day1 + 11 * MS_PER_HOUR };
    const entryDay2: Entry = { id: '2', categoryId: 'study', start: day2 + 10 * MS_PER_HOUR, end: day2 + 12 * MS_PER_HOUR };

    const groups = groupEntriesByStartDay([entryDay1, entryDay2]);
    expect(groups).toHaveLength(2);
    expect(groups[0].dayStart).toBe(day2);
    expect(groups[0].entries).toEqual([entryDay2]);
    expect(groups[0].totalMs).toBe(2 * MS_PER_HOUR);

    expect(groups[1].dayStart).toBe(day1);
    expect(groups[1].entries).toEqual([entryDay1]);
    expect(groups[1].totalMs).toBe(MS_PER_HOUR);
  });
});

describe('formatting and datetime-local helpers', () => {
  const testDate = new Date(2026, 9, 28, 14, 30, 0).getTime();

  it('formats time and time range', () => {
    expect(formatTime(testDate)).toBe('14:30');
    expect(formatTimeRange(testDate, testDate + MS_PER_HOUR)).toBe('14:30 – 15:30');
  });

  it('converts between epoch ms and datetime-local format', () => {
    const str = toDateTimeLocal(testDate);
    expect(str).toContain('2026-10-28T14:30');
    expect(fromDateTimeLocal(str)).toBe(testDate);
    expect(fromDateTimeLocal('')).toBeNull();
  });

  it('formats day labels', () => {
    const now = testDate;
    expect(formatDayLabel(now, now)).toBe('Today');
    expect(formatDayLabel(now - 24 * MS_PER_HOUR, now)).toBe('Yesterday');
  });

  it('creates default manual range of 30 minutes ending now', () => {
    const range = defaultManualRange(testDate);
    expect(range.end).toBe(testDate);
    expect(range.start).toBe(testDate - 30 * MS_PER_MINUTE);
  });
});

describe('Stage 3: Period Ranges and Navigation', () => {
  // Monday, 26 Oct 2026, 10:00 AM
  const monday = new Date(2026, 9, 26, 10, 0, 0).getTime();
  // Wednesday, 28 Oct 2026, 15:30 PM
  const wednesday = new Date(2026, 9, 28, 15, 30, 0).getTime();

  it('calculates week range with Monday start (WEEK_STARTS_ON = 1)', () => {
    const week = getPeriodRange('week', wednesday);
    const startDay = new Date(week.start).getDay(); // 1 = Monday
    expect(startDay).toBe(1);
    expect(week.end - week.start).toBe(7 * 24 * MS_PER_HOUR);
  });

  it('calculates day, month, and year ranges correctly', () => {
    const day = getPeriodRange('day', wednesday);
    expect(day.end - day.start).toBe(24 * MS_PER_HOUR);

    const month = getPeriodRange('month', wednesday);
    expect(new Date(month.start).getDate()).toBe(1);
    expect(new Date(month.start).getMonth()).toBe(9); // October

    const year = getPeriodRange('year', wednesday);
    expect(new Date(year.start).getMonth()).toBe(0); // January 1
    expect(new Date(year.start).getDate()).toBe(1);
  });

  it('navigates periods backward and forward with shiftPeriod', () => {
    const nextDay = shiftPeriod('day', wednesday, 1);
    expect(new Date(nextDay).getDate()).toBe(29);

    const prevMonth = shiftPeriod('month', wednesday, -1);
    expect(new Date(prevMonth).getMonth()).toBe(8); // September
  });

  it('disables next navigation at the current period containing now', () => {
    const now = wednesday;
    expect(canNavigateNext('day', wednesday, now)).toBe(false);
    expect(canNavigateNext('day', monday, now)).toBe(true);

    expect(canNavigateNext('week', wednesday, now)).toBe(false);
    expect(canNavigateNext('month', wednesday, now)).toBe(false);
    expect(canNavigateNext('year', wednesday, now)).toBe(false);
  });

  it('formats period labels correctly', () => {
    const now = wednesday;
    expect(formatPeriodLabel('day', now, now)).toBe('Today');
    expect(formatPeriodLabel('month', now, now)).toBe('October 2026');
    expect(formatPeriodLabel('year', now, now)).toBe('2026');
    expect(formatPeriodLabel('week', now, now)).toContain('Oct');
  });
});

describe('Stage 3: Stats calculations, clipping, and percentages', () => {
  const catWork: Category = { id: 'c-work', name: 'Work', color: '#6366f1', type: 'productive', archived: false };
  const catSocial: Category = { id: 'c-social', name: 'Social', color: '#f43f5e', type: 'wasted', archived: false };
  const catBreak: Category = { id: 'c-break', name: 'Break', color: '#64748b', type: 'neutral', archived: false };
  const categories = [catWork, catSocial, catBreak];

  const day1 = new Date(2026, 9, 28, 0, 0, 0).getTime();
  const day2 = new Date(2026, 9, 29, 0, 0, 0).getTime();
  const day3 = new Date(2026, 9, 30, 0, 0, 0).getTime();

  it('handles midnight-crossing entries clipped to period (Rule 8)', () => {
    // 23:00 on Day 1 to 02:00 on Day 2 (3 hours total)
    const entry: Entry = {
      id: 'e-midnight',
      categoryId: 'c-work',
      start: day1 + 23 * MS_PER_HOUR,
      end: day2 + 2 * MS_PER_HOUR,
    };

    // Clipped to Day 1: only 1 hour (23:00 to 24:00)
    const statsDay1 = calculateStatsSummary([entry], null, categories, day1, day2, day3);
    expect(statsDay1.totalMs).toBe(MS_PER_HOUR);
    expect(statsDay1.productiveMs).toBe(MS_PER_HOUR);

    // Clipped to Day 2: 2 hours (00:00 to 02:00)
    const statsDay2 = calculateStatsSummary([entry], null, categories, day2, day3, day3);
    expect(statsDay2.totalMs).toBe(2 * MS_PER_HOUR);
    expect(statsDay2.productiveMs).toBe(2 * MS_PER_HOUR);

    // Across both days: full 3 hours
    const statsBoth = calculateStatsSummary([entry], null, categories, day1, day3, day3);
    expect(statsBoth.totalMs).toBe(3 * MS_PER_HOUR);
  });

  it('handles entries spanning several days correctly', () => {
    // Starts Day 1 at 10:00, ends Day 3 at 15:00
    // Day 1: 10:00 -> 24:00 = 14 hours
    // Day 2: 00:00 -> 24:00 = 24 hours
    // Day 3: 00:00 -> 15:00 = 15 hours
    const entry: Entry = {
      id: 'e-multiday',
      categoryId: 'c-work',
      start: day1 + 10 * MS_PER_HOUR,
      end: day3 + 15 * MS_PER_HOUR,
    };

    const day1Stats = calculateStatsSummary([entry], null, categories, day1, day2, day3 + 24 * MS_PER_HOUR);
    expect(day1Stats.totalMs).toBe(14 * MS_PER_HOUR);

    const day2Stats = calculateStatsSummary([entry], null, categories, day2, day3, day3 + 24 * MS_PER_HOUR);
    expect(day2Stats.totalMs).toBe(24 * MS_PER_HOUR);

    const day3Stats = calculateStatsSummary([entry], null, categories, day3, day3 + 24 * MS_PER_HOUR, day3 + 24 * MS_PER_HOUR);
    expect(day3Stats.totalMs).toBe(15 * MS_PER_HOUR);

    // Total span: 14 + 24 + 15 = 53 hours
    const allStats = calculateStatsSummary([entry], null, categories, day1, day3 + 24 * MS_PER_HOUR, day3 + 24 * MS_PER_HOUR);
    expect(allStats.totalMs).toBe(53 * MS_PER_HOUR);
  });

  it('handles month boundary clipping', () => {
    // Oct 31 20:00 to Nov 1 04:00
    const oct31 = new Date(2026, 9, 31, 0, 0, 0).getTime();
    const nov1 = new Date(2026, 10, 1, 0, 0, 0).getTime();
    const nov2 = new Date(2026, 10, 2, 0, 0, 0).getTime();

    const entry: Entry = {
      id: 'e-month-boundary',
      categoryId: 'c-work',
      start: oct31 + 20 * MS_PER_HOUR,
      end: nov1 + 4 * MS_PER_HOUR,
    };

    const octRange = getPeriodRange('month', oct31);
    const octStats = calculateStatsSummary([entry], null, categories, octRange.start, octRange.end, nov2);
    expect(octStats.totalMs).toBe(4 * MS_PER_HOUR); // 20:00 to 24:00 on Oct 31

    const novRange = getPeriodRange('month', nov1);
    const novStats = calculateStatsSummary([entry], null, categories, novRange.start, novRange.end, nov2);
    expect(novStats.totalMs).toBe(4 * MS_PER_HOUR); // 00:00 to 04:00 on Nov 1
  });

  it('handles year boundary clipping', () => {
    // Dec 31 2026 22:00 to Jan 1 2027 03:00
    const dec31 = new Date(2026, 11, 31, 0, 0, 0).getTime();
    const jan1 = new Date(2027, 0, 1, 0, 0, 0).getTime();

    const entry: Entry = {
      id: 'e-year-boundary',
      categoryId: 'c-work',
      start: dec31 + 22 * MS_PER_HOUR,
      end: jan1 + 3 * MS_PER_HOUR,
    };

    const y2026Range = getPeriodRange('year', dec31);
    const y2026Stats = calculateStatsSummary([entry], null, categories, y2026Range.start, y2026Range.end, jan1 + 24 * MS_PER_HOUR);
    expect(y2026Stats.totalMs).toBe(2 * MS_PER_HOUR);

    const y2027Range = getPeriodRange('year', jan1);
    const y2027Stats = calculateStatsSummary([entry], null, categories, y2027Range.start, y2027Range.end, jan1 + 24 * MS_PER_HOUR);
    expect(y2027Stats.totalMs).toBe(3 * MS_PER_HOUR);
  });

  it('treats running timer as a virtual entry with end = now (Rule 9)', () => {
    const startedAt = day1 + 9 * MS_PER_HOUR; // 09:00
    const now = day1 + 10 * MS_PER_HOUR + 30 * MS_PER_MINUTE; // 10:30 (1h 30m running)
    const activeTimer = { categoryId: 'c-work', startedAt };

    // Today stats include the running timer
    const statsToday = calculateStatsSummary([], activeTimer, categories, day1, day2, now);
    expect(statsToday.totalMs).toBe(90 * MS_PER_MINUTE);
    expect(statsToday.categoryTotals['c-work']).toBe(90 * MS_PER_MINUTE);

    // Yesterday stats do not include it
    const statsYesterday = calculateStatsSummary([], activeTimer, categories, day1 - 24 * MS_PER_HOUR, day1, now);
    expect(statsYesterday.totalMs).toBe(0);
  });

  it('calculates percentages and handles edge cases (Rule 10)', () => {
    // Case 1: Zero total
    const emptyStats = calculateStatsSummary([], null, categories, day1, day2, day1 + 12 * MS_PER_HOUR);
    expect(emptyStats.totalMs).toBe(0);
    expect(emptyStats.productivePercent).toBe(0);
    expect(emptyStats.wastedPercent).toBe(0);
    expect(emptyStats.categoryShares).toEqual({});

    // Case 2: Neutral only
    const breakOnly: Entry = {
      id: 'e-break',
      categoryId: 'c-break',
      start: day1 + 10 * MS_PER_HOUR,
      end: day1 + 11 * MS_PER_HOUR,
    };
    const neutralStats = calculateStatsSummary([breakOnly], null, categories, day1, day2, day2);
    expect(neutralStats.totalMs).toBe(MS_PER_HOUR);
    expect(neutralStats.neutralMs).toBe(MS_PER_HOUR);
    expect(neutralStats.productivePercent).toBe(0);
    expect(neutralStats.wastedPercent).toBe(0);
    expect(neutralStats.categoryShares['c-break']).toBe(100);

    // Case 3: 3h Work (productive), 1h Social (wasted), 1h Break (neutral) -> total 5h
    // Productive vs Wasted: 3 / 4 = 75%, 1 / 4 = 25%
    // Category shares: Work 60%, Social 20%, Break 20%
    const entries: Entry[] = [
      { id: '1', categoryId: 'c-work', start: day1 + 9 * MS_PER_HOUR, end: day1 + 12 * MS_PER_HOUR },
      { id: '2', categoryId: 'c-social', start: day1 + 13 * MS_PER_HOUR, end: day1 + 14 * MS_PER_HOUR },
      { id: '3', categoryId: 'c-break', start: day1 + 14 * MS_PER_HOUR, end: day1 + 15 * MS_PER_HOUR },
    ];
    const fullStats = calculateStatsSummary(entries, null, categories, day1, day2, day2);
    expect(fullStats.totalMs).toBe(5 * MS_PER_HOUR);
    expect(fullStats.productiveMs).toBe(3 * MS_PER_HOUR);
    expect(fullStats.wastedMs).toBe(MS_PER_HOUR);
    expect(fullStats.neutralMs).toBe(MS_PER_HOUR);
    expect(fullStats.productivePercent).toBeCloseTo(75);
    expect(fullStats.wastedPercent).toBeCloseTo(25);
    expect(fullStats.categoryShares['c-work']).toBeCloseTo(60);
    expect(fullStats.categoryShares['c-social']).toBeCloseTo(20);
    expect(fullStats.categoryShares['c-break']).toBeCloseTo(20);
  });
});

describe('Stage 3: getBarBins for charts', () => {
  const day = new Date(2026, 9, 28, 0, 0, 0).getTime();
  const e1: Entry = { id: '1', categoryId: 'work', start: day + 9 * MS_PER_HOUR, end: day + 10 * MS_PER_HOUR + 30 * MS_PER_MINUTE };

  it('generates 24 bins for day view and distributes time into hourly buckets', () => {
    const bins = getBarBins('day', day, [e1], null, day + 24 * MS_PER_HOUR);
    expect(bins).toHaveLength(24);
    // Hour 9 (09:00 - 10:00): 60 min
    expect(bins[9].categoryMs['work']).toBe(60 * MS_PER_MINUTE);
    // Hour 10 (10:00 - 11:00): 30 min
    expect(bins[10].categoryMs['work']).toBe(30 * MS_PER_MINUTE);
    // Hour 8: 0 min
    expect(bins[8].totalMs).toBe(0);
  });

  it('generates 7 bins for week view', () => {
    const bins = getBarBins('week', day, [e1], null, day + 24 * MS_PER_HOUR);
    expect(bins).toHaveLength(7);
    expect(bins[0].label).toBe('Mon');
    expect(bins[6].label).toBe('Sun');
  });

  it('generates days-in-month bins for month view', () => {
    const bins = getBarBins('month', day, [e1], null, day + 24 * MS_PER_HOUR);
    expect(bins).toHaveLength(31); // October has 31 days
    expect(bins[27].label).toBe('28'); // Day 28 (0-indexed 27)
    expect(bins[27].totalMs).toBe(90 * MS_PER_MINUTE);
  });

  it('generates 12 bins for year view', () => {
    const bins = getBarBins('year', day, [e1], null, day + 24 * MS_PER_HOUR);
    expect(bins).toHaveLength(12);
    expect(bins[9].label).toBe('Oct');
    expect(bins[9].totalMs).toBe(90 * MS_PER_MINUTE);
  });
});


