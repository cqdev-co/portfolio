"use client";

import { motion } from "framer-motion";
import { MarketData } from "@/lib/odyssey/strategies/types";
import {
  formatCurrency,
  formatPercentage,
  formatLargeNumber,
} from "@/lib/odyssey/utils/formatters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface IndexCardsProps {
  indices: MarketData[];
}

const indexNames: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

export function IndexCards({ indices }: IndexCardsProps) {
  if (indices.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No index data available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {indices.map((index, i) => {
        const isPositive = index.change > 0;
        const isNegative = index.change < 0;
        
        return (
          <motion.div
            key={index.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="group relative"
          >
            {/* Card */}
            <div className={`relative p-5 rounded-2xl backdrop-blur-xl 
              border transition-all duration-300 overflow-hidden
              ${isPositive 
                ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' 
                : isNegative 
                  ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50'
              }`}
            >
              {/* Glow effect on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 
                transition-opacity duration-300 pointer-events-none
                ${isPositive 
                  ? 'bg-gradient-to-br from-emerald-500/10 to-transparent' 
                  : isNegative 
                    ? 'bg-gradient-to-br from-red-500/10 to-transparent'
                    : 'bg-gradient-to-br from-slate-500/10 to-transparent'
                }`} 
              />

              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-medium text-slate-500 
                    uppercase tracking-wider">
                    {index.symbol}
                  </span>
                  <div className="text-sm font-medium text-slate-300">
                    {indexNames[index.symbol] || index.symbol}
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${
                  isPositive 
                    ? 'bg-emerald-500/20' 
                    : isNegative 
                      ? 'bg-red-500/20' 
                      : 'bg-slate-700/50'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : isNegative ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-2xl font-bold text-white mb-2 
                tracking-tight">
                {formatCurrency(index.price)}
              </div>

              {/* Change */}
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${
                  isPositive 
                    ? 'text-emerald-400' 
                    : isNegative 
                      ? 'text-red-400' 
                      : 'text-slate-400'
                }`}>
                  {isPositive ? '+' : ''}
                  {formatCurrency(index.change)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isPositive 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : isNegative 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-slate-700/50 text-slate-400'
                }`}>
                  {isPositive ? '+' : ''}
                  {formatPercentage(index.changePercent)}
                </span>
              </div>

              {/* Volume */}
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Volume</span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatLargeNumber(index.volume)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
