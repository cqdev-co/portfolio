'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChatExperience } from '@/app/chat/chat-experience';

// Vercel/Linear-style ease-out — strong, smooth deceleration. Used
// throughout the overlay so every motion shares a single timing language.
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/**
 * Persistent chat surface mounted from the root layout. Opens over the
 * current page when `usePathname() === '/chat'` rather than swapping
 * `<main>`'s content, so the chat appears in place rather than feeling
 * like a redirect.
 *
 * Two motion layers run in parallel, both `fixed inset-0 z-20` (under
 * the dock at `z-30`):
 *
 * 1. **Backdrop** — `bg-background`, opaque from `t=0` so the brief
 *    `<main>` swap underneath is hidden. Fades out on close.
 * 2. **Surface** — the chat UI with a subtle scale (0.985 → 1) and an
 *    opacity fade. Uses a tweened cubic-bezier (no spring overshoot)
 *    so the entrance reads as composed and intentional, not bouncy.
 */
export function ChatOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOpen = pathname === '/chat';
  const initialPrompt = searchParams?.get('prompt') ?? undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="chat-overlay-backdrop"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="fixed inset-0 z-20 bg-background"
            aria-hidden
          />

          <motion.div
            key="chat-overlay-surface"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            style={{ transformOrigin: '50% 50%' }}
            className="fixed inset-0 z-20 will-change-transform"
          >
            <ChatExperience initialPrompt={initialPrompt} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
