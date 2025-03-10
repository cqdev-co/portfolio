import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/private/'], // Add any paths you want to prevent from being indexed
      },
    ],
    sitemap: 'https://www.conorq.com/sitemap.xml', // Replace with your actual domain
  };
} 