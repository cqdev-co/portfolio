'use client';

import { cn } from '@/lib/utils';
import type { ScanOpportunitiesResult } from '@lib/ai-agent';

interface ScanResultsCardProps {
  data: ScanOpportunitiesResult;
  className?: string;
}

// Grade color mapping
const gradeColors: Record<string, string> = {
  'A+': 'text-emerald-500 bg-emerald-500/10',
  A: 'text-emerald-500 bg-emerald-500/10',
  'A-': 'text-emerald-400 bg-emerald-400/10',
  'B+': 'text-blue-500 bg-blue-500/10',
  B: 'text-blue-500 bg-blue-500/10',
  'B-': 'text-blue-400 bg-blue-400/10',
  'C+': 'text-amber-500 bg-amber-500/10',
  C: 'text-amber-500 bg-amber-500/10',
  'C-': 'text-amber-400 bg-amber-400/10',
  D: 'text-orange-500 bg-orange-500/10',
  F: 'text-red-500 bg-red-500/10',
};

// Risk level colors
const riskColors: Record<string, string> = {
  LOW: 'text-emerald-500',
  MODERATE: 'text-amber-500',
  HIGH: 'text-orange-500',
  EXTREME: 'text-red-500',
};

/**
 * Displays scan results from the scan_opportunities tool.
 * Shows opportunities found with grades, risk scores, and key metrics.
 */
export function ScanResultsCard({ data, className }: ScanResultsCardProps) {
  const { scanList, tickersScanned, results, summary } = data;

  if (results.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-card',
          'shadow-sm overflow-hidden my-4 p-4',
          className
        )}
      >
        <div className="text-center text-muted-foreground">
          <p className="font-medium">No opportunities found</p>
          <p className="text-sm mt-1">
            Scanned {tickersScanned} tickers in {scanList} list
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card',
        'shadow-sm overflow-hidden my-4',
        'transition-all duration-200 hover:shadow-md hover:border-border',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 border-b border-border/40',
          'bg-gradient-to-r from-primary/10 to-transparent'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Scan icon */}
            <div
              className={cn(
                'flex items-center justify-center',
                'w-10 h-10 rounded-lg',
                'bg-primary/10 text-primary'
              )}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Scan Results: {scanList}
              </h3>
              <p className="text-sm text-muted-foreground">
                {results.length} opportunities from {tickersScanned} tickers
              </p>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2">
            {summary.gradeA > 0 && (
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500">
                {summary.gradeA} A-grade
              </span>
            )}
            {summary.lowRisk > 0 && (
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-500">
                {summary.lowRisk} low risk
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="divide-y divide-border/40">
        {results.slice(0, 8).map((result, idx) => (
          <div
            key={`${result.ticker}-${idx}`}
            className="px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              {/* Left: Ticker, grade, price */}
              <div className="flex items-center gap-3">
                {/* Grade badge */}
                <div
                  className={cn(
                    'flex items-center justify-center',
                    'w-8 h-8 rounded-lg font-bold text-sm',
                    gradeColors[result.grade] ||
                      'text-muted-foreground bg-muted/50'
                  )}
                >
                  {result.grade}
                </div>

                {/* Ticker and price */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {result.ticker}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${result.price.toFixed(2)}
                    </span>
                    {result.changePct !== undefined && (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          result.changePct >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        )}
                      >
                        {result.changePct >= 0 ? '+' : ''}
                        {result.changePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>RSI: {result.rsi.toFixed(0)}</span>
                    <span>•</span>
                    <span
                      className={
                        result.aboveMA200
                          ? 'text-emerald-500'
                          : 'text-amber-500'
                      }
                    >
                      {result.aboveMA200 ? '↑ MA200' : '↓ MA200'}
                    </span>
                    {result.cushionPercent !== undefined && (
                      <>
                        <span>•</span>
                        <span>{result.cushionPercent.toFixed(1)}% cushion</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Risk and recommendation */}
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-muted-foreground">Risk:</span>
                    <span
                      className={cn(
                        'font-medium text-sm',
                        riskColors[result.risk.level] || 'text-foreground'
                      )}
                    >
                      {result.risk.score}/10
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.gradeResult.recommendation}
                  </div>
                </div>

                {/* Spread info if available */}
                {result.spread && (
                  <div className="hidden sm:block text-xs bg-muted/50 rounded px-2 py-1">
                    ${result.spread.longStrike}/${result.spread.shortStrike}
                    <span className="text-muted-foreground ml-1">
                      @ ${result.spread.debit.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* More results indicator */}
        {results.length > 8 && (
          <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/20">
            +{results.length - 8} more opportunities
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2 border-t border-border/40 bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Avg cushion: {summary.avgCushion.toFixed(1)}%</span>
          <span>
            {summary.gradeA} A-grade • {summary.gradeB} B-grade
          </span>
        </div>
      </div>
    </div>
  );
}
