import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat',
  description:
    "Chat with Conor's AI assistant about projects, scanners, and recent work.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * The actual chat UI is rendered by `<ChatOverlay />` from the root layout
 * (see `frontend/src/components/chat/chat-overlay.tsx`). The overlay is
 * keyed off `usePathname() === '/chat'`, so visiting this route — whether
 * via the dock, ⌘K, `openChat()`, or a direct deep link — animates the
 * chat surface in over whatever was visible underneath.
 *
 * This page is intentionally empty: it exists only to make `/chat` a real
 * route (deep-linkable, share-able). The overlay sits on top of it.
 */
export default function ChatPage() {
  return null;
}
