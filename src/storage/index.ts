/**
 * Persistence entry point (SPEC section 3, rule 1).
 *
 * The store only imports `appStorage` and `STORAGE_KEY` from here.
 * To move to IndexedDB or a remote backend, implement another StateStorage
 * (sync or async) and swap the adapter below. Nothing else changes.
 */
import { createJSONStorage } from 'zustand/middleware';
import type { PersistedState } from '../types';
import { localStorageAdapter } from './localStorageAdapter';

export const STORAGE_KEY = 'hourly-state';

export const appStorage = createJSONStorage<PersistedState>(() => localStorageAdapter);
