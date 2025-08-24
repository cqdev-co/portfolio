import { MetadataRoute } from 'next';
import { getBlogPosts } from '@/data/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.conorq.com';
  
  try {
    // Get all blog posts for dynamic routes
    const posts = await getBlogPosts();
    const blogUrls = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.metadata.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: post.metadata.featured ? 0.9 : 0.7, // Higher priority for featured posts
    }));

    // Static routes
    const routes = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 1.0,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/blog`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
      {
        url: `${baseUrl}/blog/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      },
    ];

    return [...routes, ...blogUrls];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return just static routes if blog posts can't be fetched
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 1.0,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/blog`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
      {
        url: `${baseUrl}/blog/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      },
    ];
  }
} 