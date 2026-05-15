/**
 * Tiny localStorage cache for the chat model selector.
 *
 * The server's `/api/chat/models` route already runs probe-on-fetch
 * with a stale-while-revalidate cache, so warm responses are fast.
 * This client-side cache is a layer on top: we render the dropdown
 * synchronously from cache on mount (no spinner) and revalidate in
 * the background. Cache lives in `localStorage` so it survives a
 * full page reload, not just SPA navigation.
 *
 * Cache key is versioned so a shape change (e.g. new field on
 * `EnrichedModel`) invalidates every browser's stored payload on
 * next deploy without having to ship a manual "clear cache" step.
 */

import type { ChatSelectorModel } from '@/components/chat/chat-model-selector';

const STORAGE_KEY = 'xylo_chat_models_v1';

/** Up to this age the cached payload is rendered immediately. */
export const MODEL_CACHE_FRESH_MS = 5 * 60 * 1000;
/** Beyond this age we discard the cache and wait for a fresh fetch. */
export const MODEL_CACHE_MAX_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  at: number;
  models: ChatSelectorModel[];
  unavailable?: string[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function readModelCache(): {
  models: ChatSelectorModel[];
  unavailable: string[];
  fresh: boolean;
} | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || !Array.isArray(entry.models)) return null;
    const age = Date.now() - entry.at;
    if (age > MODEL_CACHE_MAX_MS) {
      // Hard expiry — drop the entry so we don't rehydrate stale UI.
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      models: entry.models,
      unavailable: entry.unavailable ?? [],
      fresh: age < MODEL_CACHE_FRESH_MS,
    };
  } catch {
    return null;
  }
}

export function writeModelCache(
  models: ChatSelectorModel[],
  unavailable: string[] = []
): void {
  if (!isBrowser()) return;
  try {
    const entry: CacheEntry = {
      at: Date.now(),
      models,
      unavailable,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded / private mode — silently ignore.
  }
}

export function clearModelCache(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
