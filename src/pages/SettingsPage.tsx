import { useRef, useState } from 'react';
import { CategoryForm } from '../components/CategoryForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DownloadIcon, PlusIcon, UploadIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { useNow } from '../hooks/useNow';
import { CATEGORY_TYPES, countEntriesForCategory, getActiveCategories, getArchivedCategories } from '../lib/categories';
import {
  createExportPayload,
  getExportReminderMessage,
  needsExportReminder,
  validateImportPayload,
  type ExportPayload,
} from '../lib/exportImport';
import { formatDayLabel, formatTime } from '../lib/time';
import { useAppStore } from '../store/useAppStore';
import type { Category } from '../types';

type FormState = { category: Category | null } | null;

type ImportModalState =
  | { mode: 'summary'; payload: ExportPayload; summary: { categoryCount: number; entryCount: number } }
  | { mode: 'error'; message: string }
  | null;

const TYPE_LABEL = Object.fromEntries(CATEGORY_TYPES.map((t) => [t.value, t.label]));

export function SettingsPage() {
  const now = useNow();
  const categories = useAppStore((s) => s.categories);
  const entries = useAppStore((s) => s.entries);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const previousCategoryId = useAppStore((s) => s.previousCategoryId);
  const lastExportedAt = useAppStore((s) => s.lastExportedAt);
  const archiveCategory = useAppStore((s) => s.archiveCategory);
  const restoreCategory = useAppStore((s) => s.restoreCategory);
  const deleteCategoryPermanently = useAppStore((s) => s.deleteCategoryPermanently);
  const setLastExportedAt = useAppStore((s) => s.setLastExportedAt);
  const importReplace = useAppStore((s) => s.importReplace);
  const importMerge = useAppStore((s) => s.importMerge);

  const [form, setForm] = useState<FormState>(null);
  const [toArchive, setToArchive] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [importState, setImportState] = useState<ImportModalState>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = getActiveCategories(categories);
  const archived = getArchivedCategories(categories);
  const archivingRunning = toArchive !== null && activeTimer?.categoryId === toArchive.id;
  const deleteCount = toDelete ? countEntriesForCategory(entries, toDelete.id) : 0;

  const showReminder = needsExportReminder(lastExportedAt, now);
  const reminderMessage = getExportReminderMessage(lastExportedAt, now);

  const handleExport = () => {
    const timestamp = Date.now();
    const payload = createExportPayload(categories, entries, previousCategoryId, timestamp);
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    a.download = `hourly-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportedAt(timestamp);
    setToastMessage('Backup downloaded successfully.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateImportPayload(content);
      if (result.ok) {
        setImportState({
          mode: 'summary',
          payload: result.data,
          summary: result.summary,
        });
      } else {
        setImportState({
          mode: 'error',
          message: result.error,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleMerge = () => {
    if (importState?.mode !== 'summary') return;
    const res = importMerge(importState.payload);
    setImportState(null);
    setToastMessage(`Merged ${res.categoriesAdded} new categories and ${res.entriesAdded} new entries.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleConfirmReplace = () => {
    if (importState?.mode !== 'summary') return;
    importReplace(importState.payload);
    setShowReplaceConfirm(false);
    setImportState(null);
    setToastMessage('All data replaced with backup.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const formatLastExported = () => {
    if (!lastExportedAt) return 'Never';
    return `${formatDayLabel(lastExportedAt, now)} at ${formatTime(lastExportedAt)}`;
  };

  return (
    <div className="space-y-8">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">Settings</h1>

      {toastMessage && (
        <div id="settings-toast" className="animate-fade-in rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Backup & Export/Import Section */}
      <section aria-labelledby="backup-heading" className="space-y-4">
        <h2 id="backup-heading" className="text-lg font-semibold">
          Data & Backup
        </h2>

        {showReminder && reminderMessage && (
          <div id="export-reminder-banner" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Backup reminder</p>
            <p className="mt-1 text-xs">{reminderMessage}</p>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Last exported</span>
            <span id="last-exported-date" className="font-medium">
              {formatLastExported()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              id="export-btn"
              type="button"
              className="btn-primary min-h-11 px-4"
              onClick={handleExport}
            >
              <DownloadIcon className="h-4 w-4" />
              Export JSON
            </button>

            <button
              id="import-btn"
              type="button"
              className="btn-ghost min-h-11 px-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="h-4 w-4" />
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section aria-labelledby="categories-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="categories-heading" className="text-lg font-semibold">
            Categories
          </h2>
          <button id="category-add" type="button" className="btn-primary min-h-10 px-4" onClick={() => setForm({ category: null })}>
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>

        {active.length === 0 ? (
          <p className="card p-5 text-sm text-slate-500 dark:text-slate-400">No active categories. Add one to start tracking.</p>
        ) : (
          <ul className="card divide-y divide-slate-200/70 overflow-hidden dark:divide-white/10">
            {active.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3 pl-4">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {TYPE_LABEL[c.type]}
                    {c.dailyGoalMinutes ? ` · Goal ${c.dailyGoalMinutes}m` : ''}
                    {activeTimer?.categoryId === c.id && ' · Running'}
                  </p>
                </div>
                <button
                  id={`category-edit-${c.id}`}
                  type="button"
                  className="btn-ghost min-h-10 px-3"
                  onClick={() => setForm({ category: c })}
                >
                  Edit
                </button>
                <button
                  id={`category-archive-${c.id}`}
                  type="button"
                  className="btn-ghost min-h-10 px-3 text-rose-600 dark:text-rose-400"
                  onClick={() => setToArchive(c)}
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Archived Categories Section */}
      <section aria-labelledby="archived-heading" className="space-y-3">
        <h2 id="archived-heading" className="text-lg font-semibold">
          Archived
        </h2>
        {archived.length === 0 ? (
          <p className="card p-5 text-sm text-slate-500 dark:text-slate-400">
            Nothing archived. Archived categories stay in your history but are hidden from the timer.
          </p>
        ) : (
          <ul className="card divide-y divide-slate-200/70 overflow-hidden dark:divide-white/10">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3 pl-4">
                <span className="h-4 w-4 shrink-0 rounded-full opacity-60" style={{ backgroundColor: c.color }} />
                <p className="min-w-0 flex-1 truncate font-medium text-slate-500 dark:text-slate-400">{c.name}</p>
                <button
                  id={`category-restore-${c.id}`}
                  type="button"
                  className="btn-ghost min-h-10 px-3"
                  onClick={() => restoreCategory(c.id)}
                >
                  Restore
                </button>
                <button
                  id={`category-delete-${c.id}`}
                  type="button"
                  className="btn-ghost min-h-10 px-3 text-rose-600 dark:text-rose-400"
                  onClick={() => setToDelete(c)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form && <CategoryForm category={form.category} onClose={() => setForm(null)} />}

      {/* Import Summary Modal */}
      {importState?.mode === 'summary' && (
        <Modal
          open
          id="import-summary-modal"
          title="Import Backup"
          onClose={() => setImportState(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The backup file was verified successfully and contains:
            </p>
            <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5 space-y-1 text-sm font-medium">
              <p>• {importState.summary.categoryCount} Categories</p>
              <p>• {importState.summary.entryCount} Entries</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose how you want to apply the backup:
            </p>
            <div className="space-y-2 pt-2">
              <button
                id="import-merge-btn"
                type="button"
                className="btn-primary w-full"
                onClick={handleMerge}
              >
                Merge (keep existing, add new)
              </button>
              <button
                id="import-replace-btn"
                type="button"
                className="btn w-full bg-rose-600 text-white hover:bg-rose-500"
                onClick={() => setShowReplaceConfirm(true)}
              >
                Replace all data
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => setImportState(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Error Modal */}
      {importState?.mode === 'error' && (
        <Modal
          open
          id="import-error-modal"
          title="Import Failed"
          onClose={() => setImportState(null)}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
              <p className="font-semibold">Validation Error</p>
              <p className="mt-1 text-xs">{importState.message}</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your existing data has not been modified. Please fix the file or choose a valid backup.
            </p>
            <div className="pt-2">
              <button
                id="import-error-dismiss"
                type="button"
                className="btn-primary w-full"
                onClick={() => setImportState(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Replace All Data Confirmation */}
      <ConfirmDialog
        open={showReplaceConfirm}
        id="confirm-replace"
        title="Replace all data?"
        danger
        message={
          <p>
            This will <strong className="text-rose-600 dark:text-rose-400">overwrite all current data</strong> (
            {categories.length} categories and {entries.length} entries) with the contents of this backup file.
            This action cannot be undone.
          </p>
        }
        confirmLabel="Yes, replace all"
        onConfirm={handleConfirmReplace}
        onCancel={() => setShowReplaceConfirm(false)}
      />

      <ConfirmDialog
        open={toArchive !== null}
        id="confirm-archive"
        title={`Archive "${toArchive?.name ?? ''}"?`}
        message={
          <>
            <p>It will be hidden from the timer but stays in your history. You can restore it anytime.</p>
            {archivingRunning && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                This category's timer is running. It will be stopped and saved first.
              </p>
            )}
          </>
        }
        confirmLabel={archivingRunning ? 'Stop & archive' : 'Archive'}
        onConfirm={() => {
          if (toArchive) archiveCategory(toArchive.id);
          setToArchive(null);
        }}
        onCancel={() => setToArchive(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        id="confirm-delete"
        title={`Delete "${toDelete?.name ?? ''}" permanently?`}
        danger
        requireText={toDelete?.name}
        message={
          <p>
            This also deletes{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              {deleteCount} {deleteCount === 1 ? 'entry' : 'entries'}
            </strong>{' '}
            recorded in this category. This cannot be undone.
          </p>
        }
        confirmLabel="Delete forever"
        onConfirm={() => {
          if (toDelete) deleteCategoryPermanently(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
