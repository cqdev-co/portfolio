"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OptionTypeFilterProps {
  value: ('call' | 'put')[] | undefined;
  onChange: (types: ('call' | 'put')[] | undefined) => void;
  label?: string;
}

/**
 * Reusable option type filter component
 * Toggle between Calls and Puts
 */
export function OptionTypeFilter({ 
  value = [], 
  onChange,
  label = "Option Type" 
}: OptionTypeFilterProps) {
  const optionTypes: ('call' | 'put')[] = ['call', 'put'];

  const toggleType = (type: 'call' | 'put') => {
    const current = value || [];
    const newTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    
    onChange(newTypes.length > 0 ? newTypes : undefined);
  };

  const getTypeColor = (type: 'call' | 'put', isSelected: boolean) => {
    if (!isSelected) return "hover:bg-muted";
    
    return type === 'call'
      ? "bg-green-500/10 text-green-500 border-green-500/20"
      : "bg-red-500/10 text-red-500 border-red-500/20";
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">
        {label}
      </Label>
      
      <div className="flex gap-2">
        {optionTypes.map((type) => {
          const isSelected = value?.includes(type);
          return (
            <Badge
              key={type}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all text-xs px-3 py-1.5",
                "hover:scale-105 capitalize",
                getTypeColor(type, isSelected)
              )}
              onClick={() => toggleType(type)}
            >
              {type}s
            </Badge>
          );
        })}
      </div>

      {value && value.length > 0 && value.length < 2 && (
        <button
          onClick={() => onChange(undefined)}
          className={
            "text-[10px] text-muted-foreground " +
            "hover:text-foreground transition-colors"
          }
        >
          Show all
        </button>
      )}
    </div>
  );
}

