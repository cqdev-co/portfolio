"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface DateRangeFilterProps {
  value: string | undefined;
  onChange: (date: string | undefined) => void;
  label?: string;
}

/**
 * Reusable date filter component for filtering signals by detection date
 * Supports single date selection with quick preset options
 */
export function DateRangeFilter({ 
  value, 
  onChange,
  label = "Detection Date" 
}: DateRangeFilterProps) {
  const [inputDate, setInputDate] = useState(value || "");

  const handleDateChange = (newDate: string) => {
    setInputDate(newDate);
    onChange(newDate || undefined);
  };

  const getPresetDate = (daysAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  const quickPresets = [
    { label: "Today", getValue: () => getPresetDate(0) },
    { label: "Yesterday", getValue: () => getPresetDate(1) },
    { label: "Last 3 days", getValue: () => getPresetDate(3) },
    { label: "Last 7 days", getValue: () => getPresetDate(7) },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">
        {label}
      </Label>
      
      {/* Date Input */}
      <div className="relative">
        <Calendar 
          className={
            "absolute left-3 top-1/2 transform -translate-y-1/2 " +
            "h-4 w-4 text-muted-foreground"
          } 
        />
        <Input
          type="date"
          value={inputDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="pl-10 text-xs"
          placeholder="Select date..."
        />
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-1">
        {quickPresets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handleDateChange(preset.getValue())}
            className={
              "text-[10px] h-6 px-2 " +
              (inputDate === preset.getValue() 
                ? "bg-primary/10 border-primary" 
                : "")
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Clear Button */}
      {inputDate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDateChange("")}
          className="text-[10px] h-6 px-2 text-muted-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

