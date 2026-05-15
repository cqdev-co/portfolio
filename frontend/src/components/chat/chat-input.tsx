'use client';

import {
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { motion } from 'framer-motion';
import { Mic, Paperclip } from 'lucide-react';
import type { ChatStatus } from 'ai';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowUpIcon, StopIcon } from './chat-icons';
import { ChatModelSelector } from './chat-model-selector';
import {
  ChatActionsPopover,
  ChatActivePill,
  CHAT_FEATURES,
  type ChatFeatureId,
} from './chat-actions-popover';

type ChatInputProps = {
  input?: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: ChatStatus;
  placeholder?: string;
  isFullscreen?: boolean;
  /** Hint row under the composer (keyboard shortcuts, token estimate). */
  footerHint?: React.ReactNode;
  /**
   * Active chat model id (cookie-backed via `lib/ai/chat-model-store`).
   * When provided together with `onModelChange`, the composer renders
   * the model pill in its right cluster, just left of the microphone.
   */
  selectedModel?: string;
  onModelChange?: (id: string) => void;
  /**
   * Bumped by `ChatExperience` after a `MODEL_UNAVAILABLE` error to
   * force the model selector to re-fetch its list (so the just-denied
   * model disappears from the dropdown).
   */
  modelRefreshSignal?: number;
  /**
   * Set of currently-enabled per-turn capabilities (Web Search, Deep
   * Research, …). When provided alongside `onToggleFeature`, the
   * composer renders the Onyx-style configuration popover and active
   * pill row in the toolbar's left cluster.
   */
  enabledFeatures?: ReadonlySet<ChatFeatureId>;
  onToggleFeature?: (id: ChatFeatureId) => void;
};

// Subtle haptic-style scale on press for the send/stop affordance.
const hapticTap = {
  scale: [1, 0.92, 1.02, 1],
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

/**
 * Composer for the chat surface.
 *
 * Single rounded card with the textarea on top and a thin toolbar
 * underneath, split into two clusters:
 *
 *   LEFT  — paperclip file-attach, sliders config trigger, then a
 *           row of "active capability" pills (Web Search, Deep
 *           Research, …) that appear when the user toggles
 *           features in the popover.
 *   RIGHT — model pill (`ChatModelSelector`), microphone
 *           placeholder, then the circular send / stop button.
 *
 * Putting the model pill in the right cluster — directly to the
 * left of the mic and send — pairs the active model visually with
 * the input it'll be sent to. This is the most discoverable spot
 * for it: the user is already looking at the right side of the
 * composer when they're about to send.
 */
export function ChatInput({
  input = '',
  setInput,
  onSubmit,
  onStop,
  status,
  placeholder = 'Ask anything…',
  isFullscreen,
  footerHint,
  selectedModel,
  onModelChange,
  modelRefreshSignal,
  enabledFeatures,
  onToggleFeature,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === 'streaming' || status === 'submitted';
  // We gate on `onModelChange` only — *not* `selectedModel` — so the
  // selector renders on both the SSR pass and the first client render
  // even when no cookie is set yet (initial `selectedModel === ''`).
  // Gating on the model id used to leave the slot empty server-side
  // and full client-side, which produced a hydration mismatch (server
  // saw `[Mic, Send]`, client saw `[Selector, Mic, Send]`). The
  // selector handles `selectedModel === ''` gracefully — it shows a
  // loading spinner until `/api/chat/models` resolves and an
  // auto-pick / cookie value lands.
  const showModelSelector = Boolean(onModelChange);
  const showFeatureControls = Boolean(enabledFeatures && onToggleFeature);
  const canSend = input.trim().length > 0 && !isLoading;

  // Render selected feature pills next to the config trigger in the
  // same order they appear in the popover, so the row reads predictably
  // regardless of which one was toggled first (matches Onyx's stable
  // ordering of `forcedToolIds`).
  const activeFeatures = showFeatureControls
    ? CHAT_FEATURES.filter((f) => enabledFeatures!.has(f.id))
    : [];

  // The textarea grows with content. We reset to `auto` first so
  // `scrollHeight` reflects the content's natural size, then clamp
  // between the CSS-enforced min/max. The CSS `min-h-[44px]` floor
  // means an empty composer still presents a substantial typing
  // surface, not a thin one-line strip.
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 240);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Focus on mount so users can start typing immediately.
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit while IME composition is in progress.
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) onSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = () => {
    if (isLoading) onStop();
    else if (input.trim()) onSubmit();
  };

  const resetHeight = useCallback(() => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, []);

  useEffect(() => {
    if (!input) resetHeight();
  }, [input, resetHeight]);

  return (
    <div
      className={cn(
        'w-full bg-transparent',
        isFullscreen ? 'px-4 sm:px-6' : 'px-3'
      )}
    >
      {/*
        `max-w-2xl` (672 px) matches the empty-state wrapper around
        the composer, so the thread-state composer doesn't balloon
        to `max-w-4xl` (896 px) when the parent has no outer
        constraint. Both states now share the same 672 px ceiling,
        which keeps the chat box looking proportional to the
        floating dock and the messages list above.
      */}
      <div className={cn('mx-auto', isFullscreen ? 'max-w-2xl' : 'max-w-none')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className={cn(
            'group relative flex w-full flex-col',
            'rounded-3xl border border-border/60',
            'bg-background/80 backdrop-blur-xl',
            'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.08)]',
            'transition-[border-color,box-shadow] duration-200',
            'focus-within:border-foreground/20',
            'focus-within:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_28px_-10px_rgb(0_0_0/0.12)]'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading && status !== 'streaming'}
            className={cn(
              'w-full resize-none border-none bg-transparent',
              // More vertical padding + a 44px floor (≈ two lines of
              // breathing room) makes the empty composer feel like a
              // proper typing surface instead of a single-line input.
              'px-5 pt-5 pb-2 text-[15px] leading-7 outline-none',
              'placeholder:text-muted-foreground/60',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'min-h-[44px] max-h-[240px]',
              '[scrollbar-width:none] [-ms-overflow-style:none]',
              '[&::-webkit-scrollbar]:hidden'
            )}
          />

          {/*
            Inline toolbar — Onyx-style two-cluster layout
            (`onyx-main/web/src/sections/input/AppInputBar.tsx`):

              LEFT cluster
                · paperclip    — file attach (placeholder)
                · sliders      — `ChatActionsPopover` (Web Search /
                                  Deep Research toggles)
                · pills        — one per active feature, foldable
                                  (click to disable). Mirrors Onyx's
                                  `forcedToolIds.map(...)` row.

              RIGHT cluster
                · microphone   — voice input (placeholder)
                · send / stop  — circular action button

            Both placeholders preserve the visual structure today so
            the real features can land without touching the layout.
          */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Attach files (coming soon)"
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center',
                      'rounded-full border border-transparent',
                      'text-muted-foreground hover:text-foreground',
                      'hover:border-border/70 hover:bg-muted/50',
                      'transition-colors duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15'
                    )}
                  >
                    <Paperclip className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Attach files (coming soon)</p>
                </TooltipContent>
              </Tooltip>

              {showFeatureControls && (
                <>
                  <ChatActionsPopover
                    enabled={enabledFeatures!}
                    onToggle={onToggleFeature!}
                    disabled={isLoading}
                  />
                  {activeFeatures.map((feature) => (
                    <ChatActivePill
                      key={feature.id}
                      feature={feature}
                      onClear={() => onToggleFeature!(feature.id)}
                      disabled={isLoading}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {showModelSelector && (
                <ChatModelSelector
                  selectedModel={selectedModel ?? ''}
                  onModelChange={onModelChange!}
                  refreshSignal={modelRefreshSignal}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Voice input (coming soon)"
                    disabled={isLoading}
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center',
                      'rounded-full border border-transparent',
                      'text-muted-foreground hover:text-foreground',
                      'hover:border-border/70 hover:bg-muted/50',
                      'transition-colors duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15',
                      'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  >
                    <Mic className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Voice input (coming soon)</p>
                </TooltipContent>
              </Tooltip>

              {isLoading ? (
                <motion.button
                  type="button"
                  onClick={onStop}
                  whileTap={hapticTap}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center',
                    'rounded-full bg-foreground text-background',
                    'transition-colors duration-150 hover:bg-foreground/90'
                  )}
                  aria-label="Stop generating"
                >
                  <StopIcon size={12} />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={!canSend}
                  whileTap={canSend ? hapticTap : undefined}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center',
                    'rounded-full transition-all duration-150',
                    canSend
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-muted text-muted-foreground/50',
                    'disabled:cursor-not-allowed'
                  )}
                  aria-label="Send message"
                >
                  <ArrowUpIcon size={16} />
                </motion.button>
              )}
            </div>
          </div>
        </form>

        {footerHint && (
          <div
            className={cn(
              // Slightly larger / more opaque than the previous
              // `text-[10px] text-muted-foreground/55`, since the
              // footer now hosts kbd boxes with icon glyphs that
              // benefit from being readable rather than just
              // ambient. Still kept in `select-none` so it doesn't
              // get caught by stray triple-clicks on the composer.
              'mt-2 px-2 text-center select-none'
            )}
          >
            {footerHint}
          </div>
        )}
      </div>
    </div>
  );
}
