/** Pure category helpers: defaults, validation, lookups. */
import type { Category, CategoryType, Entry } from '../types';

export const CATEGORY_TYPES: readonly { value: CategoryType; label: string }[] = [
  { value: 'productive', label: 'Productive' },
  { value: 'wasted', label: 'Wasted' },
  { value: 'neutral', label: 'Neutral' },
];

export const COLOR_PRESETS: readonly string[] = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#64748b',
];

/** Default categories on first launch (SPEC section 4). Stable ids. */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'cat-work', name: 'Work', color: '#6366f1', type: 'productive', archived: false },
  { id: 'cat-study', name: 'Study', color: '#14b8a6', type: 'productive', archived: false },
  { id: 'cat-social', name: 'Social Media', color: '#f43f5e', type: 'wasted', archived: false },
  { id: 'cat-games', name: 'Games', color: '#f97316', type: 'wasted', archived: false },
  { id: 'cat-break', name: 'Break', color: '#64748b', type: 'neutral', archived: false },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(color: string): boolean {
  return HEX_RE.test(color);
}

/**
 * Returns an error message, or null if the name is valid.
 * Names must be non-empty and unique (case-insensitive, trimmed) across
 * all categories including archived ones.
 */
export function validateCategoryName(
  name: string,
  categories: readonly Category[],
  excludeId?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.length > 40) return 'Name must be 40 characters or fewer.';
  const key = trimmed.toLocaleLowerCase();
  const clash = categories.find((c) => c.id !== excludeId && c.name.trim().toLocaleLowerCase() === key);
  if (clash) return `A category named "${clash.name}" already exists${clash.archived ? ' (archived)' : ''}.`;
  return null;
}

export function getActiveCategories(categories: readonly Category[]): Category[] {
  return categories.filter((c) => !c.archived);
}

export function getArchivedCategories(categories: readonly Category[]): Category[] {
  return categories.filter((c) => c.archived);
}

export function findCategory(categories: readonly Category[], id: string | undefined | null): Category | undefined {
  return id ? categories.find((c) => c.id === id) : undefined;
}

export function countEntriesForCategory(entries: readonly Entry[], categoryId: string): number {
  return entries.reduce((n, e) => (e.categoryId === categoryId ? n + 1 : n), 0);
}
