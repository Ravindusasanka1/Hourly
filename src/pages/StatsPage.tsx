import { useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { useNow } from '../hooks/useNow';
import {
  calculateStatsSummary,
  canNavigateNext,
  formatDuration,
  formatPeriodLabel,
  getBarBins,
  getPeriodRange,
  MS_PER_HOUR,
  shiftPeriod,
  type StatsPeriod,
} from '../lib/time';
import { useAppStore } from '../store/useAppStore';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
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
  const hasData = summary.totalMs > 0;

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
          label: (context: any) => {
            const ms = context.parsed;
            const share = Math.round((ms / (summary.totalMs || 1)) * 100);
            return ` ${context.label}: ${formatDuration(ms)} (${share}%)`;
          },
        },
      },
    },
    cutout: '70%',
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
          maxTicksLimit: period === 'day' ? 6 : period === 'month' ? 7 : 12,
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
          callback: (value: any) => {
            const num = Number(value);
            if (num === 0) return '0';
            if (num >= 1) return `${num}h`;
            return `${Math.round(num * 60)}m`;
          },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const hours = context.parsed.y;
            const ms = Math.round(hours * MS_PER_HOUR);
            return ` ${context.dataset.label}: ${formatDuration(ms)}`;
          },
        },
      },
    },
  };

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

          {/* Category Share Doughnut Chart */}
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
