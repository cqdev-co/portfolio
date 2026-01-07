'use client';

import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, Zap, Package } from 'lucide-react';

interface DetectionFlagsFilterProps {
  hasVolumeAnomaly: boolean | undefined;
  hasOiSpike: boolean | undefined;
  hasSweep: boolean | undefined;
  hasBlockTrade: boolean | undefined;
  onVolumeAnomalyChange: (value: boolean | undefined) => void;
  onOiSpikeChange: (value: boolean | undefined) => void;
  onSweepChange: (value: boolean | undefined) => void;
  onBlockTradeChange: (value: boolean | undefined) => void;
  label?: string;
}

/**
 * Reusable detection flags filter component
 * Toggle filters for volume anomaly, OI spike, sweep, and block trades
 */
export function DetectionFlagsFilter({
  hasVolumeAnomaly,
  hasOiSpike,
  hasSweep,
  hasBlockTrade,
  onVolumeAnomalyChange,
  onOiSpikeChange,
  onSweepChange,
  onBlockTradeChange,
  label = 'Detection Patterns',
}: DetectionFlagsFilterProps) {
  const flags = [
    {
      key: 'volume',
      label: 'Volume Anomaly',
      icon: Activity,
      value: hasVolumeAnomaly,
      onChange: onVolumeAnomalyChange,
    },
    {
      key: 'oi',
      label: 'OI Spike',
      icon: TrendingUp,
      value: hasOiSpike,
      onChange: onOiSpikeChange,
    },
    {
      key: 'sweep',
      label: 'Sweep',
      icon: Zap,
      value: hasSweep,
      onChange: onSweepChange,
    },
    {
      key: 'block',
      label: 'Block Trade',
      icon: Package,
      value: hasBlockTrade,
      onChange: onBlockTradeChange,
    },
  ];

  const activeCount = flags.filter((f) => f.value === true).length;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">
        {label}
        {activeCount > 0 && (
          <span className="ml-2 text-[10px] text-muted-foreground">
            ({activeCount} active)
          </span>
        )}
      </Label>

      <div className="grid grid-cols-2 gap-1.5">
        {flags.map((flag) => {
          const Icon = flag.icon;
          const isActive = flag.value === true;

          return (
            <Badge
              key={flag.key}
              variant={isActive ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-all text-[10px] px-2 py-1.5',
                'hover:scale-[1.02] flex items-center gap-1 justify-center',
                isActive && 'bg-primary/10 text-primary border-primary/20'
              )}
              onClick={() => flag.onChange(isActive ? undefined : true)}
            >
              <Icon className="h-3 w-3" />
              {flag.label}
            </Badge>
          );
        })}
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => {
            onVolumeAnomalyChange(undefined);
            onOiSpikeChange(undefined);
            onSweepChange(undefined);
            onBlockTradeChange(undefined);
          }}
          className={
            'text-[10px] text-muted-foreground ' +
            'hover:text-foreground transition-colors'
          }
        >
          Clear all
        </button>
      )}
    </div>
  );
}
