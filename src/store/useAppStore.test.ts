import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore - Stage 2 entries and conveniences', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      categories: [
        { id: 'cat-1', name: 'Work', color: '#6366f1', type: 'productive', archived: false },
        { id: 'cat-2', name: 'Break', color: '#64748b', type: 'neutral', archived: false },
      ],
      entries: [],
      activeTimer: null,
      previousCategoryId: null,
      lastExportedAt: null,
      schemaVersion: 1,
    });
  });

  it('adds and deletes entries', () => {
    const store = useAppStore.getState();
    const res = store.addEntry({
      categoryId: 'cat-1',
      start: 1000,
      end: 50000,
      note: 'Deep work',
    });
    expect(res.ok).toBe(true);

    const entries = useAppStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].categoryId).toBe('cat-1');
    expect(entries[0].note).toBe('Deep work');

    store.deleteEntry(entries[0].id);
    expect(useAppStore.getState().entries).toHaveLength(0);
  });

  it('rejects entries with end <= start', () => {
    const store = useAppStore.getState();
    const res = store.addEntry({
      categoryId: 'cat-1',
      start: 50000,
      end: 1000,
    });
    expect(res.ok).toBe(false);
  });

  it('updates an existing entry', () => {
    const store = useAppStore.getState();
    store.addEntry({
      categoryId: 'cat-1',
      start: 1000,
      end: 50000,
    });
    const id = useAppStore.getState().entries[0].id;
    const res = store.updateEntry(id, {
      categoryId: 'cat-2',
      start: 2000,
      end: 60000,
      note: 'Changed to Break',
    });
    expect(res.ok).toBe(true);
    const updated = useAppStore.getState().entries[0];
    expect(updated.categoryId).toBe('cat-2');
    expect(updated.note).toBe('Changed to Break');
  });

  it('tracks previousCategoryId on category switch and clears on stop', () => {
    const store = useAppStore.getState();
    store.tapCategory('cat-1');
    expect(useAppStore.getState().activeTimer?.categoryId).toBe('cat-1');
    expect(useAppStore.getState().previousCategoryId).toBeNull();

    // Switch to cat-2
    store.tapCategory('cat-2');
    expect(useAppStore.getState().activeTimer?.categoryId).toBe('cat-2');
    expect(useAppStore.getState().previousCategoryId).toBe('cat-1');

    // Stop timer
    store.stopTimer();
    expect(useAppStore.getState().activeTimer).toBeNull();
    expect(useAppStore.getState().previousCategoryId).toBeNull();
  });

  it('replaces all data on importReplace', () => {
    const store = useAppStore.getState();
    const payload = {
      schemaVersion: 1 as const,
      exportedAt: 1000,
      categories: [{ id: 'new-c', name: 'New Cat', color: '#10b981', type: 'productive' as const, archived: false }],
      entries: [{ id: 'new-e', categoryId: 'new-c', start: 100, end: 200 }],
      previousCategoryId: null,
    };
    store.importReplace(payload);
    expect(useAppStore.getState().categories).toEqual(payload.categories);
    expect(useAppStore.getState().entries).toEqual(payload.entries);
    expect(useAppStore.getState().lastExportedAt).not.toBeNull();
  });

  it('merges data and skips existing ids on importMerge', () => {
    const store = useAppStore.getState();
    const payload = {
      schemaVersion: 1 as const,
      exportedAt: 1000,
      categories: [
        { id: 'cat-1', name: 'Ignored duplicate', color: '#10b981', type: 'productive' as const, archived: false },
        { id: 'new-c', name: 'New Cat', color: '#10b981', type: 'productive' as const, archived: false },
      ],
      entries: [
        { id: 'new-e', categoryId: 'new-c', start: 100, end: 200 },
      ],
      previousCategoryId: null,
    };
    const res = store.importMerge(payload);
    expect(res.categoriesAdded).toBe(1);
    expect(res.entriesAdded).toBe(1);
    expect(useAppStore.getState().categories).toHaveLength(3); // 2 initial + 1 new
  });
});
