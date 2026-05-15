'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

type MermaidDiagramProps = {
  source: string;
  className?: string;
};

export function MermaidDiagram({ source, className }: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme();
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          // 'loose' lets us use <br/> for line breaks inside node labels.
          // Safe here because MDX content is author-controlled, not user input.
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        // Mermaid requires DOM-safe IDs (no colons from React's useId).
        const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const { svg: rendered } = await mermaid.render(renderId, source);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to render diagram'
          );
          setSvg(null);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [source, resolvedTheme, reactId]);

  if (error) {
    return (
      <div className={cn('my-6', className)}>
        <pre className="rounded-lg border bg-secondary/50 p-4 overflow-x-auto text-xs">
          <code>{source}</code>
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Diagram failed to render: {error}
        </p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          'my-6 rounded-lg border bg-secondary/30 p-4 text-xs text-muted-foreground',
          className
        )}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'my-6 flex justify-center overflow-x-auto rounded-lg border bg-secondary/30 p-4 [&_svg]:max-w-full [&_svg]:h-auto',
        className
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
