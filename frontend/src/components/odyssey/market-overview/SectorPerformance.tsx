"use client";

import { motion } from "framer-motion";
import { SectorData } from "@/lib/odyssey/strategies/types";
import { formatPercentage } from "@/lib/odyssey/utils/formatters";
import { 
  Cpu, Landmark, Flame, Heart, ShoppingCart, Coffee, 
  Factory, Atom, Lightbulb, Building, Radio 
} from "lucide-react";

interface SectorPerformanceProps {
  sectors: SectorData[];
}

const sectorIcons: Record<string, React.ReactNode> = {
  XLK: <Cpu className="h-4 w-4" />,
  XLF: <Landmark className="h-4 w-4" />,
  XLE: <Flame className="h-4 w-4" />,
  XLV: <Heart className="h-4 w-4" />,
  XLY: <ShoppingCart className="h-4 w-4" />,
  XLP: <Coffee className="h-4 w-4" />,
  XLI: <Factory className="h-4 w-4" />,
  XLB: <Atom className="h-4 w-4" />,
  XLU: <Lightbulb className="h-4 w-4" />,
  XLRE: <Building className="h-4 w-4" />,
  XLC: <Radio className="h-4 w-4" />,
};

function getSectorGradient(changePercent: number): {
  bg: string;
  border: string;
  text: string;
  intensity: number;
} {
  const intensity = Math.min(Math.abs(changePercent) / 3, 1);
  
  if (changePercent >= 2) {
    return {
      bg: "from-emerald-500/30 to-emerald-600/10",
      border: "border-emerald-500/50",
      text: "text-emerald-400",
      intensity,
    };
  } else if (changePercent >= 1) {
    return {
      bg: "from-emerald-500/20 to-emerald-600/5",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      intensity,
    };
  } else if (changePercent >= 0) {
    return {
      bg: "from-emerald-500/10 to-transparent",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      intensity,
    };
  } else if (changePercent >= -1) {
    return {
      bg: "from-red-500/10 to-transparent",
      border: "border-red-500/20",
      text: "text-red-400",
      intensity,
    };
  } else if (changePercent >= -2) {
    return {
      bg: "from-red-500/20 to-red-600/5",
      border: "border-red-500/30",
      text: "text-red-400",
      intensity,
    };
  } else {
    return {
      bg: "from-red-500/30 to-red-600/10",
      border: "border-red-500/50",
      text: "text-red-400",
      intensity,
    };
  }
}

export function SectorPerformance({ sectors }: SectorPerformanceProps) {
  if (sectors.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No sector data available
      </div>
    );
  }

  const sortedSectors = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent
  );

  return (
    <div className="space-y-3">
      {/* Header with best/worst indicator */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">
          Sorted by performance
        </span>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Leaders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-500">Laggards</span>
          </div>
        </div>
      </div>

      {/* Sector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 
        xl:grid-cols-6 gap-3">
        {sortedSectors.map((sector, i) => {
          const style = getSectorGradient(sector.changePercent);
          const isPositive = sector.changePercent >= 0;
          
          return (
            <motion.div
              key={sector.symbol}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="group"
            >
              <div className={`relative p-4 rounded-xl backdrop-blur-sm 
                bg-gradient-to-br ${style.bg} border ${style.border}
                hover:scale-105 transition-all duration-300 cursor-default`}
              >
                {/* Rank indicator for top 3 / bottom 3 */}
                {i < 3 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 
                    rounded-full bg-emerald-500 flex items-center 
                    justify-center text-[10px] font-bold text-white">
                    {i + 1}
                  </div>
                )}
                {i >= sortedSectors.length - 3 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 
                    rounded-full bg-red-500 flex items-center 
                    justify-center text-[10px] font-bold text-white">
                    {sortedSectors.length - i}
                  </div>
                )}

                {/* Icon */}
                <div className={`mb-2 ${style.text}`}>
                  {sectorIcons[sector.symbol] || 
                    <Building className="h-4 w-4" />}
                </div>

                {/* Symbol */}
                <div className="text-[10px] font-medium text-slate-500 
                  uppercase tracking-wider mb-0.5">
                  {sector.symbol}
                </div>

                {/* Name */}
                <div className="text-xs font-semibold text-slate-300 
                  mb-2 truncate">
                  {sector.name}
                </div>

                {/* Change */}
                <div className={`text-lg font-bold ${style.text}`}>
                  {isPositive ? '+' : ''}
                  {formatPercentage(sector.changePercent)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
