/** Data model, per SPEC section 4. All timestamps are epoch milliseconds. */

export type CategoryType = 'productive' | 'wasted' | 'neutral';

export interface Category {
  id: string;
  name: string;
  /** Hex color, e.g. "#6366f1" */
  color: string;
  type: CategoryType;
  archived: boolean;
  dailyGoalMinutes?: number;
}

/** Invariant: end > start. Stores categoryId only, never name/color. */
export interface Entry {
  id: string;
  categoryId: string;
  start: number;
  end: number;
  note?: string;
}

export type ActiveTimer = {
  categoryId: string;
  startedAt: number;
  goalMinutes?: number;
} | null;

export const SCHEMA_VERSION = 1 as const;

/** The persisted slice of app state. */
export interface PersistedState {
  categories: Category[];
  entries: Entry[];
  activeTimer: ActiveTimer;
  previousCategoryId: string | null;
  lastExportedAt: number | null;
  schemaVersion: typeof SCHEMA_VERSION;
}
