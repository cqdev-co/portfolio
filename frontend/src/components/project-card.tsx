'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import Markdown from 'react-markdown';
import { motion } from 'framer-motion';
import React from 'react';
import { ExternalLinkIcon } from 'lucide-react';

interface Props {
  title: string;
  href?: string;
  description: string;
  dates: string;
  tags: readonly string[];
  links?: readonly {
    icon: React.ReactNode;
    type: string;
    href: string;
  }[];
  image?: string;
  video?: string;
  active?: boolean;
  securityFeatures?: readonly string[];
  className?: string;
}

export function ProjectCard({
  title,
  href,
  description,
  dates,
  tags,
  links,
  image,
  video,
  active,
  securityFeatures,
  className,
}: Props) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div
      className={cn(
        'group flex flex-col overflow-hidden h-full rounded-md border border-border bg-card',
        'transition-all duration-200 shadow-sm',
        isHovered ? 'shadow-md scale-[1.01]' : '',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Media Section - Video or Image */}
      <div className="relative w-full h-48 overflow-hidden bg-muted">
        <Link href={href || '#'} className="block w-full h-full">
          {video && (
            <video
              src={video}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {image && !video && (
            <Image
              src={image}
              alt={title}
              width={500}
              height={300}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {!image && !video && (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-lg font-semibold text-muted-foreground">
                {title.substring(0, 1)}
              </span>
            </div>
          )}
        </Link>

        {/* Active Badge */}
        {active && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-[10px] font-medium">
              Active
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-grow p-4">
        <div className="space-y-1.5 mb-3">
          {/* Title with optional link */}
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-foreground text-sm">{title}</h3>
            {href && (
              <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLinkIcon className="size-3.5" />
              </Link>
            )}
          </div>

          {/* Date */}
          <time className="text-caption text-muted-foreground">{dates}</time>

          {/* Description */}
          <div className="mt-2 prose-sm max-w-full text-compact text-muted-foreground dark:prose-invert">
            <Markdown>{description}</Markdown>
          </div>

          {/* Security Features Section */}
          {securityFeatures && securityFeatures.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-border">
              <h4 className="text-caption font-medium text-foreground mb-1.5">
                Security Features
              </h4>
              <ul className="list-disc pl-4 text-caption text-muted-foreground space-y-1">
                {securityFeatures.map((feature, idx) => (
                  <li key={idx} className="leading-tight">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="mt-auto">
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <Badge
                  className="px-1.5 py-0 text-caption font-normal bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 transition-colors"
                  variant="outline"
                  key={tag}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Links Section */}
          {links && links.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {links.map((link, idx) => (
                <Link
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-1 items-center px-1.5 py-0.5 text-caption border-border bg-card text-muted-foreground hover:bg-secondary transition-colors duration-200"
                >
                  {link.icon}
                  <span>{link.type}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
