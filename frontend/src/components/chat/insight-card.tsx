'use client';

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactBlock } from '@/lib/chat/types';
import { ReturnTable } from './return-table';
import { ReturnChart } from './return-chart';

interface InsightCardProps {
  title?: string;
  body?: string;
  hero?: { label: string; value: string };
  blocks: ArtifactBlock[];
  className?: string;
}

/**
 * Inline rich card rendered between assistant message text and the
 * follow-up suggestion chips. Mirrors the inspiration UI's
 * "AVERAGE RETURN / hero / callout / metric grid" layout but is
 * driven entirely by `ArtifactBlock`s so the same blocks can be
 * reused inside `<ArtifactPanel>` for the side-panel preview.
 */
export function InsightCard({
  title,
  body,
  hero,
  blocks,
  className,
}: InsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl border border-border/70 bg-background/60',
        'p-5 space-y-4 shadow-sm',
        className
      )}
    >
      {(title || hero) && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Average Return
            </div>
            {title && (
              <h3 className="text-base font-semibold leading-snug text-foreground">
                {title}
              </h3>
            )}
            {body && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            )}
          </div>
          {hero && (
            <div className="shrink-0 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                {hero.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">
                {hero.value}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block, idx) => (
          <BlockRenderer key={idx} block={block} />
        ))}
      </div>
    </motion.div>
  );
}

function BlockRenderer({ block }: { block: ArtifactBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-foreground/85">
          {block.text}
        </p>
      );
    case 'heading': {
      const sizes: Record<1 | 2 | 3, string> = {
        1: 'text-base font-semibold',
        2: 'text-sm font-semibold',
        3: 'text-xs font-semibold uppercase tracking-wide',
      };
      return (
        <div className={cn('text-foreground', sizes[block.level])}>
          {block.text}
        </div>
      );
    }
    case 'callout':
      return (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-lg p-3',
            'bg-muted/40 border border-border/40',
            'text-sm leading-relaxed text-foreground/85'
          )}
        >
          <Info
            size={14}
            className="mt-0.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span>{block.text}</span>
        </div>
      );
    case 'metricGrid':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {block.items.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="rounded-lg border border-border/50 bg-muted/20 p-3"
            >
              <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {item.value}
              </div>
              {item.hint && (
                <div className="mt-1 text-xs leading-snug text-muted-foreground">
                  {item.hint}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case 'returnTable':
      return <ReturnTable columns={block.columns} rows={block.rows} />;
    case 'returnChart':
      return <ReturnChart series={block.series} points={block.points} />;
    default:
      return null;
  }
}
