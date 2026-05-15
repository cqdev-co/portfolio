/**
 * Email-whitelist auth helper for protected server routes / pages.
 *
 * Validates the Supabase session via HTTP-only cookies and checks the
 * caller's email against `NEXT_PUBLIC_WHITELISTED_EMAILS` (comma-
 * separated, lowercased).
 *
 * Used by:
 *   - `/api/chat` (Xylo chat)
 *   - `/api/decisions` and `/decisions` (Xylo decision log viewer)
 *
 * Centralized here so every gated surface treats authorization
 * identically. Adding a new gated route should be a one-import change.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const WHITELISTED_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_WHITELISTED_EMAILS || ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface AuthResult {
  authorized: boolean;
  email?: string;
  error?: string;
}

/**
 * Returns whether the current request is from a whitelisted, authenticated
 * Supabase user. Designed for use inside Next.js route handlers and
 * server components — relies on `next/headers` cookies().
 */
export async function isUserAuthorized(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Read-only context (e.g. server components) - token
              // refresh will happen on the next request that can write
              // cookies.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        authorized: false,
        error: 'Not authenticated. Please sign in.',
      };
    }

    const email = user.email?.toLowerCase();
    if (!email) {
      return {
        authorized: false,
        error: 'No email associated with your account.',
      };
    }

    if (!WHITELISTED_EMAILS.includes(email)) {
      return {
        authorized: false,
        email,
        error:
          'Your account is not authorized. Contact the administrator for access.',
      };
    }

    return { authorized: true, email };
  } catch (err) {
    console.error('[whitelist auth] Error:', err);
    return {
      authorized: false,
      error: 'Authentication error. Please try again.',
    };
  }
}

/**
 * Read-only accessor for the configured whitelist (lowercased emails).
 * Useful for diagnostics / admin pages.
 */
export function getWhitelistedEmails(): readonly string[] {
  return WHITELISTED_EMAILS;
}
