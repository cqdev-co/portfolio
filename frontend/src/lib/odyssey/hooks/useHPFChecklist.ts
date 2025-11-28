import { useState, useCallback } from "react";
import { HPFChecklistResult, MarketData } from "../strategies/types";
import {
  HPFIndexCreditSpreadStrategy,
  TechnicalIndicators,
} from "../strategies/HPFIndexCreditSpreadStrategy";

interface UseHPFChecklistResult {
  checklist: HPFChecklistResult | null;
  isLoading: boolean;
  error: string | null;
  runChecklist: (
    marketData: MarketData[],
    openPositions?: number
  ) => Promise<void>;
}

/**
 * Hook to run the HPF-ICS checklist
 * Fetches technical indicators and evaluates all conditions
 */
export function useHPFChecklist(): UseHPFChecklistResult {
  const [checklist, setChecklist] = useState<HPFChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note: Technical indicators API not implemented yet
  // Using estimation based on current price and market conditions
  const estimateTechnicalIndicators = (
    price: number,
    changePercent: number
  ): TechnicalIndicators => {
    // Estimate based on typical bull market conditions
    // In production, you'd want real historical data for accurate SMAs
    const technicals: TechnicalIndicators = {
      currentPrice: price,
      // Estimate SMAs based on typical relationships
      sma50: price * (1 - 0.02), // ~2% below current (bullish)
      sma200: price * (1 - 0.08), // ~8% below current (bullish)
      ema20: price * (1 - 0.01), // ~1% below current (bullish)
    };

    // Adjust for bearish day
    if (changePercent < -1) {
      technicals.ema20 = price * 1.005; // EMA above price
    }
    if (changePercent < -2) {
      technicals.sma50 = price * 1.01; // SMA above price
    }

    return technicals;
  };

  const runChecklist = useCallback(
    async (marketData: MarketData[], openPositions: number = 0) => {
      setIsLoading(true);
      setError(null);

      try {
        // Get SPX/SPY price and VIX from market data
        const spx = marketData.find(
          (m) => m.symbol === "SPY" || m.symbol === "^SPX"
        );
        const vix = marketData.find((m) => m.symbol === "^VIX");

        if (!spx || !vix) {
          throw new Error("Missing SPX or VIX data");
        }

        // Estimate technical indicators from current price
        const technicals = estimateTechnicalIndicators(
          spx.price,
          spx.changePercent
        );

        // Create strategy instance
        const strategy = new HPFIndexCreditSpreadStrategy();
        
        // Prefetch economic events before running checklist
        // This populates the cache for accurate macro event checking
        await strategy.prefetchEvents();
        
        // Run checklist with cached events
        const result = strategy.runChecklist(
          technicals,
          vix.price,
          openPositions,
          8 // max positions
        );

        setChecklist(result);
      } catch (err) {
        const message = err instanceof Error 
          ? err.message 
          : "Failed to run checklist";
        setError(message);
        console.error("HPF Checklist error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    checklist,
    isLoading,
    error,
    runChecklist,
  };
}

