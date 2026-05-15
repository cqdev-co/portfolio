'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ArtifactPayload } from '@/lib/chat/types';

type ArtifactRegistry = Record<string, ArtifactPayload>;

type ChatArtifactContextValue = {
  artifacts: ArtifactRegistry;
  openArtifactId: string | null;
  registerArtifact: (artifact: ArtifactPayload) => void;
  openArtifact: (artifactId: string) => void;
  closeArtifact: () => void;
};

const ChatArtifactContext = createContext<ChatArtifactContextValue | null>(
  null
);

/**
 * Holds the per-thread registry of streamed artifacts plus the
 * currently-open artifact id. The thread renders inline
 * `<ArtifactCard>` placeholders that call `openArtifact(id)`; the
 * surrounding chat experience mounts a single `<ArtifactPanel />` on
 * the right that reads from the same context.
 *
 * Registry is keyed by `artifactId` so re-streaming the same artifact
 * (e.g. on a regenerate) replaces the previous entry in place.
 */
export function ChatArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<ArtifactRegistry>({});
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);

  const registerArtifact = useCallback((artifact: ArtifactPayload) => {
    setArtifacts((prev) => {
      const existing = prev[artifact.artifactId];
      if (existing && shallowSameArtifact(existing, artifact)) {
        return prev;
      }
      return { ...prev, [artifact.artifactId]: artifact };
    });
  }, []);

  const openArtifact = useCallback((artifactId: string) => {
    setOpenArtifactId(artifactId);
  }, []);

  const closeArtifact = useCallback(() => {
    setOpenArtifactId(null);
  }, []);

  const value = useMemo<ChatArtifactContextValue>(
    () => ({
      artifacts,
      openArtifactId,
      registerArtifact,
      openArtifact,
      closeArtifact,
    }),
    [artifacts, openArtifactId, registerArtifact, openArtifact, closeArtifact]
  );

  return (
    <ChatArtifactContext.Provider value={value}>
      {children}
    </ChatArtifactContext.Provider>
  );
}

export function useChatArtifacts(): ChatArtifactContextValue {
  const ctx = useContext(ChatArtifactContext);
  if (!ctx) {
    throw new Error(
      'useChatArtifacts must be used inside <ChatArtifactProvider>'
    );
  }
  return ctx;
}

/**
 * Cheap structural equality so we don't rerender the panel just
 * because the same artifact part re-streamed identical content.
 */
function shallowSameArtifact(a: ArtifactPayload, b: ArtifactPayload): boolean {
  if (a === b) return true;
  if (a.artifactId !== b.artifactId) return false;
  if (a.title !== b.title) return false;
  if (a.blocks.length !== b.blocks.length) return false;
  return a.generatedAt === b.generatedAt;
}
