"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BlogFilterProps {
  allTags: string[];
  selectedTag?: string;
}

export function BlogFilter({ allTags, selectedTag }: BlogFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams);
    if (tag === selectedTag) {
      // If clicking the same tag, remove the filter
      params.delete('tag');
    } else {
      params.set('tag', tag);
    }
    
    const newUrl = params.toString() ? `/blog?${params.toString()}` : '/blog';
    router.push(newUrl);
  };

  const clearFilter = () => {
    router.push('/blog');
  };

  if (allTags.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Filter by tags:</h3>
        {selectedTag && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilter}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filter
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <Badge
            key={tag}
            variant={selectedTag === tag ? "default" : "secondary"}
            className="cursor-pointer hover:bg-primary/80 transition-colors"
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}