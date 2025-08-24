import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { DATA } from "@/data/resume";
import { Metadata } from "next";

// Better typing for blog posts
export interface BlogPost {
  metadata: {
    publishedAt: string;
    title?: string;
    summary?: string;
    image?: string;
    updatedAt?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  slug: string;
  source?: string;
  readingTime?: number;
  [key: string]: unknown;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
  const currentDate = new Date().getTime();
  if (!date.includes("T")) {
    date = `${date}T00:00:00`;
  }
  const targetDate = new Date(date).getTime();
  const timeDifference = Math.abs(currentDate - targetDate);
  const daysAgo = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

  const fullDate = new Date(date).toLocaleString("en-us", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (daysAgo < 1) {
    return "Today";
  } else if (daysAgo < 7) {
    return `${fullDate} (${daysAgo}d ago)`;
  } else if (daysAgo < 30) {
    const weeksAgo = Math.floor(daysAgo / 7);
    return `${fullDate} (${weeksAgo}w ago)`;
  } else if (daysAgo < 365) {
    const monthsAgo = Math.floor(daysAgo / 30);
    return `${fullDate} (${monthsAgo}mo ago)`;
  } else {
    const yearsAgo = Math.floor(daysAgo / 365);
    return `${fullDate} (${yearsAgo}y ago)`;
  }
}

/**
 * Sort blog posts by date (newest first)
 */
export function sortPostsByDate<T extends { metadata: { publishedAt?: string } }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    const dateA = a.metadata.publishedAt ? new Date(a.metadata.publishedAt).getTime() : 0;
    const dateB = b.metadata.publishedAt ? new Date(b.metadata.publishedAt).getTime() : 0;
    return dateB - dateA; // Sort in descending order (newest first)
  });
}

/**
 * Filter blog posts by tags
 */
export function filterPostsByTag<T extends { metadata: { tags?: string[] } }>(posts: T[], tag: string): T[] {
  if (!tag) return posts;
  return posts.filter(post => 
    post.metadata.tags?.some(postTag => 
      postTag.toLowerCase().includes(tag.toLowerCase())
    )
  );
}

/**
 * Get all unique tags from blog posts
 */
export function getAllTags<T extends { metadata: { tags?: string[] } }>(posts: T[]): string[] {
  const allTags = posts.flatMap(post => post.metadata.tags || []);
  return [...new Set(allTags)].sort();
}

/**
 * Creates consistent OpenGraph metadata for pages
 */
export function createMetadata({
  title,
  description,
  pageUrl,
  type = "website",
  imagePath = "/logos/cgq.png",
}: {
  title: string;
  description: string;
  pageUrl?: string;
  type?: "website" | "article" | "profile";
  imagePath?: string;
}): Metadata {
  const url = pageUrl ? `${DATA.url}${pageUrl}` : DATA.url;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Conor Quinlan's Portfolio",
      locale: "en_US",
      type,
      images: [
        {
          url: imagePath,
          width: 800,
          height: 600,
          alt: "Conor Quinlan's logo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
      creator: "@cqdev_co",
    },
    alternates: {
      canonical: url,
    },
  };
}
