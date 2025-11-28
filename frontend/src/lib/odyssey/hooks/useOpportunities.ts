import { useState, useCallback, useEffect, useRef } from "react";
import { 
  Opportunity, 
  OptionsData,
  MarketData,
  StrategyEngineResult
} from "../strategies/types";
import { strategyEngine } from "../strategies/StrategyEngine";
import { CreditSpreadStrategy } from "../strategies/CreditSpreadStrategy";
import { DebitSpreadStrategy } from "../strategies/DebitSpreadStrategy";

interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  isAnalyzing: boolean;
  error: string | null;
  executionTime: number;
  analyze: () => Promise<void>;
  filterBySymbol: (symbol: string) => Opportunity[];
  filterByType: (type: string) => Opportunity[];
  strategiesLoaded: string[];
  optionsDataCount: number;
}

/**
 * Hook to detect and manage trading opportunities
 * Executes registered strategies and aggregates results
 * 
 * Only analyzes on explicit call - no auto-refresh to prevent
 * excessive API calls
 */
export function useOpportunities(
  marketData: MarketData[],
  watchlist: string[] = ["SPY", "QQQ", "IWM", "DIA"]
): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [strategiesLoaded, setStrategiesLoaded] = useState<string[]>([]);
  const [optionsDataCount, setOptionsDataCount] = useState(0);
  
  const strategiesInitialized = useRef(false);

  // Initialize strategies once
  useEffect(() => {
    if (strategiesInitialized.current) return;
    strategiesInitialized.current = true;

    const creditSpread = new CreditSpreadStrategy();
    const debitSpread = new DebitSpreadStrategy();
    strategyEngine.registerStrategy(creditSpread);
    strategyEngine.registerStrategy(debitSpread);

    setStrategiesLoaded([
      `${creditSpread.name} (${creditSpread.id})`,
      `${debitSpread.name} (${debitSpread.id})`,
    ]);

    return () => {
      strategyEngine.clearStrategies();
      strategiesInitialized.current = false;
    };
  }, []);

  const fetchOptionsData = useCallback(
    async (symbols: string[]): Promise<OptionsData[]> => {
      try {
        const promises = symbols.map((symbol) =>
          fetch(
            `/api/odyssey/options-chain?symbol=${symbol}&minDte=7&maxDte=45`
          ).then((res) => res.json())
        );

        const results = await Promise.all(promises);
        return results.flat();
      } catch (err) {
        console.error("Error fetching options data:", err);
        throw err;
      }
    },
    []
  );

  const analyze = useCallback(async () => {
    // Prevent concurrent analysis
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      const optionsData = await fetchOptionsData(watchlist);
      setOptionsDataCount(optionsData.length);

      const result: StrategyEngineResult = 
        await strategyEngine.executeAll(
          marketData,
          optionsData,
          undefined
        );

      setOpportunities(result.opportunities);
      setExecutionTime(result.executionTime);

      if (result.errors.length > 0) {
        console.warn("Strategy errors:", result.errors);
      }
    } catch (err) {
      const errorMsg = 
        err instanceof Error 
          ? err.message 
          : "Failed to analyze opportunities";
      setError(errorMsg);
      console.error("Analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [marketData, watchlist, fetchOptionsData, isAnalyzing]);

  const filterBySymbol = useCallback(
    (symbol: string): Opportunity[] => {
      return opportunities.filter(
        (opp) => opp.symbol.toLowerCase() === symbol.toLowerCase()
      );
    },
    [opportunities]
  );

  const filterByType = useCallback(
    (type: string): Opportunity[] => {
      return opportunities.filter((opp) => opp.opportunityType === type);
    },
    [opportunities]
  );

  return {
    opportunities,
    isAnalyzing,
    error,
    executionTime,
    analyze,
    filterBySymbol,
    filterByType,
    strategiesLoaded,
    optionsDataCount,
  };
}
