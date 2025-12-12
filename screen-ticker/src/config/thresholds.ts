import { ThresholdsConfig, ScoreWeights } from "../types/index.ts";

/**
 * Default thresholds for signal detection
 */
export const defaultThresholds: ThresholdsConfig = {
  technical: {
    rsiOversold: 40,
    rsiOverbought: 70,
    volumeSurgeMultiplier: 1.5,
    nearSupportPercent: 0.03,
  },
  fundamental: {
    pegRatioMax: 1.5,        // Relaxed from 1.0 - growth stocks often 1-2
    pegRatioGood: 2.0,       // Partial credit for PEG < 2
    fcfYieldMin: 0.03,       // Relaxed from 8% to 3% (more realistic)
    fcfYieldHigh: 0.05,      // Bonus for 5%+ yield
    forwardPEDiscountPercent: 0.10, // Relaxed from 15% to 10%
    evEbitdaMax: 15,         // Relaxed from 12 to 15
    evEbitdaGood: 20,        // Partial credit for < 20
  },
  analyst: {
    minUpsidePercent: 0.25,
    recentUpgradesMin: 2,
    revisionsTrendDays: 90,
  },
  scoring: {
    minTotalScore: 70,
    momentumBonusThreshold7d: 10,
    strongMomentumThreshold7d: 20,
  },
};

/**
 * Default score weights for each signal
 * Technical: max 50 points
 * Fundamental: max 30 points
 * Analyst: max 20 points
 * Total: max 100 points
 */
export const defaultWeights: ScoreWeights = {
  technical: {
    rsiOversold: 10,
    goldenCross: 15,
    nearSupport: 10,
    volumeSurge: 10,
    obvTrend: 5,
  },
  fundamental: {
    pegUnderOne: 10,
    fcfYieldHigh: 8,
    forwardPELow: 7,
    evEbitdaLow: 5,
  },
  analyst: {
    highUpside: 8,
    recentUpgrades: 7,
    positiveRevisions: 5,
  },
  momentum: {
    scoreImproved10pts: 5,
    scoreImproved20pts: 10,
  },
};

/**
 * S&P 500 tickers (subset for testing)
 * Full list would be loaded from Supabase
 */
export const SP500_SAMPLE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "UNH", "JNJ", "JPM", "V", "PG", "XOM", "HD", "CVX", "MA", "ABBV",
  "MRK", "LLY", "PEP", "KO", "COST", "AVGO", "TMO", "MCD", "WMT",
  "CSCO", "ACN", "ABT", "DHR", "NEE", "VZ", "ADBE", "CRM", "NKE",
  "CMCSA", "TXN", "PM", "INTC", "AMD", "QCOM", "UPS", "RTX", "HON",
  "ORCL", "IBM", "LOW", "CAT",
];

/**
 * Sector mappings for sector-based analysis
 */
export const SECTOR_MAPPING: Record<string, string[]> = {
  technology: [
    "AAPL", "MSFT", "GOOGL", "NVDA", "META", "ADBE", 
    "CRM", "CSCO", "INTC", "AMD", "QCOM", "ORCL", "IBM",
  ],
  healthcare: ["UNH", "JNJ", "ABBV", "MRK", "LLY", "TMO", "ABT", "DHR"],
  financials: ["JPM", "V", "MA", "BRK-B"],
  consumer: ["AMZN", "TSLA", "HD", "PG", "PEP", "KO", "COST", "MCD", 
             "WMT", "NKE", "LOW"],
  energy: ["XOM", "CVX"],
  industrials: ["UPS", "RTX", "HON", "CAT"],
  utilities: ["NEE"],
  telecom: ["VZ", "CMCSA"],
};

