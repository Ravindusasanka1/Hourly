interface TimerRingProps {
  fraction: number;
  color: string | null;
  goalReached: boolean;
  isRunning: boolean;
  clock: string;
  categoryName: string | null;
  goalLabel: string | null;
}

const SIZE = 280;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GOAL_COLOR = 'var(--color-goal)';

/** Large SVG progress ring using stroke-dasharray / stroke-dashoffset. */
export function TimerRing({ fraction, color, goalReached, isRunning, clock, categoryName, goalLabel }: TimerRingProps) {
  const stroke = goalReached ? GOAL_COLOR : (color ?? 'transparent');
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      {isRunning && (
        <div
          className="animate-soft-pulse absolute inset-6 rounded-full opacity-60 blur-3xl"
          style={{ backgroundColor: stroke }}
        />
      )}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative h-full w-full -rotate-90" role="img" aria-label="Timer progress">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-slate-200 dark:stroke-white/10"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        {isRunning ? (
          <>
            <span id="timer-clock" className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
              {clock}
            </span>
            <span className="mt-2 flex max-w-full items-center gap-2 truncate text-base font-medium text-slate-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? undefined }} />
              <span className="truncate">{categoryName}</span>
            </span>
            {goalReached ? (
              <span className="mt-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Goal reached
              </span>
            ) : (
              goalLabel && <span className="mt-2 text-xs text-slate-500 dark:text-slate-400">Goal {goalLabel}</span>
            )}
          </>
        ) : (
          <span className="text-base font-medium text-slate-500 dark:text-slate-400">Tap a category to start</span>
        )}
      </div>
    </div>
  );
}
