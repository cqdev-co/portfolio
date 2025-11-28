"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Opportunity, 
  CreditSpreadDetails 
} from "@/lib/odyssey/strategies/types";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatRiskReward,
  formatConfidence,
  formatDTE,
} from "@/lib/odyssey/utils/formatters";
import { 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown,
  Target,
  Shield,
  Clock,
  ArrowRight
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onSelect?: (opportunity: Opportunity) => void;
}

function getConfidenceGradient(confidence: number): string {
  if (confidence >= 80) {
    return "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30";
  } else if (confidence >= 60) {
    return "from-amber-500/20 to-amber-600/5 border-amber-500/30";
  } else {
    return "from-slate-500/20 to-slate-600/5 border-slate-500/30";
  }
}

function getConfidenceTextColor(confidence: number): string {
  if (confidence >= 80) return "text-emerald-400";
  if (confidence >= 60) return "text-amber-400";
  return "text-slate-400";
}

export function OpportunityCard({
  opportunity,
  onSelect,
}: OpportunityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCreditSpread = 
    opportunity.opportunityType === "credit_spread";
  
  const details = isCreditSpread
    ? (opportunity.details as CreditSpreadDetails)
    : null;

  const isBullish = details?.direction === "bull_put";

  return (
    <motion.div
      layout
      className={`relative rounded-2xl backdrop-blur-xl bg-gradient-to-br 
        ${getConfidenceGradient(opportunity.confidence)} 
        border overflow-hidden transition-all duration-300 
        hover:shadow-lg hover:shadow-emerald-500/10`}
    >
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 
        rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {/* Symbol Badge */}
              <span className="px-3 py-1 rounded-lg bg-slate-800/80 
                text-white font-mono text-sm font-semibold border 
                border-slate-700/50">
                {opportunity.symbol}
              </span>
              
              {/* Confidence Badge */}
              <span className={`px-2.5 py-1 rounded-lg text-xs 
                font-semibold ${getConfidenceTextColor(opportunity.confidence)}
                bg-slate-800/60 border border-slate-700/50`}>
                {formatConfidence(opportunity.confidence)}
              </span>
              
              {/* Direction Badge */}
              {details && (
                <span className={`flex items-center gap-1 px-2.5 py-1 
                  rounded-lg text-xs font-semibold border ${
                  isBullish 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }`}>
                  {isBullish ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {isBullish ? "Bull Put" : "Bear Call"}
                </span>
              )}
            </div>
            
            <h3 className="font-semibold text-white mb-1">
              {opportunity.title}
            </h3>
            <p className="text-sm text-slate-400">
              {opportunity.description}
            </p>
          </div>
        </div>

        {/* Summary Metrics */}
        {details && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-slate-800/40 border 
              border-slate-700/30">
              <div className="flex items-center gap-1.5 text-xs 
                text-slate-500 mb-1">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                Max Profit
              </div>
              <div className="text-sm font-bold text-emerald-400">
                {formatCurrency(details.maxProfit)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border 
              border-slate-700/30">
              <div className="flex items-center gap-1.5 text-xs 
                text-slate-500 mb-1">
                <Shield className="h-3 w-3 text-red-400" />
                Max Risk
              </div>
              <div className="text-sm font-bold text-red-400">
                {formatCurrency(details.maxRisk)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border 
              border-slate-700/30">
              <div className="flex items-center gap-1.5 text-xs 
                text-slate-500 mb-1">
                <Target className="h-3 w-3 text-blue-400" />
                R:R Ratio
              </div>
              <div className="text-sm font-bold text-white">
                {formatRiskReward(opportunity.riskReward)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border 
              border-slate-700/30">
              <div className="flex items-center gap-1.5 text-xs 
                text-slate-500 mb-1">
                <Clock className="h-3 w-3 text-purple-400" />
                DTE
              </div>
              <div className="text-sm font-bold text-white">
                {formatDTE(details.dte)}
              </div>
            </div>
          </div>
        )}

        {/* Expandable Details */}
        <AnimatePresence>
          {details && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-slate-500">
                      Short Strike
                    </span>
                    <div className="text-sm font-semibold text-white">
                      {formatCurrency(details.shortStrike)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">
                      Long Strike
                    </span>
                    <div className="text-sm font-semibold text-white">
                      {formatCurrency(details.longStrike)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Premium</span>
                    <div className="text-sm font-semibold text-emerald-400">
                      {formatCurrency(details.premium)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Break Even</span>
                    <div className="text-sm font-semibold text-white">
                      {formatCurrency(details.breakEven)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">
                      Spread Width
                    </span>
                    <div className="text-sm font-semibold text-white">
                      {formatCurrency(details.spreadWidth)}
                    </div>
                  </div>
                  {details.probabilityOfProfit && (
                    <div>
                      <span className="text-xs text-slate-500">POP</span>
                      <div className="text-sm font-semibold text-blue-400">
                        {details.probabilityOfProfit}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 text-slate-400 hover:text-white 
              hover:bg-slate-700/50 border border-slate-700/50"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1.5" />
                Less Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1.5" />
                More Details
              </>
            )}
          </Button>
          {onSelect && (
            <Button
              size="sm"
              onClick={() => onSelect(opportunity)}
              className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 
                text-emerald-400 border border-emerald-500/30"
            >
              View Analysis
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
