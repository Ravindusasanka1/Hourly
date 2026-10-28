import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage, STORAGE_KEY } from '../storage';
import { DEFAULT_CATEGORIES, isValidHexColor, validateCategoryName } from '../lib/categories';
import { stopTimer as stopTransition, tapCategory as tapTransition, type TimerTransition } from '../lib/timer';
import { SCHEMA_VERSION, type CategoryType, type Entry, type PersistedState } from '../types';

import { mergeImportData, type ExportPayload } from '../lib/exportImport';

export interface CategoryInput {
  name: string;
  color: string;
  type: CategoryType;
  dailyGoalMinutes?: number;
}

export interface EntryInput {
  categoryId: string;
  start: number;
  end: number;
  note?: string;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

interface Actions {
  /** Start / switch / stop depending on the running timer (SPEC rule 2, 3). */
  tapCategory: (categoryId: string, goalMinutes?: number, backdateMs?: number) => void;
  stopTimer: () => void;
  addCategory: (input: CategoryInput) => ActionResult;
  updateCategory: (id: string, input: CategoryInput) => ActionResult;
  /** Archives; if it is the running category, stops and saves the timer first. */
  archiveCategory: (id: string) => void;
  restoreCategory: (id: string) => void;
  /** Only for archived categories. Also deletes all its entries. */
  deleteCategoryPermanently: (id: string) => void;
  /** Stage 2: Entry management */
  addEntry: (input: EntryInput) => ActionResult;
  updateEntry: (id: string, input: EntryInput) => ActionResult;
  deleteEntry: (id: string) => void;
  /** Stage 4: Export/Import */
  setLastExportedAt: (timestamp: number) => void;
  importReplace: (payload: ExportPayload) => void;
  importMerge: (payload: ExportPayload) => { categoriesAdded: number; entriesAdded: number };
}

export type AppState = PersistedState & Actions;

const newId = (): string => crypto.randomUUID();

function validateInput(input: CategoryInput, state: PersistedState, excludeId?: string): string | null {
  const nameError = validateCategoryName(input.name, state.categories, excludeId);
  if (nameError) return nameError;
  if (!isValidHexColor(input.color)) return 'Pick a valid color.';
  return null;
}

/** Apply a pure timer transition to state. */
function applyTransition(state: PersistedState, t: TimerTransition): Partial<PersistedState> {
  return {
    activeTimer: t.activeTimer,
    entries: t.entry ? [...state.entries, t.entry] : state.entries,
    previousCategoryId: t.previousCategoryId,
  };
}

const initialState: PersistedState = {
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  entries: [],
  activeTimer: null,
  previousCategoryId: null,
  lastExportedAt: null,
  schemaVersion: SCHEMA_VERSION,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      tapCategory: (categoryId, goalMinutes, backdateMs) => {
        const state = get();
        const category = state.categories.find((c) => c.id === categoryId);
        if (!category || category.archived) return;
        set(applyTransition(state, tapTransition(state.activeTimer, categoryId, Date.now(), newId(), goalMinutes, backdateMs)));
      },

      stopTimer: () => {
        const state = get();
        if (!state.activeTimer) return;
        set(applyTransition(state, stopTransition(state.activeTimer, Date.now(), newId())));
      },

      addCategory: (input) => {
        const state = get();
        const error = validateInput(input, state);
        if (error) return { ok: false, error };
        set({
          categories: [
            ...state.categories,
            {
              id: newId(),
              name: input.name.trim(),
              color: input.color,
              type: input.type,
              archived: false,
              ...(input.dailyGoalMinutes !== undefined ? { dailyGoalMinutes: input.dailyGoalMinutes } : {}),
            },
          ],
        });
        return { ok: true };
      },

      updateCategory: (id, input) => {
        const state = get();
        if (!state.categories.some((c) => c.id === id)) return { ok: false, error: 'Category not found.' };
        const error = validateInput(input, state, id);
        if (error) return { ok: false, error };
        set({
          categories: state.categories.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: input.name.trim(),
                  color: input.color,
                  type: input.type,
                  dailyGoalMinutes: input.dailyGoalMinutes,
                }
              : c,
          ),
        });
        return { ok: true };
      },

      archiveCategory: (id) => {
        const state = get();
        const timerPatch =
          state.activeTimer?.categoryId === id
            ? applyTransition(state, stopTransition(state.activeTimer, Date.now(), newId()))
            : {};
        set({
          ...timerPatch,
          categories: state.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
          previousCategoryId:
            state.previousCategoryId === id
              ? null
              : timerPatch.previousCategoryId !== undefined
                ? timerPatch.previousCategoryId
                : state.previousCategoryId,
        });
      },

      restoreCategory: (id) => {
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, archived: false } : c)),
        }));
      },

      deleteCategoryPermanently: (id) => {
        const state = get();
        const target = state.categories.find((c) => c.id === id);
        if (!target || !target.archived) return;
        set({
          categories: state.categories.filter((c) => c.id !== id),
          entries: state.entries.filter((e) => e.categoryId !== id),
          previousCategoryId: state.previousCategoryId === id ? null : state.previousCategoryId,
        });
      },

      addEntry: (input) => {
        const state = get();
        if (input.end <= input.start) return { ok: false, error: 'End time must be after start time.' };
        if (!state.categories.some((c) => c.id === input.categoryId)) return { ok: false, error: 'Category not found.' };
        const entry: Entry = {
          id: newId(),
          categoryId: input.categoryId,
          start: input.start,
          end: input.end,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true };
      },

      updateEntry: (id, input) => {
        const state = get();
        if (!state.entries.some((e) => e.id === id)) return { ok: false, error: 'Entry not found.' };
        if (input.end <= input.start) return { ok: false, error: 'End time must be after start time.' };
        if (!state.categories.some((c) => c.id === input.categoryId)) return { ok: false, error: 'Category not found.' };
        set({
          entries: state.entries.map((e) =>
            e.id === id
              ? {
                  ...e,
                  categoryId: input.categoryId,
                  start: input.start,
                  end: input.end,
                  note: input.note?.trim() ? input.note.trim() : undefined,
                }
              : e,
          ),
        });
        return { ok: true };
      },

      deleteEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      setLastExportedAt: (timestamp) => {
        set({ lastExportedAt: timestamp });
      },

      importReplace: (payload) => {
        set({
          categories: payload.categories,
          entries: payload.entries,
          previousCategoryId: payload.previousCategoryId,
          activeTimer: null,
          lastExportedAt: Date.now(),
        });
      },

      importMerge: (payload) => {
        const state = get();
        const merged = mergeImportData(state.categories, state.entries, payload.categories, payload.entries);
        set({
          categories: merged.categories,
          entries: merged.entries,
          lastExportedAt: Date.now(),
        });
        return {
          categoriesAdded: merged.categoriesAdded,
          entriesAdded: merged.entriesAdded,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: appStorage,
      partialize: (s): PersistedState => ({
        categories: s.categories,
        entries: s.entries,
        activeTimer: s.activeTimer,
        previousCategoryId: s.previousCategoryId,
        lastExportedAt: s.lastExportedAt,
        schemaVersion: s.schemaVersion,
      }),
    },
  ),
);
