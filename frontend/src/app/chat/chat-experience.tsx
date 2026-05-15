'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowBigUp,
  ArrowRight,
  Compass,
  CornerDownLeft,
  LineChart,
  Radar,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import type { ChatFeatureId } from '@/components/chat/chat-actions-popover';
import { CrossIcon } from '@/components/chat/chat-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getStoredChatModel,
  setStoredChatModel,
} from '@/lib/ai/chat-model-store';
import type { XyloUIMessage } from '@/lib/chat/types';
import { ChatArtifactProvider } from '@/components/chat/artifact-context';
import { ArtifactPanel } from '@/components/chat/artifact-panel';
import { useChatArtifacts } from '@/components/chat/artifact-context';
import { markModelUnavailableClient } from '@/lib/ai/model-access-client';

// ============================================================================
// Types
// ============================================================================

type ChatExperienceProps = {
  initialPrompt?: string;
};

// ============================================================================
// Suggestion categories (Perplexity-style "Try asking" card)
// ============================================================================
//
// Each tab groups a few starter prompts under a topic. The tab labels
// are short so the strip stays single-line on mobile; prompts are
// listed underneath as bulleted rows that read like an editor's
// "you might want to ask…" recommendation.

type Suggestion = { label: string; prompt: string };
type SuggestionCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  prompts: Suggestion[];
};

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    id: 'markets',
    label: 'Markets',
    icon: TrendingUp,
    prompts: [
      {
        label: 'What is today\u2019s trading regime?',
        prompt:
          "What's today's trading regime — GO, CAUTION, or NO_TRADE? Walk me through the inputs and what the read implies for entries.",
      },
      {
        label: 'How is volatility looking right now?',
        prompt:
          'How is volatility looking right now across the major indices? VIX, term structure, and any unusual readings worth flagging.',
      },
      {
        label: 'What\u2019s on the calendar this week?',
        prompt:
          'What\u2019s on the macro and earnings calendar this week? Which prints could move things and how are positions usually framed around them?',
      },
    ],
  },
  {
    id: 'scanners',
    label: 'Scanners',
    icon: Radar,
    prompts: [
      {
        label: 'Explain the Volatility Squeeze Scanner',
        prompt:
          'Explain the Volatility Squeeze Scanner — what signals it looks for, how it grades opportunities, and how to act on the output.',
      },
      {
        label: 'How does the spread scanner pick trades?',
        prompt:
          "How does Conor's spread scanner pick trades? Walk me through the strike selection, IV checks, and risk filters.",
      },
      {
        label: 'Scan for high-grade setups today',
        prompt:
          'Scan a basket of mega-caps for high-grade setups right now. Tell me which ones look most actionable and why.',
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    icon: LineChart,
    prompts: [
      {
        label: 'Pull a financials deep-dive on NVDA',
        prompt:
          'Pull a financials deep-dive on NVDA — income statement, balance sheet, cash flow trends. Flag anything notable.',
      },
      {
        label: 'Show institutional holdings for AAPL',
        prompt:
          'Show me the top institutional holders for AAPL with % owned, and call out any meaningful changes vs the prior quarter.',
      },
      {
        label: 'Find unusual options activity in tech',
        prompt:
          'Find high-grade unusual options activity in tech today. Highlight the names with the strongest signals and what to watch.',
      },
    ],
  },
  {
    id: 'approach',
    label: 'Approach',
    icon: Compass,
    prompts: [
      {
        label: 'Walk me through Xylo\u2019s framework',
        prompt:
          "Walk me through Xylo's deep ITM call debit spread framework — selection, sizing, exits, and risk constraints.",
      },
      {
        label: 'How does the AI agent work end-to-end?',
        prompt:
          'How does the AI trading agent work end-to-end? Tools available, persona, and how it composes a recommendation.',
      },
      {
        label: 'What separates Conor\u2019s methodology?',
        prompt:
          "What separates Conor's methodology from a typical retail options approach? Be specific about the edges and the discipline.",
      },
    ],
  },
];

// ============================================================================
// Helpers
// ============================================================================

function useTokenEstimate(text: string): number {
  return useMemo(() => Math.ceil(text.length / 4), [text]);
}

/** Server-side sentinel emitted when Ollama 401s on a specific model. */
const MODEL_UNAVAILABLE_PREFIX = 'MODEL_UNAVAILABLE::';

/**
 * Pull the unavailable model id out of the route's structured error
 * marker. Returns null when the error isn't a model-availability
 * signal so the regular error banner takes over.
 */
function parseModelUnavailable(error: Error | undefined): string | null {
  if (!error) return null;
  const idx = error.message.indexOf(MODEL_UNAVAILABLE_PREFIX);
  if (idx < 0) return null;
  const tail = error.message.slice(idx + MODEL_UNAVAILABLE_PREFIX.length);
  // Marker shape is `MODEL_UNAVAILABLE::<id> :: <human message>`.
  const id = tail.split(' ::', 1)[0]?.trim();
  return id || null;
}

function getErrorDisplay(error: Error | undefined): {
  title: string;
  message: string;
  type:
    | 'rate_limit'
    | 'network'
    | 'server'
    | 'auth'
    | 'model_unavailable'
    | 'unknown';
} | null {
  if (!error) return null;

  const unavailableId = parseModelUnavailable(error);
  if (unavailableId) {
    return {
      title: 'Model unavailable',
      message: `"${unavailableId}" isn't available on your Ollama plan. Switching to another model — try sending again.`,
      type: 'model_unavailable',
    };
  }

  const msg = error.message.toLowerCase();

  if (
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('not authenticated') ||
    msg.includes('not authorized')
  ) {
    let displayMessage = 'Please sign in to use the AI chat.';
    try {
      const jsonMatch = error.message.match(/\{.*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        displayMessage = parsed.message || displayMessage;
      }
    } catch {
      // use default
    }
    return {
      title: 'Access Restricted',
      message: displayMessage,
      type: 'auth',
    };
  }

  if (msg.includes('429') || msg.includes('rate') || msg.includes('limit')) {
    return {
      title: 'Rate Limit Reached',
      message:
        "You've reached the hourly usage limit. Please wait a few minutes.",
      type: 'rate_limit',
    };
  }

  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('connection')
  ) {
    return {
      title: 'Connection Error',
      message: 'Unable to reach the AI service. Check your connection.',
      type: 'network',
    };
  }

  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
    return {
      title: 'Service Unavailable',
      message: 'The AI service is temporarily unavailable. Please try again.',
      type: 'server',
    };
  }

  return {
    title: 'Something went wrong',
    message: error.message.slice(0, 100) || 'An unexpected error occurred.',
    type: 'unknown',
  };
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Minimal floating action button used in the top-right header cluster.
 * Borderless, transparent until hover — keeps the header chrome quiet.
 */
function HeaderAction({
  onClick,
  label,
  tooltip,
  children,
}: {
  onClick: () => void;
  label: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          onClick={onClick}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'flex size-8 items-center justify-center rounded-full',
            'text-muted-foreground/80 hover:text-foreground',
            'hover:bg-muted/60',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15'
          )}
          aria-label={label}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Small "key cap" used inside `ComposerFooter`. Renders either a
 * lucide icon (for `Enter` / `Shift`) or short text (`Esc`) inside a
 * subtle bordered box so the shortcut reads as a real keyboard key,
 * not just inline text. Sized to keep the footer compact while
 * staying legible against the composer card behind it.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center',
        'rounded-md border border-border/60 bg-muted/40',
        'px-1 font-mono text-[10px] text-foreground/80'
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Footer hint for the composer. Keyboard shortcuts use icon-glyphed
 * key caps (⌅ for Return, ⇧ for Shift, "Esc" text) so the user can
 * scan them without reading prose; the running token estimate sits
 * after a hairline divider on the right. Sized so it's actually
 * readable (`text-[11px]`, `text-muted-foreground/80`) rather than
 * the previous near-invisible `text-[10px] text-muted-foreground/55`.
 */
function ComposerFooter({ estimatedTokens }: { estimatedTokens: number }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-1',
        'text-[11px] text-muted-foreground/80'
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Kbd>
          <CornerDownLeft className="size-3" />
        </Kbd>
        send
      </span>

      <span className="hidden items-center gap-1.5 sm:inline-flex">
        <Kbd>
          <ArrowBigUp className="size-3" />
        </Kbd>
        <span className="text-muted-foreground/40">+</span>
        <Kbd>
          <CornerDownLeft className="size-3" />
        </Kbd>
        newline
      </span>

      <span className="hidden items-center gap-1.5 sm:inline-flex">
        <Kbd>Esc</Kbd>
        close
      </span>

      <span className="text-muted-foreground/30" aria-hidden>
        ·
      </span>
      <span className="font-mono tabular-nums">~{estimatedTokens} tokens</span>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ChatExperience({ initialPrompt }: ChatExperienceProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  // The active model is sourced from a client-side cookie so the user's
  // last selection survives reloads and doesn't depend on a hardcoded
  // env. We deliberately *don't* read the cookie inside `useState`'s
  // lazy initialiser, because that runs during render — on the server
  // it would return `''` (no `document`), and on the client it would
  // return the saved id, producing different first-render trees and
  // a hydration mismatch. Instead we always start with `''` (server
  // and client agree) and hydrate from the cookie in a post-mount
  // `useEffect`. If the cookie is missing, `ChatModelSelector` will
  // auto-pick the first model returned by `/api/chat/models` once the
  // list loads, and the resulting `onModelChange` call writes that
  // choice back to the cookie.
  const [selectedModel, setSelectedModelState] = useState<string>('');
  useEffect(() => {
    const stored = getStoredChatModel();
    if (stored) setSelectedModelState(stored);
  }, []);
  const setSelectedModel = useCallback((id: string) => {
    setSelectedModelState(id);
    setStoredChatModel(id);
  }, []);
  const [chatKey, setChatKey] = useState(0);
  const [dismissedError, setDismissedError] = useState(false);
  // Bumped when the route reports a `MODEL_UNAVAILABLE` error so the
  // composer's `ChatModelSelector` re-fetches `/api/chat/models` and
  // drops the just-denied id from the dropdown.
  const [modelRefreshSignal, setModelRefreshSignal] = useState(0);
  const [activeSuggestionTab, setActiveSuggestionTab] = useState(
    SUGGESTION_CATEGORIES[0].id
  );

  // Per-turn capabilities the user has toggled on via the composer's
  // configuration popover (Onyx-style). The set is sent on every
  // request so the backend can filter `ollamaTools` and bias the
  // system prompt accordingly. We keep it as a plain array in state
  // for stable identity and surface it as a Set for the consumers
  // that prefer membership lookups.
  const [enabledFeatures, setEnabledFeatures] = useState<ChatFeatureId[]>([]);

  const enabledFeatureSet = useMemo(
    () => new Set(enabledFeatures),
    [enabledFeatures]
  );

  const handleToggleFeature = useCallback((id: ChatFeatureId) => {
    setEnabledFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const pendingMessageRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { model: selectedModel, enabledFeatures },
      }),
    [selectedModel, enabledFeatures]
  );

  const { messages, sendMessage, status, stop, error } = useChat<XyloUIMessage>(
    {
      id: `chat-page-${chatKey}-${selectedModel}`,
      transport,
      onError: (err) => {
        console.error('[Chat] Error:', err);
        setDismissedError(false);
        // If Ollama returned 401/403 for the active model, the route
        // emits a `MODEL_UNAVAILABLE::<id>` sentinel. Drop the model
        // from the persisted preference and refresh the selector — the
        // next render auto-picks the first remaining available model.
        const unavailableId = parseModelUnavailable(err);
        if (unavailableId && unavailableId === selectedModel) {
          // Persist the denial so the selector hides the model on
          // subsequent visits (the server-side denylist resets on
          // deploy; this one survives across sessions).
          markModelUnavailableClient(unavailableId);
          // Clear the cookie so `ChatModelSelector`'s auto-pick effect
          // back-fills the next available id, and bump the refresh
          // signal so the selector reloads its denylist + re-renders.
          setSelectedModel('');
          setModelRefreshSignal((s) => s + 1);
        }
      },
    }
  );

  // Token estimate
  const totalContent = messages
    .map(
      (m) =>
        m.parts
          ?.filter(
            (p): p is { type: 'text'; text: string } => p.type === 'text'
          )
          .map((p) => p.text)
          .join('') || ''
    )
    .join('');
  const estimatedTokens = useTokenEstimate(totalContent + input);

  // Initial prompt: queue, bump key, send when ready, then strip from URL
  useEffect(() => {
    if (initialPrompt) {
      pendingMessageRef.current = initialPrompt;
      router.replace('/chat');
      queueMicrotask(() => {
        setChatKey((prev) => prev + 1);
      });
    }
    // We only want to react to initialPrompt at mount-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    const pendingMsg = pendingMessageRef.current;
    if (pendingMsg && status === 'ready' && messages.length === 0) {
      pendingMessageRef.current = null;
      sendMessage({ text: pendingMsg });
    }
  }, [status, messages.length, sendMessage]);

  // Escape closes the chat back to the previous page
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        router.back();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const onSubmit = useCallback(() => {
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  }, [input, sendMessage]);

  const handleSuggestion = useCallback(
    (prompt: string) => {
      sendMessage({ text: prompt });
    },
    [sendMessage]
  );

  const errorDisplay = useMemo(() => {
    if (dismissedError) return null;
    return getErrorDisplay(error);
  }, [error, dismissedError]);

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isLoading = isStreaming || isSubmitted;
  const isEmpty = messages.length === 0 && !isLoading;

  const composerFooter = <ComposerFooter estimatedTokens={estimatedTokens} />;

  return (
    <ChatArtifactProvider>
      <ChatExperienceLayout>
        <ChatExperienceBody
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          stop={stop}
          status={status}
          isEmpty={isEmpty}
          messages={messages}
          handleClose={handleClose}
          errorDisplay={errorDisplay}
          setDismissedError={setDismissedError}
          composerFooter={composerFooter}
          activeSuggestionTab={activeSuggestionTab}
          setActiveSuggestionTab={setActiveSuggestionTab}
          handleSuggestion={handleSuggestion}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          enabledFeatureSet={enabledFeatureSet}
          handleToggleFeature={handleToggleFeature}
          modelRefreshSignal={modelRefreshSignal}
        />
      </ChatExperienceLayout>
    </ChatArtifactProvider>
  );
}

/**
 * Layout shell that hosts the chat thread on the left and the
 * artifact preview drawer on the right. Splitting this out lets the
 * artifact panel hook into `useChatArtifacts` without prop-drilling
 * the registry through every layer of the chat UI.
 */
function ChatExperienceLayout({ children }: { children: React.ReactNode }) {
  const { openArtifactId } = useChatArtifacts();
  return (
    <div
      className={cn(
        'relative flex h-full w-full bg-background',
        'overflow-hidden'
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10',
          'bg-linear-to-b from-primary/4 via-transparent to-transparent',
          'dark:from-primary/8'
        )}
      />

      <div
        className={cn(
          'relative flex min-w-0 flex-col',
          openArtifactId ? 'flex-1' : 'w-full'
        )}
      >
        {children}
      </div>
      <ArtifactPanel />
    </div>
  );
}

type ChatExperienceBodyProps = {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  stop: () => void;
  status: ReturnType<typeof useChat<XyloUIMessage>>['status'];
  isEmpty: boolean;
  messages: XyloUIMessage[];
  handleClose: () => void;
  errorDisplay: ReturnType<typeof getErrorDisplay>;
  setDismissedError: (v: boolean) => void;
  composerFooter: React.ReactNode;
  activeSuggestionTab: string;
  setActiveSuggestionTab: (id: string) => void;
  handleSuggestion: (prompt: string) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  enabledFeatureSet: ReadonlySet<ChatFeatureId>;
  handleToggleFeature: (id: ChatFeatureId) => void;
  modelRefreshSignal: number;
};

function ChatExperienceBody({
  input,
  setInput,
  onSubmit,
  stop,
  status,
  isEmpty,
  messages,
  handleClose,
  errorDisplay,
  setDismissedError,
  composerFooter,
  activeSuggestionTab,
  setActiveSuggestionTab,
  handleSuggestion,
  selectedModel,
  setSelectedModel,
  enabledFeatureSet,
  handleToggleFeature,
  modelRefreshSignal,
}: ChatExperienceBodyProps) {
  return (
    <>
      <LayoutGroup id="chat-experience">
        {/*
          Viewport header — only the window-level Close affordance
          lives here, anchored to the **top-left** corner. We
          deliberately leave the top-right empty so a sidebar
          toggle / chat-history rail can land there cleanly later,
          mirroring most chat shells (the close action sits next to
          the navigation surface, not at the opposite end).

          The header is **absolutely positioned** so it doesn't take
          space in the flex column. That lets the body below fill the
          *entire* viewport, which means the empty-state hero is
          truly centred on the geometric viewport centre at every
          resolution — no upward bias from header height. The thread
          state and error banner compensate with `pt-14 sm:pt-16`
          (the absolute header is `top-3 + size-8` ≈ 44 px tall, so
          56–64 px clears it with breathing room).
        */}
        <div className="absolute top-3 left-3 z-30 sm:top-4 sm:left-4">
          <HeaderAction
            onClick={handleClose}
            label="Close"
            tooltip="Close (Esc)"
          >
            <CrossIcon size={14} />
          </HeaderAction>
        </div>

        {/* Error Banner — pushed below the absolute Close button via `pt-14`. */}
        <AnimatePresence>
          {errorDisplay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="shrink-0 overflow-hidden pt-14 sm:pt-16"
            >
              <div
                className={cn(
                  'mx-3 my-2 rounded-xl border p-3 text-sm',
                  errorDisplay.type === 'auth' &&
                    'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
                  errorDisplay.type === 'rate_limit' &&
                    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  errorDisplay.type === 'network' &&
                    'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
                  errorDisplay.type === 'server' &&
                    'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
                  errorDisplay.type === 'model_unavailable' &&
                    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  errorDisplay.type === 'unknown' &&
                    'border-border bg-muted text-muted-foreground'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium">
                      {errorDisplay.title}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {errorDisplay.message}
                    </div>
                  </div>
                  <button
                    onClick={() => setDismissedError(true)}
                    className="rounded p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Dismiss"
                  >
                    <CrossIcon size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body: hero empty state OR thread */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {isEmpty ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                // Empty-state stack sits in `flex-1 + items-center +
                // justify-center`. The body div above already fills
                // the *entire* viewport (because the close button is
                // absolutely positioned, not in the flex column), so
                // `justify-center` here genuinely lands the content's
                // visual centre on the viewport's geometric centre at
                // every resolution. Symmetric `py-12 sm:py-16` gives
                // the hero / suggestions a little breathing room
                // without re-introducing the upward bias the old
                // `pb-24 sm:pb-32` produced.
                className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16"
              >
                {/*
                  Hero wordmark — restrained for a finance-focused
                  feel. Lowercase, light weight, tight tracking. Sized
                  much smaller than a marketing hero would be so the
                  composer remains the centre of gravity.
                */}
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    'mb-5 select-none text-center',
                    // Smaller, more restrained hero — keeps the page
                    // feeling composed at narrower widths and lets
                    // the composer remain the centre of gravity.
                    'text-3xl font-light tracking-tight text-foreground/90',
                    'sm:text-4xl md:text-5xl'
                  )}
                >
                  xylo
                </motion.h1>

                <motion.div
                  layoutId="chat-input-wrapper"
                  className="w-full max-w-2xl"
                  transition={{
                    type: 'spring',
                    damping: 30,
                    stiffness: 280,
                  }}
                >
                  <ChatInput
                    input={input}
                    setInput={setInput}
                    onSubmit={onSubmit}
                    onStop={stop}
                    status={status}
                    placeholder="Ask anything…"
                    isFullscreen
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    modelRefreshSignal={modelRefreshSignal}
                    enabledFeatures={enabledFeatureSet}
                    onToggleFeature={handleToggleFeature}
                    footerHint={composerFooter}
                  />
                </motion.div>

                {/*
                  Suggestions — sleek finance-dashboard layout. No
                  bordered card, no header label; just an underline
                  tab strip with `layoutId` indicator that animates
                  between tabs, then a list of prompts separated by
                  hairlines. Reads as professional and quiet rather
                  than a chrome-heavy "card".
                */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.12,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  // Suggestions are deliberately *narrower* than the
                  // composer (which sits at `max-w-2xl` / 672 px) so
                  // they read as a smaller, secondary affordance
                  // tucked under the input rather than competing with
                  // it. The parent already centres children with
                  // `items-center`, so dropping to `max-w-lg` is all
                  // we need to land them centred under the chat.
                  className="mt-8 w-full max-w-lg"
                >
                  {/*
                    Underline tab strip — left-flowing so the first
                    tab's left edge aligns with the first prompt row's
                    left edge below it. We *don't* `justify-center`
                    here: the strip itself is already centred on the
                    page (the suggestions container is `mx-auto
                    max-w-2xl`), and centring the tabs *within* the
                    strip clusters them in the middle while the
                    underline + prompts span the full width — which
                    reads as a width mismatch.
                  */}
                  <div className="flex items-center gap-1 border-b border-border/40 px-1">
                    {SUGGESTION_CATEGORIES.map((category) => {
                      const isActive = category.id === activeSuggestionTab;
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setActiveSuggestionTab(category.id)}
                          className={cn(
                            'relative inline-flex h-9 items-center gap-1.5 px-3',
                            'text-xs font-medium tracking-tight',
                            'transition-colors duration-150',
                            'focus:outline-none focus-visible:text-foreground',
                            isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Icon className="size-3.5" />
                          {category.label}
                          {isActive && (
                            <motion.span
                              layoutId="suggestion-tab-underline"
                              className="absolute -bottom-px left-2 right-2 h-px bg-foreground"
                              transition={{
                                type: 'spring',
                                stiffness: 360,
                                damping: 32,
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Prompt rows */}
                  <ul className="divide-y divide-border/30">
                    <AnimatePresence mode="wait" initial={false}>
                      {SUGGESTION_CATEGORIES.filter(
                        (c) => c.id === activeSuggestionTab
                      ).map((category) => (
                        <motion.div
                          key={category.id}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{
                            duration: 0.16,
                            ease: [0.32, 0.72, 0, 1],
                          }}
                        >
                          {category.prompts.map((s) => (
                            <li key={s.label}>
                              <button
                                type="button"
                                onClick={() => handleSuggestion(s.prompt)}
                                className={cn(
                                  'group flex w-full items-center justify-between gap-3',
                                  'px-3 py-3 text-left text-[13px]',
                                  'text-muted-foreground hover:text-foreground',
                                  'transition-colors duration-150',
                                  'focus:outline-none focus-visible:text-foreground'
                                )}
                              >
                                <span className="truncate">{s.label}</span>
                                <ArrowRight
                                  className={cn(
                                    'size-3.5 shrink-0',
                                    'opacity-0 -translate-x-1',
                                    'transition-all duration-150',
                                    'group-hover:opacity-100 group-hover:translate-x-0',
                                    'group-focus-visible:opacity-100 group-focus-visible:translate-x-0'
                                  )}
                                />
                              </button>
                            </li>
                          ))}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="thread"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                // `pt-14 sm:pt-16` clears the absolutely-positioned
                // Close button at the top-left so the first message
                // doesn't slide underneath it.
                className="flex min-h-0 flex-1 flex-col pt-14 sm:pt-16"
              >
                <ChatMessages
                  messages={messages}
                  status={status}
                  isFullscreen
                  onSuggestion={handleSuggestion}
                />

                <motion.div
                  layoutId="chat-input-wrapper"
                  className="mx-auto w-full pb-20 sm:pb-24"
                  transition={{
                    type: 'spring',
                    damping: 30,
                    stiffness: 280,
                  }}
                >
                  <ChatInput
                    input={input}
                    setInput={setInput}
                    onSubmit={onSubmit}
                    onStop={stop}
                    status={status}
                    isFullscreen
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    modelRefreshSignal={modelRefreshSignal}
                    enabledFeatures={enabledFeatureSet}
                    onToggleFeature={handleToggleFeature}
                    footerHint={composerFooter}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </>
  );
}
