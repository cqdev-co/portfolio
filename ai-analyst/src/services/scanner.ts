/**
 * Trade Scanner Service
 * Scans multiple tickers to find Grade A opportunities
 */

import YahooFinance from "yahoo-finance2";
import { findOptimalSpread, getEarningsInfo, getIVAnalysis } from "./yahoo.ts";
import { 
  gradeTradeOpportunity, 
  calculateRiskScore,
  type TradeGradeResult,
  type RiskScore,
} from "../engine/trade-analyzer.ts";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false, logOptionsErrors: false },
});

// ============================================================================
// TYPES
// ============================================================================

export interface ScanResult {
  ticker: string;
  price: number;
  changePct: number;
  grade: TradeGradeResult;
  risk: RiskScore;
  spread?: {
    strikes: string;
    debit: number;
    cushion: number;
    maxProfit: number;
    dte: number;
  };
  iv?: {
    current: number;         // Current IV percentage (e.g., 35.5)
    percentile: number;      // IV percentile (0-100)
    level: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  };
  reasons: string[];
}

export interface ScanOptions {
  minGrade?: string;  // 'A', 'B', 'C'
  maxRisk?: number;   // 1-10
  minCushion?: number; // percentage
  onProgress?: (current: number, total: number, ticker: string) => void;
}

// ============================================================================
// WATCHLISTS
// ============================================================================

// Popular liquid stocks good for options
export const SCAN_LISTS = {
  // Large cap tech - most liquid options
  megaCap: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 
    'NFLX', 'CRM', 'ORCL', 'ADBE', 'INTC', 'CSCO', 'QCOM',
  ],
  
  // Finance & Healthcare
  diversified: [
    'JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP',
    'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY',
  ],
  
  // Consumer & Industrial
  consumer: [
    'WMT', 'COST', 'HD', 'TGT', 'NKE', 'SBUX', 'MCD',
    'DIS', 'BA', 'CAT', 'DE', 'UPS', 'FDX',
  ],
  
  // High volatility (for experienced traders)
  highBeta: [
    'COIN', 'MSTR', 'RIOT', 'MARA', 'SQ', 'SHOP', 'SNOW',
    'PLTR', 'ROKU', 'DKNG', 'RBLX', 'U',
  ],
  
  // ETFs
  etfs: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK'],
};

// Default scan list - most liquid, best for our strategy
export const DEFAULT_SCAN_LIST = [
  ...SCAN_LISTS.megaCap,
  ...SCAN_LISTS.diversified.slice(0, 7),
];

// ============================================================================
// SCANNER
// ============================================================================

/**
 * Calculate RSI from historical prices
 */
async function calculateRSI(symbol: string, period: number = 14): Promise<number | undefined> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const history = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!history?.quotes || history.quotes.length < period + 1) {
      return undefined;
    }

    const closes = history.quotes
      .map(q => q.close)
      .filter((c): c is number => c !== null && c !== undefined);

    if (closes.length < period + 1) return undefined;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[closes.length - i] - closes[closes.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  } catch {
    return undefined;
  }
}

/**
 * Scan a single ticker
 */
async function scanTicker(symbol: string): Promise<ScanResult | null> {
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote?.regularMarketPrice) return null;

    const price = quote.regularMarketPrice;
    const ma200 = quote.twoHundredDayAverage;
    const aboveMA200 = ma200 ? price > ma200 : undefined;

    // Get RSI
    const rsi = await calculateRSI(symbol);

    // Get earnings and IV in parallel
    const [earningsInfo, spread, ivAnalysis] = await Promise.all([
      getEarningsInfo(symbol),
      findOptimalSpread(symbol, 30),
      getIVAnalysis(symbol),
    ]);

    const earningsDays = earningsInfo.daysUntilEarnings;

    // Build reasons array
    const reasons: string[] = [];
    
    if (aboveMA200 === true) {
      reasons.push('Above MA200 ✓');
    } else if (aboveMA200 === false) {
      reasons.push('Below MA200 ✗');
    }

    if (rsi !== undefined) {
      if (rsi >= 35 && rsi <= 55) {
        reasons.push(`RSI ${rsi.toFixed(0)} ideal ✓`);
      } else if (rsi > 65) {
        reasons.push(`RSI ${rsi.toFixed(0)} overbought ✗`);
      } else if (rsi < 30) {
        reasons.push(`RSI ${rsi.toFixed(0)} oversold ✗`);
      }
    }

    if (earningsDays !== null && earningsDays <= 14) {
      reasons.push(`Earnings ${earningsDays}d ✗`);
    } else if (earningsDays !== null && earningsDays > 30) {
      reasons.push(`Earnings ${earningsDays}d ✓`);
    }

    if (ivAnalysis) {
      if (ivAnalysis.ivLevel === 'LOW') {
        reasons.push(`IV ${ivAnalysis.currentIV.toFixed(0)}% low ✓`);
      } else if (ivAnalysis.ivLevel === 'HIGH') {
        reasons.push(`IV ${ivAnalysis.currentIV.toFixed(0)}% high ✗`);
      }
    }

    // Grade the trade
    const grade = gradeTradeOpportunity({
      price,
      rsi,
      ma200,
      aboveMA200,
      earningsDays,
      cushionPercent: spread?.cushion,
      dte: spread?.dte,
      spreadWidth: spread ? spread.shortStrike - spread.longStrike : undefined,
      debit: spread?.estimatedDebit,
    });

    // Calculate risk
    const risk = calculateRiskScore({
      rsi,
      cushionPercent: spread?.cushion,
      earningsDays,
      dte: spread?.dte,
      aboveMA200,
    });

    return {
      ticker: symbol,
      price,
      changePct: quote.regularMarketChangePercent ?? 0,
      grade,
      risk,
      spread: spread ? {
        strikes: `$${spread.longStrike}/$${spread.shortStrike}`,
        debit: spread.estimatedDebit,
        cushion: spread.cushion,
        maxProfit: spread.maxProfit,
        dte: spread.dte,
      } : undefined,
      iv: ivAnalysis ? {
        current: ivAnalysis.currentIV,
        percentile: ivAnalysis.ivPercentile,
        level: ivAnalysis.ivLevel,
      } : undefined,
      reasons,
    };
  } catch {
    return null;
  }
}

/**
 * Scan multiple tickers for opportunities
 */
export async function scanForOpportunities(
  tickers: string[] = DEFAULT_SCAN_LIST,
  options: ScanOptions = {}
): Promise<ScanResult[]> {
  const {
    minGrade = 'C',
    maxRisk = 8,
    minCushion = 5,
    onProgress,
  } = options;

  const results: ScanResult[] = [];
  const total = tickers.length;

  // Process tickers with rate limiting (avoid overwhelming Yahoo)
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    onProgress?.(i + 1, total, ticker);

    try {
      const result = await scanTicker(ticker);
      
      if (result) {
        // Apply filters
        const gradeValue = gradeToValue(result.grade.grade);
        const minGradeValue = gradeToValue(minGrade as any);
        
        if (
          gradeValue >= minGradeValue &&
          result.risk.score <= maxRisk &&
          (!result.spread || result.spread.cushion >= minCushion)
        ) {
          results.push(result);
        }
      }
    } catch {
      // Skip failed tickers
    }

    // Rate limit: small delay between requests
    if (i < tickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Sort by grade (best first)
  results.sort((a, b) => {
    const gradeA = gradeToValue(a.grade.grade);
    const gradeB = gradeToValue(b.grade.grade);
    if (gradeB !== gradeA) return gradeB - gradeA;
    // Secondary sort by risk (lower is better)
    return a.risk.score - b.risk.score;
  });

  return results;
}

function gradeToValue(grade: string): number {
  const grades: Record<string, number> = {
    'A+': 12, 'A': 11, 'A-': 10,
    'B+': 9, 'B': 8, 'B-': 7,
    'C+': 6, 'C': 5, 'C-': 4,
    'D': 3, 'F': 1,
  };
  return grades[grade] ?? 0;
}

/**
 * Quick scan - only scan most liquid tickers
 */
export async function quickScan(
  onProgress?: (current: number, total: number, ticker: string) => void
): Promise<ScanResult[]> {
  return scanForOpportunities(SCAN_LISTS.megaCap, {
    minGrade: 'B',
    maxRisk: 6,
    minCushion: 7,
    onProgress,
  });
}

/**
 * Full scan - scan all watchlists
 */
export async function fullScan(
  onProgress?: (current: number, total: number, ticker: string) => void
): Promise<ScanResult[]> {
  const allTickers = [
    ...SCAN_LISTS.megaCap,
    ...SCAN_LISTS.diversified,
    ...SCAN_LISTS.consumer,
  ];
  
  // Remove duplicates
  const uniqueTickers = [...new Set(allTickers)];
  
  return scanForOpportunities(uniqueTickers, {
    minGrade: 'B-',
    maxRisk: 7,
    minCushion: 6,
    onProgress,
  });
}

/**
 * Format scan results for display
 */
export function formatScanResults(results: ScanResult[]): string {
  if (results.length === 0) {
    return 'No opportunities found matching criteria.';
  }

  let output = `Found ${results.length} opportunities:\n\n`;
  
  for (const r of results.slice(0, 10)) {
    const changeStr = `${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(1)}%`;
    output += `${r.ticker} - Grade ${r.grade.grade} | Risk ${r.risk.score}/10\n`;
    output += `  Price: $${r.price.toFixed(2)} (${changeStr})\n`;
    
    if (r.spread) {
      output += `  Spread: ${r.spread.strikes} @ $${r.spread.debit.toFixed(2)} | `;
      output += `${r.spread.cushion.toFixed(1)}% cushion | ${r.spread.dte} DTE\n`;
    }
    
    output += `  ${r.reasons.slice(0, 3).join(' | ')}\n`;
    output += `  → ${r.grade.recommendation}\n\n`;
  }

  return output;
}

