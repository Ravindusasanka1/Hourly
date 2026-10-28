import type { ComponentType, SVGProps } from 'react';
import { HistoryIcon, SettingsIcon, StatsIcon, TimerIcon } from './icons';

export type TabId = 'timer' | 'history' | 'stats' | 'settings';

const TABS: readonly { id: TabId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'timer', label: 'Timer', Icon: TimerIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'stats', label: 'Stats', Icon: StatsIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                id={`nav-${id}`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                    isActive ? 'bg-indigo-500/15' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
