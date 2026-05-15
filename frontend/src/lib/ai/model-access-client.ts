/**
 * Client-side persistent denylist of inaccessible Ollama model ids.
 *
 * When the chat route 401s for a per-model entitlement reason, it
 * emits a `MODEL_UNAVAILABLE::<id>` sentinel which the chat page
 * intercepts. We persist the offending id here so it stays hidden
 * across browser sessions — the server-side denylist
 * (`lib/ai/model-access.ts`) is process-memory only and resets on
 * deploy, but this one survives.
 *
 * The selector reads this list on mount and filters its rendered
 * models against it before painting the dropdown, so a model the
 * user's plan can't run never reappears once it's been denied.
 */

const STORAGE_KEY = 'xylo_unavailable_models_v1';
/** Hard expiry — entries past this age are dropped on read. */
const ENTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface PersistedEntry {
  id: string;
  /** Epoch ms — when the model was first marked unavailable. */
  at: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readEntries(): PersistedEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is PersistedEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.id === 'string' &&
        typeof e.at === 'number' &&
        now - e.at < ENTRY_TTL_MS
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: PersistedEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded / private mode — silently ignore.
  }
}

/**
 * Append a model id to the persisted denylist (or refresh its
 * timestamp if already present). Safe to call from anywhere — no-op
 * during SSR.
 */
export function markModelUnavailableClient(modelId: string): void {
  if (!modelId) return;
  const existing = readEntries().filter((e) => e.id !== modelId);
  existing.push({ id: modelId, at: Date.now() });
  writeEntries(existing);
}

/**
 * Read the current denylist as a `Set<string>`. Safe during SSR
 * (returns an empty set so server and first client render produce
 * identical trees — the actual denylist is folded in via a
 * post-mount `useEffect`).
 */
export function readUnavailableModelsClient(): Set<string> {
  return new Set(readEntries().map((e) => e.id));
}

/**
 * Drop a model id from the denylist, e.g. after the user manually
 * "tries again" via a future UX affordance. Currently unused but
 * kept here so the surface has the obvious symmetry.
 */
export function unmarkModelUnavailableClient(modelId: string): void {
  if (!modelId) return;
  const next = readEntries().filter((e) => e.id !== modelId);
  writeEntries(next);
}

/**
 * Wipe the entire client denylist. Useful as a debug affordance or
 * if the user upgrades their Ollama plan and wants to re-discover
 * newly-accessible models.
 */
export function clearUnavailableModelsClient(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
