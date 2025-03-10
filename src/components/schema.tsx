import React from 'react';
import { DATA } from '@/data/resume';

export function PersonSchema() {
  // Access DATA properties safely
  const person = {
    name: DATA.name,
    url: DATA.url,
    jobTitle: DATA.title,
    description: DATA.about,
    image: DATA.avatarUrl && `${DATA.url}${DATA.avatarUrl}`,
    location: DATA.location,
  };

  // Create schema without social links for now
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    ...person,
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
    name: `${DATA.name}'s Portfolio`,
    url: DATA.url,
    description: DATA.description || 'Professional portfolio showcasing my work and skills',
    author: {
      '@type': 'Person',
      name: DATA.name,
    },
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
} 