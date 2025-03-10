"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

interface ResumeCardProps {
  logoUrl: string;
  altText: string;
  title: string;
  subtitle?: string;
  href?: string;
  period: string;
  description?: string;
  highlights?: readonly string[] | string[];
}
export const ResumeCard = ({
  logoUrl,
  altText,
  title,
  subtitle,
  href,
  period,
  description,
  highlights,
}: ResumeCardProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (description || highlights?.length) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
  };

  const hasDetails = description || (highlights && highlights.length > 0);

  return (
    <div 
      className="block transition-all duration-200 ease-in-out"
    >
      <div className={cn(
        "rounded-md border border-border bg-card p-3.5",
        "transition-all duration-200 shadow-sm",
      )}>
        <div className="flex items-center space-x-3 cursor-pointer" onClick={handleClick}>
          {/* Logo Circle */}
          <Avatar className="size-10 bg-muted ring-1 ring-border">
            <AvatarImage
              src={logoUrl}
              alt={altText}
              className="object-contain p-1"
            />
            <AvatarFallback className="text-xs font-medium text-muted-foreground">{altText[0]}</AvatarFallback>
          </Avatar>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {href ? (
                    <Link href={href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </h3>
                {hasDetails && (
                  <ChevronRightIcon
                    className={cn(
                      "size-3 ml-1 flex-shrink-0 transform transition-all duration-200",
                      isExpanded ? "rotate-90" : "rotate-0",
                      "text-muted-foreground"
                    )}
                  />
                )}
              </div>
              <div className="text-caption text-muted-foreground">
                {period}
              </div>
            </div>
            {subtitle && (
              <p className="text-caption text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Expanded details section */}
        {hasDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: isExpanded ? 1 : 0,
              height: isExpanded ? "auto" : 0,
            }}
            transition={{
              duration: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="overflow-hidden pt-0"
          >
            <div className="mt-2.5 border-t border-border pt-2.5 pl-[52px] text-compact text-muted-foreground pr-2 select-text cursor-text">
              {/* Description section */}
              {description && <p className="mb-2 text-compact leading-relaxed">{description}</p>}
              
              {/* Highlights/accomplishments section */}
              {highlights && highlights.length > 0 && (
                <div className="mt-2">
                  <ul className="list-disc pl-4 space-y-0.5 text-compact">
                    {highlights.map((highlight, index) => (
                      <li key={index} className="leading-snug">{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
