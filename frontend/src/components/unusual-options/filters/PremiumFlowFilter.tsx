"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

interface PremiumFlowFilterProps {
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  label?: string;
}

/**
 * Reusable premium flow range filter component
 * Supports min/max range with quick preset buttons
 */
export function PremiumFlowFilter({ 
  minValue, 
  maxValue,
  onMinChange,
  onMaxChange,
  label = "Premium Flow Range" 
}: PremiumFlowFilterProps) {
  const [minInput, setMinInput] = useState(
    minValue?.toString() || ""
  );
  const [maxInput, setMaxInput] = useState(
    maxValue?.toString() || ""
  );

  const handleMinChange = (value: string) => {
    setMinInput(value);
    const numValue = parseFloat(value);
    onMinChange(isNaN(numValue) ? undefined : numValue);
  };

  const handleMaxChange = (value: string) => {
    setMaxInput(value);
    const numValue = parseFloat(value);
    onMaxChange(isNaN(numValue) ? undefined : numValue);
  };

  const presets = [
    { label: "≥ $100K", min: 100_000 },
    { label: "≥ $500K", min: 500_000 },
    { label: "≥ $1M", min: 1_000_000 },
    { label: "≥ $5M", min: 5_000_000 },
  ];

  const clearFilters = () => {
    setMinInput("");
    setMaxInput("");
    onMinChange(undefined);
    onMaxChange(undefined);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">
        {label}
      </Label>
      
      {/* Min/Max Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <DollarSign 
            className={
              "absolute left-2 top-1/2 transform -translate-y-1/2 " +
              "h-3 w-3 text-muted-foreground"
            } 
          />
          <Input
            type="number"
            placeholder="Min"
            value={minInput}
            onChange={(e) => handleMinChange(e.target.value)}
            className="pl-7 text-xs"
          />
        </div>
        <div className="relative">
          <DollarSign 
            className={
              "absolute left-2 top-1/2 transform -translate-y-1/2 " +
              "h-3 w-3 text-muted-foreground"
            } 
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxInput}
            onChange={(e) => handleMaxChange(e.target.value)}
            className="pl-7 text-xs"
          />
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => {
              const value = preset.min.toString();
              handleMinChange(value);
            }}
            className={
              "text-[10px] h-6 px-2 " +
              (minInput === preset.min.toString() 
                ? "bg-primary/10 border-primary" 
                : "")
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Clear Button */}
      {(minInput || maxInput) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-[10px] h-6 px-2 text-muted-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

