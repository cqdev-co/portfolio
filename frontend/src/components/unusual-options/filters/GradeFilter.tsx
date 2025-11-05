"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getGradeColor } from "@/lib/types/unusual-options";

interface GradeFilterProps {
  value: ('S' | 'A' | 'B' | 'C' | 'D' | 'F')[] | undefined;
  onChange: (
    grades: ('S' | 'A' | 'B' | 'C' | 'D' | 'F')[] | undefined
  ) => void;
  label?: string;
}

/**
 * Reusable grade filter component
 * Multi-select badge interface for filtering by signal grade
 */
export function GradeFilter({ 
  value = [], 
  onChange,
  label = "Signal Grade" 
}: GradeFilterProps) {
  const grades: ('S' | 'A' | 'B' | 'C' | 'D' | 'F')[] = [
    'S', 
    'A', 
    'B', 
    'C', 
    'D', 
    'F'
  ];

  const toggleGrade = (grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F') => {
    const current = value || [];
    const newGrades = current.includes(grade)
      ? current.filter(g => g !== grade)
      : [...current, grade];
    
    onChange(newGrades.length > 0 ? newGrades : undefined);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">
        {label}
      </Label>
      
      <div className="flex flex-wrap gap-1.5">
        {grades.map((grade) => {
          const isSelected = value?.includes(grade);
          return (
            <Badge
              key={grade}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all text-xs px-2 py-1",
                "hover:scale-105",
                isSelected 
                  ? getGradeColor(grade) 
                  : "hover:bg-muted"
              )}
              onClick={() => toggleGrade(grade)}
            >
              {grade}
            </Badge>
          );
        })}
      </div>

      {value && value.length > 0 && (
        <button
          onClick={() => onChange(undefined)}
          className={
            "text-[10px] text-muted-foreground " +
            "hover:text-foreground transition-colors"
          }
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

