'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TypewriterTextProps {
  content: string;
  isStreaming?: boolean;
  speed?: number; // chars per frame
  className?: string;
}

/**
 * Typewriter effect for text content.
 * During streaming: shows content as it arrives (no artificial delay)
 * After streaming: reveals any remaining content with typewriter effect
 */
export function TypewriterText({
  content,
  isStreaming = false,
  speed = 3,
  className,
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const prevContentRef = useRef('');
  const animationRef = useRef<number | null>(null);

  // Track how much content we've "committed" to showing
  const committedLength = useRef(0);

  // Animation callback - safe to call setState since it's async via rAF
  const startAnimation = useCallback(
    (startPos: number, targetLength: number) => {
      let currentPos = startPos;

      const animate = () => {
        currentPos = Math.min(currentPos + speed, targetLength);
        setDisplayedLength(currentPos);

        if (currentPos < targetLength) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          committedLength.current = targetLength;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [speed]
  );

  // Handle content and streaming state changes
  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Reset when content shrinks significantly (new message)
    if (content.length < prevContentRef.current.length * 0.5) {
      committedLength.current = 0;
    }
    prevContentRef.current = content;

    if (isStreaming) {
      // During streaming, commit immediately - rAF handles the setState
      committedLength.current = content.length;
      animationRef.current = requestAnimationFrame(() => {
        setDisplayedLength(content.length);
      });
      return;
    }

    const newContentStart = committedLength.current;
    const targetLength = content.length;

    if (newContentStart >= targetLength) {
      // No new content to animate - use rAF to avoid sync setState
      animationRef.current = requestAnimationFrame(() => {
        setDisplayedLength(targetLength);
      });
      return;
    }

    // Animate from committed position to end
    startAnimation(newContentStart, targetLength);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, isStreaming, startAnimation]);

  const displayedContent = content.slice(0, displayedLength);
  const isTyping = displayedLength < content.length;

  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-foreground',
        'prose-container',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes('language-');
            if (isBlock) {
              return <code className="text-xs font-mono">{children}</code>;
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
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50 border-b">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y">{children}</tbody>
          ),
          tr: ({ children }) => <tr className="divide-x">{children}</tr>,
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
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="line-through opacity-70">{children}</del>
          ),
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
          h1: ({ children }) => (
            <h1
              className={cn('text-base font-semibold', 'mt-4 mb-2 first:mt-0')}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn('text-sm font-semibold', 'mt-4 mb-2 first:mt-0')}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn('text-sm font-semibold', 'mt-3 mb-1.5 first:mt-0')}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={cn('text-sm font-medium', 'mt-3 mb-1 first:mt-0')}>
              {children}
            </h4>
          ),
          hr: () => <hr className="my-4 border-border" />,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ''}
              className={cn('max-w-full h-auto rounded-lg my-3', 'border')}
            />
          ),
        }}
      >
        {displayedContent || ' '}
      </ReactMarkdown>

      {/* Cursor */}
      {(isStreaming || isTyping) && (
        <motion.span
          className="inline-block ml-0.5 text-muted-foreground"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        >
          ▋
        </motion.span>
      )}
    </div>
  );
}
