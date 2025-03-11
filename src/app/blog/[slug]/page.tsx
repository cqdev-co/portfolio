import { getBlogPosts, getPost } from "@/data/blog";
import { DATA } from "@/data/resume";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import BlurFade from "@/components/magicui/blur-fade";
import { Clock } from "lucide-react";
import TableOfContents from "@/components/toc";
import CodeBlockEnhancer from "@/components/code-block";
import Script from "next/script";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: {
    slug: string;
  };
}): Promise<Metadata | undefined> {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  const {
    title,
    publishedAt: publishedTime,
    summary: description,
    image,
  } = post.metadata;
  const ogImage = image ? `${DATA.url}${image}` : `${DATA.url}/og?title=${title}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      url: `${DATA.url}/blog/${post.slug}`,
      images: [
        {
          url: ogImage,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function Blog({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  // Get all posts for adjacent post navigation
  const allPosts = await getBlogPosts();
  const sortedPosts = allPosts.sort((a, b) => {
    if (new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)) {
      return -1;
    }
    return 1;
  });

  const currentPostIndex = sortedPosts.findIndex(p => p.slug === post.slug);
  const previousPost = currentPostIndex < sortedPosts.length - 1 ? sortedPosts[currentPostIndex + 1] : null;
  const nextPost = currentPostIndex > 0 ? sortedPosts[currentPostIndex - 1] : null;

  return (
    <>
      <Script
        id="schema-article"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.metadata.title,
            description: post.metadata.summary,
            image: post.metadata.image ? `${DATA.url}${post.metadata.image}` : `${DATA.url}/og?title=${post.metadata.title}`,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.updatedAt || post.metadata.publishedAt,
            author: {
              "@type": "Person",
              name: "Conor Quinlan",
              url: DATA.url
            },
            publisher: {
              "@type": "Person",
              name: "Conor Quinlan",
              url: DATA.url
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `${DATA.url}/blog/${post.slug}`
            }
          })
        }}
      />
      
      <CodeBlockEnhancer />

      <BlurFade>
        <div className="mb-8">
          <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            <span>Back to all posts</span>
          </Link>
        </div>
      </BlurFade>

      <article className="max-w-2xl mx-auto">
        <BlurFade delay={0.1}>
          <header className="mb-6">
            <h1 className="title font-medium text-3xl md:text-4xl tracking-tighter mb-4">
              {post.metadata.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                <Suspense fallback={<span className="h-5" />}>
                  <time dateTime={post.metadata.publishedAt}>
                    {formatDate(post.metadata.publishedAt)}
                  </time>
                </Suspense>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{post.readingTime} min read</span>
              </div>
            </div>
          </header>
        </BlurFade>

        {/* Mobile Table of Contents - only visible on small screens */}
        <BlurFade delay={0.15} className="lg:hidden mb-3">
          <TableOfContents html={post.source} />
        </BlurFade>

        <div className="grid grid-cols-1 lg:grid-cols-[auto_240px] gap-10">
          <BlurFade delay={0.2}>
            <div className="prose dark:prose-invert">
              <div dangerouslySetInnerHTML={{ __html: post.source }} />
            </div>
          </BlurFade>
          
          <BlurFade delay={0.2}>
            <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
              <TableOfContents html={post.source} />
            </div>
          </BlurFade>
        </div>

        <BlurFade delay={0.3}>
          <div className="mt-16 grid gap-4 md:grid-cols-2 border-t pt-6">
            {previousPost && (
              <Link href={`/blog/${previousPost.slug}`} className="group p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                  <span>Previous post</span>
                </div>
                <div className="font-medium group-hover:text-foreground transition-colors">
                  {previousPost.metadata.title}
                </div>
              </Link>
            )}
            {nextPost && (
              <Link href={`/blog/${nextPost.slug}`} className="group p-4 border rounded-lg hover:bg-secondary/50 transition-colors text-right">
                <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground mb-2">
                  <span>Next post</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="m5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
                <div className="font-medium group-hover:text-foreground transition-colors">
                  {nextPost.metadata.title}
                </div>
              </Link>
            )}
          </div>
        </BlurFade>
      </article>
    </>
  );
}
