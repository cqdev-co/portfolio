"use client";

import { memo } from "react";
import type { UIMessage } from "ai";
import type { ChatStatus } from "@ai-sdk/react";
import { ArrowDownIcon } from "./chat-icons";
import { ChatMessage, ThinkingMessage } from "./chat-message";
import { ChatGreeting } from "./chat-greeting";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { cn } from "@/lib/utils";

type ChatMessagesProps = {
  messages: UIMessage[];
  status: ChatStatus;
  onSuggestionClick: (prompt: string) => void;
};

function PureChatMessages({ 
  messages, 
  status, 
  onSuggestionClick 
}: ChatMessagesProps) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
  } = useScrollToBottom();

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto touch-pan-y"
      >
        <div 
          className={cn(
            "mx-auto flex min-w-0 max-w-full flex-col gap-5",
            "px-4 py-4"
          )}
        >
          {/* Empty state with greeting */}
          {messages.length === 0 && (
            <ChatGreeting onSuggestionClick={onSuggestionClick} />
          )}

          {/* Messages - tool cards are now embedded in ChatMessage */}
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLoading={
                isStreaming && 
                message.role === "assistant" && 
                index === messages.length - 1
              }
            />
          ))}

          {/* Thinking indicator */}
          {isSubmitted && <ThinkingMessage />}

          {/* Scroll anchor */}
          <div ref={endRef} className="min-h-[16px] min-w-[16px] shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <button
        type="button"
        aria-label="Scroll to bottom"
        onClick={() => scrollToBottom("smooth")}
        className={cn(
          "absolute bottom-3 left-1/2 -translate-x-1/2 z-10",
          "flex size-8 items-center justify-center",
          "rounded-full border bg-background shadow-md",
          "transition-all duration-200 hover:bg-muted",
          isAtBottom
            ? "pointer-events-none scale-0 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        )}
      >
        <ArrowDownIcon size={14} />
      </button>
    </div>
  );
}

export const ChatMessages = memo(
  PureChatMessages,
  (prev, next) => {
    // Always re-render during streaming
    if (prev.status === "streaming" || next.status === "streaming") {
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
  }
);
