"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TableOfContentsProps {
  html: string;
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * Extracts headings from HTML content to generate a table of contents
 */
export default function TableOfContents({ html }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Extract headings from the HTML content
  useEffect(() => {
    if (!html) return;

    // Create a temporary div to parse the HTML
    const div = document.createElement("div");
    div.innerHTML = html;

    // Find all headings (h2 and h3 only)
    const elements = div.querySelectorAll("h2, h3, h4");
    const headingsList: Heading[] = [];

    elements.forEach((el) => {
      const id = el.id;
      const text = el.textContent || "";
      const level = Number(el.tagName.substring(1)); // Get the heading level (2 or 3)

      if (id && text) {
        headingsList.push({ id, text, level });
      }
    });

    setHeadings(headingsList);
  }, [html]);

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
      { rootMargin: "-100px 0px -80% 0px" }
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

  return (
    <div className="toc-container">
      <h2>Table of Contents</h2>
      <nav>
        <ul>
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={cn(
                heading.level === 3 && "depth-3",
                heading.level === 4 && "depth-4"
              )}
            >
              <a
                href={`#${heading.id}`}
                className={cn(
                  activeId === heading.id && "active"
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
} 