'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  fetchHistoricalPrices,
  getPriceChange,
  getCurrentPrice,
  formatPrice,
  type PriceDataPoint,
  type TimeRange,
} from '@/lib/api/stock-prices';
import type { UnusualOptionsSignal } from '@/lib/types/unusual-options';
import { formatPremiumFlow, getGradeColor } from '@/lib/types/unusual-options';
import { Activity, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PriceChartProps {
  ticker: string;
  signals: UnusualOptionsSignal[];
  onSignalClick?: (signalId: string) => void;
}

interface ChartDataPoint extends PriceDataPoint {
  detections?: Array<{
    signal: UnusualOptionsSignal;
    y: number;
  }>;
}

// ============================================================================
// Constants - Robinhood Colors
// ============================================================================

const COLORS = {
  positive: {
    line: '#00C805',
    glow: 'rgba(0, 200, 5, 0.4)',
  },
  negative: {
    line: '#FF5000',
    glow: 'rgba(255, 80, 0, 0.4)',
  },
  signals: {
    call: '#00C805',
    put: '#FF5000',
    mixed: '#a855f7',
  },
};

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', '5Y', 'MAX'];

// ============================================================================
// Helper Functions
// ============================================================================

function formatChange(change: number, percent: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${Math.abs(change).toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
}

// ============================================================================
// Time Range Selector Component
// ============================================================================

function TimeRangeSelector({
  ranges,
  selected,
  onChange,
  isPositive,
}: {
  ranges: TimeRange[];
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  isPositive: boolean;
}) {
  return (
    <div className="flex items-center justify-center">
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
                  layoutId="optionsTimeRangeIndicator"
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
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="h-8 w-28 bg-muted/20 rounded animate-pulse" />
        <div className="h-4 w-40 bg-muted/10 rounded animate-pulse" />
      </div>
      <div className="relative w-full overflow-hidden rounded-lg h-[260px]">
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent 
            via-muted/20 to-transparent animate-shimmer"
        />
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
      <div className="flex justify-center gap-2">
        {TIME_RANGES.slice(0, 5).map((range) => (
          <div
            key={range}
            className="h-7 w-10 bg-muted/10 rounded-full animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Custom Cursor Component (vertical line only)
// ============================================================================

function CustomCursor({
  points,
  height,
  color,
}: {
  points?: Array<{ x: number; y: number }>;
  height?: number;
  color: string;
}) {
  if (!points?.length) return null;

  const x = points[0].x;

  return (
    <g>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={color}
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

function CustomActiveDot({
  cx,
  cy,
  color,
}: {
  cx?: number;
  cy?: number;
  color: string;
}) {
  if (!cx || !cy) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.2} />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="white"
        strokeWidth={2}
      />
    </g>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PriceChart({
  ticker,
  signals,
  onSignalClick,
}: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState<{
    data: ChartDataPoint;
    x: number;
    y: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch price data
  useEffect(() => {
    let isMounted = true;

    async function loadPriceData() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchHistoricalPrices(ticker, selectedRange);
        if (isMounted) {
          setPriceData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load price data'
          );
          setPriceData([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPriceData();
    return () => {
      isMounted = false;
    };
  }, [ticker, selectedRange]);

  // Clear states when range changes
  useEffect(() => {
    setPinnedTooltip(null);
    setHoveredData(null);
  }, [selectedRange]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pinnedTooltip) {
        setPinnedTooltip(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [pinnedTooltip]);

  // Process chart data with signal detections
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (priceData.length === 0) return [];

    const dataMap = new Map<string, ChartDataPoint>();
    priceData.forEach((point) => {
      dataMap.set(point.time, { ...point, detections: [] });
    });

    signals.forEach((signal) => {
      const detectionTime = new Date(signal.detection_timestamp).toISOString();
      let closestTime: string | null = null;
      let minDiff = Infinity;

      dataMap.forEach((_, time) => {
        const diff = Math.abs(
          new Date(time).getTime() - new Date(detectionTime).getTime()
        );
        if (diff < minDiff) {
          minDiff = diff;
          closestTime = time;
        }
      });

      if (closestTime) {
        const point = dataMap.get(closestTime);
        if (point) {
          if (!point.detections) point.detections = [];
          point.detections.push({
            signal,
            y: signal.underlying_price || point.price,
          });
        }
      }
    });

    return Array.from(dataMap.values());
  }, [priceData, signals]);

  const priceChange = useMemo(() => getPriceChange(priceData), [priceData]);
  const currentPrice = useMemo(() => getCurrentPrice(priceData), [priceData]);

  const lineColor = priceChange.isPositive
    ? COLORS.positive.line
    : COLORS.negative.line;

  // Y-axis domain with padding
  const yDomain = useMemo(() => {
    if (priceData.length === 0) return [0, 100];
    const prices = priceData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [priceData]);

  // Tooltip position calculation
  const tooltipPosition = useMemo(() => {
    if (!pinnedTooltip || !chartContainerRef.current) {
      return { left: 0, top: 0, transform: '', arrowClass: 'bottom' as const };
    }

    const container = chartContainerRef.current.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = 280;
    const arrowHeight = 12;
    const padding = 16;
    const { x, y } = pinnedTooltip;

    let left = x;
    let top = y - arrowHeight;
    let transform = 'translate(-50%, -100%)';
    let arrowClass: 'top' | 'bottom' = 'bottom';

    if (top - tooltipHeight < padding) {
      top = y + arrowHeight;
      transform = 'translate(-50%, 0%)';
      arrowClass = 'top';
    }

    const tooltipLeft = left - tooltipWidth / 2;
    const tooltipRight = left + tooltipWidth / 2;

    if (tooltipLeft < padding) {
      left = tooltipWidth / 2 + padding;
    } else if (tooltipRight > container.width - padding) {
      left = container.width - tooltipWidth / 2 - padding;
    }

    return { left, top, transform, arrowClass };
  }, [pinnedTooltip]);

  // Display price (hovered or current)
  const displayPrice = useMemo(() => {
    if (hoveredData) return hoveredData.price;
    return currentPrice;
  }, [hoveredData, currentPrice]);

  const handleRangeChange = useCallback((range: TimeRange) => {
    setSelectedRange(range);
    setPinnedTooltip(null);
    setHoveredData(null);
  }, []);

  // Custom hover tooltip
  const HoverTooltip = useCallback(
    ({
      active,
      payload,
    }: {
      active?: boolean;
      payload?: Array<{ payload: ChartDataPoint }>;
    }) => {
      if (pinnedTooltip !== null) return null;
      if (!active || !payload || payload.length === 0) return null;

      const data = payload[0].payload;
      const hasDetections = data.detections && data.detections.length > 0;

      return (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none"
        >
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ color: lineColor }}
            >
              {formatPrice(data.price)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(data.time).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            {hasDetections && (
              <span className="text-[10px] text-muted-foreground/60 mt-1">
                Click dot for signal details
              </span>
            )}
          </div>
        </motion.div>
      );
    },
    [pinnedTooltip, lineColor]
  );

  // Custom signal dot
  const SignalDot = useCallback(
    (props: { cx?: number; cy?: number; payload?: ChartDataPoint }) => {
      const { cx, cy, payload } = props;
      if (!cx || !cy || !payload) return null;

      const data = payload;
      if (!data.detections || data.detections.length === 0) return null;

      const hasCalls = data.detections.some(
        (d) => d.signal.option_type === 'call'
      );
      const hasPuts = data.detections.some(
        (d) => d.signal.option_type === 'put'
      );

      let color: string;
      if (hasCalls && hasPuts) {
        color = COLORS.signals.mixed;
      } else if (hasCalls) {
        color = COLORS.signals.call;
      } else {
        color = COLORS.signals.put;
      }

      const baseSize = 4;
      const size = Math.min(baseSize + data.detections.length * 1, 8);
      const isPinned =
        pinnedTooltip !== null && pinnedTooltip.data.time === data.time;

      return (
        <g
          style={{ cursor: 'pointer' }}
          className="transition-all duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setPinnedTooltip({ data, x: cx, y: cy });
          }}
        >
          {isPinned && (
            <circle
              cx={cx}
              cy={cy}
              r={size + 6}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              opacity={0.4}
            >
              <animate
                attributeName="r"
                from={size + 4}
                to={size + 10}
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from={0.6}
                to={0.1}
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle
            cx={cx}
            cy={cy}
            r={size + 3}
            fill={color}
            fillOpacity={isPinned ? 0.2 : 0.1}
          />
          <circle cx={cx} cy={cy} r={size} fill={color} />
          <circle cx={cx} cy={cy} r={size - 1} fill="white" fillOpacity={0.3} />
          {data.detections.length > 1 && (
            <>
              <circle
                cx={cx + size}
                cy={cy - size}
                r={6}
                fill="white"
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={cx + size}
                y={cy - size}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight="700"
                fill={color}
              >
                {data.detections.length}
              </text>
            </>
          )}
        </g>
      );
    },
    [pinnedTooltip, lineColor]
  );

  // Loading state
  if (loading) {
    return <ChartSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchHistoricalPrices(ticker, selectedRange)
              .then(setPriceData)
              .catch((err) => setError(err.message))
              .finally(() => setLoading(false));
          }}
          className={cn(
            'px-4 py-2 text-xs font-medium rounded-full',
            'bg-muted/20 hover:bg-muted/40 transition-colors'
          )}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Price Header - Robinhood Style */}
      <div className="space-y-1">
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
              {formatPrice(displayPrice)}
            </span>
            <span className="text-sm font-medium" style={{ color: lineColor }}>
              {formatChange(priceChange.change, priceChange.changePercent)}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="relative"
        onMouseLeave={() => setHoveredData(null)}
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            onMouseMove={(state) => {
              const chartState = state as {
                activePayload?: Array<{ payload: ChartDataPoint }>;
              };
              if (chartState?.activePayload?.[0] && !pinnedTooltip) {
                setHoveredData(chartState.activePayload[0].payload);
              }
            }}
          >
            <defs>
              <linearGradient
                id="optionsChartGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Reference line at start price */}
            {priceData.length > 0 && (
              <ReferenceLine
                y={priceData[0]?.price}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}

            <XAxis dataKey="time" hide />
            <YAxis domain={yDomain} hide />

            <Tooltip
              content={<HoverTooltip />}
              cursor={<CustomCursor height={260} color={lineColor} />}
              position={{ y: -40 }}
              allowEscapeViewBox={{ x: true, y: true }}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#optionsChartGradient)"
              dot={(dotProps) => {
                const { key, ...rest } = dotProps as { key?: string };
                return <SignalDot key={key} {...rest} />;
              }}
              activeDot={(props) => (
                <CustomActiveDot
                  cx={props.cx}
                  cy={props.cy}
                  color={lineColor}
                />
              )}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Pinned Tooltip Overlay */}
        {pinnedTooltip && (
          <div
            className="absolute inset-0 bg-background/30 backdrop-blur-[1px] 
              z-40 animate-in fade-in-0 duration-200"
            onClick={() => setPinnedTooltip(null)}
          />
        )}

        {/* Pinned Tooltip */}
        <AnimatePresence>
          {pinnedTooltip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute pointer-events-auto z-50"
              style={{
                left: `${tooltipPosition.left}px`,
                top: `${tooltipPosition.top}px`,
                transform: tooltipPosition.transform,
              }}
            >
              <div className="relative">
                {/* Arrow */}
                {tooltipPosition.arrowClass === 'bottom' ? (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-0 h-0 
                      border-l-[6px] border-r-[6px] border-t-[8px] 
                      border-l-transparent border-r-transparent"
                    style={{
                      bottom: '-8px',
                      borderTopColor: lineColor,
                      opacity: 0.6,
                    }}
                  />
                ) : (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-0 h-0 
                      border-l-[6px] border-r-[6px] border-b-[8px] 
                      border-l-transparent border-r-transparent"
                    style={{
                      top: '-8px',
                      borderBottomColor: lineColor,
                      opacity: 0.6,
                    }}
                  />
                )}

                <div
                  className="bg-background/98 backdrop-blur-xl rounded-xl 
                    shadow-2xl p-4 min-w-[220px] border-2"
                  style={{ borderColor: `${lineColor}40` }}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                          {new Date(pinnedTooltip.data.time).toLocaleDateString(
                            'en-US',
                            {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }
                          )}
                        </div>
                        <div
                          className="text-xl font-bold"
                          style={{ color: lineColor }}
                        >
                          {formatPrice(pinnedTooltip.data.price)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedTooltip(null);
                        }}
                        className="text-muted-foreground/50 hover:text-foreground 
                          transition-colors p-1 rounded-full hover:bg-muted/30"
                        title="Close (ESC)"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Signal Details */}
                    {pinnedTooltip.data.detections &&
                      pinnedTooltip.data.detections.length > 0 && (
                        <div className="border-t border-border/30 pt-3">
                          <div
                            className="text-[10px] font-semibold mb-2 flex 
                              items-center gap-1.5 text-muted-foreground/80 
                              uppercase tracking-wide"
                          >
                            <Activity className="h-3 w-3" />
                            <span>
                              {pinnedTooltip.data.detections.length} Signal
                              {pinnedTooltip.data.detections.length > 1
                                ? 's'
                                : ''}
                            </span>
                          </div>
                          <div
                            className="space-y-2 max-h-[180px] overflow-y-auto 
                              pr-1 scrollbar-thin"
                          >
                            {pinnedTooltip.data.detections.map(({ signal }) => (
                              <button
                                key={signal.signal_id}
                                onClick={() => {
                                  onSignalClick?.(signal.signal_id);
                                  setPinnedTooltip(null);
                                }}
                                className={cn(
                                  'w-full text-left p-3 rounded-lg',
                                  'transition-all cursor-pointer',
                                  'border border-transparent',
                                  'bg-muted/10 hover:bg-muted/30',
                                  'hover:border-border/50'
                                )}
                              >
                                <div
                                  className="flex items-center justify-between 
                                    mb-1.5"
                                >
                                  <span
                                    className={cn(
                                      'text-sm font-bold capitalize',
                                      signal.option_type === 'call'
                                        ? 'text-[#00C805]'
                                        : 'text-[#FF5000]'
                                    )}
                                  >
                                    ${signal.strike} {signal.option_type}
                                  </span>
                                  <Badge
                                    className={cn(
                                      'text-[9px] px-2 py-0.5',
                                      getGradeColor(signal.grade)
                                    )}
                                  >
                                    {signal.grade}
                                  </Badge>
                                </div>
                                <div
                                  className="text-xs font-semibold"
                                  style={{ color: COLORS.positive.line }}
                                >
                                  {formatPremiumFlow(signal.premium_flow)}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Time Range Selector */}
      <TimeRangeSelector
        ranges={TIME_RANGES}
        selected={selectedRange}
        onChange={handleRangeChange}
        isPositive={priceChange.isPositive}
      />

      {/* Legend */}
      <div
        className="flex items-center justify-center gap-4 text-[10px] 
          text-muted-foreground/60"
      >
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COLORS.signals.call }}
          />
          <span>Calls</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COLORS.signals.put }}
          />
          <span>Puts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COLORS.signals.mixed }}
          />
          <span>Mixed</span>
        </div>
      </div>
    </div>
  );
}
