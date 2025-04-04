import BlurFade from "@/components/magicui/blur-fade";
import { getBlogPosts } from "@/data/blog";
import { formatDate, createMetadata, sortPostsByDate } from "@/lib/utils";
import Link from "next/link";
import CodeBlockEnhancer from "@/components/code-block";
import type { Metadata } from "next";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description: "My thoughts on software development, life, and more.",
  pageUrl: "/blog",
});

const BLUR_FADE_DELAY = 0.04;

export default async function BlogPage() {
  const posts = await getBlogPosts();
  const sortedPosts = sortPostsByDate(posts);

  return (
    <section className="max-w-3xl mx-auto">
      <CodeBlockEnhancer />
      
      <BlurFade delay={BLUR_FADE_DELAY}>
        <h1 className="font-medium text-2xl mb-8 tracking-tighter">blog</h1>
      </BlurFade>
      
      <div className="grid gap-6 md:gap-8">
        {sortedPosts.map((post, id) => (
          <BlurFade delay={BLUR_FADE_DELAY * 2 + id * 0.05} key={post.slug}>
            <Link
              className="block p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors duration-200"
              href={`/blog/${post.slug}`}
            >
              <div className="flex flex-col space-y-2">
                <h2 className="text-xl font-medium tracking-tight">{post.metadata.title}</h2>
                <p className="text-muted-foreground line-clamp-2">{post.metadata.summary}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                  <time dateTime={post.metadata.publishedAt}>
                    {formatDate(post.metadata.publishedAt)}
                  </time>
                  <span>•</span>
                  <span>{post.readingTime} min read</span>
                </div>
              </div>
            </Link>
          </BlurFade>
        ))}
      </div>
      {posts.length === 0 && (
        <p className="text-muted-foreground">No posts published yet. Check back soon!</p>
      )}
    </section>
  );
}
