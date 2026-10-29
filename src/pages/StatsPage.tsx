import { useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { useNow } from '../hooks/useNow';
import {
  calculateStatsSummary,
  calculateTrendComparison,
  canNavigateNext,
  formatDuration,
  formatPeriodLabel,
  getBarBins,
  getPeriodRange,
  getTrendSeries,
  MS_PER_HOUR,
  shiftPeriod,
  type StatsPeriod,
  type TrendFilter,
} from '../lib/time';
import { useAppStore } from '../store/useAppStore';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
);

const PERIODS: readonly { value: StatsPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export function StatsPage() {
  const now = useNow();
  const categories = useAppStore((s) => s.categories);
  const entries = useAppStore((s) => s.entries);
  const activeTimer = useAppStore((s) => s.activeTimer);

  const [period, setPeriod] = useState<StatsPeriod>('day');
  const [referenceDate, setReferenceDate] = useState<number>(now);
  const [trendFilter, setTrendFilter] = useState<TrendFilter>({ kind: 'type' });

  const handlePeriodChange = (nextPeriod: StatsPeriod) => {
    setPeriod(nextPeriod);
    setReferenceDate(now);
  };

  const handlePrev = () => {
    setReferenceDate((prev) => shiftPeriod(period, prev, -1));
  };

  const handleNext = () => {
    if (canNavigateNext(period, referenceDate, now)) {
      setReferenceDate((prev) => shiftPeriod(period, prev, 1));
    }
  };

  const { start: rangeStart, end: rangeEnd } = getPeriodRange(period, referenceDate);
  const summary = calculateStatsSummary(entries, activeTimer, categories, rangeStart, rangeEnd, now);
  const bins = getBarBins(period, referenceDate, entries, activeTimer, now);
  const periodLabel = formatPeriodLabel(period, referenceDate, now);

  // Ensure selected category filter stays valid if category is removed
  const effectiveTrendFilter: TrendFilter =
    trendFilter.kind === 'category' && !categories.some((c) => c.id === trendFilter.categoryId)
      ? { kind: 'all' }
      : trendFilter;

  const trendSeries = getTrendSeries(effectiveTrendFilter, bins, categories, period);
  const trendComparison = calculateTrendComparison(
    effectiveTrendFilter,
    period,
    referenceDate,
    entries,
    activeTimer,
    categories,
    now,
  );

  const hasData = summary.totalMs > 0 || trendComparison.previousMs > 0;

  // Categories available in filter chips (non-archived or having data in the current period)
  const selectableCategories = categories.filter(
    (c) => !c.archived || (summary.categoryTotals[c.id] ?? 0) > 0,
  );

  // Active or represented categories for doughnut chart
  const activeCategoriesWithData = categories.filter((c) => (summary.categoryTotals[c.id] ?? 0) > 0);

  const doughnutData = {
    labels: activeCategoriesWithData.map((c) => c.name),
    datasets: [
      {
        data: activeCategoriesWithData.map((c) => summary.categoryTotals[c.id] ?? 0),
        backgroundColor: activeCategoriesWithData.map((c) => c.color),
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => {
            const ms = context.parsed;
            const share = Math.round((ms / (summary.totalMs || 1)) * 100);
            return ` ${context.label}: ${formatDuration(ms)} (${share}%)`;
          },
        },
      },
    },
    cutout: '70%',
  };

  const shouldFillPulseArea = effectiveTrendFilter.kind === 'category' || effectiveTrendFilter.kind === 'type';

  const lineDatasets = [
    ...trendSeries.datasets.map((ds) => ({
      label: ds.label,
      data: ds.hoursData,
      borderColor: ds.color,
      backgroundColor: `${ds.color}22`,
      fill: shouldFillPulseArea,
      tension: 0.38,
      borderWidth: effectiveTrendFilter.kind === 'category' ? 2.5 : 2,
      pointRadius: ds.hoursData.map((v) => (v > 0 ? 3 : 0)),
      pointHoverRadius: 5,
      pointBackgroundColor: ds.color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5,
    })),
    ...(trendSeries.dailyGoalHours !== null
      ? [
          {
            label: 'Daily Goal',
            data: trendSeries.labels.map(() => trendSeries.dailyGoalHours ?? 0),
            borderColor: '#94a3b8',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0,
          },
        ]
      : []),
  ];

  const lineData = {
    labels: trendSeries.labels,
    datasets: lineDatasets,
  };

  const maxTicksX = period === 'day' ? 6 : period === 'month' ? 7 : 12;

  const formatYAxisTick = (value: string | number) => {
    const num = Number(value);
    if (num === 0) return '0';
    if (num >= 1) return `${Number(num.toFixed(1))}h`;
    return `${Math.round(num * 60)}m`;
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: maxTicksX,
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 1,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          maxTicksLimit: 5,
          callback: formatYAxisTick,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const hours = context.parsed.y ?? 0;
            const ms = Math.round(hours * MS_PER_HOUR);
            return ` ${context.dataset.label}: ${formatDuration(ms)}`;
          },
        },
      },
    },
  };

  const barData = {
    labels: bins.map((b) => b.label),
    datasets: activeCategoriesWithData.map((c) => ({
      label: c.name,
      data: bins.map((b) => Number(((b.categoryMs[c.id] ?? 0) / MS_PER_HOUR).toFixed(2))),
      backgroundColor: c.color,
      stack: 'stack',
      borderRadius: 3,
    })),
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: maxTicksX,
        },
      },
      y: {
        stacked: true,
        suggestedMax: 1,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          maxTicksLimit: 5,
          callback: formatYAxisTick,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const hours = context.parsed.y ?? 0;
            const ms = Math.round(hours * MS_PER_HOUR);
            return ` ${context.dataset.label}: ${formatDuration(ms)}`;
          },
        },
      },
    },
  };

  const isDeltaGood =
    trendComparison.deltaMs === 0
      ? null
      : (trendComparison.deltaMs > 0 && trendComparison.increaseIsPositive) ||
        (trendComparison.deltaMs < 0 && !trendComparison.increaseIsPositive);

  return (
    <div className="space-y-6">
      <header className="pt-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Stats</h1>
      </header>

      {/* Period Toggle */}
      <div className="flex justify-center">
        <div className="flex rounded-full bg-slate-200/70 p-1 dark:bg-white/10" role="tablist">
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <button
                key={p.value}
                id={`stats-period-${p.value}`}
                type="button"
                role="tab"
                aria-selected={active}
                className={`min-h-9 rounded-full px-4 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
                onClick={() => handlePeriodChange(p.value)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prev / Next Period Navigation */}
      <div className="flex items-center justify-between px-2">
        <button
          id="stats-prev"
          type="button"
          className="btn-ghost h-9 w-9 rounded-full p-0"
          aria-label="Previous period"
          onClick={handlePrev}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 id="stats-period-label" className="text-base font-semibold">
          {periodLabel}
        </h2>
        <button
          id="stats-next"
          type="button"
          className="btn-ghost h-9 w-9 rounded-full p-0"
          aria-label="Next period"
          disabled={!canNavigateNext(period, referenceDate, now)}
          onClick={handleNext}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {!hasData ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No tracked time in this period</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Start a timer or add an entry to see your stats and breakdown.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Card */}
          <section aria-label="Summary" className="card p-5">
            <div className="border-b border-slate-200/70 pb-3 text-center dark:divide-white/10 dark:border-white/10">
              <span className="label">Total Tracked</span>
              <p className="text-3xl font-bold tracking-tight">{formatDuration(summary.totalMs)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 text-center">
              <div>
                <span className="label">Productive</span>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round(summary.productivePercent)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDuration(summary.productiveMs)}
                </p>
              </div>
              <div>
                <span className="label">Wasted</span>
                <p className="text-lg font-semibold text-rose-600 dark:text-rose-400">
                  {Math.round(summary.wastedPercent)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDuration(summary.wastedMs)}
                </p>
              </div>
              <div>
                <span className="label">Neutral</span>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  {formatDuration(summary.neutralMs)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">excluded from %</p>
              </div>
            </div>
          </section>

          {/* Category Pulse & Progress (Heart-Rate Trend Line Chart) */}
          <section aria-label="Category Pulse & Progress" className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
                Pulse & Progress ({period})
              </h3>
              {trendSeries.dailyGoalHours !== null && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-block w-3 border-t-2 border-dashed border-slate-400" />
                  Goal: {formatDuration(trendSeries.dailyGoalHours * MS_PER_HOUR)}/day
                </span>
              )}
            </div>

            {/* Filter Chips: Productive vs Wasted | All Categories | Individual Category Chips */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Trend filter">
              <button
                type="button"
                id="trend-filter-type"
                onClick={() => setTrendFilter({ kind: 'type' })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  effectiveTrendFilter.kind === 'type'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                }`}
              >
                Productive vs Wasted
              </button>
              <button
                type="button"
                id="trend-filter-all"
                onClick={() => setTrendFilter({ kind: 'all' })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  effectiveTrendFilter.kind === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                }`}
              >
                All Categories
              </button>
              {selectableCategories.map((cat) => {
                const isSelected =
                  effectiveTrendFilter.kind === 'category' &&
                  effectiveTrendFilter.categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`trend-filter-cat-${cat.id}`}
                    onClick={() => setTrendFilter({ kind: 'category', categoryId: cat.id })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Period-over-Period Comparison Strip */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-slate-100/80 px-3.5 py-2.5 dark:bg-white/5">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {trendComparison.subjectLabel}
                </span>
                <p className="text-lg font-bold tracking-tight">
                  {formatDuration(trendComparison.currentMs)}
                </p>
              </div>
              <div className="text-right">
                {trendComparison.deltaMs === 0 ? (
                  <span className="inline-block rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    No change {trendComparison.comparisonPeriodLabel}
                  </span>
                ) : (
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isDeltaGood
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {trendComparison.deltaMs > 0 ? '▲ +' : '▼ -'}
                    {formatDuration(Math.abs(trendComparison.deltaMs))}
                    {trendComparison.deltaPercent !== null
                      ? ` (${trendComparison.deltaMs > 0 ? '+' : ''}${Math.round(
                          trendComparison.deltaPercent,
                        )}%)`
                      : ''}{' '}
                    {trendComparison.comparisonPeriodLabel}
                  </span>
                )}
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Previous: {formatDuration(trendComparison.previousMs)}
                </p>
              </div>
            </div>

            {/* Pulse / Heart-Rate Line Chart */}
            <div className="h-56 w-full">
              <Line data={lineData} options={lineOptions} />
            </div>

            {/* Legend for Visible Pulse Lines */}
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              {trendSeries.datasets.map((ds) => (
                <div key={ds.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ds.color }}
                  />
                  <span className="font-medium">{ds.label}:</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatDuration(ds.totalMs)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Category Share Doughnut Chart */}
          {summary.totalMs > 0 && (
            <section aria-label="Category Share" className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
                Category Share
              </h3>
              <div className="relative mx-auto h-48 w-48">
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                  <span className="text-sm font-bold">{formatDuration(summary.totalMs)}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {activeCategoriesWithData.map((c) => {
                  const share = Math.round(summary.categoryShares[c.id] ?? 0);
                  const ms = summary.categoryTotals[c.id] ?? 0;
                  return (
                    <div key={c.id} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-medium">{c.name}:</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatDuration(ms)} ({share}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stacked Bar Chart */}
          <section aria-label="Activity Breakdown" className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Activity Breakdown ({period})
            </h3>
            <div className="h-52 w-full">
              <Bar data={barData} options={barOptions} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
