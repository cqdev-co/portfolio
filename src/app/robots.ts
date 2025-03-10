import { MetadataRoute } from 'next';
import { DATA } from '@/data/resume';

export default function robots(): MetadataRoute.Robots {
  const url = DATA.url || 'https://conorq.com';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: `${url}/sitemap.xml`,
  };
} 