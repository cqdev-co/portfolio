/**
 * Shared market data types used across all engine strategies.
 * These are the canonical types for Yahoo Finance data.
 */

// ============================================================================
// QUOTE & MARKET DATA
// ============================================================================

export interface QuoteData {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  marketCap?: number;
}

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

// ============================================================================
// QUOTE SUMMARY (FUNDAMENTALS + ANALYST)
// ============================================================================

export interface QuoteSummary {
  price?: {
    regularMarketPrice?: { raw?: number };
    shortName?: string;
  };
  summaryDetail?: {
    forwardPE?: { raw?: number };
    trailingPE?: { raw?: number };
    pegRatio?: { raw?: number };
    priceToBook?: { raw?: number };
  };
  defaultKeyStatistics?: {
    enterpriseToEbitda?: { raw?: number };
    pegRatio?: { raw?: number };
    shortPercentOfFloat?: { raw?: number };
    sharesShort?: { raw?: number };
    shortRatio?: { raw?: number };
    beta?: { raw?: number };
    fiftyTwoWeekChange?: { raw?: number };
    floatShares?: { raw?: number };
    sharesOutstanding?: { raw?: number };
  };
  financialData?: {
    freeCashflow?: { raw?: number };
    operatingCashflow?: { raw?: number };
    totalRevenue?: { raw?: number };
    revenueGrowth?: { raw?: number };
    earningsGrowth?: { raw?: number };
    currentPrice?: { raw?: number };
    targetMeanPrice?: { raw?: number };
    recommendationMean?: { raw?: number };
    numberOfAnalystOpinions?: { raw?: number };
    profitMargins?: { raw?: number };
    operatingMargins?: { raw?: number };
    returnOnEquity?: { raw?: number };
    financialCurrency?: string;
    debtToEquity?: { raw?: number };
    currentRatio?: { raw?: number };
    quickRatio?: { raw?: number };
    totalCash?: { raw?: number };
    totalDebt?: { raw?: number };
  };
  earningsTrend?: {
    trend?: Array<{
      period?: string;
      growth?: { raw?: number };
      earningsEstimate?: {
        avg?: { raw?: number };
      };
      epsTrend?: {
        current?: number;
        sevenDaysAgo?: number;
        thirtyDaysAgo?: number;
        sixtyDaysAgo?: number;
        ninetyDaysAgo?: number;
      };
      epsRevisions?: {
        upLast7days?: number;
        upLast30days?: number;
        downLast7days?: number;
        downLast30days?: number;
      };
    }>;
  };
  recommendationTrend?: {
    trend?: Array<{
      period?: string;
      strongBuy?: number;
      buy?: number;
      hold?: number;
      sell?: number;
      strongSell?: number;
    }>;
  };
  upgradeDowngradeHistory?: {
    history?: Array<{
      epochGradeDate?: number;
      firm?: string;
      toGrade?: string;
      fromGrade?: string;
      action?: string;
    }>;
  };
  calendarEvents?: {
    earnings?: {
      earningsDate?: Array<Date>;
    };
  };
  assetProfile?: {
    sector?: string;
    industry?: string;
    country?: string;
    website?: string;
  };
  majorHoldersBreakdown?: {
    insidersPercentHeld?: number;
    institutionsPercentHeld?: number;
    institutionsCount?: number;
  };
  netSharePurchaseActivity?: {
    period?: string;
    buyInfoCount?: number;
    buyInfoShares?: number;
    sellInfoCount?: number;
    sellInfoShares?: number;
    netInfoCount?: number;
    netInfoShares?: number;
  };
  earnings?: {
    financialsChart?: {
      quarterly?: Array<{
        date?: string;
        revenue?: number;
        earnings?: number;
      }>;
    };
  };
  earningsHistory?: {
    history?: Array<{
      quarter?: Date;
      epsActual?: number;
      epsEstimate?: number;
      epsDifference?: number;
      surprisePercent?: number;
    }>;
  };
}

// ============================================================================
// OPTIONS CHAIN
// ============================================================================

export interface OptionLeg {
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
}

export interface OptionsChainResult {
  calls: OptionLeg[];
  puts: OptionLeg[];
  expiration: Date;
}

// ============================================================================
// VERTICAL SPREAD TYPES
// ============================================================================

export interface OptionContract {
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  type: 'call' | 'put';
  openInterest: number;
  volume: number;
  impliedVolatility: number;
}

export interface VerticalSpread {
  type: 'call_debit' | 'put_credit' | 'call_credit' | 'put_debit';
  strategy: string;
  sentiment: 'bullish' | 'bearish';
  longLeg: {
    strike: number;
    premium: number;
    type: 'call' | 'put';
  };
  shortLeg: {
    strike: number;
    premium: number;
    type: 'call' | 'put';
  };
  expiration: Date;
  daysToExpiry: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  riskRewardRatio: number;
  probabilityOfProfit: number;
  spreadWidth: number;
  netDebit: number | null;
  netCredit: number | null;
}

// ============================================================================
// SIGNAL TYPES (shared across engines)
// ============================================================================

export type SignalCategory = 'technical' | 'fundamental' | 'analyst';

export interface Signal {
  name: string;
  category: SignalCategory;
  points: number;
  description: string;
  value?: number | string | boolean;
}
