/**
 * Sector Relative Strength Analysis
 * v1.7.0: Tracks sector rotation and money flow
 * 
 * Compares sector ETFs to SPY to identify:
 * - Which sectors are leading/lagging
 * - Money flow direction (rotation)
 * - Sector-specific risk context
 */

import { yahooProvider } from "../providers/yahoo.ts";
import type { HistoricalData } from "../types/index.ts";

// Sector to ETF mapping
const SECTOR_ETF_MAP: Record<string, string> = {
  "Technology": "XLK",
  "Healthcare": "XLV",
  "Financial Services": "XLF",
  "Financials": "XLF",
  "Consumer Cyclical": "XLY",
  "Consumer Defensive": "XLP",
  "Industrials": "XLI",
  "Energy": "XLE",
  "Utilities": "XLU",
  "Real Estate": "XLRE",
  "Materials": "XLB",
  "Basic Materials": "XLB",
  "Communication Services": "XLC",
  "Communication": "XLC",
};

export interface SectorStrengthResult {
  sector: string;
  sectorETF: string;
  /** Sector ETF return over period */
  sectorReturn: number;
  /** SPY return over same period */
  spyReturn: number;
  /** Relative strength (sector - SPY) */
  relativeStrength: number;
  /** Performance rating */
  rating: "leading" | "inline" | "lagging" | "underperforming";
  /** Money flow direction based on trend */
  moneyFlow: "inflow" | "outflow" | "neutral";
  /** Description for display */
  description: string;
}

/**
 * Calculate return from historical data
 */
function calculateReturn(historical: HistoricalData[], days: number): number | null {
  if (historical.length < days) return null;
  
  const current = historical[historical.length - 1]?.close;
  const past = historical[historical.length - days]?.close;
  
  if (!current || !past || past === 0) return null;
  
  return ((current - past) / past) * 100;
}

/**
 * Determine money flow direction based on multiple timeframes
 */
function determineMoneyFlow(
  return5d: number | null,
  return20d: number | null,
  relativeStrength20d: number
): "inflow" | "outflow" | "neutral" {
  // Strong recent inflow: positive 5d and 20d returns with positive RS
  if (return5d && return5d > 1 && return20d && return20d > 2 && relativeStrength20d > 2) {
    return "inflow";
  }
  
  // Strong recent outflow: negative 5d and 20d returns with negative RS
  if (return5d && return5d < -1 && return20d && return20d < -2 && relativeStrength20d < -2) {
    return "outflow";
  }
  
  return "neutral";
}

/**
 * Calculate sector relative strength vs SPY
 */
export async function calculateSectorStrength(
  sector: string | undefined
): Promise<SectorStrengthResult | null> {
  if (!sector) return null;
  
  const sectorETF = SECTOR_ETF_MAP[sector];
  if (!sectorETF) {
    // Unknown sector, can't calculate
    return null;
  }
  
  try {
    // Fetch sector ETF and SPY historical data in parallel
    const [sectorHistory, spyHistory] = await Promise.all([
      yahooProvider.getHistorical(sectorETF, 60),
      yahooProvider.getHistorical("SPY", 60),
    ]);
    
    if (!sectorHistory || sectorHistory.length < 20 || 
        !spyHistory || spyHistory.length < 20) {
      return null;
    }
    
    // Calculate returns for different periods
    const sectorReturn5d = calculateReturn(sectorHistory, 5);
    const sectorReturn20d = calculateReturn(sectorHistory, 20);
    const sectorReturn50d = calculateReturn(sectorHistory, 50);
    
    const spyReturn5d = calculateReturn(spyHistory, 5);
    const spyReturn20d = calculateReturn(spyHistory, 20);
    const spyReturn50d = calculateReturn(spyHistory, 50);
    
    if (sectorReturn20d === null || spyReturn20d === null) {
      return null;
    }
    
    // Calculate relative strength (primary metric is 20-day)
    const relativeStrength = sectorReturn20d - spyReturn20d;
    
    // Determine rating
    let rating: SectorStrengthResult["rating"];
    if (relativeStrength > 3) {
      rating = "leading";
    } else if (relativeStrength > -1) {
      rating = "inline";
    } else if (relativeStrength > -3) {
      rating = "lagging";
    } else {
      rating = "underperforming";
    }
    
    // Determine money flow
    const moneyFlow = determineMoneyFlow(
      sectorReturn5d,
      sectorReturn20d,
      relativeStrength
    );
    
    // Build description
    let description: string;
    const rsSign = relativeStrength >= 0 ? "+" : "";
    if (rating === "leading") {
      description = `${sector} outperforming market (${rsSign}${relativeStrength.toFixed(1)}% vs SPY)`;
    } else if (rating === "inline") {
      description = `${sector} tracking with market`;
    } else if (rating === "lagging") {
      description = `${sector} lagging market (${rsSign}${relativeStrength.toFixed(1)}% vs SPY)`;
    } else {
      description = `${sector} significantly underperforming (${rsSign}${relativeStrength.toFixed(1)}% vs SPY)`;
    }
    
    return {
      sector,
      sectorETF,
      sectorReturn: sectorReturn20d,
      spyReturn: spyReturn20d,
      relativeStrength,
      rating,
      moneyFlow,
      description,
    };
  } catch (error) {
    console.error(`Error calculating sector strength for ${sector}:`, error);
    return null;
  }
}

/**
 * Get all sector ETF symbols
 */
export function getSectorETFs(): string[] {
  return [...new Set(Object.values(SECTOR_ETF_MAP))];
}

/**
 * Get sector for a given ETF
 */
export function getSectorForETF(etf: string): string | null {
  for (const [sector, sectorETF] of Object.entries(SECTOR_ETF_MAP)) {
    if (sectorETF === etf) {
      return sector;
    }
  }
  return null;
}
