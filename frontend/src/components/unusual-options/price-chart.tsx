"use client";

import { useState, useEffect, useMemo } from "react";
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

    const highestGrade = data.detections.reduce((best, curr) => {
      const gradeOrder = { 
        'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 
      };
      return gradeOrder[curr.signal.grade] > 
        gradeOrder[best.signal.grade] 
        ? curr 
        : best;
    }, data.detections[0]);

    const isCall = highestGrade.signal.option_type === 'call';
    const gradeColors: Record<string, string> = {
      'S': isCall ? '#a855f7' : '#dc2626',
      'A': isCall ? '#10b981' : '#ef4444',
      'B': isCall ? '#3b82f6' : '#f97316',
      'C': isCall ? '#eab308' : '#f59e0b',
      'D': isCall ? '#f97316' : '#ea580c',
      'F': '#6b7280',
    };

    const color = gradeColors[highestGrade.signal.grade] || '#6b7280';
    
    const baseSize = 4;
    const size = Math.min(baseSize + data.detections.length * 1, 8);

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
        {/* Outer glow - more subtle */}
        <circle
          cx={cx}
          cy={cy}
          r={size + 2.5}
          fill={color}
          fillOpacity={0.08}
        />
        {/* Middle ring - subtle */}
        <circle
          cx={cx}
          cy={cy}
          r={size + 0.8}
          fill={color}
          fillOpacity={0.18}
        />
        {/* Inner dot - solid */}
        <circle
          cx={cx}
          cy={cy}
          r={size}
          fill={color}
          stroke="hsl(var(--background))"
          strokeWidth={1.5}
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
        onClick={(e) => {
          // Close pinned tooltip when clicking on chart background
          const target = e.target as HTMLElement;
          if (target.tagName === 'DIV' && pinnedTooltip) {
            setPinnedTooltip(null);
          }
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

        {/* Pinned Tooltip */}
        {pinnedTooltip && (
          <div 
            className="absolute pointer-events-auto z-50"
            style={{
              left: `${pinnedTooltip.x}px`,
              top: `${pinnedTooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-20px'
            }}
          >
            <div className="relative">
              <div className="bg-background/95 backdrop-blur-lg border border-primary/50 rounded shadow-xl p-2 min-w-[150px]">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="text-[8px] text-muted-foreground/50 font-medium">
                        {new Date(pinnedTooltip.data.time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="text-xs font-bold">
                        {formatPrice(pinnedTooltip.data.price)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedTooltip(null);
                      }}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors"
                      title="Close (ESC)"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {pinnedTooltip.data.detections && pinnedTooltip.data.detections.length > 0 && (
                    <>
                      <div className="pt-1 mt-1 border-t border-border/10">
                        <div className="text-[8px] font-semibold mb-1 flex items-center gap-1 text-muted-foreground/50 uppercase tracking-wider">
                          <Activity className="h-1.5 w-1.5" />
                          <span>
                            {pinnedTooltip.data.detections.length} Option{pinnedTooltip.data.detections.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                          {pinnedTooltip.data.detections.map(({ signal }) => (
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
          <span>S-Grade</span>
        </div>
      </div>
    </div>
  );
}

