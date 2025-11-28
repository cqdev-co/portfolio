"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Settings, Plus, X, RotateCcw, Zap, Bell, Clock 
} from "lucide-react";
import { StrategyConfig as StrategyConfigType } from 
  "@/lib/odyssey/strategies/types";
import { ConfigDialog } from "./ConfigDialog";

interface StrategyConfigProps {
  config: StrategyConfigType;
  onUpdateParams: (
    strategyId: string, 
    params: Record<string, unknown>
  ) => void;
  onAddToWatchlist: (symbol: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
  onResetToDefaults: () => void;
}

export function StrategyConfig({
  config,
  onUpdateParams,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onResetToDefaults,
}: StrategyConfigProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");

  const handleAddSymbol = () => {
    if (newSymbol.trim()) {
      onAddToWatchlist(newSymbol.trim().toUpperCase());
      setNewSymbol("");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="p-6 rounded-2xl backdrop-blur-xl bg-slate-800/40 
          border border-slate-700/50 space-y-6 sticky top-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">
              Configuration
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetToDefaults}
              className="text-slate-400 hover:text-white 
                hover:bg-slate-700/50"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="text-slate-400 hover:text-white 
                hover:bg-slate-700/50"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Strategies */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-medium text-slate-300">
              Active Strategies
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(config.strategies).map(
              ([id, params]) =>
                params.enabled && (
                  <motion.span
                    key={id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="px-3 py-1.5 rounded-full text-xs 
                      font-medium bg-gradient-to-r from-amber-500/20 
                      to-orange-500/20 text-amber-400 border 
                      border-amber-500/30"
                  >
                    {id.replace("-", " ")}
                  </motion.span>
                )
            )}
          </div>
        </div>

        {/* Watchlist */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-300">
            Watchlist
          </h4>
          
          {/* Symbol Tags */}
          <div className="flex flex-wrap gap-2">
            {config.watchlist.map((symbol) => (
              <motion.span
                key={symbol}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="group inline-flex items-center gap-1.5 px-3 
                  py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 
                  text-slate-300 border border-slate-600/50 
                  hover:border-slate-500/50 transition-colors"
              >
                {symbol}
                <button
                  onClick={() => onRemoveFromWatchlist(symbol)}
                  className="opacity-50 group-hover:opacity-100 
                    hover:text-red-400 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </div>

          {/* Add Symbol Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
              placeholder="Add symbol..."
              className="flex-1 px-4 py-2 text-sm rounded-xl 
                bg-slate-900/50 border border-slate-700/50 
                focus:border-emerald-500/50 focus:ring-1 
                focus:ring-emerald-500/20 outline-none text-white 
                placeholder:text-slate-500 transition-all"
            />
            <Button
              size="sm"
              onClick={handleAddSymbol}
              disabled={!newSymbol.trim()}
              className="px-4 bg-emerald-500/20 hover:bg-emerald-500/30 
                text-emerald-400 border border-emerald-500/30 
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Settings */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t 
          border-slate-700/50">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs 
              text-slate-500">
              <Clock className="h-3 w-3" />
              <span>Refresh</span>
            </div>
            <div className="text-sm font-medium text-white">
              {config.refreshInterval} min
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs 
              text-slate-500">
              <Bell className="h-3 w-3" />
              <span>Alerts</span>
            </div>
            <div className={`text-sm font-medium ${
              config.notificationsEnabled 
                ? 'text-emerald-400' 
                : 'text-slate-500'
            }`}>
              {config.notificationsEnabled ? "On" : "Off"}
            </div>
          </div>
        </div>
      </motion.div>

      <ConfigDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        config={config}
        onUpdateParams={onUpdateParams}
      />
    </>
  );
}
