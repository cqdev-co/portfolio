'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  RegenerateIcon,
} from './chat-icons';
import { ToolCallCard, type ToolCall } from './tool-call-card';
import { TypewriterText } from './typewriter-text';

type ChatMessageProps = {
  message: UIMessage;
  isLoading?: boolean;
  onRegenerate?: () => void;
};

// Tool marker patterns - greedy to capture full JSON
const TOOL_START_REGEX = /<!--TOOL_START:(\w+):([\s\S]+?):START-->/g;
const TOOL_RESULT_REGEX = /<!--TOOL:(\w+):([\s\S]+?):TOOL-->/g;
const TOOL_ERROR_REGEX = /<!--TOOL_ERROR:(\w+):([\s\S]+?):ERROR-->/g;

// Thinking marker patterns
const THINKING_COMPLETE_REGEX =
  /<!--THINKING_START-->([\s\S]*?)<!--THINKING_END-->/g;
const THINKING_START_MARKER = '<!--THINKING_START-->';
const THINKING_END_MARKER = '<!--THINKING_END-->';
const PARTIAL_MARKER_REGEX =
  /<!--(?:THINKING_?(?:START|END)?|TOOL_?(?:START)?)[^>]*$/;

// Extract text content from UIMessage parts
function getMessageContent(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return '';
  }

  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && 'text' in part
    )
    .map((part) => part.text)
    .join('');
}

// Parse tool calls and thinking from content
function parseToolCalls(content: string): {
  cleanContent: string;
  toolCalls: ToolCall[];
  thinking: string | null;
} {
  const toolMap = new Map<string, ToolCall>();
  let cleanContent = content;

  // STEP 1: Extract tool calls FIRST
  cleanContent = cleanContent.replace(
    TOOL_START_REGEX,
    (_, toolName, jsonData) => {
      try {
        const args = JSON.parse(jsonData);
        const id = `${toolName}_${JSON.stringify(args)}`;

        if (!toolMap.has(id)) {
          toolMap.set(id, {
            id,
            tool: toolName,
            args,
            status: 'running',
          });
        }
      } catch {
        const id = `${toolName}_unknown`;
        if (!toolMap.has(id)) {
          toolMap.set(id, {
            id,
            tool: toolName,
            args: {},
            status: 'running',
          });
        }
      }
      return '';
    }
  );

  // Find all RESULT markers
  cleanContent = cleanContent.replace(
    TOOL_RESULT_REGEX,
    (_, toolName, jsonData) => {
      try {
        const result = JSON.parse(jsonData);

        let found = false;
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'complete';
            tc.result = result;
            found = true;
            break;
          }
        }

        if (!found) {
          const id = `${toolName}_${Date.now()}`;
          toolMap.set(id, {
            id,
            tool: toolName,
            args: {},
            status: 'complete',
            result,
          });
        }
      } catch {
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = 'Failed to parse result';
            break;
          }
        }
      }
      return '';
    }
  );

  // Find all ERROR markers
  cleanContent = cleanContent.replace(
    TOOL_ERROR_REGEX,
    (_, toolName, jsonData) => {
      try {
        const errorInfo = JSON.parse(jsonData);

        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = errorInfo.error || 'Tool execution failed';
            break;
          }
        }
      } catch {
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = 'Tool execution failed';
            break;
          }
        }
      }
      return '';
    }
  );

  // STEP 2: Extract thinking content
  const thinkingParts: string[] = [];

  cleanContent = cleanContent.replace(
    THINKING_COMPLETE_REGEX,
    (_, thinkingContent) => {
      const cleaned = thinkingContent.trim();
      if (cleaned) thinkingParts.push(cleaned);
      return '';
    }
  );

  const startIdx = cleanContent.indexOf(THINKING_START_MARKER);
  if (startIdx !== -1) {
    const beforeStart = cleanContent.slice(0, startIdx);
    let afterStart = cleanContent.slice(
      startIdx + THINKING_START_MARKER.length
    );

    afterStart = afterStart.replace(THINKING_END_MARKER, '');

    const thinkingContent = afterStart.trim();
    if (thinkingContent) {
      thinkingParts.push(thinkingContent);
    }

    cleanContent = beforeStart;
  }

  cleanContent = cleanContent
    .replace(/<!--THINKING_START-->/g, '')
    .replace(/<!--THINKING_END-->/g, '');

  cleanContent = cleanContent.replace(PARTIAL_MARKER_REGEX, '');

  const thinking = thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null;

  return {
    cleanContent: cleanContent.trim(),
    toolCalls: Array.from(toolMap.values()),
    thinking,
  };
}

function PureChatMessage({
  message,
  isLoading,
  onRegenerate,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const rawContent = getMessageContent(message);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { cleanContent, toolCalls, thinking } = useMemo(
    () => parseToolCalls(rawContent),
    [rawContent]
  );

  const hasContent = cleanContent.length > 0;
  const hasToolCalls = toolCalls.length > 0;
  const hasThinking = thinking && thinking.length > 0;

  // Copy to clipboard handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [cleanContent]);

  if (!hasContent && !isLoading && !hasToolCalls && !hasThinking) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        'w-full group',
        isUser ? 'flex justify-end' : 'flex justify-start'
      )}
      data-role={message.role}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          'flex gap-3',
          isUser ? 'flex-row-reverse max-w-[85%]' : 'flex-row w-full'
        )}
      >
        {/* Avatar - only for assistant */}
        {!isUser && (
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center',
              'rounded-full bg-background ring-1 ring-border'
            )}
          >
            <SparklesIcon size={12} />
          </div>
        )}

        {/* Message content */}
        <div
          className={cn(
            'min-w-0 overflow-hidden relative',
            isUser
              ? 'rounded-2xl bg-primary text-primary-foreground px-3 py-2'
              : 'flex-1'
          )}
        >
          {isUser ? (
            <p
              className={cn(
                'text-sm leading-relaxed',
                'whitespace-pre-wrap break-words'
              )}
            >
              {cleanContent}
            </p>
          ) : (
            <div className="space-y-3">
              {/* Thinking display */}
              {hasThinking && (
                <ThinkingDisplay thinking={thinking} isLoading={isLoading} />
              )}

              {/* Tool call cards */}
              {hasToolCalls && (
                <div className="space-y-2">
                  {toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}

              {/* Message content with typewriter effect */}
              {hasContent && (
                <TypewriterText
                  content={cleanContent}
                  isStreaming={isLoading}
                  speed={4}
                />
              )}

              {/* Message actions - visible on hover (no layout shift) */}
              {hasContent && !isLoading && (
                <div
                  className={cn(
                    'flex items-center gap-1 pt-1',
                    'transition-opacity duration-150',
                    isHovered ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md',
                      'text-[10px] text-muted-foreground',
                      'hover:bg-muted hover:text-foreground',
                      'transition-all duration-150'
                    )}
                    title="Copy message"
                  >
                    {copied ? (
                      <>
                        <CheckIcon size={12} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Regenerate button */}
                  {onRegenerate && (
                    <button
                      onClick={onRegenerate}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-md',
                        'text-[10px] text-muted-foreground',
                        'hover:bg-muted hover:text-foreground',
                        'transition-all duration-150'
                      )}
                      title="Regenerate response"
                    >
                      <RegenerateIcon size={12} />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Collapsible thinking display
 */
function ThinkingDisplay({
  thinking,
  isLoading,
}: {
  thinking: string;
  isLoading?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const estimatedSeconds = Math.max(1, Math.round(thinking.length / 150));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2 }}
      className="mb-2"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'group flex items-center gap-1.5',
          'text-xs text-muted-foreground/70',
          'hover:text-muted-foreground transition-colors',
          'py-1'
        )}
      >
        {/* Thinking icon */}
        <motion.svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={isLoading ? { rotate: 360 } : {}}
          transition={
            isLoading ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}
          }
        >
          {isLoading ? (
            <path d="M12 2v4m0 12v4m-7.07-14.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          ) : (
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
          )}
        </motion.svg>

        <span className="font-medium">
          {isLoading ? (
            <>
              Thinking
              <span className="inline-flex ml-0.5">
                <span className="animate-[bounce_1s_infinite_0ms]">.</span>
                <span className="animate-[bounce_1s_infinite_200ms]">.</span>
                <span className="animate-[bounce_1s_infinite_400ms]">.</span>
              </span>
            </>
          ) : (
            `Thought for ${estimatedSeconds}s`
          )}
        </span>

        {/* Expand chevron */}
        <motion.svg
          className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
          viewBox="0 0 16 16"
          fill="none"
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'pl-5 py-2 text-xs leading-relaxed',
                'text-muted-foreground/60',
                'border-l-2 border-muted-foreground/10',
                'max-h-[280px] overflow-y-auto',
                'whitespace-pre-wrap break-words'
              )}
            >
              {thinking}
              {isLoading && (
                <span className="animate-pulse text-muted-foreground">▋</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Memo with smart comparison
export const ChatMessage = memo(PureChatMessage, (prev, next) => {
  if (prev.isLoading || next.isLoading) {
    return false;
  }
  return (
    prev.message.id === next.message.id &&
    getMessageContent(prev.message) === getMessageContent(next.message)
  );
});

// Thinking/loading indicator
export const ThinkingMessage = () => (
  <motion.div
    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ duration: 0.3 }}
    className="w-full flex justify-start"
    data-role="assistant"
  >
    <div className="flex gap-3">
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center',
          'rounded-full bg-background ring-1 ring-border'
        )}
      >
        <SparklesIcon size={12} />
      </div>

      <div
        className={cn(
          'flex items-center gap-1',
          'text-muted-foreground text-sm'
        )}
      >
        <span>Thinking</span>
        <span className="inline-flex">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </div>
    </div>
  </motion.div>
);
