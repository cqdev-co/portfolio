import { z } from "zod";

// Signal categories
export const SignalCategory = z.enum([
  "technical",
  "fundamental",
  "analyst",
]);
export type SignalCategory = z.infer<typeof SignalCategory>;

// Stock investment style
export const StockStyle = z.enum(["growth", "value", "blend"]);
export type StockStyle = z.infer<typeof StockStyle>;

// Individual signal schema
export const Signal = z.object({
  name: z.string(),
  category: SignalCategory,
  points: z.number(),
  description: z.string(),
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
});
export type Signal = z.infer<typeof Signal>;

// 52-week context data
export const WeekContext = z.object({
  low52: z.number().optional(),
  high52: z.number().optional(),
  pctFromLow: z.number().optional(),
  pctFromHigh: z.number().optional(),
  positionInRange: z.number().optional(),
  ma200: z.number().optional(),
  marketCap: z.number().optional(),
  nextEarningsDate: z.date().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  // Valuation metrics for sector comparison (v1.1.1)
  trailingPE: z.number().optional(),
  forwardPE: z.number().optional(),
  pegRatio: z.number().optional(),
  evEbitda: z.number().optional(),
  analystTarget: z.number().optional(),
  // v1.7.0: Additional risk/context metrics
  beta: z.number().optional(),
  shortPercentOfFloat: z.number().optional(),
  sharesShort: z.number().optional(),
  shortRatio: z.number().optional(),  // days to cover
  // Balance sheet health
  debtToEquity: z.number().optional(),
  currentRatio: z.number().optional(),
  quickRatio: z.number().optional(),
  totalCash: z.number().optional(),
  totalDebt: z.number().optional(),
  // Volatility context
  atr14: z.number().optional(),  // 14-day ATR
  atrPercent: z.number().optional(),  // ATR as % of price
});
export type WeekContext = z.infer<typeof WeekContext>;

// Stock score output schema
export const StockScore = z.object({
  ticker: z.string(),
  name: z.string().optional(),
  price: z.number(),
  technicalScore: z.number().min(0).max(50),
  fundamentalScore: z.number().min(0).max(30),
  analystScore: z.number().min(0).max(20),
  totalScore: z.number().min(0).max(100),
  upsidePotential: z.number(),
  signals: z.array(Signal),
  warnings: z.array(Signal).optional(),
  dataQuality: z.enum(["good", "partial", "poor"]).optional(),
  scanDate: z.date(),
  context: WeekContext.optional(),
  stockStyle: StockStyle.optional(),
});
export type StockScore = z.infer<typeof StockScore>;

// Configuration thresholds schema
export const ThresholdsConfig = z.object({
  technical: z.object({
    rsiOversold: z.number().default(40),
    rsiOverbought: z.number().default(70),
    volumeSurgeMultiplier: z.number().default(1.5),
    nearSupportPercent: z.number().default(0.03),
  }),
  fundamental: z.object({
    pegRatioMax: z.number().default(1.5),
    pegRatioGood: z.number().default(2.0),
    fcfYieldMin: z.number().default(0.03),
    fcfYieldHigh: z.number().default(0.05),
    forwardPEDiscountPercent: z.number().default(0.10),
    evEbitdaMax: z.number().default(15),
    evEbitdaGood: z.number().default(20),
  }),
  analyst: z.object({
    minUpsidePercent: z.number().default(0.25),
    recentUpgradesMin: z.number().default(2),
    revisionsTrendDays: z.number().default(90),
  }),
  scoring: z.object({
    minTotalScore: z.number().default(70),
    momentumBonusThreshold7d: z.number().default(10),
    strongMomentumThreshold7d: z.number().default(20),
  }),
});
export type ThresholdsConfig = z.infer<typeof ThresholdsConfig>;

// Score weights schema
export const ScoreWeights = z.object({
  technical: z.object({
    rsiOversold: z.number().default(10),
    goldenCross: z.number().default(15),
    nearSupport: z.number().default(10),
    volumeSurge: z.number().default(10),
    obvTrend: z.number().default(5),
  }),
  fundamental: z.object({
    pegUnderOne: z.number().default(10),
    fcfYieldHigh: z.number().default(8),
    forwardPELow: z.number().default(7),
    evEbitdaLow: z.number().default(5),
  }),
  analyst: z.object({
    highUpside: z.number().default(8),
    recentUpgrades: z.number().default(7),
    positiveRevisions: z.number().default(5),
  }),
  momentum: z.object({
    scoreImproved10pts: z.number().default(5),
    scoreImproved20pts: z.number().default(10),
  }),
});
export type ScoreWeights = z.infer<typeof ScoreWeights>;

// Quarterly Performance types (v1.4.0)
export interface QuarterlyResult {
  quarter: string;       // e.g., "3Q2024"
  revenue: number | null;
  earnings: number | null;
  epsActual: number | null;
  epsEstimate: number | null;
  epsSurprise: number | null;  // surprise percentage
  beat: boolean | null;
}

export interface QuarterlyPerformance {
  quarters: QuarterlyResult[];
  revenueTrend: "growing" | "declining" | "mixed" | "insufficient_data";
  earningsTrend: "improving" | "declining" | "mixed" | "insufficient_data";
  beatMissRecord: {
    beats: number;
    misses: number;
    total: number;
    summary: string;  // e.g., "Beat 3 of last 4 quarters"
  };
  profitableQuarters: number;
  totalQuarters: number;
  sequentialImprovement: boolean;  // margins improving QoQ
  surpriseTrend: "consistently_beating" | "consistently_missing" | 
                "mixed" | "insufficient_data";
}

// Yahoo Finance data types
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
    shortRatio?: { raw?: number };  // days to cover
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
    // v1.7.0: Balance sheet health metrics
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

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

// Database record type
export const StockOpportunityRecord = z.object({
  ticker: z.string(),
  price: z.number(),
  technical_score: z.number(),
  fundamental_score: z.number(),
  analyst_score: z.number(),
  total_score: z.number(),
  upside_potential: z.number(),
  signals: z.array(Signal),
  scan_date: z.string(),
});
export type StockOpportunityRecord = z.infer<typeof StockOpportunityRecord>;

// CLI options
export interface ScanOptions {
  list?: string;
  tickers?: string;
  minScore: number;
  dryRun: boolean;
  verbose: boolean;
}

export interface TrendsOptions {
  days: number;
  minDelta: number;
}

