import { useState, useEffect, useCallback, useRef } from "react";
import { MarketData, SectorData } from "../strategies/types";
import { cache } from "../utils/cache";

interface UseMarketDataResult {
  marketData: MarketData[];
  sectorData: SectorData[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdate: Date | null;
}

/**
 * Hook to fetch and manage market overview data
 * Includes major indices, VIX, and sector performance
 * 
 * @param autoRefresh - Whether to auto-refresh data (default: true)
 * @param refreshInterval - Interval for auto-refresh in ms (default: 10 sec)
 */
export function useMarketData(
  autoRefresh: boolean = true,
  refreshInterval: number = 10 * 1000
): UseMarketDataResult {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [sectorData, setSectorData] = useState<SectorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const hasFetched = useRef(false);
  const isFetching = useRef(false);

  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch("/api/odyssey/market-data");
      if (!response.ok) {
        throw new Error("Failed to fetch market data");
      }
      const data = await response.json();
      
      const transformed: MarketData[] = data.map(
        (item: Omit<MarketData, "timestamp">) => ({
          ...item,
          timestamp: new Date(),
        })
      );
      
      return transformed;
    } catch (err) {
      console.error("Error fetching market data:", err);
      throw err;
    }
  }, []);

  const fetchSectorData = useCallback(async () => {
    try {
      const response = await fetch("/api/odyssey/sector-data");
      if (!response.ok) {
        throw new Error("Failed to fetch sector data");
      }
      const data = await response.json();
      return data as SectorData[];
    } catch (err) {
      console.error("Error fetching sector data:", err);
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;
    isFetching.current = true;
    
    setIsLoading(true);
    setError(null);

    try {
      const [market, sector] = await Promise.all([
        fetchMarketData(),
        fetchSectorData(),
      ]);

      setMarketData(market);
      setSectorData(sector);
      setLastUpdate(new Date());

      cache.set("market-data", market, refreshInterval);
      cache.set("sector-data", sector, refreshInterval);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [fetchMarketData, fetchSectorData, refreshInterval]);

  // Initial load - only once
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const cachedMarket = cache.get<MarketData[]>("market-data");
    const cachedSector = cache.get<SectorData[]>("sector-data");

    if (cachedMarket && cachedSector) {
      setMarketData(cachedMarket);
      setSectorData(cachedSector);
      setLastUpdate(new Date());
      setIsLoading(false);
    } else {
      refresh();
    }
  }, [refresh]);

  // Auto-refresh (only if enabled)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refresh, refreshInterval]);

  return {
    marketData,
    sectorData,
    isLoading,
    error,
    refresh,
    lastUpdate,
  };
}
