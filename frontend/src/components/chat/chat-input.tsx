'use client';

import {
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { motion } from 'framer-motion';
import type { ChatStatus } from 'ai';
import { cn } from '@/lib/utils';
import { ArrowUpIcon, StopIcon } from './chat-icons';

type ChatInputProps = {
  input?: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: ChatStatus;
  placeholder?: string;
  isFullscreen?: boolean;
};

// Haptic feedback animation - subtle scale bump on press
const hapticTap = {
  scale: [1, 0.92, 1.02, 1],
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

export function ChatInput({
  input = '',
  setInput,
  onSubmit,
  onStop,
  status,
  placeholder = 'Send a message...',
  isFullscreen,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === 'streaming' || status === 'submitted';

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '24px';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit if IME composition is in progress
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = () => {
    if (isLoading) {
      onStop();
    } else if (input.trim()) {
      onSubmit();
    }
  };

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
  }, []);

  // Reset height after submit
  useEffect(() => {
    if (!input) {
      resetHeight();
    }
  }, [input, resetHeight]);

  return (
    <div
      className={cn(
        'border-t bg-background w-full',
        isFullscreen ? 'px-6 pb-6 pt-4 sm:px-8' : 'px-3 pb-4 pt-3 md:px-4'
      )}
    >
      {/* Centered container for fullscreen - matches message area */}
      <div className={cn('mx-auto', isFullscreen ? 'max-w-3xl' : 'max-w-none')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className={cn(
            'flex w-full items-center gap-2',
            'rounded-xl border border-border bg-muted/30',
            'pl-4 pr-2 py-2',
            'transition-all duration-200',
            'focus-within:border-primary/50 focus-within:bg-background',
            'hover:border-muted-foreground/30',
            // Larger input in fullscreen
            isFullscreen && 'py-3'
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
              'flex-1 resize-none border-none bg-transparent',
              'py-1 text-sm outline-none leading-6',
              'placeholder:text-muted-foreground/70',
              'focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[24px] max-h-[200px]',
              '[scrollbar-width:none] [-ms-overflow-style:none]',
              '[&::-webkit-scrollbar]:hidden'
            )}
          />

          {status === 'submitted' || status === 'streaming' ? (
            <motion.button
              type="button"
              onClick={onStop}
              whileTap={hapticTap}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center',
                'rounded-full',
                'bg-foreground text-background',
                'transition-colors duration-200',
                'hover:bg-foreground/90'
              )}
              aria-label="Stop generating"
            >
              <StopIcon size={14} />
            </motion.button>
          ) : (
            <motion.button
              type="submit"
              disabled={!input.trim()}
              whileTap={input.trim() ? hapticTap : undefined}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center',
                'rounded-full',
                'bg-primary text-primary-foreground',
                'transition-all duration-200',
                'hover:bg-primary/90',
                'disabled:bg-muted disabled:text-muted-foreground',
                'disabled:cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <ArrowUpIcon size={14} />
            </motion.button>
          )}
        </form>
      </div>
    </div>
  );
}
