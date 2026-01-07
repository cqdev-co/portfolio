'use client';

import { memo, useMemo, useState } from 'react';
import type { UIMessage } from 'ai';
import { cn } from '@/lib/utils';
import { SparklesIcon } from './chat-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallCard, type ToolCall } from './tool-call-card';

type ChatMessageProps = {
  message: UIMessage;
  isLoading?: boolean;
};

// Tool marker patterns - greedy to capture full JSON
// Start:  <!--TOOL_START:toolName:JSON:START-->
// Result: <!--TOOL:toolName:JSON:TOOL-->
// Error:  <!--TOOL_ERROR:toolName:JSON:ERROR-->
const TOOL_START_REGEX = /<!--TOOL_START:(\w+):([\s\S]+?):START-->/g;
const TOOL_RESULT_REGEX = /<!--TOOL:(\w+):([\s\S]+?):TOOL-->/g;
const TOOL_ERROR_REGEX = /<!--TOOL_ERROR:(\w+):([\s\S]+?):ERROR-->/g;

// Thinking marker patterns
// Complete: <!--THINKING_START-->content<!--THINKING_END-->
// Partial (streaming): <!--THINKING_START-->content... (no end yet)
const THINKING_COMPLETE_REGEX =
  /<!--THINKING_START-->([\s\S]*?)<!--THINKING_END-->/g;
const THINKING_START_MARKER = '<!--THINKING_START-->';
const THINKING_END_MARKER = '<!--THINKING_END-->';
// Also catch partial/malformed markers during streaming
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

  // ========================================
  // STEP 1: Extract tool calls FIRST
  // (before thinking, so thinking content is clean)
  // ========================================

  // Find all START markers
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
            status: 'running', // Default to running
          });
        }
      } catch {
        // Create placeholder if JSON fails
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
      return ''; // Remove marker
    }
  );

  // Second pass: find all RESULT markers and update status
  cleanContent = cleanContent.replace(
    TOOL_RESULT_REGEX,
    (_, toolName, jsonData) => {
      try {
        const result = JSON.parse(jsonData);

        // Find existing tool call or create new one
        let found = false;
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'complete';
            tc.result = result;
            found = true;
            break;
          }
        }

        // Create complete entry if no running one found
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
        // Mark as error if JSON fails
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = 'Failed to parse result';
            break;
          }
        }
      }
      return ''; // Remove marker
    }
  );

  // Third pass: find all ERROR markers and update status
  cleanContent = cleanContent.replace(
    TOOL_ERROR_REGEX,
    (_, toolName, jsonData) => {
      try {
        const errorInfo = JSON.parse(jsonData);

        // Find existing tool call and mark as error
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = errorInfo.error || 'Tool execution failed';
            break;
          }
        }
      } catch {
        // Still mark as error even if parse fails
        for (const tc of toolMap.values()) {
          if (tc.tool === toolName && tc.status === 'running') {
            tc.status = 'error';
            tc.error = 'Tool execution failed';
            break;
          }
        }
      }
      return ''; // Remove marker
    }
  );

  // ========================================
  // STEP 2: Extract thinking content
  // (after tool markers removed, so thinking is clean)
  // ========================================

  const thinkingParts: string[] = [];

  // First: Extract complete thinking blocks (with both START and END markers)
  cleanContent = cleanContent.replace(
    THINKING_COMPLETE_REGEX,
    (_, thinkingContent) => {
      const cleaned = thinkingContent.trim();
      if (cleaned) thinkingParts.push(cleaned);
      return ''; // Remove complete thinking block
    }
  );

  // Second: Handle incomplete thinking (streaming - START exists but no END yet)
  // This captures everything AFTER the START marker as thinking
  const startIdx = cleanContent.indexOf(THINKING_START_MARKER);
  if (startIdx !== -1) {
    // Everything before START marker stays as cleanContent
    const beforeStart = cleanContent.slice(0, startIdx);
    // Everything after START marker is thinking (still streaming)
    let afterStart = cleanContent.slice(
      startIdx + THINKING_START_MARKER.length
    );

    // Remove any stray END markers that might be in there
    afterStart = afterStart.replace(THINKING_END_MARKER, '');

    const thinkingContent = afterStart.trim();
    if (thinkingContent) {
      thinkingParts.push(thinkingContent);
    }

    cleanContent = beforeStart;
  }

  // Third: Clean up any orphaned markers (shouldn't happen but just in case)
  cleanContent = cleanContent
    .replace(/<!--THINKING_START-->/g, '')
    .replace(/<!--THINKING_END-->/g, '');

  // Fourth: Remove any partial markers at the end (mid-stream artifacts)
  // e.g., "text<!--THINK" or "text<!--THINKING_ST"
  cleanContent = cleanContent.replace(PARTIAL_MARKER_REGEX, '');

  // Combine all thinking parts
  const thinking = thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null;

  return {
    cleanContent: cleanContent.trim(),
    toolCalls: Array.from(toolMap.values()),
    thinking,
  };
}

function PureChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const rawContent = getMessageContent(message);

  // Parse tool calls, thinking, and clean content - memoized
  const { cleanContent, toolCalls, thinking } = useMemo(
    () => parseToolCalls(rawContent),
    [rawContent]
  );

  // Don't render empty messages unless streaming/loading or has tool calls/thinking
  const hasContent = cleanContent.length > 0;
  const hasToolCalls = toolCalls.length > 0;
  const hasThinking = thinking && thinking.length > 0;

  if (!hasContent && !isLoading && !hasToolCalls && !hasThinking) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-full animate-in fade-in duration-200',
        isUser ? 'flex justify-end' : 'flex justify-start'
      )}
      data-role={message.role}
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
              'rounded-full bg-background ring-1 ring-border',
              isLoading && 'animate-pulse'
            )}
          >
            <SparklesIcon size={12} />
          </div>
        )}

        {/* Message content */}
        <div
          className={cn(
            'min-w-0 overflow-hidden',
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
              {/* Thinking display - collapsible reasoning */}
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

              {/* Message content */}
              {hasContent && (
                <div
                  className={cn(
                    'text-sm leading-relaxed text-foreground',
                    'prose-container',
                    // Streaming cursor
                    isLoading && [
                      "after:content-['▋']",
                      'after:animate-pulse',
                      'after:ml-0.5',
                      'after:text-muted-foreground',
                    ]
                  )}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Paragraphs
                      p: ({ children }) => (
                        <p className="mb-3 last:mb-0">{children}</p>
                      ),

                      // Code - inline and block
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return (
                            <code className="text-xs font-mono">
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code
                            className={cn(
                              'bg-muted px-1.5 py-0.5 rounded',
                              'text-xs font-mono break-all'
                            )}
                          >
                            {children}
                          </code>
                        );
                      },

                      // Code blocks
                      pre: ({ children }) => (
                        <pre
                          className={cn(
                            'bg-muted rounded-lg p-3 my-3',
                            'overflow-x-auto text-xs',
                            '[&>code]:bg-transparent [&>code]:p-0'
                          )}
                        >
                          {children}
                        </pre>
                      ),

                      // Tables
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto rounded-lg border">
                          <table className="w-full text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted/50 border-b">
                          {children}
                        </thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y">{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="divide-x">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th
                          className={cn(
                            'px-3 py-2 text-left font-semibold',
                            'text-xs whitespace-nowrap'
                          )}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2 text-xs">{children}</td>
                      ),

                      // Lists
                      ul: ({ children }) => (
                        <ul
                          className={cn(
                            'list-disc pl-5 mb-3 space-y-1',
                            'last:mb-0 [&_ul]:mb-0 [&_ul]:mt-1'
                          )}
                        >
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol
                          className={cn(
                            'list-decimal pl-5 mb-3 space-y-1',
                            'last:mb-0 [&_ol]:mb-0 [&_ol]:mt-1'
                          )}
                        >
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="pl-1">{children}</li>
                      ),

                      // Text formatting
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      del: ({ children }) => (
                        <del className="line-through opacity-70">
                          {children}
                        </del>
                      ),

                      // Links
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'text-primary underline underline-offset-2',
                            'hover:opacity-80 transition-opacity'
                          )}
                        >
                          {children}
                        </a>
                      ),

                      // Blockquotes
                      blockquote: ({ children }) => (
                        <blockquote
                          className={cn(
                            'border-l-2 border-border',
                            'pl-4 my-3 text-muted-foreground italic',
                            '[&>p]:mb-0'
                          )}
                        >
                          {children}
                        </blockquote>
                      ),

                      // Headings
                      h1: ({ children }) => (
                        <h1
                          className={cn(
                            'text-base font-semibold',
                            'mt-4 mb-2 first:mt-0'
                          )}
                        >
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2
                          className={cn(
                            'text-sm font-semibold',
                            'mt-4 mb-2 first:mt-0'
                          )}
                        >
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3
                          className={cn(
                            'text-sm font-semibold',
                            'mt-3 mb-1.5 first:mt-0'
                          )}
                        >
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4
                          className={cn(
                            'text-sm font-medium',
                            'mt-3 mb-1 first:mt-0'
                          )}
                        >
                          {children}
                        </h4>
                      ),

                      // Horizontal rule
                      hr: () => <hr className="my-4 border-border" />,

                      // Images
                      img: ({ src, alt }) => (
                        <img
                          src={src}
                          alt={alt || ''}
                          className={cn(
                            'max-w-full h-auto rounded-lg my-3',
                            'border'
                          )}
                        />
                      ),
                    }}
                  >
                    {cleanContent || ' '}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible thinking display - Claude/ChatGPT style
 * Collapsed by default, subtle appearance
 */
function ThinkingDisplay({
  thinking,
  isLoading,
}: {
  thinking: string;
  isLoading?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Estimate thinking time based on content length (rough approximation)
  const estimatedSeconds = Math.max(1, Math.round(thinking.length / 150));

  return (
    <div className="mb-2">
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
        {/* Sparkle/thinking icon */}
        <svg
          className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {isLoading ? (
            // Loading spinner
            <path d="M12 2v4m0 12v4m-7.07-14.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          ) : (
            // Sparkles icon (completed)
            <>
              <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
            </>
          )}
        </svg>

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

        {/* Expand/collapse chevron */}
        <svg
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            'opacity-0 group-hover:opacity-100',
            isExpanded && 'rotate-90'
          )}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Expandable thinking content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
        )}
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
      </div>
    </div>
  );
}

// Always re-render during streaming for live updates
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
  <div
    className="w-full animate-in fade-in duration-300 flex justify-start"
    data-role="assistant"
  >
    <div className="flex gap-3">
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center',
          'rounded-full bg-background ring-1 ring-border'
        )}
      >
        <div className="animate-pulse">
          <SparklesIcon size={12} />
        </div>
      </div>

      <div
        className={cn(
          'flex items-center gap-1',
          'text-muted-foreground text-sm'
        )}
      >
        <span className="animate-pulse">Thinking</span>
        <span className="inline-flex">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </div>
    </div>
  </div>
);
