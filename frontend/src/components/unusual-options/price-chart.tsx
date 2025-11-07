"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  fetchHistoricalPrices,
  getPriceChange,
  getCurrentPrice,
  formatPrice,
  formatPriceChange,
  type PriceDataPoint,
  type TimeRange,
} from "@/lib/api/stock-prices";
import type { UnusualOptionsSignal } from "@/lib/types/unusual-options";
import { 
  formatPremiumFlow, 
  getGradeColor 
} from "@/lib/types/unusual-options";
import { Activity, X } from "lucide-react";

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

const TIME_RANGES: TimeRange[] = [
  '1D', 
  '1W', 
  '1M', 
  '3M', 
  '1Y', 
  '5Y', 
  'MAX'
];

export function PriceChart({ 
  ticker, 
  signals, 
  onSignalClick 
}: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState<{
    data: ChartDataPoint;
    x: number;
    y: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

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
            err instanceof Error 
              ? err.message 
              : 'Failed to load price data'
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

  // Clear pinned tooltip when time range changes
  useEffect(() => {
    setPinnedTooltip(null);
  }, [selectedRange]);

  // Handle escape key to close pinned tooltip
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pinnedTooltip) {
        setPinnedTooltip(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [pinnedTooltip]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (priceData.length === 0) return [];

    const dataMap = new Map<string, ChartDataPoint>();
    priceData.forEach((point: PriceDataPoint) => {
      dataMap.set(point.time, { ...point, detections: [] });
    });

    signals.forEach(signal => {
      const detectionTime = new Date(
        signal.detection_timestamp
      ).toISOString();
      
      let closestTime: string | null = null;
      let minDiff = Infinity;

      dataMap.forEach((_point: ChartDataPoint, time: string) => {
        const diff = Math.abs(
          new Date(time).getTime() - 
          new Date(detectionTime).getTime()
        );
        if (diff < minDiff) {
          minDiff = diff;
          closestTime = time;
        }
      });

      if (closestTime) {
        const point = dataMap.get(closestTime);
        if (point) {
          if (!point.detections) {
            point.detections = [];
          }
          
          point.detections.push({
            signal,
            y: signal.underlying_price || point.price,
          });
        }
      }
    });

    return Array.from(dataMap.values());
  }, [priceData, signals]);

  const priceChange = useMemo(
    () => getPriceChange(priceData),
    [priceData]
  );

  const currentPrice = useMemo(
    () => getCurrentPrice(priceData),
    [priceData]
  );

  // Calculate smart tooltip position that stays within chart bounds
  const tooltipPosition = useMemo(() => {
    if (!pinnedTooltip || !chartContainerRef.current) {
      return { left: 0, top: 0, transform: '', arrowClass: 'bottom' as const };
    }

    const container = chartContainerRef.current.getBoundingClientRect();
    const tooltipWidth = 200; // min-width from tooltip
    const tooltipHeight = 250; // approximate max height
    const arrowHeight = 12;
    const padding = 16;

    const { x, y } = pinnedTooltip;

    // Calculate initial position (above the dot)
    let left = x;
    let top = y - arrowHeight;
    let transform = 'translate(-50%, -100%)';
    let arrowClass: 'top' | 'bottom' = 'bottom'; // arrow points down by default

    // Check if tooltip goes off top - flip to bottom
    if (top - tooltipHeight < padding) {
      top = y + arrowHeight;
      transform = 'translate(-50%, 0%)';
      arrowClass = 'top'; // arrow points up
    }

    // Check horizontal bounds
    const tooltipLeft = left - tooltipWidth / 2;
    const tooltipRight = left + tooltipWidth / 2;

    if (tooltipLeft < padding) {
      // Too far left
      left = tooltipWidth / 2 + padding;
      transform = transform.replace('-50%', '0%');
    } else if (tooltipRight > container.width - padding) {
      // Too far right
      left = container.width - tooltipWidth / 2 - padding;
      transform = transform.replace('-50%', '-100%');
    }

    return { left, top, transform, arrowClass };
  }, [pinnedTooltip]);

  const CustomTooltip = ({ 
    active, 
    payload 
  }: { 
    active?: boolean; 
    payload?: Array<{ payload: ChartDataPoint }> 
  }) => {
    // Don't show hover tooltip if something is pinned
    if (pinnedTooltip !== null) return null;
    
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload as ChartDataPoint;
    const hasDetections = data.detections && data.detections.length > 0;

    return (
      <div className="relative group">
        {/* Invisible hover zone - extends above and below tooltip */}
        <div className="absolute inset-0 -inset-y-4 -inset-x-2" />
        
        <div 
          className="relative bg-background/95 backdrop-blur-lg border border-border/30 rounded shadow-xl p-2 min-w-[150px] animate-in fade-in-0 duration-100"
        >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="text-[8px] text-muted-foreground/50 font-medium">
                {new Date(data.time).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
              <div className="text-xs font-bold">
                {formatPrice(data.price)}
              </div>
            </div>
            {hasDetections && (
              <div className="text-[7px] text-muted-foreground/40 italic">
                Click dot to pin
              </div>
            )}
          </div>
          
          {hasDetections && (
            <>
              <div className="pt-1 mt-1 border-t border-border/10">
                <div className="text-[8px] font-semibold mb-1 flex items-center gap-1 text-muted-foreground/50 uppercase tracking-wider">
                  <Activity className="h-1.5 w-1.5" />
                  <span>
                    {data.detections!.length} Option{data.detections!.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                  {data.detections!.map(({ signal }) => (
                    <button
                      key={signal.signal_id}
                      onClick={() => onSignalClick?.(signal.signal_id)}
                      className="w-full text-xs p-1 bg-muted/5 rounded hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn(
                          "text-[9px] font-semibold capitalize",
                          signal.option_type === 'call' 
                            ? 'text-green-500' 
                            : 'text-red-500'
                        )}>
                          ${signal.strike} {signal.option_type}
                        </span>
                        <Badge className={cn(
                          "text-[7px] px-1 py-0 h-3",
                          getGradeColor(signal.grade)
                        )}>
                          {signal.grade}
                        </Badge>
                      </div>
                      <div className="text-[8px] font-semibold text-green-600">
                        {formatPremiumFlow(signal.premium_flow)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    );
  };

  const CustomDot = (props: {
    cx?: number;
    cy?: number;
    payload?: ChartDataPoint;
  }) => {
    const { cx, cy, payload } = props;
    
    if (!cx || !cy || !payload) return null;
    const data = payload as ChartDataPoint;
    
    if (!data.detections || data.detections.length === 0) {
      return null;
    }

    // Determine if this point has calls, puts, or both
    const hasCalls = data.detections.some(d => d.signal.option_type === 'call');
    const hasPuts = data.detections.some(d => d.signal.option_type === 'put');
    
    let color: string;
    if (hasCalls && hasPuts) {
      // Mixed - both calls and puts at this time
      color = '#a855f7'; // Purple for mixed
    } else if (hasCalls) {
      // Only calls
      color = '#10b981'; // Green for calls
    } else {
      // Only puts
      color = '#ef4444'; // Red for puts
    }
    
    const baseSize = 4;
    const size = Math.min(baseSize + data.detections.length * 1, 8);

    // Check if this dot is currently pinned
    const isPinned = pinnedTooltip !== null && 
                     pinnedTooltip.data.time === data.time;

    return (
      <g 
        style={{ cursor: 'pointer' }}
        className="transition-all duration-150"
        onClick={(e) => {
          e.stopPropagation();
          // Pin the tooltip at this location
          if (props.payload && cx && cy) {
            setPinnedTooltip({
              data: data,
              x: cx,
              y: cy
            });
          }
        }}
      >
        {/* Pinned indicator - pulsing ring */}
        {isPinned && (
          <>
            <circle
              cx={cx}
              cy={cy}
              r={size + 6}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              opacity={0.4}
            >
              <animate
                attributeName="r"
                from={size + 4}
                to={size + 8}
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
          </>
        )}
        
        {/* Outer glow - more subtle */}
        <circle
          cx={cx}
          cy={cy}
          r={size + 2.5}
          fill={color}
          fillOpacity={isPinned ? 0.15 : 0.08}
        />
        {/* Middle ring - subtle */}
        <circle
          cx={cx}
          cy={cy}
          r={size + 0.8}
          fill={color}
          fillOpacity={isPinned ? 0.3 : 0.18}
        />
        {/* Inner dot - solid */}
        <circle
          cx={cx}
          cy={cy}
          r={size}
          fill={color}
          stroke={isPinned ? "hsl(var(--primary))" : "hsl(var(--background))"}
          strokeWidth={isPinned ? 2 : 1.5}
        />
        {/* Badge for multiple detections - smaller */}
        {data.detections.length > 1 && (
          <>
            <circle
              cx={cx + size}
              cy={cy - size}
              r={5}
              fill="hsl(var(--background))"
              stroke={color}
              strokeWidth={1.2}
            />
            <text
              x={cx + size}
              y={cy - size}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontWeight="700"
              fill={color}
            >
              {data.detections.length}
            </text>
          </>
        )}
      </g>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[320px]">
        <div className="text-center space-y-2">
          <div className="relative">
            <div className="h-8 w-8 rounded-full border-2 border-muted/50 animate-pulse mx-auto" />
            <Activity 
              className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50 animate-pulse" 
            />
          </div>
          <div className="text-[10px] text-muted-foreground/50 font-medium">
            Loading {ticker}...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[320px]">
        <div className="text-center space-y-2.5">
          <div className="text-[10px] text-destructive/70 max-w-[250px] font-medium">
            {error}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchHistoricalPrices(ticker, selectedRange)
                .then(setPriceData)
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
            }}
            className="text-[10px] h-7 px-3"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Price Header */}
      <div className="space-y-0">
        <div className="text-2xl font-bold tracking-tight">
          {formatPrice(currentPrice)}
        </div>
        <div className={cn(
          "text-xs font-medium flex items-center gap-1",
          priceChange.isPositive 
            ? "text-green-500" 
            : "text-red-500"
        )}>
          <span>
            {formatPriceChange(
              priceChange.change, 
              priceChange.changePercent
            )}
          </span>
          <span className="text-muted-foreground/50 font-normal">
            Today
          </span>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        className="relative -mx-4 px-2" 
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.08) 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -20, bottom: 5 }}
          >
            <defs>
              <linearGradient 
                id="lineGradient" 
                x1="0" 
                y1="0" 
                x2="1" 
                y2="0"
              >
                <stop 
                  offset="0%" 
                  stopColor={
                    priceChange.isPositive ? "#10b981" : "#ef4444"
                  }
                  stopOpacity={1}
                />
                <stop 
                  offset="100%" 
                  stopColor={
                    priceChange.isPositive ? "#10b981" : "#ef4444"
                  }
                  stopOpacity={1}
                />
              </linearGradient>
            </defs>
            
            <XAxis
              dataKey="time"
              tickFormatter={(time) => {
                const date = new Date(time);
                if (selectedRange === '1D') {
                  return date.toLocaleTimeString('en-US', { 
                    hour: 'numeric'
                  });
                }
                return date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                });
              }}
              tick={{ 
                fontSize: 9, 
                fill: 'hsl(var(--muted-foreground))',
                opacity: 0.3
              }}
              tickLine={false}
              axisLine={false}
              minTickGap={70}
              height={20}
            />
            
            <YAxis
              domain={[
                (dataMin: number) => Math.floor(dataMin * 0.998),
                (dataMax: number) => Math.ceil(dataMax * 1.002)
              ]}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              tick={{ 
                fontSize: 9, 
                fill: 'hsl(var(--muted-foreground))',
                opacity: 0.3
              }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickCount={4}
            />
            
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ 
                stroke: 'hsl(var(--muted-foreground))', 
                strokeWidth: 0.5,
                strokeDasharray: '2 2',
                opacity: 0.15
              }}
              wrapperStyle={{ 
                outline: 'none',
                pointerEvents: 'auto',
                zIndex: 50
              }}
              isAnimationActive={false}
              animationDuration={0}
              allowEscapeViewBox={{ x: false, y: true }}
              offset={20}
            />
            
            <Line
              type="monotone"
              dataKey="price"
              stroke={priceChange.isPositive ? "#10b981" : "#ef4444"}
              strokeWidth={1.5}
              dot={(dotProps) => {
                // Extract key prop to avoid React warning about spreading keys
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { key, ...rest } = dotProps as any;
                return <CustomDot key={key} {...rest} />;
              }}
              activeDot={false}
              animationDuration={300}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Previous Close Label (Perplexity-style) */}
        {priceData.length > 0 && (
          <div 
            className="absolute top-3 right-8 text-[9px] text-muted-foreground/50 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border/20"
          >
            Prev close: {formatPrice(priceData[0]?.price || 0)}
          </div>
        )}

        {/* Pinned Tooltip Overlay */}
        {pinnedTooltip && (
          <div 
            className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-40 pointer-events-auto animate-in fade-in-0 duration-200"
            onClick={() => setPinnedTooltip(null)}
          />
        )}

        {/* Pinned Tooltip */}
        {pinnedTooltip && (
          <div 
            className="absolute pointer-events-auto z-50 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{
              left: `${tooltipPosition.left}px`,
              top: `${tooltipPosition.top}px`,
              transform: tooltipPosition.transform
            }}
          >
            <div className="relative">
              {/* Arrow pointing to dot */}
              {tooltipPosition.arrowClass === 'bottom' ? (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary/50"
                  style={{
                    bottom: '-8px'
                  }}
                />
              ) : (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-primary/50"
                  style={{
                    top: '-8px'
                  }}
                />
              )}
              
              <div className="bg-background/98 backdrop-blur-lg border-2 border-primary/50 rounded-lg shadow-2xl p-3 min-w-[200px]">
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-[10px] text-muted-foreground/60 font-medium mb-0.5">
                        {new Date(pinnedTooltip.data.time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {formatPrice(pinnedTooltip.data.price)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedTooltip(null);
                      }}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/20"
                      title="Close (ESC)"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {pinnedTooltip.data.detections && pinnedTooltip.data.detections.length > 0 && (
                    <>
                      <div className="border-t border-border/20 pt-2">
                        <div className="text-[9px] font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground/70 uppercase tracking-wide">
                          <Activity className="h-2 w-2" />
                          <span>
                            {pinnedTooltip.data.detections.length} Unusual Option{pinnedTooltip.data.detections.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                          {pinnedTooltip.data.detections.map(({ signal }) => (
                            <button
                              key={signal.signal_id}
                              onClick={() => {
                                onSignalClick?.(signal.signal_id);
                                setPinnedTooltip(null);
                              }}
                              className="w-full text-left p-2 bg-muted/10 hover:bg-muted/30 rounded-md transition-all cursor-pointer border border-transparent hover:border-primary/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn(
                                  "text-[11px] font-bold capitalize",
                                  signal.option_type === 'call' 
                                    ? 'text-green-500' 
                                    : 'text-red-500'
                                )}>
                                  ${signal.strike} {signal.option_type}
                                </span>
                                <Badge className={cn(
                                  "text-[8px] px-1.5 py-0.5 h-4",
                                  getGradeColor(signal.grade)
                                )}>
                                  {signal.grade}
                                </Badge>
                              </div>
                              <div className="text-[9px] font-semibold text-green-600">
                                {formatPremiumFlow(signal.premium_flow)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Range Buttons */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-0 bg-muted/20 rounded-md p-0.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={cn(
                "text-[10px] font-semibold h-6 px-2.5 rounded transition-all duration-150",
                selectedRange === range
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-background/50"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Legend - Minimal */}
      <div className="flex items-center justify-center gap-2.5 text-[9px] text-muted-foreground/40">
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-0.5 rounded-full bg-green-500/60" />
          <span>Calls</span>
        </div>
        <span className="text-muted-foreground/20">•</span>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-0.5 rounded-full bg-red-500/60" />
          <span>Puts</span>
        </div>
        <span className="text-muted-foreground/20">•</span>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-0.5 rounded-full bg-purple-500/60" />
          <span>Mixed</span>
        </div>
      </div>
    </div>
  );
}

