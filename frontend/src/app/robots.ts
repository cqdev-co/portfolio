import { MetadataRoute } from 'next';
import { DATA } from '@/data/resume';

export default function robots(): MetadataRoute.Robots {
  const url = DATA.url || 'https://conorq.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/private/', '/api/', '/_next/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/private/', '/api/', '/_next/'],
        crawlDelay: 1,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/private/', '/api/', '/_next/'],
        crawlDelay: 1,
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
