"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";
import { motion } from "framer-motion";
import React from "react";
import { ExternalLinkIcon } from "lucide-react";

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
        "group flex flex-col overflow-hidden h-full rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
        "transition-all duration-200 shadow-sm",
        isHovered ? "shadow-md border-gray-200 dark:border-gray-700 scale-[1.01]" : "",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Media Section - Video or Image */}
      <div className="relative w-full h-48 overflow-hidden bg-gray-50 dark:bg-gray-800">
        <Link href={href || "#"} className="block w-full h-full">
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
              <span className="text-lg font-semibold text-gray-400">{title.substring(0, 1)}</span>
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
        <div className="space-y-2 mb-4">
          {/* Title with optional link */}
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {href && (
              <Link href={href} target="_blank" rel="noopener noreferrer" className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <ExternalLinkIcon className="size-4" />
              </Link>
            )}
          </div>
          
          {/* Date */}
          <time className="text-xs font-medium text-gray-500 dark:text-gray-400">{dates}</time>
          
          {/* Description */}
          <div className="prose prose-sm max-w-full text-pretty text-xs text-gray-600 dark:text-gray-400 dark:prose-invert">
            <Markdown>{description}</Markdown>
          </div>
          
          {/* Security Features Section */}
          {securityFeatures && securityFeatures.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Security Features</h4>
              <ul className="list-disc pl-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {securityFeatures.map((feature, idx) => (
                  <li key={idx} className="leading-relaxed">{feature}</li>
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
                  className="px-1.5 py-0 text-[10px] font-normal bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
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
            <div className="flex flex-row flex-wrap items-start gap-1 mt-2">
              {links.map((link, idx) => (
                <Link href={link?.href} key={idx} target="_blank" rel="noopener noreferrer">
                  <Badge 
                    key={idx} 
                    className="flex gap-1.5 items-center px-2 py-0.5 text-[10px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200" 
                    variant="outline"
                  >
                    {link.icon}
                    {link.type}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
