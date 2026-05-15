import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isUserAuthorized } from '@/lib/auth/whitelist';
import { DecisionsClient } from '@/components/decisions/decisions-client';

export const metadata: Metadata = {
  title: 'Xylo Decisions',
  description:
    'Decision log for the Xylo trading agent: every chat turn, the model and prompt used, and the tools called.',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

/**
 * `/decisions` — Xylo decision-log viewer (Phase 0 of the Xylo roadmap).
 *
 * Server component that gates access via the same email whitelist used
 * by `/api/chat` and then hands rendering off to the client component
 * `DecisionsClient`, which fetches from `/api/decisions` and provides
 * source / model / class / ticker filters.
 */
export default async function DecisionsPage() {
  const auth = await isUserAuthorized();
  if (!auth.authorized) {
    redirect('/');
  }

  return <DecisionsClient />;
}
