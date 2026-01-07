import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { unified } from 'unified';

// Node types for rehype plugins
interface HastElement {
  type: 'element';
  tagName: string;
  properties: {
    className?: string[];
    [key: string]: unknown;
  };
  children: Array<HastElement | { type: 'text'; value: string }>;
}

// Used for TypeScript validation
export type Metadata = {
  title: string;
  publishedAt: string;
  summary: string;
  image?: string;
  tags?: string[];
};

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === '.mdx');
}

export async function markdownToHTML(markdown: string) {
  const p = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: true, // Pass HTML through
    })
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: {
        className: ['anchor'],
        ariaHidden: true,
        tabIndex: -1,
      },
      content: {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['anchor-icon'],
        },
        children: [],
      },
    })
    .use(rehypePrettyCode, {
      // Better code block styling
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },
      keepBackground: true,
      onVisitLine(node: HastElement) {
        // Prevent lines from collapsing
        if (node.children.length === 0) {
          node.children = [{ type: 'text', value: ' ' }];
        }
      },
      onVisitHighlightedLine(node: HastElement) {
        // Add highlighted line class
        if (!node.properties.className) {
          node.properties.className = [];
        }
        node.properties.className.push('highlighted');
      },
      onVisitHighlightedWord(node: HastElement) {
        // Add highlighted word class
        node.properties.className = ['word'];
      },
    } as unknown as Parameters<typeof rehypePrettyCode>[0]) // Type assertion with more specific type
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return p.toString();
}

// Calculate reading time in minutes
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  const readingTime = Math.ceil(words / wordsPerMinute);
  return Math.max(1, readingTime); // Minimum 1 minute
}

export async function getPost(slug: string) {
  const filePath = path.join('content', `${slug}.mdx`);
  const source = fs.readFileSync(filePath, 'utf-8');
  const { content: rawContent, data: metadata } = matter(source);
  const content = await markdownToHTML(rawContent);
  const readingTime = calculateReadingTime(rawContent);

  return {
    source: content,
    rawContent, // Keep raw markdown for proper component rendering
    metadata,
    slug,
    readingTime,
  };
}

async function getAllPosts(dir: string) {
  const mdxFiles = getMDXFiles(dir);
  return Promise.all(
    mdxFiles.map(async (file) => {
      const slug = path.basename(file, path.extname(file));
      const { metadata, source, rawContent, readingTime } = await getPost(slug);
      return {
        metadata,
        slug,
        source,
        rawContent,
        readingTime,
      };
    })
  );
}

export async function getBlogPosts() {
  return getAllPosts(path.join(process.cwd(), 'content'));
}
