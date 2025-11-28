"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Opportunity } from "@/lib/odyssey/strategies/types";
import { OpportunityCard } from "./OpportunityCard";
import { Search } from "lucide-react";

interface OpportunitiesPanelProps {
  opportunities: Opportunity[];
  isLoading?: boolean;
  onSelectOpportunity?: (opportunity: Opportunity) => void;
}

export function OpportunitiesPanel({
  opportunities,
  isLoading = false,
  onSelectOpportunity,
}: OpportunitiesPanelProps) {
  const [activeTab, setActiveTab] = useState<"all" | "credit-spreads">("all");

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-slate-800/40 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  const creditSpreads = opportunities.filter(
    (opp) => opp.opportunityType === "credit_spread"
  );

  const displayedOpportunities = 
    activeTab === "all" ? opportunities : creditSpreads;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-slate-800/40 
        backdrop-blur-sm border border-slate-700/50 w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`relative px-4 py-2 rounded-lg text-sm font-medium 
            transition-all ${
            activeTab === "all"
              ? "text-white"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          {activeTab === "all" && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-slate-700/50 rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            All
            {opportunities.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === "all"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}>
                {opportunities.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("credit-spreads")}
          className={`relative px-4 py-2 rounded-lg text-sm font-medium 
            transition-all ${
            activeTab === "credit-spreads"
              ? "text-white"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          {activeTab === "credit-spreads" && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-slate-700/50 rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Credit Spreads
            {creditSpreads.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === "credit-spreads"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}>
                {creditSpreads.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      {displayedOpportunities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 
            text-center"
        >
          <div className="p-4 rounded-2xl bg-slate-800/40 border 
            border-slate-700/50 mb-4">
            <Search className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No Opportunities Detected
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Adjust your strategy configuration or add more symbols 
            to your watchlist to discover opportunities.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4"
        >
          {displayedOpportunities.map((opp, i) => (
            <motion.div
              key={opp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <OpportunityCard
                opportunity={opp}
                onSelect={onSelectOpportunity}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
