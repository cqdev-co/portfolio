/**
 * Sector Rotation Analyzer
 * Core logic for analyzing sector relative strength and rotation
 */

import { SECTOR_ETFS, type SectorETF } from './etfs.ts';

export interface SectorAnalysis {
  etf: string;
  name: string;
  price: number;
  change1D: number;
  change5D: number;
  change1M: number;
  change3M: number;
  rsVsSpy1M: number;
  rsVsSpy3M: number;
  trend: 'leading' | 'lagging' | 'neutral';
  momentum: 'improving' | 'stable' | 'deteriorating';
  rsi: number;
}

export interface SectorRotationResult {
  sectors: SectorAnalysis[];
  spyBenchmark: {
    change5D: number;
    change1M: number;
    change3M: number;
  };
  leading: SectorAnalysis[];
  lagging: SectorAnalysis[];
  rotatingIn: SectorAnalysis[];
  rotatingOut: SectorAnalysis[];
}

export interface MarketDataProvider {
  getHistorical: (
    ticker: string,
    days: number
  ) => Promise<{ close: number }[] | null>;
  getQuote: (ticker: string) => Promise<{ regularMarketPrice?: number } | null>;
}

/**
 * Calculate relative strength vs benchmark
 */
export function calculateRelativeStrength(
  sectorChange: number,
  benchmarkChange: number
): number {
  return sectorChange - benchmarkChange;
}

/**
 * Calculate simple RSI from price array
 */
export function calculateSimpleRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  const changes = closes
    .slice(-(period + 1))
    .map((c, i, arr) => {
      if (i === 0) return 0;
      const prev = arr[i - 1];
      return prev !== undefined ? c - prev : 0;
    })
    .slice(1);

  let gains = 0;
  let losses = 0;

  for (const change of changes) {
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Analyze sector rotation relative to SPY
 * Returns raw data - CLI formatting handled by strategy
 */
export async function analyzeSectorRotation(
  provider: MarketDataProvider
): Promise<SectorRotationResult | null> {
  // Fetch SPY benchmark data
  const spyHistorical = await provider.getHistorical('SPY', 120);
  if (!spyHistorical || spyHistorical.length < 30) {
    return null;
  }

  const spyCloses = spyHistorical.map((h) => h.close);
  const spyNow = spyCloses[spyCloses.length - 1] ?? 0;
  const spy5D = spyCloses[Math.max(0, spyCloses.length - 6)] ?? spyNow;
  const spy1M = spyCloses[Math.max(0, spyCloses.length - 22)] ?? spyNow;
  const spy3M = spyCloses[Math.max(0, spyCloses.length - 66)] ?? spyNow;

  const spyChange5D = ((spyNow - spy5D) / spy5D) * 100;
  const spyChange1M = ((spyNow - spy1M) / spy1M) * 100;
  const spyChange3M = ((spyNow - spy3M) / spy3M) * 100;

  // Analyze each sector
  const results: SectorAnalysis[] = [];

  for (const [, sector] of Object.entries(SECTOR_ETFS)) {
    try {
      const [historical, quote] = await Promise.all([
        provider.getHistorical(sector.etf, 120),
        provider.getQuote(sector.etf),
      ]);

      if (!historical || historical.length < 30 || !quote) {
        continue;
      }

      const closes = historical.map((h) => h.close);
      const now = closes[closes.length - 1] ?? 0;
      const d1 = closes[Math.max(0, closes.length - 2)] ?? now;
      const d5 = closes[Math.max(0, closes.length - 6)] ?? now;
      const m1 = closes[Math.max(0, closes.length - 22)] ?? now;
      const m3 = closes[Math.max(0, closes.length - 66)] ?? now;

      const change1D = ((now - d1) / d1) * 100;
      const change5D = ((now - d5) / d5) * 100;
      const change1M = ((now - m1) / m1) * 100;
      const change3M = ((now - m3) / m3) * 100;

      const rsVsSpy1M = calculateRelativeStrength(change1M, spyChange1M);
      const rsVsSpy3M = calculateRelativeStrength(change3M, spyChange3M);
      const rsi = calculateSimpleRSI(closes);

      // Determine trend
      let trend: SectorAnalysis['trend'];
      if (rsVsSpy1M > 2 && rsVsSpy3M > 2) {
        trend = 'leading';
      } else if (rsVsSpy1M < -2 && rsVsSpy3M < -2) {
        trend = 'lagging';
      } else {
        trend = 'neutral';
      }

      // Determine momentum
      let momentum: SectorAnalysis['momentum'];
      if (rsVsSpy1M > rsVsSpy3M + 1) {
        momentum = 'improving';
      } else if (rsVsSpy1M < rsVsSpy3M - 1) {
        momentum = 'deteriorating';
      } else {
        momentum = 'stable';
      }

      results.push({
        etf: sector.etf,
        name: sector.name,
        price: quote.regularMarketPrice ?? now,
        change1D,
        change5D,
        change1M,
        change3M,
        rsVsSpy1M,
        rsVsSpy3M,
        trend,
        momentum,
        rsi,
      });
    } catch {
      // Skip failed sectors
      continue;
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Sort by 1M relative strength
  results.sort((a, b) => b.rsVsSpy1M - a.rsVsSpy1M);

  return {
    sectors: results,
    spyBenchmark: {
      change5D: spyChange5D,
      change1M: spyChange1M,
      change3M: spyChange3M,
    },
    leading: results.filter((r) => r.trend === 'leading'),
    lagging: results.filter((r) => r.trend === 'lagging'),
    rotatingIn: results.filter(
      (r) => r.trend === 'neutral' && r.momentum === 'improving'
    ),
    rotatingOut: results.filter(
      (r) => r.trend === 'neutral' && r.momentum === 'deteriorating'
    ),
  };
}
