/**
 * localStorage implementation of Zustand's StateStorage interface.
 * This is the ONLY file in the app that touches window.localStorage.
 */
import type { StateStorage } from 'zustand/middleware';

export const localStorageAdapter: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch (err) {
      // Quota exceeded / private mode: keep the app usable in memory.
      console.error('[storage] Failed to persist state', err);
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
