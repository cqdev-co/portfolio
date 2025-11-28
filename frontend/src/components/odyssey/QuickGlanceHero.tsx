"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
} from "lucide-react";
import { 
  Opportunity, 
  CreditSpreadDetails, 
  DebitSpreadDetails 
} from "@/lib/odyssey/strategies/types";
import { formatCurrency } from "@/lib/odyssey/utils/formatters";

interface QuickGlanceHeroProps {
  opportunities: Opportunity[];
  maxItems?: number;
  isLoading?: boolean;
}

/**
 * Calculate composite priority score for ranking opportunities
 * Weights: Confidence (60%), Risk/Reward (25%), Time Sensitivity (15%)
 */
function calculatePriorityScore(opp: Opportunity): number {
  const details = opp.details as 
    CreditSpreadDetails | DebitSpreadDetails | Record<string, unknown>;
  const dte = (details as { dte?: number }).dte || 30;

  // Confidence factor (0-60 points)
  const confidenceScore = (opp.confidence / 100) * 60;

  // Risk/Reward factor (0-25 points)
  // Higher R:R is better, cap at 5:1
  const rrScore = Math.min(opp.riskReward / 5, 1) * 25;

  // Time sensitivity factor (0-15 points)
  // Closer DTE = higher urgency (if setup is strong)
  // Sweet spot is 14-21 DTE
  let timeScore = 0;
  if (dte >= 7 && dte <= 14) {
    timeScore = opp.confidence >= 70 ? 15 : 8;
  } else if (dte > 14 && dte <= 21) {
    timeScore = 12;
  } else if (dte > 21 && dte <= 30) {
    timeScore = 8;
  } else {
    timeScore = 4;
  }

  return confidenceScore + rrScore + timeScore;
}

/**
 * Get urgency badge based on DTE and confidence
 */
function getUrgencyBadge(opp: Opportunity): {
  label: string;
  variant: "default" | "secondary" | "outline";
  color: string;
} {
  const details = opp.details as { dte?: number };
  const dte = details.dte || 30;

  if (dte <= 7 && opp.confidence >= 75) {
    return {
      label: "ACT NOW",
      variant: "default",
      color: "bg-emerald-500 text-white",
    };
  }
  if (dte <= 14 && opp.confidence >= 65) {
    return {
      label: "HIGH",
      variant: "secondary",
      color: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "WATCH",
    variant: "outline",
    color: "",
  };
}

/**
 * Generate one-line action text for an opportunity
 */
function generateActionText(opp: Opportunity): string {
  const details = opp.details as 
    CreditSpreadDetails | DebitSpreadDetails;

  if ("direction" in details) {
    const direction = details.direction;

    if (direction === "bull_put" || direction === "bear_call") {
      // Credit spread
      const d = details as CreditSpreadDetails;
      const spreadType = direction === "bull_put" 
        ? "Put Spread" 
        : "Call Spread";
      return `Sell ${opp.symbol} $${d.shortStrike}/$${d.longStrike} ` +
        `${spreadType} @ ${formatCurrency(d.premium)}`;
    }

    if (direction === "bull_call" || direction === "bear_put") {
      // Debit spread
      const d = details as DebitSpreadDetails;
      const spreadType = direction === "bull_call" 
        ? "Call Spread" 
        : "Put Spread";
      return `Buy ${opp.symbol} $${d.longStrike}/$${d.shortStrike} ` +
        `${spreadType} @ ${formatCurrency(d.netDebit)}`;
    }
  }

  return opp.title;
}

function ActionRow({ 
  opportunity, 
  rank, 
  expanded, 
  onToggle 
}: {
  opportunity: Opportunity;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const urgency = getUrgencyBadge(opportunity);
  const details = opportunity.details as 
    CreditSpreadDetails | DebitSpreadDetails;
  const isBullish = 
    ("direction" in details) && 
    (details.direction === "bull_put" || details.direction === "bull_call");

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full text-left py-3 px-1 hover:bg-muted/30 
          transition-colors rounded"
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span className="text-lg font-bold text-muted-foreground w-6">
            {rank}
          </span>

          {/* Direction indicator */}
          <div className={`p-1.5 rounded-md ${
            isBullish 
              ? "bg-green-100 dark:bg-green-900/30" 
              : "bg-red-100 dark:bg-red-900/30"
          }`}>
            {isBullish ? (
              <TrendingUp className="h-4 w-4 text-green-600 
                dark:text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 
                dark:text-red-400" />
            )}
          </div>

          {/* Action text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {generateActionText(opportunity)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {opportunity.confidence}% conf
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {("dte" in details) ? `${details.dte} DTE` : "—"}
              </span>
            </div>
          </div>

          {/* Urgency badge */}
          <Badge className={`text-xs ${urgency.color}`}>
            {urgency.label}
          </Badge>

          {/* Expand icon */}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="pb-3 px-1 ml-9 space-y-2">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2 rounded-md bg-muted/50">
              <span className="text-muted-foreground block mb-0.5">
                Max Profit
              </span>
              <span className="font-semibold text-green-600 
                dark:text-green-400">
                {formatCurrency(
                  ("maxProfit" in details) ? details.maxProfit : 0
                )}
              </span>
            </div>
            <div className="p-2 rounded-md bg-muted/50">
              <span className="text-muted-foreground block mb-0.5">
                Max Risk
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(
                  ("maxRisk" in details) ? details.maxRisk : 0
                )}
              </span>
            </div>
            <div className="p-2 rounded-md bg-muted/50">
              <span className="text-muted-foreground block mb-0.5">
                R:R Ratio
              </span>
              <span className="font-semibold">
                {opportunity.riskReward.toFixed(2)}:1
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {opportunity.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function QuickGlanceHero({
  opportunities,
  maxItems = 5,
  isLoading = false,
}: QuickGlanceHeroProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort by priority score and take top N
  const topOpportunities = [...opportunities]
    .map((opp) => ({
      ...opp,
      priorityScore: calculatePriorityScore(opp),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, maxItems);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-muted/50 animate-pulse rounded"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topOpportunities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Top Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <Target className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No opportunities detected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Scan to search for setups
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br 
      from-background to-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Top Actions
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs 
            text-muted-foreground">
            <Clock className="h-3 w-3" />
            {topOpportunities.length} opportunities
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div>
          {topOpportunities.map((opp, index) => (
            <ActionRow
              key={opp.id}
              opportunity={opp}
              rank={index + 1}
              expanded={expandedId === opp.id}
              onToggle={() => handleToggle(opp.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

