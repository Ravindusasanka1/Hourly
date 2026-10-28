import { describe, expect, it } from 'vitest';
import {
  createExportPayload,
  getExportReminderMessage,
  mergeImportData,
  needsExportReminder,
  validateImportPayload,
} from './exportImport';
import type { Category, Entry } from '../types';

describe('Stage 4: Export/Import validation and utilities', () => {
  const catWork: Category = {
    id: 'cat-work',
    name: 'Work',
    color: '#6366f1',
    type: 'productive',
    archived: false,
    dailyGoalMinutes: 60,
  };
  const catStudy: Category = {
    id: 'cat-study',
    name: 'Study',
    color: '#14b8a6',
    type: 'productive',
    archived: false,
  };
  const entry1: Entry = {
    id: 'e-1',
    categoryId: 'cat-work',
    start: 1000,
    end: 50000,
    note: 'Initial work',
  };

  it('creates a valid ExportPayload', () => {
    const payload = createExportPayload([catWork], [entry1], 'cat-work', 1700000000000);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.exportedAt).toBe(1700000000000);
    expect(payload.categories).toEqual([catWork]);
    expect(payload.entries).toEqual([entry1]);
    expect(payload.previousCategoryId).toBe('cat-work');
  });

  it('validates a correct JSON backup successfully', () => {
    const payload = createExportPayload([catWork, catStudy], [entry1], 'cat-work', 1700000000000);
    const jsonStr = JSON.stringify(payload);
    const result = validateImportPayload(jsonStr);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.categoryCount).toBe(2);
      expect(result.summary.entryCount).toBe(1);
      expect(result.data.categories).toHaveLength(2);
      expect(result.data.entries).toHaveLength(1);
    }
  });

  describe('Strict validation of broken files', () => {
    it('rejects invalid JSON syntax', () => {
      const res = validateImportPayload('{ broken json:');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('Invalid JSON file');
    });

    it('rejects non-object root', () => {
      const res = validateImportPayload('[1, 2, 3]');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('root must be a JSON object');
    });

    it('rejects unsupported schemaVersion', () => {
      const badVersion = {
        schemaVersion: 2,
        exportedAt: 1000,
        categories: [],
        entries: [],
      };
      const res = validateImportPayload(JSON.stringify(badVersion));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('Unsupported schema version');
    });

    it('rejects invalid or missing exportedAt', () => {
      const badExportedAt = {
        schemaVersion: 1,
        exportedAt: 'yesterday',
        categories: [],
        entries: [],
      };
      const res = validateImportPayload(JSON.stringify(badExportedAt));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('"exportedAt" must be a timestamp');
    });

    it('rejects invalid category fields (bad color, empty name, bad type)', () => {
      const badCategory = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [
          { id: 'c1', name: '', color: '#6366f1', type: 'productive', archived: false },
        ],
        entries: [],
      };
      expect(validateImportPayload(JSON.stringify(badCategory)).ok).toBe(false);

      const badColor = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [
          { id: 'c1', name: 'Work', color: 'not-hex', type: 'productive', archived: false },
        ],
        entries: [],
      };
      expect(validateImportPayload(JSON.stringify(badColor)).ok).toBe(false);

      const badType = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [
          { id: 'c1', name: 'Work', color: '#6366f1', type: 'fun', archived: false },
        ],
        entries: [],
      };
      expect(validateImportPayload(JSON.stringify(badType)).ok).toBe(false);
    });

    it('rejects duplicate category IDs in file', () => {
      const duplicateCats = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [
          { id: 'c1', name: 'Work 1', color: '#6366f1', type: 'productive', archived: false },
          { id: 'c1', name: 'Work 2', color: '#14b8a6', type: 'productive', archived: false },
        ],
        entries: [],
      };
      const res = validateImportPayload(JSON.stringify(duplicateCats));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('Duplicate category id');
    });

    it('strictly rejects entries with end <= start', () => {
      const badTime = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [catWork],
        entries: [
          { id: 'e1', categoryId: 'cat-work', start: 5000, end: 5000 },
        ],
      };
      const resEqual = validateImportPayload(JSON.stringify(badTime));
      expect(resEqual.ok).toBe(false);
      if (!resEqual.ok) expect(resEqual.error).toContain('end timestamp');

      const badTimeReversed = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [catWork],
        entries: [
          { id: 'e1', categoryId: 'cat-work', start: 6000, end: 5000 },
        ],
      };
      const resReversed = validateImportPayload(JSON.stringify(badTimeReversed));
      expect(resReversed.ok).toBe(false);
      if (!resReversed.ok) expect(resReversed.error).toContain('end timestamp');
    });

    it('strictly rejects entries pointing to unknown categoryIds', () => {
      const orphanEntry = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [catWork],
        entries: [
          { id: 'e1', categoryId: 'cat-does-not-exist', start: 1000, end: 5000 },
        ],
      };
      const res = validateImportPayload(JSON.stringify(orphanEntry));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('references unknown categoryId');
    });

    it('rejects previousCategoryId pointing to unknown categoryId', () => {
      const badPrev = {
        schemaVersion: 1,
        exportedAt: 1000,
        categories: [catWork],
        entries: [],
        previousCategoryId: 'cat-unknown',
      };
      const res = validateImportPayload(JSON.stringify(badPrev));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('references an unknown categoryId');
    });
  });

  describe('mergeImportData', () => {
    it('merges new categories and entries while skipping existing IDs', () => {
      const existingCats = [catWork];
      const existingEntries = [entry1];

      const newCat: Category = {
        id: 'cat-games',
        name: 'Games',
        color: '#f97316',
        type: 'wasted',
        archived: false,
      };
      const newEntry: Entry = {
        id: 'e-2',
        categoryId: 'cat-games',
        start: 60000,
        end: 70000,
      };

      const importedCats = [catWork, newCat]; // catWork already exists
      const importedEntries = [entry1, newEntry]; // entry1 already exists

      const merged = mergeImportData(existingCats, existingEntries, importedCats, importedEntries);
      expect(merged.categoriesAdded).toBe(1);
      expect(merged.entriesAdded).toBe(1);
      expect(merged.categories).toHaveLength(2);
      expect(merged.entries).toHaveLength(2);
      expect(merged.categories.map((c) => c.id)).toEqual(['cat-work', 'cat-games']);
      expect(merged.entries.map((e) => e.id)).toEqual(['e-1', 'e-2']);
    });
  });

  describe('needsExportReminder & getExportReminderMessage', () => {
    const now = 1700000000000;
    const DAY = 24 * 60 * 60 * 1000;

    it('reminds if never exported', () => {
      expect(needsExportReminder(null, now)).toBe(true);
      expect(getExportReminderMessage(null, now)).toContain('never');
    });

    it('does not remind if exported recently', () => {
      const recent = now - 5 * DAY;
      expect(needsExportReminder(recent, now)).toBe(false);
      expect(getExportReminderMessage(recent, now)).toBeNull();
    });

    it('reminds if exported more than 14 days ago', () => {
      const old = now - 15 * DAY;
      expect(needsExportReminder(old, now)).toBe(true);
      expect(getExportReminderMessage(old, now)).toContain('15 days ago');
    });
  });
});
