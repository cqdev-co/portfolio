"use client";

import { motion } from "framer-motion";
import { MarketData } from "@/lib/odyssey/strategies/types";
import { formatCurrency, formatPercentage } from 
  "@/lib/odyssey/utils/formatters";
import { Gauge, AlertTriangle, Shield, Flame } from "lucide-react";

interface VIXIndicatorProps {
  vix: MarketData;
}

function getVIXLevel(value: number): {
  level: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  glowColor: string;
  description: string;
} {
  if (value < 12) {
    return {
      level: "Very Low",
      icon: <Shield className="h-4 w-4" />,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
      glowColor: "shadow-blue-500/20",
      description: "Extremely calm market conditions",
    };
  } else if (value < 20) {
    return {
      level: "Normal",
      icon: <Shield className="h-4 w-4" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      glowColor: "shadow-emerald-500/20",
      description: "Stable market environment",
    };
  } else if (value < 30) {
    return {
      level: "Elevated",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      glowColor: "shadow-amber-500/20",
      description: "Increased market uncertainty",
    };
  } else if (value < 40) {
    return {
      level: "High",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
      glowColor: "shadow-orange-500/20",
      description: "Significant market stress",
    };
  } else {
    return {
      level: "Extreme",
      icon: <Flame className="h-4 w-4" />,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      glowColor: "shadow-red-500/20",
      description: "Extreme fear in market",
    };
  }
}

export function VIXIndicator({ vix }: VIXIndicatorProps) {
  const vixLevel = getVIXLevel(vix.price);
  const percentage = Math.min((vix.price / 60) * 100, 100);
  const isVixDown = vix.change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative p-6 rounded-2xl backdrop-blur-xl 
        bg-slate-800/40 border border-slate-700/50 overflow-hidden
        shadow-xl ${vixLevel.glowColor}`}
    >
      {/* Ambient glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 
        ${vixLevel.bgColor} rounded-full blur-3xl opacity-50`} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${vixLevel.bgColor}`}>
              <Gauge className={`h-5 w-5 ${vixLevel.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                VIX Index
              </h3>
              <p className="text-xs text-slate-500">
                Fear & Greed Indicator
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 
            rounded-full ${vixLevel.bgColor}`}>
            {vixLevel.icon}
            <span className={`text-sm font-semibold ${vixLevel.color}`}>
              {vixLevel.level}
            </span>
          </div>
        </div>

        {/* Main Value */}
        <div className="flex items-end gap-4 mb-4">
          <div className="text-4xl font-bold text-white tracking-tight">
            {vix.price.toFixed(2)}
          </div>
          <div className={`flex items-center gap-1 pb-1.5 ${
            isVixDown ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <span className="text-lg font-semibold">
              {isVixDown ? '' : '+'}
              {formatCurrency(vix.change)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isVixDown ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              {formatPercentage(vix.changePercent)}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-6">
          {vixLevel.description}
        </p>

        {/* Gauge */}
        <div className="space-y-3">
          {/* Labels */}
          <div className="flex justify-between text-xs text-slate-500 
            font-medium">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Extreme</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full overflow-hidden 
            bg-slate-700/50">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r 
              from-emerald-500 via-amber-500 to-red-500 opacity-30" />
            
            {/* Filled portion */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute h-full bg-gradient-to-r 
                from-emerald-500 via-amber-500 to-red-500"
            />

            {/* Current value indicator */}
            <motion.div
              initial={{ left: 0 }}
              animate={{ left: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-white shadow-lg 
                  border-2 border-slate-900" />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 
                  px-2 py-1 rounded bg-slate-800 text-xs font-bold 
                  text-white whitespace-nowrap">
                  {vix.price.toFixed(1)}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Scale markers */}
          <div className="flex justify-between text-xs text-slate-600">
            <span>0</span>
            <span>15</span>
            <span>30</span>
            <span>45</span>
            <span>60</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
