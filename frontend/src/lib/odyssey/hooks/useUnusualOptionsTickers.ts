import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface UnusualOptionsTicker {
  ticker: string;
  signalCount: number;
  avgScore: number;
  topGrade: string;
  latestSentiment: string | null;
}

interface UseUnusualOptionsTickersResult {
  tickers: string[];
  tickerDetails: UnusualOptionsTicker[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdate: Date | null;
}

/**
 * Hook to fetch unique tickers from unusual options signals
 * Pulls recent high-conviction signals (last 7 days, grade A or S)
 */
export function useUnusualOptionsTickers(
  options: {
    minGrade?: string[];
    minScore?: number;
    activeOnly?: boolean;
    maxTickers?: number;
    daysBack?: number;
  } = {}
): UseUnusualOptionsTickersResult {
  const {
    minGrade = ["S", "A", "B", "C"],
    minScore = 0.4, // Score is 0-1 scale, 0.4 = 40%
    activeOnly = false, // Default to false - not all signals have is_active
    maxTickers = 20,
    daysBack = 14, // Look back 14 days for more signals
  } = options;

  const [tickers, setTickers] = useState<string[]>([]);
  const [tickerDetails, setTickerDetails] = useState<UnusualOptionsTicker[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Prevent duplicate fetches
  const hasFetched = useRef(false);
  const isFetching = useRef(false);

  // Serialize options for stable dependency
  const optionsKey = JSON.stringify({ minGrade, minScore, activeOnly, daysBack });

  const fetchTickers = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;
    isFetching.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Build query for recent signals
      let query = supabase
        .from("unusual_options_signals")
        .select("ticker, overall_score, grade, sentiment")
        .gte("detection_timestamp", startDate.toISOString());

      // Apply filters
      if (minGrade.length > 0) {
        query = query.in("grade", minGrade);
      }
      if (minScore > 0) {
        query = query.gte("overall_score", minScore);
      }
      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!data || data.length === 0) {
        setTickers([]);
        setTickerDetails([]);
        setLastUpdate(new Date());
        return;
      }

      // Aggregate by ticker
      const tickerMap = new Map<
        string,
        {
          count: number;
          scores: number[];
          grades: string[];
          sentiments: (string | null)[];
        }
      >();

      for (const signal of data) {
        const existing = tickerMap.get(signal.ticker) || {
          count: 0,
          scores: [],
          grades: [],
          sentiments: [],
        };

        existing.count++;
        existing.scores.push(signal.overall_score);
        existing.grades.push(signal.grade);
        existing.sentiments.push(signal.sentiment);

        tickerMap.set(signal.ticker, existing);
      }

      // Convert to sorted array (by signal count, then avg score)
      const details: UnusualOptionsTicker[] = Array.from(
        tickerMap.entries()
      )
        .map(([ticker, info]) => ({
          ticker,
          signalCount: info.count,
          avgScore: info.scores.reduce((a, b) => a + b, 0) / info.scores.length,
          topGrade: getTopGrade(info.grades),
          latestSentiment: info.sentiments[info.sentiments.length - 1],
        }))
        .sort((a, b) => {
          // Sort by grade first, then by signal count
          const gradeOrder = ["S", "A", "B", "C", "D", "F"];
          const gradeCompare =
            gradeOrder.indexOf(a.topGrade) - gradeOrder.indexOf(b.topGrade);
          if (gradeCompare !== 0) return gradeCompare;
          return b.signalCount - a.signalCount;
        })
        .slice(0, maxTickers);

      const uniqueTickers = details.map((d) => d.ticker);

      setTickers(uniqueTickers);
      setTickerDetails(details);
      setLastUpdate(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch tickers";
      setError(message);
      console.error("Error fetching unusual options tickers:", err);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, maxTickers]); // Use serialized key for stable deps

  // Fetch on mount only
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchTickers();
  }, [fetchTickers]);

  return {
    tickers,
    tickerDetails,
    isLoading,
    error,
    refresh: fetchTickers,
    lastUpdate,
  };
}

/**
 * Get the highest grade from a list
 */
function getTopGrade(grades: string[]): string {
  const order = ["S", "A", "B", "C", "D", "F"];
  let best = "F";

  for (const grade of grades) {
    if (order.indexOf(grade) < order.indexOf(best)) {
      best = grade;
    }
  }

  return best;
}

