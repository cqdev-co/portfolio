'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, Activity } from 'lucide-react';
import { MarketPulse, type MarketDataPoint } from './market-pulse';
import { SectorHeatmap, type SectorDataPoint } from './sector-heatmap';

// ============================================================================
// Types
// ============================================================================

interface MarketContextProps {
  marketData: MarketDataPoint[];
  sectorData: SectorDataPoint[];
  loading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MarketContext({
  marketData,
  sectorData,
  loading,
}: MarketContextProps) {
  const [expanded, setExpanded] = useState(false);

  // Build inline summary for collapsed state
  const spy = marketData.find((d) => d.symbol === 'SPY');
  const qqq = marketData.find((d) => d.symbol === 'QQQ');
  const vix = marketData.find((d) => d.symbol === '^VIX');

  const summaryParts: string[] = [];
  if (spy)
    summaryParts.push(
      `SPY ${spy.changePercent >= 0 ? '+' : ''}${spy.changePercent.toFixed(2)}%`
    );
  if (qqq)
    summaryParts.push(
      `QQQ ${qqq.changePercent >= 0 ? '+' : ''}${qqq.changePercent.toFixed(2)}%`
    );
  if (vix) summaryParts.push(`VIX ${vix.price.toFixed(1)}`);

  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-start h-auto py-2 px-2 text-muted-foreground hover:text-foreground"
      >
        <Activity className="h-3.5 w-3.5 mr-2 shrink-0" />
        <span className="text-xs font-medium mr-2">Market details</span>
        {!expanded && summaryParts.length > 0 && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {summaryParts.join(' · ')}
          </span>
        )}
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 ml-auto transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </Button>

      {expanded && (
        <div className="space-y-3 mt-2">
          <MarketPulse data={marketData} loading={loading} />
          <SectorHeatmap data={sectorData} loading={loading} />
        </div>
      )}
    </div>
  );
}
