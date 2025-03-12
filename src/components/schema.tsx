import React from 'react';
import { DATA } from '@/data/resume';

export function PersonSchema() {
  // Access DATA properties safely and add more identity-focused attributes
  const person = {
    name: DATA.name,
    url: DATA.url,
    jobTitle: DATA.title,
    description: DATA.about,
    image: DATA.avatarUrl && `${DATA.url}${DATA.avatarUrl}`,
    location: DATA.location,
    sameAs: [
      'https://conorq.com',
      'https://github.com/conorquinlan',
      'https://linkedin.com/in/conorquinlan',
      'https://twitter.com/realconorcodes',
      // Add any other profiles you have
    ],
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: 'Your University Name', // Replace with your actual university
    },
    knowsAbout: [
      'Cloud Security (AWS/GCP)',
      'CI/CD Security',
      'Docker Containerization',
      'Infrastructure as Code',
      'Zero-Trust Architecture',
      'Security Engineering',
      'Application Security',
    ],
  };

  // Create schema with enhanced identity information
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://conorq.com/#person',
    ...person,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://conorq.com',
    },
    worksFor: DATA.work && DATA.work.length > 0
      ? {
          '@type': 'Organization',
          name: DATA.work[0].company,
          url: DATA.work[0].href,
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://conorq.com/#website',
    name: `${DATA.name}'s Portfolio`,
    url: DATA.url,
    description: DATA.description || `${DATA.name} - Security Engineer Portfolio`,
    author: {
      '@type': 'Person',
      '@id': 'https://conorq.com/#person',
      name: DATA.name,
    },
    publisher: {
      '@type': 'Person',
      '@id': 'https://conorq.com/#person',
      name: DATA.name,
    },
    inLanguage: 'en-US'
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BlogPostSchema for blog post structured data
export function BlogPostSchema({ 
  title, 
  description, 
  image, 
  slug, 
  publishedAt, 
  updatedAt 
}: { 
  title: string; 
  description: string; 
  image?: string; 
  slug: string; 
  publishedAt: string; 
  updatedAt?: string; 
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: description,
    image: image ? `${DATA.url}${image}` : `${DATA.url}/og?title=${title}`,
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: {
      "@type": "Person",
      name: DATA.name,
      url: DATA.url
    },
    publisher: {
      "@type": "Person",
      name: DATA.name,
      url: DATA.url
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${DATA.url}/blog/${slug}`
    }
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BreadcrumbList Schema for structured navigation
export function BreadcrumbSchema({ items }: { items: {name: string, url: string}[] }) {
  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
} 