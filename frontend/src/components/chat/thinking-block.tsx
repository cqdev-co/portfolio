'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ThinkingStep } from '@/lib/chat/types';

interface ThinkingBlockProps {
  /** Streamed reasoning text from the model (may be empty). */
  reasoningText?: string;
  /** Plan-narration steps surfaced as bullets above the reasoning. */
  steps: ThinkingStep[];
  /** True while the assistant is still streaming. Drives "Thinking…" + spinner. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Collapsible "thinking" surface — replaces the marker-driven
 * `ThinkingDisplay` with a part-driven version. While streaming, the
 * header reads "Thinking…" with a pulsing dot and the body shows the
 * latest plan-step inline; once the assistant text starts (or the
 * thinking finishes) it collapses to "Thought for Xs". Expanding
 * reveals every plan step plus the raw reasoning content.
 */
export function ThinkingBlock({
  reasoningText,
  steps,
  isLoading,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  // Track the first time we have any thinking content; freeze the
  // elapsed value the moment streaming flips to false.
  useEffect(() => {
    if (
      startedAtRef.current === null &&
      ((reasoningText && reasoningText.length > 0) || steps.length > 0)
    ) {
      startedAtRef.current = Date.now();
    }
  }, [reasoningText, steps.length]);

  useEffect(() => {
    if (!isLoading && startedAtRef.current !== null && elapsed === null) {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(Math.max(0.1, seconds));
    }
  }, [isLoading, elapsed]);

  const lastRunningStep = useMemo(
    () => [...steps].reverse().find((s) => s.status === 'running'),
    [steps]
  );

  const headerLabel = isLoading
    ? 'Thinking'
    : elapsed != null
      ? `Thought for ${elapsed.toFixed(1)}s`
      : 'Thought';

  if (!reasoningText && steps.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={cn(
          'group flex items-center gap-2',
          'text-xs text-muted-foreground/80 hover:text-muted-foreground',
          'py-1 transition-colors'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex size-1.5 rounded-full',
            isLoading ? 'bg-primary animate-pulse' : 'bg-emerald-500'
          )}
        />
        <span className="font-medium">
          {headerLabel}
          {isLoading && (
            <span className="ml-0.5 inline-flex">
              <span className="animate-[bounce_1s_infinite_0ms]">.</span>
              <span className="animate-[bounce_1s_infinite_200ms]">.</span>
              <span className="animate-[bounce_1s_infinite_400ms]">.</span>
            </span>
          )}
        </span>
        <ChevronRight
          size={12}
          className={cn(
            'opacity-50 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* When collapsed but still streaming, show the latest active step */}
      {!isExpanded && isLoading && lastRunningStep && (
        <div className="ml-3 pl-2 text-xs text-muted-foreground/70 border-l border-border/40">
          {lastRunningStep.label}
        </div>
      )}

      <AnimatePresence initial={false}>
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
                'mt-2 ml-2 pl-3 space-y-2',
                'border-l-2 border-border/40'
              )}
            >
              {steps.length > 0 && (
                <ul className="space-y-1.5">
                  {steps.map((step) => (
                    <li
                      key={step.stepId}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full',
                          step.status === 'done'
                            ? 'text-emerald-600'
                            : 'text-muted-foreground/60'
                        )}
                      >
                        {step.status === 'done' ? (
                          <Check size={12} strokeWidth={2.5} />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current animate-pulse" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground/85">{step.label}</div>
                        {step.detail && (
                          <div className="text-[11px] text-muted-foreground/70">
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {reasoningText && (
                <div
                  className={cn(
                    'text-[11px] leading-relaxed text-muted-foreground/70',
                    'whitespace-pre-wrap break-words',
                    'max-h-[280px] overflow-y-auto'
                  )}
                >
                  {reasoningText}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
