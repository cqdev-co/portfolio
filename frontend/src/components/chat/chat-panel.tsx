'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ChatModelSelector } from './chat-model-selector';
import { CrossIcon, SparklesIcon, RefreshIcon } from './chat-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { useGlobalChat } from './chat-context';

// Parse error message for user-friendly display
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
    // Try to extract the actual message from JSON response
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
        "You've reached the hourly usage limit. Please wait a few minutes or try a different model.",
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
      message:
        'Unable to reach the AI service. Check your internet connection.',
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

  // Generic error
  return {
    title: 'Something went wrong',
    message: error.message.slice(0, 100) || 'An unexpected error occurred.',
    type: 'unknown',
  };
}

type ChatPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { initialPrompt, clearInitialPrompt } = useGlobalChat();
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const [chatKey, setChatKey] = useState(0);

  // Use ref for pending message to avoid timing issues with React batching
  const pendingMessageRef = useRef<string | null>(null);

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
    // Re-initialize chat when model changes
    id: `chat-${chatKey}-${selectedModel}`,
    transport,
    onError: (err) => {
      console.error('[Chat] Error:', err);
      setDismissedError(false); // Show new errors
    },
  });

  // Handle initial prompt from context (e.g., position analysis)
  // Queue the message and reset chat to send it
  useEffect(() => {
    if (isOpen && initialPrompt) {
      console.log(
        '[Chat] Received initial prompt:',
        initialPrompt.substring(0, 80) + '...'
      );
      // Store in ref before resetting chat
      pendingMessageRef.current = initialPrompt;
      clearInitialPrompt();
      // Reset chat - this creates a fresh instance

      setChatKey((prev) => prev + 1);
    }
  }, [isOpen, initialPrompt, clearInitialPrompt]);

  // Send the pending message once chat is ready
  // This effect runs whenever status changes, checking if we have a queued message
  useEffect(() => {
    const pendingMsg = pendingMessageRef.current;
    console.log(
      '[Chat] Status changed:',
      status,
      'pending:',
      !!pendingMsg,
      'messages:',
      messages.length
    );

    if (pendingMsg && status === 'ready' && messages.length === 0) {
      console.log(
        '[Chat] Sending queued message:',
        pendingMsg.substring(0, 80) + '...'
      );
      // Clear ref BEFORE sending to prevent re-sends
      pendingMessageRef.current = null;
      // Send immediately - the chat instance is ready
      sendMessage({ text: pendingMsg });
    }
  }, [status, messages.length, sendMessage]);

  // Start a new chat
  const handleNewChat = useCallback(() => {
    setChatKey((prev) => prev + 1);
    setInput('');
    setDismissedError(false);
  }, []);

  // Parse error for display
  const errorDisplay = useMemo(() => {
    if (dismissedError) return null;
    return getErrorDisplay(error);
  }, [error, dismissedError]);

  const onSubmit = useCallback(() => {
    if (input.trim()) {
      // Use sendMessage with text format (AI SDK 3.x API)
      sendMessage({ text: input });
      setInput('');
    }
  }, [input, sendMessage]);

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      sendMessage({ text: prompt });
    },
    [sendMessage]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/20"
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
            className={cn(
              'fixed z-50',
              'bottom-4 right-4 sm:bottom-6 sm:right-6',
              'w-[calc(100vw-2rem)] sm:w-[420px]',
              'h-[min(600px,calc(100vh-8rem))]',
              'rounded-2xl border bg-background shadow-2xl',
              'flex flex-col overflow-hidden'
            )}
          >
            {/* Header */}
            <div
              className={cn(
                'flex items-center justify-between',
                'border-b px-4 py-3 shrink-0'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center',
                    'rounded-full bg-muted ring-1 ring-border'
                  )}
                >
                  <SparklesIcon size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold">AI Assistant</h2>
                    <ChatModelSelector
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Powered by Ollama Cloud
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className={cn(
                        'flex size-8 items-center justify-center',
                        'rounded-lg transition-colors',
                        'hover:bg-muted text-muted-foreground',
                        'hover:text-foreground'
                      )}
                      aria-label="New chat"
                    >
                      <RefreshIcon size={15} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>New chat</p>
                  </TooltipContent>
                </Tooltip>

                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'flex size-8 items-center justify-center',
                    'rounded-lg transition-colors',
                    'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  aria-label="Close"
                >
                  <CrossIcon size={16} />
                </button>
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
                        {/* Icon */}
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
              onSuggestionClick={handleSuggestionClick}
            />

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              onStop={stop}
              status={status}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
