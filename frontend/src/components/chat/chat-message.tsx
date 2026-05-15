'use client';

import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  RegenerateIcon,
} from './chat-icons';
import { ToolCallCard, type ToolCall } from './tool-call-card';
import { TypewriterText } from './typewriter-text';
import { CoverageStrip } from './coverage-strip';
import { RiskGateStrip } from './risk-gate-strip';
import { ThinkingBlock } from './thinking-block';
import { ArtifactCard } from './artifact-card';
import { SuggestionChips } from './suggestion-chips';
import { useChatArtifacts } from './artifact-context';
import { renderTickerInline } from './ticker-chip';
import type {
  XyloUIMessage,
  ThinkingStep,
  ArtifactPayload,
  SuggestionsPayload,
} from '@/lib/chat/types';
import type { CoverageReportPayload } from './coverage-strip';
import type { RiskGatePayload } from './risk-gate-strip';

type ChatMessageProps = {
  message: XyloUIMessage;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onSuggestion?: (prompt: string) => void;
};

/**
 * Walks `message.parts` once and projects them into the discrete UI
 * surfaces the chat renders. Parts are typed via `XyloUIMessage`, so
 * the discrimination is exhaustive and we never fall back to regex
 * parsing on text deltas.
 */
function useMessageProjection(message: XyloUIMessage) {
  return useMemo(() => {
    const parts = message.parts ?? [];

    let text = '';
    let reasoningText = '';
    const thinkingStepsMap = new Map<string, ThinkingStep>();
    const toolCalls: ToolCall[] = [];
    const toolCallsById = new Map<string, ToolCall>();

    let coverageData: CoverageReportPayload | null = null;
    let riskGateData: RiskGatePayload | null = null;
    let artifactPart: ArtifactPayload | null = null;
    let suggestionsData: SuggestionsPayload | null = null;

    for (const part of parts) {
      switch (part.type) {
        case 'text': {
          text += part.text;
          break;
        }
        case 'reasoning': {
          reasoningText += part.text;
          break;
        }
        case 'data-thinkingStep': {
          const step = part.data;
          // Replace any prior step with the same id to support
          // running → done transitions.
          thinkingStepsMap.set(step.stepId, step);
          break;
        }
        case 'data-coverage': {
          coverageData = part.data;
          break;
        }
        case 'data-riskGate': {
          riskGateData = part.data;
          break;
        }
        case 'data-artifact': {
          artifactPart = part.data;
          break;
        }
        case 'data-suggestions': {
          suggestionsData = part.data;
          break;
        }
        case 'dynamic-tool': {
          // Convert the SDK's discriminated tool part into our
          // existing ToolCall shape so `<ToolCallCard>` can keep
          // rendering against a stable contract.
          const tc = toolCallFromDynamicPart(part);
          if (toolCallsById.has(tc.id)) {
            const existing = toolCallsById.get(tc.id)!;
            const merged: ToolCall = { ...existing, ...tc };
            toolCallsById.set(tc.id, merged);
            const idx = toolCalls.findIndex((x) => x.id === tc.id);
            if (idx >= 0) toolCalls[idx] = merged;
          } else {
            toolCallsById.set(tc.id, tc);
            toolCalls.push(tc);
          }
          break;
        }
        default:
          // Static tool parts (`tool-<name>`) follow the same shape;
          // forward them to the same converter when we ever wire
          // `static` UITools into the route.
          if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
            const tc = toolCallFromStaticPart(
              part as unknown as StaticToolPart
            );
            if (toolCallsById.has(tc.id)) {
              const existing = toolCallsById.get(tc.id)!;
              const merged: ToolCall = { ...existing, ...tc };
              toolCallsById.set(tc.id, merged);
              const idx = toolCalls.findIndex((x) => x.id === tc.id);
              if (idx >= 0) toolCalls[idx] = merged;
            } else {
              toolCallsById.set(tc.id, tc);
              toolCalls.push(tc);
            }
          }
          break;
      }
    }

    return {
      text: text.trim(),
      reasoningText,
      thinkingSteps: Array.from(thinkingStepsMap.values()),
      toolCalls,
      coverage: coverageData,
      riskGate: riskGateData,
      artifact: artifactPart,
      suggestions: suggestionsData,
    };
  }, [message]);
}

type DynamicToolPart = Extract<
  XyloUIMessage['parts'][number],
  { type: 'dynamic-tool' }
>;

interface StaticToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function toolCallFromDynamicPart(part: DynamicToolPart): ToolCall {
  const args = (part.input as Record<string, unknown> | undefined) ?? {};
  const base: ToolCall = {
    id: part.toolCallId,
    tool: part.toolName,
    args,
    status: 'running',
  };
  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
      base.status = 'running';
      return base;
    case 'output-available':
      return { ...base, status: 'complete', result: part.output };
    case 'output-error':
      return {
        ...base,
        status: 'error',
        error: part.errorText || 'Tool execution failed',
      };
    default:
      return base;
  }
}

function toolCallFromStaticPart(part: StaticToolPart): ToolCall {
  const toolName = part.type.replace(/^tool-/, '');
  const args = (part.input as Record<string, unknown> | undefined) ?? {};
  const base: ToolCall = {
    id: part.toolCallId,
    tool: toolName,
    args,
    status: 'running',
  };
  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
      return base;
    case 'output-available':
      return { ...base, status: 'complete', result: part.output };
    case 'output-error':
      return {
        ...base,
        status: 'error',
        error: part.errorText || 'Tool execution failed',
      };
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Inline renderer for assistant text — replaces standalone tickers with
// `<TickerChip>` pills while leaving everything else to TypewriterText.
// ---------------------------------------------------------------------------

function AssistantText({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming?: boolean;
}) {
  // Only render the chip-decorated overlay once streaming finishes,
  // so the typewriter effect can run cleanly during streaming
  // without per-frame re-tokenisation.
  if (isStreaming) {
    return <TypewriterText content={text} isStreaming speed={4} />;
  }
  return (
    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
      {renderTickerInline(text, 'assistant')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function PureChatMessage({
  message,
  isLoading,
  onRegenerate,
  onSuggestion,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const projection = useMessageProjection(message);
  const { registerArtifact } = useChatArtifacts();
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Side effect: register streamed artifacts with the panel registry.
  useEffect(() => {
    if (projection.artifact) {
      registerArtifact(projection.artifact);
    }
  }, [projection.artifact, registerArtifact]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(projection.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [projection.text]);

  const hasContent = projection.text.length > 0;
  const hasThinking =
    projection.reasoningText.length > 0 || projection.thinkingSteps.length > 0;
  const hasTools = projection.toolCalls.length > 0;
  const hasCoverage = !!projection.coverage;
  const hasRiskGate =
    !!projection.riskGate && !projection.riskGate.gate_skipped;
  const hasArtifact = !!projection.artifact;
  const hasSuggestions =
    !!projection.suggestions && projection.suggestions.chips.length > 0;

  if (
    !hasContent &&
    !isLoading &&
    !hasTools &&
    !hasThinking &&
    !hasCoverage &&
    !hasRiskGate &&
    !hasArtifact &&
    !hasSuggestions
  ) {
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
              {projection.text}
            </p>
          ) : (
            <div className="space-y-3">
              {hasCoverage && projection.coverage && (
                <CoverageStrip coverage={projection.coverage} />
              )}

              {hasRiskGate && projection.riskGate && (
                <RiskGateStrip verdict={projection.riskGate} />
              )}

              {hasThinking && (
                <ThinkingBlock
                  reasoningText={projection.reasoningText}
                  steps={projection.thinkingSteps}
                  isLoading={isLoading}
                />
              )}

              {hasTools && (
                <div className="space-y-2">
                  {projection.toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}

              {hasContent && (
                <AssistantText text={projection.text} isStreaming={isLoading} />
              )}

              {hasArtifact && projection.artifact && (
                <ArtifactCard artifact={projection.artifact} />
              )}

              {hasSuggestions && projection.suggestions && (
                <SuggestionChips
                  chips={projection.suggestions.chips}
                  onSelect={(prompt) => onSuggestion?.(prompt)}
                />
              )}

              {hasContent && !isLoading && (
                <div
                  className={cn(
                    'flex items-center gap-1 pt-1',
                    'transition-opacity duration-150',
                    isHovered ? 'opacity-100' : 'opacity-0'
                  )}
                >
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

export const ChatMessage = memo(PureChatMessage, (prev, next) => {
  if (prev.isLoading || next.isLoading) {
    return false;
  }
  return (
    prev.message.id === next.message.id &&
    prev.message.parts?.length === next.message.parts?.length
  );
});

// Loading indicator shown while the request is in flight but the
// stream hasn't started producing parts yet.
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
