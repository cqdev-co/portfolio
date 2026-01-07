import BlurFade from '@/components/magicui/blur-fade';
import { getBlogPosts } from '@/data/blog';
import {
  formatDate,
  createMetadata,
  sortPostsByDate,
  filterPostsByTag,
  getAllTags,
} from '@/lib/utils';
import Link from 'next/link';
import CodeBlockEnhancer from '@/components/code-block';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { BlogFilter } from '../../components/blog-filter';

export const metadata: Metadata = createMetadata({
  title: 'Blog',
  description: 'My thoughts on software development, life, and more.',
  pageUrl: '/blog',
});

const BLUR_FADE_DELAY = 0.04;

async function BlogPageContent({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const posts = await getBlogPosts();
  const sortedPosts = sortPostsByDate(posts);
  const allTags = getAllTags(posts);

  const params = await searchParams;
  const selectedTag = params.tag;
  const filteredPosts = selectedTag
    ? filterPostsByTag(sortedPosts, selectedTag)
    : sortedPosts;

  return (
    <section className="max-w-3xl mx-auto">
      <CodeBlockEnhancer />

      <BlurFade delay={BLUR_FADE_DELAY}>
        <h1 className="font-medium text-2xl mb-8 tracking-tighter">blog</h1>
      </BlurFade>

      <BlurFade delay={BLUR_FADE_DELAY * 1.5}>
        <BlogFilter allTags={allTags} selectedTag={selectedTag} />
      </BlurFade>

      {selectedTag && (
        <BlurFade delay={BLUR_FADE_DELAY * 2}>
          <div className="mb-6 p-4 bg-secondary/30 rounded-lg border">
            <div className="text-sm text-muted-foreground">
              Showing posts tagged with{' '}
              <Badge variant="secondary" className="mx-1">
                {selectedTag}
              </Badge>
              ({filteredPosts.length} result
              {filteredPosts.length !== 1 ? 's' : ''})
            </div>
          </div>
        </BlurFade>
      )}

      <div className="grid gap-6 md:gap-8">
        {filteredPosts.map((post, id) => (
          <BlurFade delay={BLUR_FADE_DELAY * 2.5 + id * 0.05} key={post.slug}>
            <Link
              className="block p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors duration-200"
              href={`/blog/${post.slug}`}
            >
              <div className="flex flex-col space-y-2">
                <h2 className="text-xl font-medium tracking-tight">
                  {post.metadata.title}
                </h2>
                <p className="text-muted-foreground line-clamp-2">
                  {post.metadata.summary}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <time dateTime={post.metadata.publishedAt}>
                      {formatDate(post.metadata.publishedAt)}
                    </time>
                    <span>•</span>
                    <span>{post.readingTime} min read</span>
                  </div>
                  {post.metadata.tags && post.metadata.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {post.metadata.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {post.metadata.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{post.metadata.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </BlurFade>
        ))}
      </div>
      {filteredPosts.length === 0 && selectedTag && (
        <p className="text-muted-foreground">
          No posts found with the tag &ldquo;{selectedTag}&rdquo;. Try a
          different tag or view all posts.
        </p>
      )}
      {posts.length === 0 && (
        <p className="text-muted-foreground">
          No posts published yet. Check back soon!
        </p>
      )}
    </section>
  );
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BlogPageContent searchParams={searchParams} />
    </Suspense>
  );
}
