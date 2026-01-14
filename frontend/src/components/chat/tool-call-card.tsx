'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TickerData, ScanOpportunitiesResult } from '@lib/ai-agent';

// Tool call state
export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
  error?: string;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
  className?: string;
}

// Tool display config
const TOOL_CONFIG: Record<
  string,
  {
    name: string;
    icon: string;
    description: string;
  }
> = {
  get_ticker_data: {
    name: 'Market Data',
    icon: '📊',
    description: 'Fetching real-time stock data',
  },
  web_search: {
    name: 'Web Search',
    icon: '🔍',
    description: 'Searching the web',
  },
  analyze_position: {
    name: 'Position Analysis',
    icon: '📈',
    description: 'Analyzing position',
  },
  scan_opportunities: {
    name: 'Opportunity Scanner',
    icon: '🎯',
    description: 'Scanning for trade opportunities',
  },
  get_financials_deep: {
    name: 'Financial Analysis',
    icon: '📑',
    description: 'Fetching detailed financials',
  },
  get_institutional_holdings: {
    name: 'Institutional Holdings',
    icon: '🏦',
    description: 'Fetching ownership data',
  },
  get_unusual_options_activity: {
    name: 'Unusual Options',
    icon: '🔥',
    description: 'Fetching options signals',
  },
  get_trading_regime: {
    name: 'Market Regime',
    icon: '🚦',
    description: 'Analyzing market conditions',
  },
  get_iv_by_strike: {
    name: 'IV Analysis',
    icon: '📉',
    description: 'Fetching strike IV',
  },
  calculate_spread: {
    name: 'Spread Calculator',
    icon: '🧮',
    description: 'Calculating spread pricing',
  },
};

/**
 * Animated spinner with spring physics
 */
function SpringSpinner() {
  const rotation = useSpring(0, { stiffness: 50, damping: 10 });
  rotation.set(rotation.get() + 360);

  return (
    <motion.div
      className="relative w-4 h-4"
      animate={{ rotate: 360 }}
      transition={{
        repeat: Infinity,
        duration: 1,
        ease: 'linear',
      }}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full',
          'border-2 border-blue-400/30'
        )}
      />
      <motion.div
        className={cn(
          'absolute inset-0 rounded-full',
          'border-2 border-transparent border-t-blue-500'
        )}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

// Result structure from API: { data: object, formatted: string }
interface ToolResultPayload {
  data?: unknown;
  formatted?: string;
}

/**
 * Collapsible card showing tool execution status and results.
 * Shows the TOON/formatted string that the AI actually receives.
 */
export function ToolCallCard({ toolCall, className }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tool, args, status, result, error } = toolCall;

  const config = TOOL_CONFIG[tool] || {
    name: tool,
    icon: '⚙️',
    description: `Running ${tool}`,
  };

  const ticker: string | undefined = (args as { ticker?: string })?.ticker;

  // Extract data and formatted string from result payload
  // New format: { data: {...}, formatted: "TOON string" }
  // Old format: direct data object (backwards compatible)
  const resultPayload = result as ToolResultPayload | undefined;
  const actualData = resultPayload?.data ?? result;
  const formattedString = resultPayload?.formatted;

  // Progress spring for running state
  useSpring(status === 'running' ? 1 : 0, {
    stiffness: 100,
    damping: 20,
  });

  // Generate preview text based on tool type
  const getResultPreview = () => {
    if (!actualData) return null;

    if (tool === 'get_ticker_data' && typeof actualData === 'object') {
      const data = actualData as TickerData;
      return `$${data.price?.toFixed(2) || '—'} | RSI ${data.rsi?.toFixed(0) || '—'}`;
    }

    if (tool === 'web_search' && Array.isArray(actualData)) {
      return `${actualData.length} results found`;
    }

    if (tool === 'scan_opportunities' && typeof actualData === 'object') {
      const data = actualData as ScanOpportunitiesResult;
      const gradeA = data.summary?.gradeA ?? 0;
      return `${data.results?.length ?? 0} opportunities (${gradeA} A-grade)`;
    }

    return 'Data retrieved';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
      className={cn(
        'rounded-lg border overflow-hidden',
        'transition-colors duration-200',
        status === 'running' && 'border-blue-300 dark:border-blue-700',
        status === 'complete' && 'border-emerald-300 dark:border-emerald-700',
        status === 'error' && 'border-red-300 dark:border-red-700',
        status === 'pending' && 'border-border',
        className
      )}
    >
      {/* Progress bar for running state */}
      {status === 'running' && (
        <motion.div
          className="h-0.5 bg-blue-500/50"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 3,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      )}

      {/* Header */}
      <button
        type="button"
        onClick={() => status === 'complete' && setIsExpanded(!isExpanded)}
        disabled={status !== 'complete'}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5',
          'text-left text-sm',
          status === 'complete' && 'cursor-pointer hover:bg-muted/50',
          status !== 'complete' && 'cursor-default'
        )}
      >
        {/* Status Icon */}
        <motion.div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            'text-base shrink-0',
            status === 'pending' && 'bg-muted text-muted-foreground',
            status === 'running' && 'bg-blue-500/10 text-blue-600',
            status === 'complete' && 'bg-emerald-500/10 text-emerald-600',
            status === 'error' && 'bg-red-500/10 text-red-600'
          )}
          animate={
            status === 'running'
              ? {
                  scale: [1, 1.05, 1],
                  transition: { repeat: Infinity, duration: 1.5 },
                }
              : status === 'complete'
                ? { scale: [1, 1.2, 1], transition: { duration: 0.3 } }
                : {}
          }
        >
          {status === 'running' ? (
            <SpringSpinner />
          ) : status === 'complete' ? (
            <motion.svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <motion.path
                d="M3 8.5L6.5 12L13 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
              />
            </motion.svg>
          ) : status === 'error' ? (
            <motion.svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.svg>
          ) : (
            <span>{config.icon}</span>
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{config.name}</span>
            {ticker && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  'bg-primary/10 text-primary uppercase'
                )}
              >
                {String(ticker)}
              </motion.span>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {status === 'running' && (
              <motion.span
                className="flex items-center gap-1"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {config.description}
                <span className="flex gap-0.5">
                  <motion.span
                    className="w-1 h-1 rounded-full bg-current"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  />
                  <motion.span
                    className="w-1 h-1 rounded-full bg-current"
                    animate={{ y: [0, -3, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.6,
                      delay: 0.15,
                    }}
                  />
                  <motion.span
                    className="w-1 h-1 rounded-full bg-current"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                  />
                </span>
              </motion.span>
            )}
            {status === 'complete' && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                {getResultPreview()}
              </motion.span>
            )}
            {status === 'error' && (error || 'Failed to execute')}
            {status === 'pending' && 'Waiting...'}
          </div>
        </div>

        {/* Expand indicator */}
        {status === 'complete' && result != null && (
          <motion.svg
            className="w-4 h-4 text-muted-foreground"
            viewBox="0 0 16 16"
            fill="none"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </button>

      {/* Expandable Data Section - Shows what AI receives (TOON/text) */}
      <AnimatePresence>
        {isExpanded && result != null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 },
            }}
            className="overflow-hidden"
          >
            <div className={cn('px-3 py-3 border-t', 'bg-muted/30 text-xs')}>
              {/* Label showing this is what AI sees */}
              <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground">
                <span>🤖</span>
                <span>What the AI receives:</span>
                {formattedString && (
                  <span className="px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    TOON
                  </span>
                )}
              </div>
              <pre
                className={cn(
                  'p-2 rounded bg-muted overflow-x-auto overflow-y-auto',
                  'text-[10px] font-mono max-h-64',
                  'text-foreground/80 whitespace-pre-wrap'
                )}
              >
                {formattedString || JSON.stringify(actualData, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
