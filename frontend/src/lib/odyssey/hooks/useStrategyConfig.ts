import { useState, useEffect, useCallback } from "react";
import { StrategyConfig, StrategyParameters } from "../strategies/types";
import { strategyEngine } from "../strategies/StrategyEngine";

const DEFAULT_CONFIG: StrategyConfig = {
  strategies: {
    "credit-spread": {
      enabled: true,
      minDte: 7,
      maxDte: 45,
      minRiskReward: 2.0,
      minConfidence: 60,
      maxResults: 20,
      minIVPercentile: 30,
      maxIVPercentile: 70,
    },
  },
  watchlist: ["SPY", "QQQ", "IWM", "DIA"],
  refreshInterval: 5,
  notificationsEnabled: false,
};

const STORAGE_KEY = "odyssey-strategy-config";

interface UseStrategyConfigResult {
  config: StrategyConfig;
  updateStrategyParams: (
    strategyId: string,
    params: Partial<StrategyParameters>
  ) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  setRefreshInterval: (minutes: number) => void;
  toggleNotifications: () => void;
  resetToDefaults: () => void;
  isLoading: boolean;
}

/**
 * Hook to manage strategy configuration and persistence
 * Syncs with localStorage and updates strategy engine
 */
export function useStrategyConfig(): UseStrategyConfigResult {
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StrategyConfig;
        setConfig(parsed);
        
        // Update strategy engine with loaded config
        Object.entries(parsed.strategies).forEach(
          ([strategyId, params]) => {
            const strategy = strategyEngine.getStrategy(strategyId);
            if (strategy) {
              strategy.updateParameters(params);
            }
          }
        );
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (err) {
        console.error("Error saving config:", err);
      }
    }
  }, [config, isLoading]);

  const updateStrategyParams = useCallback(
    (strategyId: string, params: Partial<StrategyParameters>) => {
      setConfig((prev) => ({
        ...prev,
        strategies: {
          ...prev.strategies,
          [strategyId]: {
            ...prev.strategies[strategyId],
            ...params,
          },
        },
      }));

      // Update strategy engine
      const strategy = strategyEngine.getStrategy(strategyId);
      if (strategy) {
        try {
          strategy.updateParameters({
            ...strategy.parameters,
            ...params,
          });
        } catch (err) {
          console.error(
            `Error updating strategy ${strategyId}:`,
            err
          );
        }
      }
    },
    []
  );

  const addToWatchlist = useCallback((symbol: string) => {
    setConfig((prev) => {
      if (prev.watchlist.includes(symbol.toUpperCase())) {
        return prev;
      }
      return {
        ...prev,
        watchlist: [...prev.watchlist, symbol.toUpperCase()],
      };
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setConfig((prev) => ({
      ...prev,
      watchlist: prev.watchlist.filter(
        (s) => s !== symbol.toUpperCase()
      ),
    }));
  }, []);

  const setRefreshInterval = useCallback((minutes: number) => {
    setConfig((prev) => ({
      ...prev,
      refreshInterval: minutes,
    }));
  }, []);

  const toggleNotifications = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      notificationsEnabled: !prev.notificationsEnabled,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    
    // Update strategy engine with defaults
    Object.entries(DEFAULT_CONFIG.strategies).forEach(
      ([strategyId, params]) => {
        const strategy = strategyEngine.getStrategy(strategyId);
        if (strategy) {
          strategy.updateParameters(params);
        }
      }
    );
  }, []);

  return {
    config,
    updateStrategyParams,
    addToWatchlist,
    removeFromWatchlist,
    setRefreshInterval,
    toggleNotifications,
    resetToDefaults,
    isLoading,
  };
}

