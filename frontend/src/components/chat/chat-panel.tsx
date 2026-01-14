'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
  useTransform,
  useSpring,
} from 'framer-motion';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ChatModelSelector } from './chat-model-selector';
import {
  CrossIcon,
  SparklesIcon,
  RefreshIcon,
  MaximizeIcon,
  MinimizeIcon,
} from './chat-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { useGlobalChat } from './chat-context';
import { StreamProgress } from './stream-progress';

// ============================================================================
// Token Counter Hook
// ============================================================================

function useTokenEstimate(text: string): number {
  // Rough estimate: ~4 chars per token
  return useMemo(() => Math.ceil(text.length / 4), [text]);
}

// ============================================================================
// Error Display Helper
// ============================================================================

function getErrorDisplay(error: Error | undefined): {
  title: string;
  message: string;
  type: 'rate_limit' | 'network' | 'server' | 'auth' | 'unknown';
} | null {
  if (!error) return null;

  const msg = error.message.toLowerCase();

  // Authentication/Authorization errors
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
      // Use default message
    }

    return {
      title: 'Access Restricted',
      message: displayMessage,
      type: 'auth',
    };
  }

  // Rate limit errors
  if (msg.includes('429') || msg.includes('rate') || msg.includes('limit')) {
    return {
      title: 'Rate Limit Reached',
      message:
        "You've reached the hourly usage limit. Please wait a few minutes.",
      type: 'rate_limit',
    };
  }

  // Network errors
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

  // Server errors
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
// Main Component
// ============================================================================

type ChatPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { initialPrompt, clearInitialPrompt, isFullscreen, toggleFullscreen } =
    useGlobalChat();
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const [chatKey, setChatKey] = useState(0);

  // Pending message ref for timing issues
  const pendingMessageRef = useRef<string | null>(null);

  // Drag controls for swipe-to-close
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const springY = useSpring(y, { stiffness: 400, damping: 40 });

  // Opacity based on drag position (fade out as dragging down)
  const opacity = useTransform(y, [0, 200], [1, 0.3]);
  const scale = useTransform(y, [0, 200], [1, 0.95]);

  // Create transport with API endpoint and model in body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { model: selectedModel },
      }),
    [selectedModel]
  );

  const [dismissedError, setDismissedError] = useState(false);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: `chat-${chatKey}-${selectedModel}`,
    transport,
    onError: (err) => {
      console.error('[Chat] Error:', err);
      setDismissedError(false);
    },
  });

  // Token estimate for current conversation
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

  // Handle initial prompt from context
  useEffect(() => {
    if (isOpen && initialPrompt) {
      pendingMessageRef.current = initialPrompt;
      clearInitialPrompt();
      queueMicrotask(() => {
        setChatKey((prev) => prev + 1);
      });
    }
  }, [isOpen, initialPrompt, clearInitialPrompt]);

  // Send pending message when ready
  useEffect(() => {
    const pendingMsg = pendingMessageRef.current;
    if (pendingMsg && status === 'ready' && messages.length === 0) {
      pendingMessageRef.current = null;
      sendMessage({ text: pendingMsg });
    }
  }, [status, messages.length, sendMessage]);

  // New chat handler
  const handleNewChat = useCallback(() => {
    setChatKey((prev) => prev + 1);
    setInput('');
    setDismissedError(false);
  }, []);

  // Error display
  const errorDisplay = useMemo(() => {
    if (dismissedError) return null;
    return getErrorDisplay(error);
  }, [error, dismissedError]);

  const onSubmit = useCallback(() => {
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  }, [input, sendMessage]);

  // Handle drag end for swipe-to-close
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      // Close if dragged down enough or with enough velocity
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
      // Reset position
      y.set(0);
    },
    [onClose, y]
  );

  // Streaming state helpers
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isLoading = isStreaming || isSubmitted;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed inset-0 z-40',
              isFullscreen ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/20'
            )}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
            }}
            style={{
              y: springY,
              opacity: isFullscreen ? 1 : opacity,
              scale: isFullscreen ? 1 : scale,
            }}
            drag={!isFullscreen ? 'y' : false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            dragListener={false}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed z-50',
              'flex flex-col overflow-hidden',
              'border bg-background shadow-2xl',
              // Mobile: full screen
              'inset-0 rounded-none',
              // Desktop: positioned panel or fullscreen
              isFullscreen
                ? 'sm:inset-4 sm:rounded-2xl'
                : [
                    'sm:inset-auto',
                    'sm:bottom-4 sm:right-4',
                    'sm:w-[420px]',
                    'sm:h-[min(600px,calc(100vh-8rem))]',
                    'sm:rounded-2xl',
                  ]
            )}
          >
            {/* Drag handle (mobile only) - only this triggers drag */}
            <div
              className="sm:hidden flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div
              className={cn(
                'flex items-center justify-between',
                'border-b shrink-0',
                isFullscreen ? 'px-6 py-4' : 'px-4 py-3'
              )}
            >
              {/* Left side - branding */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center',
                    'rounded-full bg-gradient-to-br from-primary/20 to-primary/5',
                    'ring-1 ring-primary/20',
                    isFullscreen ? 'size-10' : 'size-8'
                  )}
                >
                  <SparklesIcon size={isFullscreen ? 16 : 14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h2
                      className={cn(
                        'font-semibold',
                        isFullscreen ? 'text-base' : 'text-sm'
                      )}
                    >
                      AI Assistant
                    </h2>
                    <ChatModelSelector
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                    />
                  </div>
                  {/* Token counter + stream progress */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-muted-foreground/60 font-mono',
                        isFullscreen ? 'text-xs' : 'text-[10px]'
                      )}
                    >
                      ~{estimatedTokens} tokens
                    </span>
                    <StreamProgress isActive={isLoading} size={12} />
                  </div>
                </div>
              </div>

              {/* Right side - actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Fullscreen toggle (desktop only) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={toggleFullscreen}
                      whileTap={{ scale: 0.9 }}
                      className={cn(
                        'hidden sm:flex size-8 items-center justify-center',
                        'rounded-lg transition-colors',
                        'hover:bg-muted text-muted-foreground',
                        'hover:text-foreground'
                      )}
                      aria-label={
                        isFullscreen ? 'Exit fullscreen' : 'Fullscreen'
                      }
                    >
                      {isFullscreen ? (
                        <MinimizeIcon size={15} />
                      ) : (
                        <MaximizeIcon size={15} />
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</p>
                  </TooltipContent>
                </Tooltip>

                {/* New chat */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={handleNewChat}
                      whileTap={{ scale: 0.9 }}
                      className={cn(
                        'flex size-8 items-center justify-center',
                        'rounded-lg transition-colors',
                        'hover:bg-muted text-muted-foreground',
                        'hover:text-foreground'
                      )}
                      aria-label="New chat"
                    >
                      <RefreshIcon size={15} />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>New chat</p>
                  </TooltipContent>
                </Tooltip>

                {/* Close button */}
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'flex size-8 items-center justify-center',
                    'rounded-lg transition-colors',
                    'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  aria-label="Close"
                >
                  <CrossIcon size={16} />
                </motion.button>
              </div>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {errorDisplay && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="shrink-0 overflow-hidden"
                >
                  <div
                    className={cn(
                      'mx-3 my-2 p-3 rounded-lg',
                      'border text-sm',
                      errorDisplay.type === 'auth' && [
                        'bg-purple-500/10 border-purple-500/30',
                        'text-purple-700 dark:text-purple-300',
                      ],
                      errorDisplay.type === 'rate_limit' && [
                        'bg-amber-500/10 border-amber-500/30',
                        'text-amber-700 dark:text-amber-300',
                      ],
                      errorDisplay.type === 'network' && [
                        'bg-blue-500/10 border-blue-500/30',
                        'text-blue-700 dark:text-blue-300',
                      ],
                      errorDisplay.type === 'server' && [
                        'bg-red-500/10 border-red-500/30',
                        'text-red-700 dark:text-red-300',
                      ],
                      errorDisplay.type === 'unknown' && [
                        'bg-muted border-border',
                        'text-muted-foreground',
                      ]
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {errorDisplay.type === 'auth' && (
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <rect
                                x="3"
                                y="7"
                                width="10"
                                height="7"
                                rx="1.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M5 7V5a3 3 0 016 0v2"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <circle
                                cx="8"
                                cy="10.5"
                                r="1"
                                fill="currentColor"
                              />
                            </svg>
                          )}
                          {errorDisplay.type === 'rate_limit' && (
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <circle
                                cx="8"
                                cy="8"
                                r="7"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M8 4.5V8.5L10.5 10"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                          {errorDisplay.type === 'network' && (
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M2 8a6 6 0 0112 0M4 8a4 4 0 018 0M6 8a2 2 0 014 0"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <circle
                                cx="8"
                                cy="12"
                                r="1"
                                fill="currentColor"
                              />
                            </svg>
                          )}
                          {(errorDisplay.type === 'server' ||
                            errorDisplay.type === 'unknown') && (
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M8 5v4M8 11v.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <circle
                                cx="8"
                                cy="8"
                                r="7"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-xs">
                            {errorDisplay.title}
                          </div>
                          <div className="text-xs opacity-80 mt-0.5">
                            {errorDisplay.message}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDismissedError(true)}
                        className={cn(
                          'p-1 rounded hover:bg-black/10',
                          'dark:hover:bg-white/10 transition-colors'
                        )}
                        aria-label="Dismiss"
                      >
                        <CrossIcon size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <ChatMessages
              messages={messages}
              status={status}
              isFullscreen={isFullscreen}
            />

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              onStop={stop}
              status={status}
              isFullscreen={isFullscreen}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
