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
  const [isHovered, setIsHovered] = React.useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (description || highlights?.length) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  const hasDetails = description || (highlights && highlights.length > 0);

  return (
    <Link
      href={href || "#"}
      className={cn(
        "block transition-all duration-200 ease-in-out",
        hasDetails ? "cursor-pointer" : "",
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        "rounded-md p-4",
        "transition-all duration-200",
      )}>
        <div className="flex items-center space-x-3">
          {/* Logo Circle */}
          <Avatar className="size-12 bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-100 dark:ring-gray-700">
            <AvatarImage
              src={logoUrl}
              alt={altText}
              className="object-contain p-1"
            />
            <AvatarFallback className="text-sm font-medium">{altText[0]}</AvatarFallback>
          </Avatar>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center">
                <h3 className="text-base font-semibold truncate">{title}</h3>
                {hasDetails && (
                  <ChevronRightIcon
                    className={cn(
                      "size-3.5 ml-1.5 flex-shrink-0 transform transition-all duration-200",
                      isExpanded ? "rotate-90" : "rotate-0",
                      isHovered || isExpanded ? "opacity-100" : "opacity-0"
                    )}
                  />
                )}
              </div>
              <div className="text-xs font-small">
                {period}
              </div>
            </div>
            {subtitle && (
              <p className="text-xs mt-0.5 truncate">
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
            <div className="mt-3 border-t  pt-3 pl-[60px] text-sm text-gray-600 dark:text-gray-400 pr-2">
              {/* Description section */}
              {description && <p className="mb-2 text-xs leading-relaxed">{description}</p>}
              
              {/* Highlights/accomplishments section */}
              {highlights && highlights.length > 0 && (
                <div className="mt-2">
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {highlights.map((highlight, index) => (
                      <li key={index} className="leading-relaxed">{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </Link>
  );
};
