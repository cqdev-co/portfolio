"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TickerData } from "@lib/ai-agent";

// Tool call state
export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "complete" | "error";
  result?: unknown;
  error?: string;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
  className?: string;
}

// Tool display config
const TOOL_CONFIG: Record<string, {
  name: string;
  icon: string;
  description: string;
}> = {
  get_ticker_data: {
    name: "Market Data",
    icon: "📊",
    description: "Fetching real-time stock data",
  },
  web_search: {
    name: "Web Search", 
    icon: "🔍",
    description: "Searching the web",
  },
  analyze_position: {
    name: "Position Analysis",
    icon: "📈",
    description: "Analyzing position",
  },
  scan_for_opportunities: {
    name: "Market Scan",
    icon: "🎯",
    description: "Scanning for opportunities",
  },
};

/**
 * Collapsible card showing tool execution status and results.
 * Professional UI with expandable data view for debugging.
 */
export function ToolCallCard({ toolCall, className }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tool, args, status, result, error } = toolCall;
  
  const config = TOOL_CONFIG[tool] || {
    name: tool,
    icon: "⚙️",
    description: `Running ${tool}`,
  };

  // Get ticker from args if available
  const ticker = (args as { ticker?: string })?.ticker;
  
  // Format result preview
  const getResultPreview = () => {
    if (!result) return null;
    
    if (tool === "get_ticker_data" && typeof result === "object") {
      const data = result as TickerData;
      return `$${data.price?.toFixed(2) || "—"} | RSI ${data.rsi?.toFixed(0) || "—"}`;
    }
    
    if (tool === "web_search" && Array.isArray(result)) {
      return `${result.length} results found`;
    }
    
    return "Data retrieved";
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        "transition-all duration-200",
        status === "running" && "border-blue-300 dark:border-blue-700",
        status === "complete" && "border-emerald-300 dark:border-emerald-700",
        status === "error" && "border-red-300 dark:border-red-700",
        status === "pending" && "border-border",
        className
      )}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => status === "complete" && setIsExpanded(!isExpanded)}
        disabled={status !== "complete"}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5",
          "text-left text-sm",
          status === "complete" && "cursor-pointer hover:bg-muted/50",
          status !== "complete" && "cursor-default"
        )}
      >
        {/* Status Icon */}
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg",
          "text-base shrink-0",
          status === "pending" && "bg-muted text-muted-foreground",
          status === "running" && "bg-blue-500/10 text-blue-600",
          status === "complete" && "bg-emerald-500/10 text-emerald-600",
          status === "error" && "bg-red-500/10 text-red-600"
        )}>
          {status === "running" ? (
            <div className="relative w-4 h-4">
              <div className={cn(
                "absolute inset-0 rounded-full",
                "border-2 border-current border-t-transparent",
                "animate-spin"
              )} />
            </div>
          ) : status === "complete" ? (
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path 
                d="M3 8.5L6.5 12L13 4" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          ) : status === "error" ? (
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path 
                d="M4 4L12 12M12 4L4 12" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <span>{config.icon}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {config.name}
            </span>
            {ticker && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                "bg-primary/10 text-primary uppercase"
              )}>
                {ticker}
              </span>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {status === "running" && (
              <span className="flex items-center gap-1">
                {config.description}
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              </span>
            )}
            {status === "complete" && getResultPreview()}
            {status === "error" && (error || "Failed to execute")}
            {status === "pending" && "Waiting..."}
          </div>
        </div>

        {/* Expand indicator */}
        {status === "complete" && result && (
          <svg 
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )} 
            viewBox="0 0 16 16" 
            fill="none"
          >
            <path 
              d="M4 6L8 10L12 6" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Expandable Data Section */}
      <AnimatePresence>
        {isExpanded && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "px-3 py-3 border-t",
              "bg-muted/30 text-xs"
            )}>
              {/* Ticker Data Display */}
              {tool === "get_ticker_data" && typeof result === "object" && (
                <TickerDataSummary data={result as TickerData} />
              )}
              
              {/* Web Search Results */}
              {tool === "web_search" && Array.isArray(result) && (
                <WebSearchResults results={result} />
              )}
              
              {/* Raw JSON for other tools */}
              {tool !== "get_ticker_data" && tool !== "web_search" && (
                <pre className={cn(
                  "p-2 rounded bg-muted overflow-x-auto",
                  "text-[10px] font-mono max-h-48"
                )}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact ticker data summary for expanded view
 */
function TickerDataSummary({ data }: { data: TickerData }) {
  return (
    <div className="space-y-3">
      {/* Core Metrics */}
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      <DataRow label="Price" value={`$${data.price?.toFixed(2)}`} />
        <DataRow 
          label="Change" 
          value={`${data.changePct >= 0 ? "+" : ""}${data.changePct?.toFixed(2)}%`} 
          className={data.changePct >= 0 ? "text-emerald-600" : "text-red-500"} 
        />
      {data.rsi && <DataRow label="RSI" value={data.rsi.toFixed(1)} />}
        {data.adx && <DataRow label="ADX" value={data.adx.toFixed(0)} />}
      {data.ma200 && <DataRow label="MA200" value={`$${data.ma200.toFixed(0)}`} />}
        {data.marketCap && (
          <DataRow label="Market Cap" value={formatMarketCap(data.marketCap)} />
        )}
      {data.peRatio && <DataRow label="P/E" value={data.peRatio.toFixed(1)} />}
      {data.analystRatings && (
          <DataRow 
            label="Sentiment" 
            value={`${data.analystRatings.bullishPercent}% Bullish`} 
          />
        )}
      </div>
      
      {/* Rich Data - Options Flow & Relative Strength */}
      {(data.optionsFlow || data.relativeStrength || data.shortInterest) && (
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {data.optionsFlow && (
              <DataRow 
                label="P/C Ratio" 
                value={`${data.optionsFlow.pcRatioOI.toFixed(2)} (${data.optionsFlow.sentiment})`}
                className={
                  data.optionsFlow.sentiment === "bullish" 
                    ? "text-emerald-600" 
                    : data.optionsFlow.sentiment === "bearish" 
                      ? "text-red-500" 
                      : undefined
                }
              />
            )}
            {data.relativeStrength && (
              <DataRow 
                label="vs SPY" 
                value={`${data.relativeStrength.vsSPY >= 0 ? "+" : ""}${data.relativeStrength.vsSPY.toFixed(1)}%`}
                className={
                  data.relativeStrength.vsSPY > 0 
                    ? "text-emerald-600" 
                    : data.relativeStrength.vsSPY < 0 
                      ? "text-red-500" 
                      : undefined
                }
              />
            )}
            {data.shortInterest && data.shortInterest.shortPct !== undefined && (
              <DataRow 
                label="Short" 
                value={`${data.shortInterest.shortPct.toFixed(1)}% (${data.shortInterest.shortRatio?.toFixed(1) || "—"}d)`} 
              />
            )}
          </div>
        </div>
      )}
      
      {/* Earnings with history */}
      {(data.earningsDays !== undefined && data.earningsDays !== null || data.earnings) && (
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {data.earningsDays !== undefined && data.earningsDays !== null && (
              <DataRow 
                label="Earnings" 
                value={data.earningsDays > 0 ? `${data.earningsDays}d` : 'Passed'} 
              />
            )}
            {data.earnings?.streak && (
              <DataRow 
                label="Streak" 
                value={data.earnings.streak > 0 
                  ? `${data.earnings.streak} beats` 
                  : `${Math.abs(data.earnings.streak)} misses`}
                className={data.earnings.streak > 0 ? "text-emerald-600" : "text-red-500"}
              />
            )}
            {data.earnings?.lastSurprise !== undefined && (
              <DataRow 
                label="Last Surprise" 
                value={`${data.earnings.lastSurprise >= 0 ? "+" : ""}${data.earnings.lastSurprise.toFixed(1)}%`}
                className={data.earnings.lastSurprise >= 0 ? "text-emerald-600" : "text-red-500"}
              />
            )}
          </div>
        </div>
      )}
      
      {/* IV Analysis */}
      {data.iv && (
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <DataRow label="IV" value={`${data.iv.currentIV.toFixed(0)}%`} />
            {data.iv.hv20 && <DataRow label="HV20" value={`${data.iv.hv20.toFixed(0)}%`} />}
            {data.iv.premium && (
              <DataRow 
                label="Options" 
                value={data.iv.premium}
                className={
                  data.iv.premium === "cheap" 
                    ? "text-emerald-600" 
                    : data.iv.premium === "expensive" 
                      ? "text-amber-500" 
                      : undefined
                }
              />
            )}
          </div>
        </div>
      )}
      
      {/* PFV */}
      {data.pfv && (
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <DataRow 
              label="🧠 PFV" 
              value={`$${data.pfv.fairValue?.toFixed(2) ?? "—"}`} 
            />
            <DataRow 
              label="Divergence" 
              value={data.pfv.deviationPercent != null 
                ? `${data.pfv.deviationPercent >= 0 ? "+" : ""}${data.pfv.deviationPercent.toFixed(1)}%`
                : "—"}
              className={data.pfv.deviationPercent != null && data.pfv.deviationPercent < 0 
                ? "text-red-500" 
                : "text-emerald-600"}
            />
            <DataRow label="Bias" value={data.pfv.bias || "—"} />
            <DataRow label="Confidence" value={data.pfv.confidence || "—"} />
          </div>
        </div>
      )}
      
      {/* Spread */}
      {data.spread && (
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <DataRow 
              label="Spread" 
              value={`$${data.spread.longStrike}/$${data.spread.shortStrike}`} 
            />
            <DataRow 
              label="Debit" 
              value={`$${data.spread.estimatedDebit.toFixed(2)}`} 
            />
            <DataRow label="Cushion" value={`${data.spread.cushion.toFixed(1)}%`} />
            {data.spread.pop && (
              <DataRow label="PoP" value={`${data.spread.pop.toFixed(0)}%`} />
            )}
          </div>
        </div>
      )}
      
      {/* Grade */}
      {data.grade && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Grade</span>
            <span className={cn(
              "px-2 py-0.5 rounded font-medium",
              data.grade.grade.startsWith("A") 
                ? "bg-emerald-500/10 text-emerald-600"
                : data.grade.grade.startsWith("B")
                  ? "bg-blue-500/10 text-blue-600"
                  : "bg-amber-500/10 text-amber-600"
            )}>
              {data.grade.grade} ({data.grade.score}/100) - {data.grade.recommendation}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({ 
  label, 
  value, 
  className 
}: { 
  label: string; 
  value: string; 
  className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", className)}>{value}</span>
    </div>
  );
}

function formatMarketCap(mc: number) {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(0)}B`;
  return `$${(mc / 1e6).toFixed(0)}M`;
}

/**
 * Web search results display
 */
function WebSearchResults({ results }: { results: Array<{ title: string; url?: string; snippet?: string }> }) {
  return (
    <div className="space-y-2">
      {results.slice(0, 3).map((r, i) => (
        <div key={i} className="space-y-0.5">
          <div className="font-medium text-foreground line-clamp-1">
            {r.title}
          </div>
          {r.snippet && (
            <div className="text-muted-foreground line-clamp-2">
              {r.snippet}
            </div>
          )}
        </div>
      ))}
      {results.length > 3 && (
        <div className="text-muted-foreground">
          +{results.length - 3} more results
        </div>
      )}
    </div>
  );
}

