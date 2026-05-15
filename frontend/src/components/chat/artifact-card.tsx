'use client';

import { motion } from 'framer-motion';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactPayload } from '@/lib/chat/types';
import { useChatArtifacts } from './artifact-context';

interface ArtifactCardProps {
  artifact: ArtifactPayload;
}

/**
 * Inline placeholder rendered inside the message thread. Acts as the
 * entry point into the side-panel `<ArtifactPanel>` — clicking
 * "Open" expands the artifact in the right-hand drawer; "Export"
 * triggers a (stubbed) PDF export.
 */
export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const { openArtifact } = useChatArtifacts();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border border-border/70 bg-background/70',
        'p-4 flex items-start gap-3'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center',
          'rounded-lg bg-primary/10 text-primary'
        )}
      >
        <FileText size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Generated Artifact
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {artifact.filename}
        </div>
        {artifact.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {artifact.summary}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => exportPdfStub(artifact)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full',
            'border border-border/60 bg-background',
            'px-3 py-1.5 text-xs font-medium',
            'text-foreground hover:bg-muted',
            'transition-colors'
          )}
        >
          <Download size={12} />
          Export PDF
        </button>
        <button
          type="button"
          onClick={() => openArtifact(artifact.artifactId)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full',
            'bg-foreground text-background',
            'px-3 py-1.5 text-xs font-medium',
            'hover:bg-foreground/90 transition-colors'
          )}
        >
          <ExternalLink size={12} />
          Open
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Stub exporter — real PDF generation is intentionally out of scope
 * for this iteration. We download a JSON snapshot of the artifact so
 * the wiring is testable end-to-end without bringing in a renderer.
 */
function exportPdfStub(artifact: ArtifactPayload) {
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
