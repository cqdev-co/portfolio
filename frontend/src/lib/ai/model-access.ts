/**
 * Server-side denylist of Ollama model ids that the configured
 * `OLLAMA_API_KEY` can't actually run.
 *
 * Ollama Cloud's `/api/tags` endpoint returns the full catalog of
 * available models — it doesn't filter by what your key is entitled
 * to. So a user can pick something like `glm-5.1` from the selector,
 * hit `/api/chat`, and only then get a 401 back from Ollama. We work
 * around this with two complementary mechanisms:
 *
 * 1. **Probe-on-fetch**: when `/api/chat/models` runs, it POSTs to
 *    Ollama's `/api/show` for every catalog entry with the bearer
 *    token. Any model that 401s or 403s is folded into this denylist.
 *
 * 2. **Lazy mark**: if a model slips past the probe (race / cache
 *    expiry) and the chat route subsequently 401s, we add it to the
 *    denylist there too, so the next `/api/chat/models` fetch hides
 *    it.
 *
 * The set is process-memory only; resets on deploy. That's
 * acceptable for now — keys rarely change at runtime, and the probe
 * runs on every cold cache miss.
 */

const unavailable = new Set<string>();

export function markModelUnavailable(modelId: string): void {
  if (!modelId) return;
  unavailable.add(modelId);
}

export function isModelUnavailable(modelId: string): boolean {
  return unavailable.has(modelId);
}

export function getUnavailableModels(): string[] {
  return Array.from(unavailable);
}

/**
 * Bulk-merge a set of probed-as-unavailable ids into the denylist.
 * Used by the `/api/chat/models` probe so it can update the registry
 * in one shot after running its parallel probes.
 */
export function recordUnavailableBatch(ids: Iterable<string>): void {
  for (const id of ids) {
    if (id) unavailable.add(id);
  }
}
