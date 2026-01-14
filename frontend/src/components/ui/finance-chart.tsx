'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface FinanceDataPoint {
  time: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface FinanceChartProps {
  /** Array of price data points */
  data: FinanceDataPoint[];
  /** Optional loading state */
  loading?: boolean;
  /** Optional error message */
  error?: string | null;
  /** Ticker symbol for display */
  ticker?: string;
  /** Company name for display */
  companyName?: string;
  /** Currently selected time range */
  selectedRange?: TimeRange;
  /** Callback when time range changes */
  onRangeChange?: (range: TimeRange) => void;
  /** Available time ranges to show */
  timeRanges?: TimeRange[];
  /** Height of the chart in pixels */
  height?: number;
  /** Show the header with price info */
  showHeader?: boolean;
  /** Custom class name */
  className?: string;
  /** Force a specific color (overrides gain/loss coloring) */
  forceColor?: 'positive' | 'negative';
  /** Show volume bars */
  showVolume?: boolean;
  /** Currency symbol */
  currency?: string;
  /** Number of decimal places for price */
  decimals?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

const COLORS = {
  positive: {
    line: '#00C805',
    gradient: ['rgba(0, 200, 5, 0.12)', 'rgba(0, 200, 5, 0)'],
    text: '#00C805',
    glow: 'rgba(0, 200, 5, 0.4)',
  },
  negative: {
    line: '#FF5000',
    gradient: ['rgba(255, 80, 0, 0.12)', 'rgba(255, 80, 0, 0)'],
    text: '#FF5000',
    glow: 'rgba(255, 80, 0, 0.4)',
  },
  neutral: {
    line: 'hsl(var(--muted-foreground))',
    gradient: [
      'hsla(var(--muted-foreground), 0.12)',
      'hsla(var(--muted-foreground), 0)',
    ],
    text: 'hsl(var(--muted-foreground))',
    glow: 'hsla(var(--muted-foreground), 0.4)',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatPrice(
  price: number,
  currency: string = '$',
  decimals: number = 2
): string {
  if (price >= 1000) {
    return `${currency}${price.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `${currency}${price.toFixed(decimals)}`;
}

function formatChange(change: number, percent: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${Math.abs(change).toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
}

function formatTimeLabel(time: string, range: TimeRange): string {
  const date = new Date(time);

  if (range === '1D') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (range === '1W') {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
    });
  }

  if (range === '1M' || range === '3M') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function formatTooltipTime(time: string, range: TimeRange): string {
  const date = new Date(time);

  if (range === '1D') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calculatePriceChange(data: FinanceDataPoint[]): {
  change: number;
  changePercent: number;
  isPositive: boolean;
} {
  if (data.length < 2) {
    return { change: 0, changePercent: 0, isPositive: true };
  }

  const firstPrice = data[0].price;
  const lastPrice = data[data.length - 1].price;
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;

  return {
    change,
    changePercent,
    isPositive: change >= 0,
  };
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: FinanceDataPoint;
    value: number;
  }>;
  range: TimeRange;
  colors: typeof COLORS.positive;
  currency: string;
  decimals: number;
}

function CustomTooltip({
  active,
  payload,
  range,
  colors,
  currency,
  decimals,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none"
    >
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ color: colors.text }}
        >
          {formatPrice(data.price, currency, decimals)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatTooltipTime(data.time, range)}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Custom Cursor Component (vertical line only)
// ============================================================================

interface CustomCursorProps {
  points?: Array<{ x: number; y: number }>;
  height?: number;
  colors: typeof COLORS.positive;
}

function CustomCursor({ points, height, colors }: CustomCursorProps) {
  if (!points?.length) return null;

  const x = points[0].x;

  return (
    <g>
      {/* Vertical line */}
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={colors.line}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.4}
      />
    </g>
  );
}

// ============================================================================
// Custom Active Dot Component (dot on the line)
// ============================================================================

interface CustomActiveDotProps {
  cx?: number;
  cy?: number;
  colors: typeof COLORS.positive;
}

function CustomActiveDot({ cx, cy, colors }: CustomActiveDotProps) {
  if (!cx || !cy) return null;

  return (
    <g>
      {/* Glow dot */}
      <circle cx={cx} cy={cy} r={8} fill={colors.glow} opacity={0.4} />
      {/* Main dot */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={colors.line}
        stroke="white"
        strokeWidth={2}
      />
    </g>
  );
}

// ============================================================================
// Time Range Selector Component
// ============================================================================

interface TimeRangeSelectorProps {
  ranges: TimeRange[];
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  isPositive: boolean;
}

function TimeRangeSelector({
  ranges,
  selected,
  onChange,
  isPositive,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {ranges.map((range) => {
        const isSelected = range === selected;

        return (
          <button
            key={range}
            onClick={() => onChange(range)}
            className={cn(
              'relative px-3 py-1.5 text-xs font-medium',
              'transition-colors duration-200',
              'rounded-full',
              isSelected
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="timeRangeIndicator"
                className={cn(
                  'absolute inset-0 rounded-full',
                  isPositive ? 'bg-[#00C805]/10' : 'bg-[#FF5000]/10'
                )}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            <span className="relative z-10">{range}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ height }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/20 to-transparent animate-shimmer" />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        className="text-muted/30"
      >
        <path
          d="M0,150 Q50,120 100,130 T200,100 T300,110 T400,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity={0.3}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FinanceChart({
  data,
  loading = false,
  error = null,
  ticker,
  companyName,
  selectedRange = '1M',
  onRangeChange,
  timeRanges = DEFAULT_TIME_RANGES,
  height = 300,
  showHeader = true,
  className,
  forceColor,
  showVolume: _showVolume = false,
  currency = '$',
  decimals = 2,
}: FinanceChartProps) {
  const [hoveredData, setHoveredData] = useState<FinanceDataPoint | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate price change
  const priceChange = useMemo(() => calculatePriceChange(data), [data]);

  // Determine colors based on performance or forced color
  const colorScheme = useMemo(() => {
    if (forceColor) {
      return COLORS[forceColor];
    }
    return priceChange.isPositive ? COLORS.positive : COLORS.negative;
  }, [priceChange.isPositive, forceColor]);

  // Current display price (hovered or latest)
  const displayPrice = useMemo(() => {
    if (hoveredData) return hoveredData.price;
    if (data.length === 0) return 0;
    return data[data.length - 1].price;
  }, [hoveredData, data]);

  // Calculate Y-axis domain with padding
  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 100];

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;

    return [min - padding, max + padding];
  }, [data]);

  // Handle range change
  const handleRangeChange = useCallback(
    (range: TimeRange) => {
      onRangeChange?.(range);
      setHoveredData(null);
    },
    [onRangeChange]
  );

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredData(null);
  }, []);

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className={cn(
            'flex items-center justify-center rounded-lg',
            'border border-destructive/20 bg-destructive/5'
          )}
          style={{ height }}
        >
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || data.length === 0) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {showHeader && (
          <div className="flex flex-col gap-1">
            <div className="h-8 w-32 bg-muted/20 rounded animate-pulse" />
            <div className="h-5 w-48 bg-muted/10 rounded animate-pulse" />
          </div>
        )}
        <ChartSkeleton height={height} />
        {timeRanges.length > 0 && (
          <div className="flex justify-center">
            <div className="flex gap-2">
              {timeRanges.map((range) => (
                <div
                  key={range}
                  className="h-8 w-10 bg-muted/10 rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header with price info */}
      {showHeader && (
        <div className="flex flex-col gap-1">
          {/* Ticker and company name */}
          {(ticker || companyName) && (
            <div className="flex items-baseline gap-2">
              {ticker && (
                <span className="text-sm font-medium text-muted-foreground">
                  {ticker}
                </span>
              )}
              {companyName && (
                <span className="text-xs text-muted-foreground/60">
                  {companyName}
                </span>
              )}
            </div>
          )}

          {/* Price display */}
          <AnimatePresence mode="wait">
            <motion.div
              key={hoveredData ? 'hovered' : 'current'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="flex items-baseline gap-3"
            >
              <span className="text-3xl font-semibold tracking-tight">
                {formatPrice(displayPrice, currency, decimals)}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: colorScheme.text }}
              >
                {formatChange(priceChange.change, priceChange.changePercent)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Chart */}
      <div ref={chartRef} className="relative" onMouseLeave={handleMouseLeave}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            onMouseMove={(state) => {
              const chartState = state as {
                activePayload?: Array<{ payload: FinanceDataPoint }>;
              };
              if (chartState?.activePayload?.[0]) {
                setHoveredData(chartState.activePayload[0].payload);
              }
            }}
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient
                id="financeChartGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={colorScheme.line}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={colorScheme.line}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            {/* Reference line at start price */}
            <ReferenceLine
              y={data[0]?.price}
              stroke="hsl(var(--border))"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />

            {/* Hidden axes for proper scaling */}
            <XAxis
              dataKey="time"
              hide
              tickFormatter={(time) => formatTimeLabel(time, selectedRange)}
            />
            <YAxis domain={yDomain} hide />

            {/* Custom tooltip */}
            <Tooltip
              content={
                <CustomTooltip
                  range={selectedRange}
                  colors={colorScheme}
                  currency={currency}
                  decimals={decimals}
                />
              }
              cursor={<CustomCursor height={height} colors={colorScheme} />}
              position={{ y: -40 }}
              allowEscapeViewBox={{ x: true, y: true }}
            />

            {/* Area fill */}
            <Area
              type="monotone"
              dataKey="price"
              stroke={colorScheme.line}
              strokeWidth={2}
              fill="url(#financeChartGradient)"
              dot={false}
              activeDot={(props) => (
                <CustomActiveDot
                  cx={props.cx}
                  cy={props.cy}
                  colors={colorScheme}
                />
              )}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Time range selector */}
      {timeRanges.length > 0 && onRangeChange && (
        <div className="flex justify-center">
          <TimeRangeSelector
            ranges={timeRanges}
            selected={selectedRange}
            onChange={handleRangeChange}
            isPositive={forceColor === 'positive' || priceChange.isPositive}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Variant: Compact Finance Chart (for cards/widgets)
// ============================================================================

export interface CompactFinanceChartProps {
  data: FinanceDataPoint[];
  height?: number;
  className?: string;
  showIndicator?: boolean;
}

export function CompactFinanceChart({
  data,
  height = 60,
  className,
  showIndicator = true,
}: CompactFinanceChartProps) {
  const priceChange = useMemo(() => calculatePriceChange(data), [data]);

  const colorScheme = priceChange.isPositive
    ? COLORS.positive
    : COLORS.negative;

  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 100];
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.15;
    return [min - padding, max + padding];
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        className={cn('w-full bg-muted/10 rounded', className)}
        style={{ height }}
      />
    );
  }

  return (
    <div className={cn('relative', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient
              id="compactChartGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={colorScheme.line}
                stopOpacity={0.15}
              />
              <stop
                offset="100%"
                stopColor={colorScheme.line}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <YAxis domain={yDomain} hide />
          <XAxis hide />

          <Area
            type="monotone"
            dataKey="price"
            stroke={colorScheme.line}
            strokeWidth={1.5}
            fill="url(#compactChartGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Performance indicator dot */}
      {showIndicator && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: colorScheme.line }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export utilities
// ============================================================================

export {
  formatPrice as formatFinancePrice,
  formatChange as formatFinanceChange,
  calculatePriceChange,
  COLORS as FINANCE_CHART_COLORS,
};
