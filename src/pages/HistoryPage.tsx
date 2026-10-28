import { useState } from 'react';
import { EntryForm } from '../components/EntryForm';
import { PlusIcon } from '../components/icons';
import { useNow } from '../hooks/useNow';
import { findCategory } from '../lib/categories';
import {
  crossesMidnight,
  formatDayLabel,
  formatDuration,
  formatTimeRange,
  groupEntriesByStartDay,
} from '../lib/time';
import { useAppStore } from '../store/useAppStore';
import type { Entry } from '../types';

export function HistoryPage() {
  const now = useNow();
  const entries = useAppStore((s) => s.entries);
  const categories = useAppStore((s) => s.categories);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const dayGroups = groupEntriesByStartDay(entries);

  const openAdd = () => {
    setSelectedEntry(null);
    setFormOpen(true);
  };

  const openEdit = (e: Entry) => {
    setSelectedEntry(e);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <button
          id="entry-add"
          type="button"
          className="btn-primary min-h-10 px-4"
          onClick={openAdd}
        >
          <PlusIcon className="h-4 w-4" />
          Add entry
        </button>
      </div>

      {dayGroups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No entries yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Completed timer sessions and manual entries will appear here.
          </p>
          <button
            id="history-empty-add"
            type="button"
            className="btn-primary mt-4"
            onClick={openAdd}
          >
            Add first entry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => {
            const dayLabel = formatDayLabel(group.dayStart, now);
            const totalLabel = formatDuration(group.totalMs);

            return (
              <section
                key={group.dayStart}
                aria-label={`Entries for ${dayLabel}`}
                className="space-y-2"
              >
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
                    {dayLabel}
                  </h2>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {totalLabel}
                  </span>
                </div>

                <ul className="card divide-y divide-slate-200/70 overflow-hidden dark:divide-white/10">
                  {group.entries.map((e) => {
                    const cat = findCategory(categories, e.categoryId);
                    const rangeLabel = formatTimeRange(e.start, e.end);
                    const durationLabel = formatDuration(e.end - e.start);
                    const spansNextDay = crossesMidnight(e.start, e.end);

                    return (
                      <li key={e.id}>
                        <button
                          id={`entry-item-${e.id}`}
                          type="button"
                          className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-slate-50/70 dark:hover:bg-white/5"
                          onClick={() => openEdit(e)}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cat?.color ?? '#64748b' }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">
                                {cat?.name ?? 'Unknown'}
                              </p>
                              {spansNextDay && (
                                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
                                  continues next day
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {rangeLabel}
                            </p>
                            {e.note && (
                              <p className="mt-0.5 truncate text-xs text-slate-600 italic dark:text-slate-300">
                                {e.note}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">
                            {durationLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {formOpen && (
        <EntryForm
          entry={selectedEntry}
          now={now}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
