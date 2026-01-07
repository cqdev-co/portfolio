'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ListFilter } from 'lucide-react';

interface TableOfContentsProps {
  html: string;
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(html: string): Heading[] {
  if (!html) return [];

  // Create a temporary div to parse the HTML
  const div = document.createElement('div');
  div.innerHTML = html;

  // Find all headings (h2 and h3 only)
  const elements = div.querySelectorAll('h2, h3, h4');
  const headingsList: Heading[] = [];

  elements.forEach((el) => {
    const id = el.id;
    const text = el.textContent || '';
    const level = Number(el.tagName.substring(1));

    if (id && text) {
      headingsList.push({ id, text, level });
    }
  });

  return headingsList;
}

/**
 * Extracts headings from HTML content to generate a table of contents
 */
export default function TableOfContents({ html }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Extract headings using useMemo to avoid re-parsing on every render
  const headings = useMemo(() => extractHeadings(html), [html]);

  // Track active heading during scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      headings.forEach(({ id }) => {
        const element = document.getElementById(id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [headings]);

  if (headings.length < 2) {
    return null; // Don't show the TOC if there are fewer than 2 headings
  }

  // Count the number of visible sections
  const sectionCount = headings.filter((h) => h.level === 2).length;

  return (
    <div className="toc-container">
      <div className="flex items-center justify-between pb-2">
        <h2 className="flex items-center gap-1 m-0">
          <ListFilter className="size-3" />
          <span>CONTENTS</span>
          {sectionCount > 0 && (
            <span className="text-[0.6rem] opacity-60">{sectionCount}</span>
          )}
        </h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground/70 hover:text-foreground size-4 flex items-center justify-center rounded-sm hover:bg-secondary/50 transition-colors -mr-0.5"
          aria-label={
            isCollapsed
              ? 'Expand table of contents'
              : 'Collapse table of contents'
          }
        >
          {isCollapsed ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      </div>
      {!isCollapsed && (
        <nav aria-label="Table of contents" className="mt-1">
          <ul className="pt-0.5">
            {headings.map((heading) => (
              <li
                key={heading.id}
                className={cn(
                  heading.level === 3 && 'depth-3',
                  heading.level === 4 && 'depth-4'
                )}
              >
                <a
                  href={`#${heading.id}`}
                  className={cn(activeId === heading.id && 'active')}
                  aria-current={
                    activeId === heading.id ? 'location' : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(`#${heading.id}`)?.scrollIntoView({
                      behavior: 'smooth',
                    });
                    // Update URL hash without jumping
                    window.history.pushState(null, '', `#${heading.id}`);
                  }}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
