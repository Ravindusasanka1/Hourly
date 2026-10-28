import type { CategoryButtonView } from '../lib/timerView';

interface CategoryButtonProps {
  view: CategoryButtonView;
  onTap: (id: string) => void;
}

export function CategoryButton({ view, onTap }: CategoryButtonProps) {
  return (
    <button
      id={`category-btn-${view.id}`}
      type="button"
      aria-pressed={view.isRunning}
      onClick={() => onTap(view.id)}
      className={`group relative flex min-h-20 flex-col items-start justify-between overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.97] ${
        view.isRunning
          ? 'border-transparent text-white shadow-lg'
          : 'border-slate-200/80 bg-white/70 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
      }`}
      style={
        view.isRunning
          ? { backgroundColor: view.color, boxShadow: `0 10px 30px -10px ${view.color}` }
          : undefined
      }
    >
      <span className="flex w-full items-center gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${view.isRunning ? 'bg-white ring-4 ring-white/30' : ''}`}
          style={view.isRunning ? undefined : { backgroundColor: view.color }}
        />
        <span className="truncate font-semibold">{view.name}</span>
      </span>
      <span
        className={`mt-2 text-sm tabular-nums ${view.isRunning ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}
      >
        Today {view.todayLabel}
      </span>
      {view.dailyGoalMinutes !== undefined && (
        <div className="mt-2 w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <div
              className={`h-full transition-all duration-300 ${view.isRunning ? 'bg-white' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.round((view.dailyGoalProgress ?? 0) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
