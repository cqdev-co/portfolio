// ============================================================================
// Chat-model preference (cookie-backed)
// ============================================================================
//
// We persist the user's selected chat model in a client-side cookie so the
// next visit (or page refresh) keeps the same model loaded — without a
// hard-coded `OLLAMA_MODEL` env default. The cookie is plain string content
// (no PII, no auth signal), readable by the browser only, with a long
// max-age so the preference survives across sessions.
//
// We deliberately *don't* read this server-side: the chat API route
// receives the active model via the request body
// (`DefaultChatTransport({ body: { model } })`), so the cookie is purely
// a UX continuity primitive. If we ever want SSR-rendered initial state,
// the cookie name and shape are stable enough to read with `next/headers`.

const COOKIE_NAME = 'xylo_chat_model';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Read the persisted chat-model id from `document.cookie`.
 * Returns `null` on the server, when the cookie is missing, or when the
 * stored value is empty after decoding.
 */
export function getStoredChatModel(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]);
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Persist the user's chat-model selection. No-ops on the server.
 * Uses `SameSite=Lax` (so the cookie travels with top-level navigations
 * but not cross-site requests) and a 1-year `max-age` so the preference
 * sticks but eventually rotates with major UA cookie sweeps.
 */
export function setStoredChatModel(modelId: string): void {
  if (typeof document === 'undefined') return;
  if (!modelId) return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(modelId)}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
}

/**
 * Best-effort: clear the persisted preference (e.g. after sign-out).
 * Sets the cookie to empty with `max-age=0`.
 */
export function clearStoredChatModel(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}
