import { useState } from 'react';
import { BackdatePicker } from '../components/BackdatePicker';
import { CategoryButton } from '../components/CategoryButton';
import { GoalPicker } from '../components/GoalPicker';
import { StopIcon } from '../components/icons';
import { TimerRing } from '../components/TimerRing';
import { useNow } from '../hooks/useNow';
import { MS_PER_MINUTE, getElapsedMs } from '../lib/time';
import { buildTimerView } from '../lib/timerView';
import { useAppStore } from '../store/useAppStore';

interface TimerPageProps {
  onOpenSettings: () => void;
}

export function TimerPage({ onOpenSettings }: TimerPageProps) {
  const now = useNow();
  const categories = useAppStore((s) => s.categories);
  const entries = useAppStore((s) => s.entries);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const previousCategoryId = useAppStore((s) => s.previousCategoryId);
  const tapCategory = useAppStore((s) => s.tapCategory);
  const stopTimer = useAppStore((s) => s.stopTimer);
  const [goal, setGoal] = useState<number | null>(null);
  const [backdateMinutes, setBackdateMinutes] = useState(0);

  const view = buildTimerView(categories, entries, activeTimer, now, previousCategoryId);

  const handleTap = (id: string) => {
    tapCategory(id, goal ?? undefined, backdateMinutes * MS_PER_MINUTE);
    setBackdateMinutes(0);
  };

  const handleStop = () => {
    stopTimer();
    setBackdateMinutes(0);
  };

  const elapsedMs = activeTimer ? getElapsedMs(activeTimer.startedAt, now) : 0;

  return (
    <div className="space-y-6">
      <header className="pt-2 text-center">
        <h1 className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">Hourly</h1>
      </header>

      <TimerRing
        fraction={view.ringFraction}
        color={view.color}
        goalReached={view.goalReached}
        isRunning={view.isRunning}
        clock={view.clock}
        categoryName={view.categoryName}
        goalLabel={view.goalLabel}
      />

      {!view.isRunning && <GoalPicker value={goal} onChange={setGoal} />}

      {view.isRunning && (
        <BackdatePicker
          value={backdateMinutes}
          onChange={setBackdateMinutes}
          elapsedMs={elapsedMs}
        />
      )}

      {view.isRunning && view.previousCategory && (
        <div className="flex justify-center">
          <button
            id="timer-resume"
            type="button"
            className="btn w-full max-w-xs border border-indigo-500/30 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
            onClick={() => handleTap(view.previousCategory!.id)}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: view.previousCategory.color }} />
            Resume {view.previousCategory.name}
          </button>
        </div>
      )}

      <div className="flex justify-center">
        <button
          id="timer-stop"
          type="button"
          className="btn min-w-40 bg-slate-900 text-white shadow-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          disabled={!view.isRunning}
          onClick={handleStop}
        >
          <StopIcon className="h-4 w-4" />
          Stop
        </button>
      </div>

      {view.buttons.length > 0 ? (
        <section aria-label="Categories" className="grid grid-cols-2 gap-3">
          {view.buttons.map((b) => (
            <CategoryButton key={b.id} view={b} onTap={handleTap} />
          ))}
        </section>
      ) : (
        <div className="card p-6 text-center">
          <p className="font-medium">No categories yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add one in Settings to start tracking.</p>
          <button id="timer-empty-settings" type="button" className="btn-primary mt-4" onClick={onOpenSettings}>
            Go to Settings
          </button>
        </div>
      )}
    </div>
  );
}

