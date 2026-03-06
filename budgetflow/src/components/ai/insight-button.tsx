'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sparkles, Loader2 } from 'lucide-react';

interface InsightButtonProps {
  widgetType: string;
}

export function InsightButton({ widgetType }: InsightButtonProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchInsight = async () => {
    if (insight) return;
    setLoading(true);
    try {
      const response = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetType }),
      });
      const data = await response.json();
      setInsight(data.insight);
    } catch {
      setInsight('Unable to generate insight right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) fetchInsight();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing...
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
              <Sparkles className="h-3 w-3" />
              AI Insight
            </div>
            <p className="text-sm leading-relaxed">{insight}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
