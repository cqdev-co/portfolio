import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  sortPostsByDate,
  filterPostsByTag,
  getAllTags,
} from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const showHidden = false;
    const showVisible = true;
    expect(cn('base', showHidden && 'hidden', showVisible && 'visible')).toBe(
      'base visible'
    );
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('formatDate', () => {
  it('returns "Today" for current date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(formatDate(today)).toBe('Today');
  });

  it('formats dates with relative time', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const dateStr = pastDate.toISOString().split('T')[0];
    const result = formatDate(dateStr);
    expect(result).toContain('3d ago');
  });

  it('shows weeks ago for dates 7-30 days old', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14);
    const dateStr = pastDate.toISOString().split('T')[0];
    const result = formatDate(dateStr);
    expect(result).toContain('2w ago');
  });
});

describe('sortPostsByDate', () => {
  it('sorts posts by date (newest first)', () => {
    const posts = [
      { metadata: { publishedAt: '2024-01-01' } },
      { metadata: { publishedAt: '2024-06-15' } },
      { metadata: { publishedAt: '2024-03-10' } },
    ];

    const sorted = sortPostsByDate(posts);

    expect(sorted[0].metadata.publishedAt).toBe('2024-06-15');
    expect(sorted[1].metadata.publishedAt).toBe('2024-03-10');
    expect(sorted[2].metadata.publishedAt).toBe('2024-01-01');
  });

  it('handles posts without dates', () => {
    const posts = [
      { metadata: { publishedAt: '2024-01-01' } },
      { metadata: {} },
    ];

    const sorted = sortPostsByDate(posts);
    expect(sorted[0].metadata.publishedAt).toBe('2024-01-01');
  });
});

describe('filterPostsByTag', () => {
  const posts = [
    { metadata: { tags: ['react', 'typescript'] } },
    { metadata: { tags: ['python', 'machine-learning'] } },
    { metadata: { tags: ['react', 'nextjs'] } },
  ];

  it('filters posts by tag', () => {
    const filtered = filterPostsByTag(posts, 'react');
    expect(filtered).toHaveLength(2);
  });

  it('returns all posts when tag is empty', () => {
    const filtered = filterPostsByTag(posts, '');
    expect(filtered).toHaveLength(3);
  });

  it('is case insensitive', () => {
    const filtered = filterPostsByTag(posts, 'REACT');
    expect(filtered).toHaveLength(2);
  });
});

describe('getAllTags', () => {
  it('extracts unique tags from posts', () => {
    const posts = [
      { metadata: { tags: ['react', 'typescript'] } },
      { metadata: { tags: ['react', 'nextjs'] } },
    ];

    const tags = getAllTags(posts);

    expect(tags).toHaveLength(3);
    expect(tags).toContain('react');
    expect(tags).toContain('typescript');
    expect(tags).toContain('nextjs');
  });

  it('returns sorted tags', () => {
    const posts = [{ metadata: { tags: ['zebra', 'apple'] } }];

    const tags = getAllTags(posts);
    expect(tags[0]).toBe('apple');
    expect(tags[1]).toBe('zebra');
  });

  it('handles posts without tags', () => {
    const posts = [{ metadata: {} }];
    const tags = getAllTags(posts);
    expect(tags).toHaveLength(0);
  });
});
