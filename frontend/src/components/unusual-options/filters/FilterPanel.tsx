'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { UnusualOptionsFilters } from '@/lib/types/unusual-options';
import { DateRangeFilter } from './DateRangeFilter';
import { GradeFilter } from './GradeFilter';
import { OptionTypeFilter } from './OptionTypeFilter';
import { PremiumFlowFilter } from './PremiumFlowFilter';
import { DetectionFlagsFilter } from './DetectionFlagsFilter';
import { X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: UnusualOptionsFilters;
  onFiltersChange: (filters: UnusualOptionsFilters) => void;
  onApply: () => void;
}

/**
 * Orchestrating filter panel component
 * Provides a unified interface for all filter options
 * Designed to be extensible - easy to add new filters
 */
export function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
}: FilterPanelProps) {
  // Count active filters for badge
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.detection_date) count++;
    if (filters.grade && filters.grade.length > 0) count++;
    if (filters.option_type && filters.option_type.length > 0) count++;
    if (filters.min_premium_flow !== undefined) count++;
    if (filters.max_premium_flow !== undefined) count++;
    if (filters.has_volume_anomaly !== undefined) count++;
    if (filters.has_oi_spike !== undefined) count++;
    if (filters.has_sweep !== undefined) count++;
    if (filters.has_block_trade !== undefined) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const handleClearAll = () => {
    onFiltersChange({});
    onApply();
  };

  const updateFilter = <K extends keyof UnusualOptionsFilters>(
    key: K,
    value: UnusualOptionsFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}

      {/* Filter Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[400px]',
          'bg-background border-l border-border z-50',
          'shadow-2xl flex flex-col',
          'transform transition-all duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className={
            'flex items-center justify-between p-4 ' +
            'border-b border-border shrink-0'
          }
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Filters</h2>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {activeCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Date Filter */}
          <DateRangeFilter
            value={filters.detection_date}
            onChange={(date) => updateFilter('detection_date', date)}
          />

          <Separator className="opacity-50" />

          {/* Grade Filter */}
          <GradeFilter
            value={filters.grade}
            onChange={(grades) => updateFilter('grade', grades)}
          />

          <Separator className="opacity-50" />

          {/* Option Type Filter */}
          <OptionTypeFilter
            value={filters.option_type}
            onChange={(types) => updateFilter('option_type', types)}
          />

          <Separator className="opacity-50" />

          {/* Premium Flow Filter */}
          <PremiumFlowFilter
            minValue={filters.min_premium_flow}
            maxValue={filters.max_premium_flow}
            onMinChange={(val) => updateFilter('min_premium_flow', val)}
            onMaxChange={(val) => updateFilter('max_premium_flow', val)}
          />

          <Separator className="opacity-50" />

          {/* Detection Flags Filter */}
          <DetectionFlagsFilter
            hasVolumeAnomaly={filters.has_volume_anomaly}
            hasOiSpike={filters.has_oi_spike}
            hasSweep={filters.has_sweep}
            hasBlockTrade={filters.has_block_trade}
            onVolumeAnomalyChange={(val) =>
              updateFilter('has_volume_anomaly', val)
            }
            onOiSpikeChange={(val) => updateFilter('has_oi_spike', val)}
            onSweepChange={(val) => updateFilter('has_sweep', val)}
            onBlockTradeChange={(val) => updateFilter('has_block_trade', val)}
          />

          {/* Future filters can be easily added here */}
          {/* Example:
          <Separator className="opacity-50" />
          <SentimentFilter
            value={filters.sentiment}
            onChange={(sentiment) => 
              updateFilter('sentiment', sentiment)
            }
          />
          */}
        </div>

        {/* Footer Actions */}
        <div
          className={
            'shrink-0 p-4 border-t border-border ' + 'flex items-center gap-2'
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={activeCount === 0}
            className="flex-1"
          >
            Clear All
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="flex-1"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </>
  );
}
