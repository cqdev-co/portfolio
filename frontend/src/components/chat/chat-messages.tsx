'use client';

import { memo } from 'react';
import type { ChatStatus } from 'ai';
import { ArrowDownIcon } from './chat-icons';
import { ChatMessage, ThinkingMessage } from './chat-message';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { cn } from '@/lib/utils';
import type { XyloUIMessage } from '@/lib/chat/types';

type ChatMessagesProps = {
  messages: XyloUIMessage[];
  status: ChatStatus;
  isFullscreen?: boolean;
  onSuggestion?: (prompt: string) => void;
};

function PureChatMessages({
  messages,
  status,
  isFullscreen,
  onSuggestion,
}: ChatMessagesProps) {
  const { containerRef, endRef, isAtBottom, scrollToBottom } =
    useScrollToBottom();

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full overflow-y-auto touch-pan-y"
      >
        {/* Content container - ChatGPT style centered layout */}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-5 mx-auto',
            isFullscreen
              ? 'max-w-3xl px-6 py-6 sm:px-8'
              : 'max-w-none px-4 py-4'
          )}
        >
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLoading={
                isStreaming &&
                message.role === 'assistant' &&
                index === messages.length - 1
              }
              onSuggestion={onSuggestion}
            />
          ))}

          {isSubmitted && <ThinkingMessage />}

          <div ref={endRef} className="min-h-[16px] min-w-[16px] shrink-0" />
        </div>
      </div>

      <button
        type="button"
        aria-label="Scroll to bottom"
        onClick={() => scrollToBottom('smooth')}
        className={cn(
          'absolute bottom-3 left-1/2 -translate-x-1/2 z-10',
          'flex size-8 items-center justify-center',
          'rounded-full border bg-background shadow-md',
          'transition-all duration-200 hover:bg-muted',
          isAtBottom
            ? 'pointer-events-none scale-0 opacity-0'
            : 'pointer-events-auto scale-100 opacity-100'
        )}
      >
        <ArrowDownIcon size={14} />
      </button>
    </div>
  );
}

export const ChatMessages = memo(PureChatMessages, (prev, next) => {
  if (prev.status === 'streaming' || next.status === 'streaming') {
    return false;
  }
  if (prev.isFullscreen !== next.isFullscreen) {
    return false;
  }
  return (
    prev.status === next.status &&
    prev.messages.length === next.messages.length &&
    prev.messages.every(
      (m, i) =>
        m.id === next.messages[i]?.id &&
        m.parts?.length === next.messages[i]?.parts?.length
    )
  );
});
