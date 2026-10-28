import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { findCategory, getActiveCategories } from '../lib/categories';
import {
  defaultManualRange,
  findOverlaps,
  formatTimeRange,
  fromDateTimeLocal,
  toDateTimeLocal,
  type Overlap,
} from '../lib/time';
import { useAppStore } from '../store/useAppStore';
import type { Entry } from '../types';

interface EntryFormProps {
  /** Entry to edit, or null to add a new manual entry. */
  entry: Entry | null;
  now: number;
  onClose: () => void;
}

export function EntryForm({ entry, now, onClose }: EntryFormProps) {
  const categories = useAppStore((s) => s.categories);
  const entries = useAppStore((s) => s.entries);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const addEntry = useAppStore((s) => s.addEntry);
  const updateEntry = useAppStore((s) => s.updateEntry);
  const deleteEntry = useAppStore((s) => s.deleteEntry);

  const activeCategories = getActiveCategories(categories);
  // If editing an entry with an archived category, allow keeping it.
  const editingCategory = entry ? findCategory(categories, entry.categoryId) : undefined;
  const availableCategories =
    editingCategory && editingCategory.archived
      ? [editingCategory, ...activeCategories]
      : activeCategories;

  const defaultRange = defaultManualRange(now);
  const [categoryId, setCategoryId] = useState(
    entry?.categoryId ?? (availableCategories[0]?.id || ''),
  );
  const [startStr, setStartStr] = useState(
    toDateTimeLocal(entry ? entry.start : defaultRange.start),
  );
  const [endStr, setEndStr] = useState(
    toDateTimeLocal(entry ? entry.end : defaultRange.end),
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<Overlap[] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const commitSave = (startMs: number, endMs: number) => {
    const input = {
      categoryId,
      start: startMs,
      end: endMs,
      note: note.trim() || undefined,
    };
    const result = entry ? updateEntry(entry.id, input) : addEntry(input);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    const startMs = fromDateTimeLocal(startStr);
    const endMs = fromDateTimeLocal(endStr);
    if (startMs === null || endMs === null) {
      setError('Please enter valid start and end times.');
      return;
    }
    if (endMs <= startMs) {
      setError('End time must be after start time.');
      return;
    }
    if (endMs > now) {
      setError('End time cannot be in the future.');
      return;
    }

    // Check for overlaps (Rule 7)
    const detected = findOverlaps({ start: startMs, end: endMs }, entries, activeTimer, now, entry?.id);
    if (detected.length > 0 && !overlaps) {
      setOverlaps(detected);
      return;
    }

    commitSave(startMs, endMs);
  };

  const handleSaveAnyway = () => {
    const startMs = fromDateTimeLocal(startStr);
    const endMs = fromDateTimeLocal(endStr);
    if (startMs !== null && endMs !== null) {
      commitSave(startMs, endMs);
    }
  };

  const getOverlapLabel = (o: Overlap) => {
    if (o.kind === 'entry') {
      const cat = findCategory(categories, o.entry.categoryId);
      return `${cat?.name ?? 'Unknown'} (${formatTimeRange(o.entry.start, o.entry.end)})`;
    }
    const cat = findCategory(categories, o.categoryId);
    return `Running timer: ${cat?.name ?? 'Unknown'} (${formatTimeRange(o.start, o.end)})`;
  };

  return (
    <>
      <Modal
        open
        id="entry-form"
        title={entry ? 'Edit entry' : 'Add entry'}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <div className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>}

          <div>
            <label htmlFor="entry-category" className="label">
              Category
            </label>
            <select
              id="entry-category"
              className="input"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setOverlaps(null);
              }}
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.archived ? '(archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="entry-start" className="label">
                Start time
              </label>
              <input
                id="entry-start"
                type="datetime-local"
                className="input"
                value={startStr}
                onChange={(e) => {
                  setStartStr(e.target.value);
                  setOverlaps(null);
                }}
              />
            </div>
            <div>
              <label htmlFor="entry-end" className="label">
                End time
              </label>
              <input
                id="entry-end"
                type="datetime-local"
                className="input"
                value={endStr}
                onChange={(e) => {
                  setEndStr(e.target.value);
                  setOverlaps(null);
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="entry-note" className="label">
              Note (optional)
            </label>
            <input
              id="entry-note"
              type="text"
              className="input"
              value={note}
              placeholder="What were you working on?"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {overlaps && overlaps.length > 0 && (
            <div id="entry-overlap-warning" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Time range overlaps with:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {overlaps.map((o, idx) => (
                  <li key={idx}>{getOverlapLabel(o)}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  id="entry-save-anyway"
                  type="button"
                  className="btn min-h-10 bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-500"
                  onClick={handleSaveAnyway}
                >
                  Save anyway
                </button>
                <button
                  type="button"
                  className="btn-ghost min-h-10 px-4 text-xs"
                  onClick={() => setOverlaps(null)}
                >
                  Adjust time
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {entry ? (
              <button
                id="entry-delete"
                type="button"
                className="btn-ghost text-rose-600 hover:text-rose-700 dark:text-rose-400"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button id="entry-submit" type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {showDeleteConfirm && (
        <ConfirmDialog
          open
          id="entry-delete-confirm"
          title="Delete entry"
          message="Are you sure you want to delete this entry? This action cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            if (entry) deleteEntry(entry.id);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
