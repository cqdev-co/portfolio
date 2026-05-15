'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SuggestionChip } from '@/lib/chat/types';

interface SuggestionChipsProps {
  chips: SuggestionChip[];
  onSelect: (prompt: string) => void;
  className?: string;
}

/**
 * Post-reply "Try Next" pill row driven by `data-suggestions` parts.
 * Each chip wears a slash-command prefix (`/pdf`, `/deck`, `/mail`,
 * `/compare`, `/table`) — visual shorthand for the action — and a
 * short label. Clicking sends the underlying prompt back through
 * `useChat`'s `sendMessage`.
 */
export function SuggestionChips({
  chips,
  onSelect,
  className,
}: SuggestionChipsProps) {
  if (chips.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl border border-border/60 bg-muted/30',
        'p-3 space-y-2',
        className
      )}
    >
      <div className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Try Next
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, idx) => (
          <button
            key={`${chip.slash}-${idx}`}
            type="button"
            onClick={() => onSelect(chip.prompt)}
            className={cn(
              'group inline-flex items-center gap-2 rounded-full',
              'border border-border/60 bg-background/70',
              'px-3 py-1.5 text-xs',
              'hover:border-primary/40 hover:bg-background',
              'transition-colors'
            )}
          >
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] font-medium',
                'bg-primary/10 text-primary'
              )}
            >
              /{chip.slash}
            </span>
            <span className="text-foreground/85 group-hover:text-foreground">
              {chip.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
