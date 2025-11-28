"use client";

import { useState, useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
} from "lucide-react";
import { useMarketData } from "@/lib/odyssey/hooks/useMarketData";
import { useOpportunities } from "@/lib/odyssey/hooks/useOpportunities";
import { useStrategyConfig } from "@/lib/odyssey/hooks/useStrategyConfig";
import { useHPFChecklist } from "@/lib/odyssey/hooks/useHPFChecklist";
import { usePinnedPlans } from "@/lib/odyssey/hooks/usePinnedPlans";
import { useUnusualOptionsTickers } from "@/lib/odyssey/hooks/useUnusualOptionsTickers";
import { Opportunity } from "@/lib/odyssey/strategies/types";
import {
  DEFAULT_ENTRY_RULES,
  DEFAULT_EXIT_RULES,
} from "@/lib/odyssey/strategies/HPFIndexCreditSpreadStrategy";
import {
  formatCurrency,
  formatPercentage,
  formatTime,
} from "@/lib/odyssey/utils/formatters";
import { QuickGlanceHero } from "@/components/odyssey/QuickGlanceHero";
import { StrategyChecklist } from "@/components/odyssey/StrategyChecklist";

// Market sentiment based on VIX and index performance
function getMarketSentiment(
  vix: number | undefined,
  spyChange: number | undefined
): {
  label: string;
  description: string;
  action: string;
  color: string;
  icon: React.ReactNode;
} {
  if (!vix || spyChange === undefined) {
    return {
      label: "Loading",
      description: "Fetching market data...",
      action: "Wait for data",
      color: "text-muted-foreground",
      icon: <Clock className="h-5 w-5" />,
    };
  }

  if (vix >= 30) {
    return {
      label: "High Volatility",
      description:
        "Market is stressed. High risk, but potential for oversold bounces.",
      action: "Be cautious. Wait for stabilization or target oversold names.",
      color: "text-red-600 dark:text-red-400",
      icon: <AlertTriangle className="h-5 w-5" />,
    };
  }

  if (vix >= 20) {
    if (spyChange < -1) {
      return {
        label: "Pullback",
        description:
          "Elevated fear with selling pressure. Could be opportunity.",
        action: "Watch for support levels. Consider scaling into positions.",
        color: "text-amber-600 dark:text-amber-400",
        icon: <AlertTriangle className="h-5 w-5" />,
      };
    }
    return {
      label: "Elevated Caution",
      description:
        "Above-average uncertainty. Markets could move either way.",
      action: "Be selective. Focus on high-conviction setups only.",
      color: "text-amber-600 dark:text-amber-400",
      icon: <Minus className="h-5 w-5" />,
    };
  }

  if (vix < 15 && spyChange > 0.5) {
    return {
      label: "Low Vol Rally",
      description:
        "Complacent market with upward drift. Low fear environment.",
      action: "Good for credit spreads. Consider taking profits on longs.",
      color: "text-green-600 dark:text-green-400",
      icon: <CheckCircle className="h-5 w-5" />,
    };
  }

  if (spyChange > 1) {
    return {
      label: "Strong Day",
      description: "Bullish momentum. Risk-on sentiment.",
      action: "Let winners run. Avoid chasing extended moves.",
      color: "text-green-600 dark:text-green-400",
      icon: <TrendingUp className="h-5 w-5" />,
    };
  }

  if (spyChange < -1) {
    return {
      label: "Weak Day",
      description: "Selling pressure, but VIX is contained.",
      action: "Watch for bounce. Don't panic sell quality positions.",
      color: "text-red-600 dark:text-red-400",
      icon: <TrendingDown className="h-5 w-5" />,
    };
  }

  return {
    label: "Neutral",
    description: "Normal market conditions. No extreme readings.",
    action: "Business as usual. Follow your trading plan.",
    color: "text-muted-foreground",
    icon: <Minus className="h-5 w-5" />,
  };
}

export default function OdysseyPage() {
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);
  const [showHPFChecklist, setShowHPFChecklist] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const analyzeRef = useRef(false);

  const { config, addToWatchlist, removeFromWatchlist } = useStrategyConfig();

  // HPF Checklist
  const {
    checklist: hpfChecklist,
    isLoading: isLoadingChecklist,
    runChecklist,
  } = useHPFChecklist();

  // Pinned Plans
  const { pinnedPlan, pinPlan, unpinPlan } = usePinnedPlans();

  // Unusual Options Tickers from Supabase
  // Note: overall_score is on 0-1 scale, not 0-100
  const {
    tickers: unusualTickers,
    tickerDetails: unusualTickerDetails,
    isLoading: isLoadingUnusual,
    error: unusualError,
    refresh: refreshUnusualTickers,
  } = useUnusualOptionsTickers({
    minGrade: ["S", "A", "B", "C"],
    minScore: 0.4, // 0-1 scale (0.4 = 40%)
    activeOnly: false,
    maxTickers: 15,
    daysBack: 14,
  });

  // Combine manual watchlist with unusual options tickers
  const combinedWatchlist = [
    ...new Set([...config.watchlist, ...unusualTickers]),
  ];

  // Disable auto-refresh - only fetch on page load + manual refresh
  const {
    marketData,
    sectorData,
    isLoading: isLoadingMarket,
    error: marketError,
    refresh: refreshMarket,
    lastUpdate,
  } = useMarketData(false);

  const {
    opportunities,
    isAnalyzing,
    error: opportunitiesError,
    analyze,
    strategiesLoaded,
    optionsDataCount,
  } = useOpportunities(marketData, combinedWatchlist);

  // Only analyze once on initial load
  useEffect(() => {
    if (marketData.length > 0 && !hasAnalyzed && !analyzeRef.current) {
      analyzeRef.current = true;
      Promise.all([analyze(), runChecklist(marketData)]).finally(() =>
        setHasAnalyzed(true)
      );
    }
  }, [marketData, hasAnalyzed, analyze, runChecklist]);

  const handleRefresh = async () => {
    await Promise.all([refreshMarket(), refreshUnusualTickers()]);
    await Promise.all([analyze(), runChecklist(marketData)]);
  };

  const handleAddSymbol = () => {
    if (newSymbol.trim()) {
      addToWatchlist(newSymbol.trim().toUpperCase());
      setNewSymbol("");
    }
  };

  const handlePinToggle = () => {
    if (pinnedPlan?.id === "hpf-ics-default") {
      unpinPlan("hpf-ics-default");
    } else {
      pinPlan("hpf-ics-default");
    }
  };

  const isRefreshing = isLoadingMarket || isAnalyzing;

  // Extract key data
  const vix = marketData.find((d) => d.symbol === "^VIX");
  const spy = marketData.find((d) => d.symbol === "SPY");
  const qqq = marketData.find((d) => d.symbol === "QQQ");

  const sentiment = getMarketSentiment(vix?.price, spy?.changePercent);

  // Sort sectors by performance - show top 3 only
  const sortedSectors = [...sectorData].sort(
    (a, b) => b.changePercent - a.changePercent
  );
  const topSectors = sortedSectors.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Odyssey</h1>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-caption text-muted-foreground">
              {formatTime(lastUpdate)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {(marketError || opportunitiesError) && (
        <div
          className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 
          border border-red-200 dark:border-red-800 text-sm 
          text-red-700 dark:text-red-400"
        >
          {marketError || opportunitiesError}
        </div>
      )}

      {/* Quick Glance Hero - Top Actions (PRIMARY FOCUS) */}
      <QuickGlanceHero
        opportunities={opportunities}
        maxItems={5}
        isLoading={isAnalyzing && !hasAnalyzed}
      />

      {/* Scanning Status Strip */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground 
        p-2 rounded-md bg-muted/30 border border-border/50">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <span className="font-medium">Strategies:</span>
          <span>
            {strategiesLoaded.length > 0 
              ? strategiesLoaded.map((s) => s.split(" (")[0]).join(", ")
              : "Loading..."}
          </span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" />
          <span className="font-medium">Scanning:</span>
          <span>{combinedWatchlist.length} tickers</span>
          <span className="text-muted-foreground/60">
            ({optionsDataCount} contracts)
          </span>
        </div>
      </div>

      {/* Market Pulse Strip - Condensed */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            {/* Sentiment */}
            <div className="flex items-center gap-2 flex-1">
              <span className={sentiment.color}>{sentiment.icon}</span>
              <div>
                <Badge variant="outline" className={`${sentiment.color} mb-1`}>
                  {sentiment.label}
                </Badge>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {sentiment.action}
                </p>
              </div>
            </div>

            <Separator orientation="vertical" className="h-12" />

            {/* SPY */}
            {spy && (
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">
                  SPY
                </span>
                <span className="font-semibold">
                  {formatCurrency(spy.price)}
                </span>
                <span
                  className={`text-xs block ${
                    spy.change >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatPercentage(spy.changePercent)}
                </span>
              </div>
            )}

            {/* QQQ */}
            {qqq && (
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">
                  QQQ
                </span>
                <span className="font-semibold">
                  {formatCurrency(qqq.price)}
                </span>
                <span
                  className={`text-xs block ${
                    qqq.change >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatPercentage(qqq.changePercent)}
                </span>
              </div>
            )}

            {/* VIX */}
            {vix && (
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">
                  VIX
                </span>
                <span className="font-semibold">{vix.price.toFixed(2)}</span>
                <Badge
                  variant={
                    vix.price < 15
                      ? "default"
                      : vix.price < 20
                      ? "secondary"
                      : vix.price < 30
                      ? "outline"
                      : "destructive"
                  }
                  className="text-xs mt-0.5"
                >
                  {vix.price < 15
                    ? "Low"
                    : vix.price < 20
                    ? "Normal"
                    : vix.price < 30
                    ? "Elevated"
                    : "High"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sector Leaders - Condensed to top 3 */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Leaders:</span>
        <div className="flex gap-2 flex-1">
          {topSectors.map((sector) => (
            <Badge
              key={sector.symbol}
              variant="secondary"
              className="flex items-center gap-1.5"
            >
              <span>{sector.name}</span>
              <span
                className={`font-semibold ${
                  sector.changePercent >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatPercentage(sector.changePercent)}
              </span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Full Opportunities - Toggle Expand */}
      <section>
        <button
          onClick={() => setShowAllOpportunities(!showAllOpportunities)}
          className="flex items-center gap-2 text-sm text-muted-foreground 
            hover:text-foreground transition-colors mb-3"
        >
          {showAllOpportunities ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          All Opportunities ({opportunities.length})
        </button>

        {showAllOpportunities && (
          <>
            <Separator className="mb-4" />
            {opportunities.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <XCircle
                    className="h-8 w-8 text-muted-foreground mx-auto 
                    mb-3"
                  />
                  <p className="text-compact text-muted-foreground mb-1">
                    No opportunities detected
                  </p>
                  <p className="text-caption text-muted-foreground">
                    Scanning: {combinedWatchlist.join(", ")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <OpportunityRow key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* HPF-ICS Strategy Checklist - At bottom for reference */}
      <section>
        <button
          onClick={() => setShowHPFChecklist(!showHPFChecklist)}
          className="flex items-center gap-2 text-sm text-muted-foreground 
            hover:text-foreground transition-colors mb-3"
        >
          {showHPFChecklist ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          HPF-ICS Strategy Checklist
          {hpfChecklist && (
            <Badge
              variant={
                hpfChecklist.recommendation === "GO"
                  ? "default"
                  : hpfChecklist.recommendation === "CAUTION"
                  ? "secondary"
                  : "destructive"
              }
              className={`ml-2 ${
                hpfChecklist.recommendation === "GO"
                  ? "bg-green-600"
                  : ""
              }`}
            >
              {hpfChecklist.recommendation}
            </Badge>
          )}
        </button>

        {showHPFChecklist && (
          <StrategyChecklist
            checklist={hpfChecklist}
            entryRules={DEFAULT_ENTRY_RULES}
            exitRules={DEFAULT_EXIT_RULES}
            isLoading={isLoadingChecklist && !hasAnalyzed}
            onPin={handlePinToggle}
            isPinned={pinnedPlan?.id === "hpf-ics-default"}
          />
        )}
      </section>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dashboard Settings</DialogTitle>
            <DialogDescription>
              Configure your watchlist and view scanning status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Manual Watchlist */}
            <div>
              <h4 className="text-sm font-medium mb-2">Manual Watchlist</h4>
              <p className="text-caption text-muted-foreground mb-3">
                Your custom tickers to scan
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {config.watchlist.map((symbol) => (
                  <Badge
                    key={symbol}
                    variant="secondary"
                    className="flex items-center gap-1.5 pr-1"
                  >
                    {symbol}
                    <button
                      onClick={() => removeFromWatchlist(symbol)}
                      className="ml-1 p-0.5 rounded 
                        hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
                  placeholder="Add ticker..."
                  className="flex-1 px-3 py-1.5 text-sm rounded-md border 
                    border-border bg-background focus:outline-none 
                    focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  onClick={handleAddSymbol}
                  disabled={!newSymbol.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Unusual Options Tickers */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">
                  Unusual Options Activity
                </h4>
                {isLoadingUnusual && (
                  <RefreshCw className="h-3 w-3 animate-spin 
                    text-muted-foreground" />
                )}
              </div>
              <p className="text-caption text-muted-foreground mb-3">
                High-conviction signals from scanner (auto-included)
              </p>

              {unusualError ? (
                <p className="text-caption text-red-600 dark:text-red-400">
                  Error: {unusualError}
                </p>
              ) : unusualTickerDetails.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {unusualTickerDetails.map((detail) => (
                    <Badge
                      key={detail.ticker}
                      variant="outline"
                      className={`flex items-center gap-1.5 ${
                        detail.topGrade === "S"
                          ? "border-emerald-500 text-emerald-700 " +
                            "dark:text-emerald-400"
                          : detail.topGrade === "A"
                          ? "border-blue-500 text-blue-700 " +
                            "dark:text-blue-400"
                          : ""
                      }`}
                    >
                      <span>{detail.ticker}</span>
                      <span className="text-xs opacity-70">
                        {detail.topGrade}
                      </span>
                      {detail.latestSentiment && (
                        <span className="text-xs">
                          {detail.latestSentiment === "BULLISH" ? "↑" : 
                           detail.latestSentiment === "BEARISH" ? "↓" : "–"}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-caption text-muted-foreground italic">
                  No unusual activity detected (last 14 days)
                </p>
              )}
            </div>

            {/* Combined Summary */}
            <div className="pt-4 border-t">
              <div className="text-caption text-muted-foreground space-y-1">
                <p>
                  • Scanning {combinedWatchlist.length} tickers total
                  ({config.watchlist.length} manual + 
                  {unusualTickers.filter(
                    (t) => !config.watchlist.includes(t)
                  ).length} from unusual activity)
                </p>
                <p>• HPF-ICS checklist runs automatically</p>
                <p>• Pin strategy to save rules for reference</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: Opportunity }) {
  const details = opportunity.details as {
    direction?: string;
    maxProfit?: number;
    maxRisk?: number;
    dte?: number;
    shortStrike?: number;
    longStrike?: number;
    premium?: number;
    netDebit?: number;
  };

  const isCredit =
    details.direction === "bull_put" || details.direction === "bear_call";
  const spreadLabel = isCredit
    ? details.direction === "bull_put"
      ? "Bull Put"
      : "Bear Call"
    : details.direction === "bull_call"
    ? "Bull Call"
    : "Bear Put";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono">
                {opportunity.symbol}
              </Badge>
              <Badge variant="secondary">{spreadLabel}</Badge>
              <Badge
                variant={opportunity.confidence >= 70 ? "default" : "outline"}
                className={
                  opportunity.confidence >= 70
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 " +
                      "dark:text-green-400"
                    : ""
                }
              >
                {opportunity.confidence}% conf
              </Badge>
            </div>
            <p className="text-compact">{opportunity.title}</p>
          </div>
          <div className="text-right">
            <div
              className="text-compact font-medium text-green-600 
              dark:text-green-400"
            >
              {formatCurrency(details.maxProfit || 0)} max
            </div>
            <div className="text-caption text-muted-foreground">
              {details.dte} DTE | ${details.shortStrike}/${details.longStrike}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
