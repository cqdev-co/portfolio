'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactBlock, ArtifactPayload } from '@/lib/chat/types';
import { useChatArtifacts } from './artifact-context';
import { ReturnTable } from './return-table';
import { ReturnChart } from './return-chart';

/**
 * Right-side slide-in drawer that renders the active artifact. The
 * panel reads `openArtifactId` and the registry of artifacts from
 * `<ChatArtifactProvider>`. Closing returns focus to the message
 * thread; the surrounding chat layout reclaims the freed horizontal
 * space.
 */
export function ArtifactPanel() {
  const { artifacts, openArtifactId, closeArtifact } = useChatArtifacts();
  const artifact = openArtifactId ? artifacts[openArtifactId] : null;

  return (
    <AnimatePresence>
      {artifact && (
        <motion.aside
          key={artifact.artifactId}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex h-full w-full max-w-[520px] shrink-0 flex-col',
            'border-l border-border/60 bg-background/95 backdrop-blur-sm'
          )}
          aria-label="Artifact preview"
        >
          <ArtifactPanelHeader
            artifact={artifact}
            onClose={() => closeArtifact()}
          />
          <ArtifactPanelBody artifact={artifact} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ArtifactPanelHeader({
  artifact,
  onClose,
}: {
  artifact: ArtifactPayload;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        'border-b border-border/60 px-5 py-4'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5',
              'bg-primary/10 text-primary',
              'text-[10px] font-semibold uppercase tracking-wider'
            )}
          >
            {artifact.kind} preview
          </span>
          {artifact.generatedAt && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {new Date(artifact.generatedAt).toLocaleDateString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Generated Artifact
        </div>
        <h2 className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {artifact.filename}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => void downloadStub(artifact)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full',
            'border border-border/60 bg-background',
            'px-3 py-1.5 text-xs font-medium',
            'hover:bg-muted transition-colors'
          )}
        >
          <Download size={12} />
          Export PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'transition-colors'
          )}
          aria-label="Close artifact preview"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ArtifactPanelBody({ artifact }: { artifact: ArtifactPayload }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold leading-tight text-foreground">
          {artifact.title}
        </h1>

        {artifact.summary && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {artifact.summary}
          </p>
        )}

        {artifact.hero && (
          <div
            className={cn(
              'rounded-xl border border-border/60 bg-muted/30',
              'flex items-center justify-between gap-4 px-4 py-3'
            )}
          >
            <div className="min-w-0">
              <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Executive Summary
              </div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">
                {artifact.hero.label}
              </div>
            </div>
            <div className="shrink-0 rounded-lg bg-background px-3 py-2 text-sm font-semibold text-foreground">
              {artifact.hero.value}
            </div>
          </div>
        )}

        {artifact.keyTakeaways && artifact.keyTakeaways.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Key Takeaways
            </div>
            <ul className="space-y-1.5">
              {artifact.keyTakeaways.map((t, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm leading-relaxed text-foreground/85"
                >
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {artifact.blocks.map((block, idx) => (
            <PanelBlock key={idx} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelBlock({ block }: { block: ArtifactBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-foreground/85">
          {block.text}
        </p>
      );
    case 'heading': {
      const sizes: Record<1 | 2 | 3, string> = {
        1: 'text-lg font-semibold',
        2: 'text-base font-semibold',
        3: 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground',
      };
      return <div className={sizes[block.level]}>{block.text}</div>;
    }
    case 'callout':
      return (
        <div
          className={cn(
            'rounded-lg border border-border/50 bg-muted/30',
            'px-4 py-3 text-sm leading-relaxed text-foreground/85'
          )}
        >
          {block.text}
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

function downloadStub(artifact: ArtifactPayload) {
  const blob = new Blob([JSON.stringify(artifact, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.filename.replace(/\.pdf$/i, '.json');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
