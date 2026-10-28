/**
 * Pure functions for Stage 4: Export/Import, schema validation, and merge logic.
 */
import { isValidHexColor } from './categories';
import { SCHEMA_VERSION, type Category, type Entry } from '../types';

export const EXPORT_REMINDER_DAYS = 14;
export const EXPORT_REMINDER_MS = EXPORT_REMINDER_DAYS * 24 * 60 * 60 * 1000;

export interface ExportPayload {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: number;
  categories: Category[];
  entries: Entry[];
  previousCategoryId: string | null;
}

export type ValidationResult =
  | {
      ok: true;
      data: ExportPayload;
      summary: { categoryCount: number; entryCount: number };
    }
  | {
      ok: false;
      error: string;
    };

/** Create an ExportPayload from the current state (pure function). */
export function createExportPayload(
  categories: readonly Category[],
  entries: readonly Entry[],
  previousCategoryId: string | null,
  now: number,
): ExportPayload {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    categories: categories.map((c) => ({ ...c })),
    entries: entries.map((e) => ({ ...e })),
    previousCategoryId,
  };
}

/**
 * Strictly validate an imported JSON string.
 * Validates:
 * - Valid JSON syntax
 * - Non-null object structure
 * - schemaVersion === 1
 * - exportedAt is valid number
 * - categories array & field types (id, name, color, type, archived, dailyGoalMinutes)
 * - entries array & field types (id, categoryId, start, end with end > start, note)
 * - entries pointing to unknown categoryIds in the file
 * - previousCategoryId type and reference
 */
export function validateImportPayload(content: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: 'Invalid JSON file: file content could not be parsed.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Invalid backup file: root must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;

  // 1. schemaVersion
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schema version: ${String(obj.schemaVersion)}. Expected version ${SCHEMA_VERSION}.`,
    };
  }

  // 2. exportedAt
  if (typeof obj.exportedAt !== 'number' || !Number.isFinite(obj.exportedAt)) {
    return { ok: false, error: 'Invalid backup file: "exportedAt" must be a timestamp number.' };
  }

  // 3. categories
  if (!Array.isArray(obj.categories)) {
    return { ok: false, error: 'Invalid backup file: "categories" must be an array.' };
  }

  const categoryIds = new Set<string>();
  const validatedCategories: Category[] = [];

  for (let i = 0; i < obj.categories.length; i++) {
    const c = obj.categories[i];
    if (typeof c !== 'object' || c === null || Array.isArray(c)) {
      return { ok: false, error: `Invalid category at index ${i}: must be an object.` };
    }

    const { id, name, color, type, archived, dailyGoalMinutes } = c as Record<string, unknown>;

    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, error: `Category at index ${i} has an invalid or empty "id".` };
    }

    if (categoryIds.has(id)) {
      return { ok: false, error: `Duplicate category id "${id}" at index ${i}.` };
    }
    categoryIds.add(id);

    if (typeof name !== 'string' || name.trim() === '') {
      return { ok: false, error: `Category "${id}" has an invalid or empty "name".` };
    }

    if (typeof color !== 'string' || !isValidHexColor(color)) {
      return { ok: false, error: `Category "${name}" has an invalid hex color "${String(color)}".` };
    }

    if (type !== 'productive' && type !== 'wasted' && type !== 'neutral') {
      return {
        ok: false,
        error: `Category "${name}" has invalid type "${String(type)}". Must be productive, wasted, or neutral.`,
      };
    }

    if (typeof archived !== 'boolean') {
      return { ok: false, error: `Category "${name}" must have boolean "archived" property.` };
    }

    if (
      dailyGoalMinutes !== undefined &&
      (typeof dailyGoalMinutes !== 'number' || !Number.isFinite(dailyGoalMinutes) || dailyGoalMinutes <= 0)
    ) {
      return { ok: false, error: `Category "${name}" has an invalid "dailyGoalMinutes" value.` };
    }

    validatedCategories.push({
      id,
      name: name.trim(),
      color,
      type,
      archived,
      ...(dailyGoalMinutes !== undefined ? { dailyGoalMinutes } : {}),
    });
  }

  // 4. entries
  if (!Array.isArray(obj.entries)) {
    return { ok: false, error: 'Invalid backup file: "entries" must be an array.' };
  }

  const entryIds = new Set<string>();
  const validatedEntries: Entry[] = [];

  for (let i = 0; i < obj.entries.length; i++) {
    const e = obj.entries[i];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      return { ok: false, error: `Invalid entry at index ${i}: must be an object.` };
    }

    const { id, categoryId, start, end, note } = e as Record<string, unknown>;

    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, error: `Entry at index ${i} has an invalid or empty "id".` };
    }

    if (entryIds.has(id)) {
      return { ok: false, error: `Duplicate entry id "${id}" at index ${i}.` };
    }
    entryIds.add(id);

    if (typeof categoryId !== 'string') {
      return { ok: false, error: `Entry "${id}" has an invalid "categoryId".` };
    }

    // Strict validation: entries pointing to unknown categoryIds
    if (!categoryIds.has(categoryId)) {
      return {
        ok: false,
        error: `Entry "${id}" references unknown categoryId "${categoryId}". Every entry must belong to a known category.`,
      };
    }

    if (typeof start !== 'number' || !Number.isFinite(start)) {
      return { ok: false, error: `Entry "${id}" has an invalid "start" timestamp.` };
    }

    if (typeof end !== 'number' || !Number.isFinite(end)) {
      return { ok: false, error: `Entry "${id}" has an invalid "end" timestamp.` };
    }

    // Strict validation: end > start
    if (end <= start) {
      return {
        ok: false,
        error: `Entry "${id}" has invalid time range: end timestamp (${end}) must be greater than start timestamp (${start}).`,
      };
    }

    if (note !== undefined && typeof note !== 'string') {
      return { ok: false, error: `Entry "${id}" has an invalid "note" (must be string).` };
    }

    validatedEntries.push({
      id,
      categoryId,
      start,
      end,
      ...(note !== undefined && note.trim() !== '' ? { note: note.trim() } : {}),
    });
  }

  // 5. previousCategoryId
  let previousCategoryId: string | null = null;
  if (obj.previousCategoryId !== null && obj.previousCategoryId !== undefined) {
    if (typeof obj.previousCategoryId !== 'string') {
      return { ok: false, error: 'Invalid backup file: "previousCategoryId" must be a string or null.' };
    }
    if (!categoryIds.has(obj.previousCategoryId)) {
      return {
        ok: false,
        error: `previousCategoryId "${obj.previousCategoryId}" references an unknown categoryId.`,
      };
    }
    previousCategoryId = obj.previousCategoryId;
  }

  return {
    ok: true,
    data: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: obj.exportedAt,
      categories: validatedCategories,
      entries: validatedEntries,
      previousCategoryId,
    },
    summary: {
      categoryCount: validatedCategories.length,
      entryCount: validatedEntries.length,
    },
  };
}

export interface MergeResult {
  categories: Category[];
  entries: Entry[];
  categoriesAdded: number;
  entriesAdded: number;
}

/**
 * Merge imported data with existing state (skips existing IDs).
 */
export function mergeImportData(
  existingCategories: readonly Category[],
  existingEntries: readonly Entry[],
  importedCategories: readonly Category[],
  importedEntries: readonly Entry[],
): MergeResult {
  const existingCatIds = new Set(existingCategories.map((c) => c.id));
  const newCategories = importedCategories.filter((c) => !existingCatIds.has(c.id));

  const existingEntryIds = new Set(existingEntries.map((e) => e.id));
  const newEntries = importedEntries.filter((e) => !existingEntryIds.has(e.id));

  return {
    categories: [...existingCategories, ...newCategories],
    entries: [...existingEntries, ...newEntries],
    categoriesAdded: newCategories.length,
    entriesAdded: newEntries.length,
  };
}

/** True if the last export was over 14 days ago or never. */
export function needsExportReminder(lastExportedAt: number | null, now: number): boolean {
  if (lastExportedAt === null) return true;
  return now - lastExportedAt > EXPORT_REMINDER_MS;
}

/** Generates the gentle reminder message for the Settings screen. */
export function getExportReminderMessage(lastExportedAt: number | null, now: number): string | null {
  if (lastExportedAt === null) {
    return 'You have never exported a backup. Export a JSON file to keep your tracking data safe.';
  }
  const elapsedMs = now - lastExportedAt;
  if (elapsedMs > EXPORT_REMINDER_MS) {
    const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    return `Your last backup was ${days} days ago. Consider exporting a fresh backup.`;
  }
  return null;
}
