/**
 * Type definitions for Yahoo Finance Proxy
 *
 * These types match lib/ai-agent expected format
 */

// =============================================================================
// AUTH
// =============================================================================

export interface YahooAuth {
  cookies: string;
  crumb: string;
}

// =============================================================================
// OUTPUT TYPES (returned to clients)
// =============================================================================

/**
 * Quote data with nullable fields for companies with
 * negative earnings or unavailable data
 */
export interface QuoteData {
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  beta: number | null;
  dividendYield: number;
  fiftyDayAverage: number;
  twoHundredDayAverage: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
}

export interface ChartData {
  dataPoints: number;
  quotes: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export interface EarningsData {
  date: string;
  daysUntil: number;
}

export interface AnalystsData {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  bullishPct: number;
}

export interface ShortInterestData {
  shortRatio: number;
  shortPctFloat: number;
}

export interface OptionsData {
  expirations: number;
  nearestExpiry: string;
  callCount: number;
  putCount: number;
  atmIV: number | null;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  pcRatioVol: number | null;
  pcRatioOI: number | null;
}

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  date: string;
}

export interface SummaryData {
  earnings: EarningsData | null;
  analysts: AnalystsData | null;
  shortInterest: ShortInterestData | null;
  beta: number | null;
  eps: number | null;
  // v4.1: Expanded fundamental data
  fundamentals: FundamentalsData | null;
  epsTrend: EPSTrendData | null;
  earningsHistory: EarningsHistoryData | null;
  insiderActivity: InsiderActivityData | null;
  profile: ProfileData | null;
}

// v4.1: Fundamental metrics for scoring
export interface FundamentalsData {
  pegRatio: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  freeCashFlow: number | null;
  fcfYield: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  targetMeanPrice: number | null;
  recommendationMean: number | null;
  numberOfAnalystOpinions: number | null;
}

// v4.1: EPS estimates and revisions
export interface EPSTrendData {
  current: number | null;
  sevenDaysAgo: number | null;
  thirtyDaysAgo: number | null;
  sixtyDaysAgo: number | null;
  ninetyDaysAgo: number | null;
  // Revisions
  upLast7days: number;
  upLast30days: number;
  downLast7days: number;
  downLast30days: number;
}

// v4.1: Earnings beat/miss history
export interface EarningsHistoryData {
  quarters: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprise: number | null;
    beat: boolean | null;
  }>;
  beatCount: number;
  missCount: number;
}

// v4.1: Insider buying/selling
export interface InsiderActivityData {
  buyCount: number;
  buyShares: number;
  sellCount: number;
  sellShares: number;
  netShares: number;
  period: string;
}

// v4.1: Company profile
export interface ProfileData {
  sector: string | null;
  industry: string | null;
  country: string | null;
  employees: number | null;
}

// =============================================================================
// FINANCIALS TYPES
// =============================================================================

export interface FinancialsData {
  ticker: string;
  currency: string;
  fiscalYear: string;
  income: {
    revenue: number;
    revenueGrowth: number | null;
    grossProfit: number;
    grossMargin: number;
    operatingIncome: number;
    operatingMargin: number;
    netIncome: number;
    netMargin: number;
    eps: number;
    epsGrowth: number | null;
  };
  balance: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    cash: number;
    totalDebt: number;
    debtToEquity: number;
    currentRatio: number;
  };
  cashFlow: {
    operatingCashFlow: number;
    capitalExpenditure: number;
    freeCashFlow: number;
    fcfYield: number | null;
    dividendsPaid: number | null;
  };
  valuationMetrics: {
    peRatio: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    evToEbitda: number | null;
  };
}

export interface HoldingsData {
  ticker: string;
  institutionsPercent: number;
  institutionsCount: number;
  topHolders: Array<{
    name: string;
    pctHeld: number | undefined;
    value: number;
    reportDate: string | undefined;
  }>;
}

// =============================================================================
// YAHOO API RESPONSE TYPES (internal)
// =============================================================================

export interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketVolume?: number;
      averageDailyVolume3Month?: number;
      marketCap?: number;
      trailingPE?: number;
      forwardPE?: number;
      trailingEps?: number;
      beta?: number;
      dividendYield?: number;
      fiftyDayAverage?: number;
      twoHundredDayAverage?: number;
      fiftyTwoWeekLow?: number;
      fiftyTwoWeekHigh?: number;
    }>;
  };
}

export interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
}

export interface YahooSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      calendarEvents?: {
        earnings?: {
          earningsDate?: Array<{ raw?: number }>;
        };
      };
      recommendationTrend?: {
        trend?: Array<{
          strongBuy?: number;
          buy?: number;
          hold?: number;
          sell?: number;
          strongSell?: number;
        }>;
      };
      defaultKeyStatistics?: {
        shortRatio?: { raw?: number };
        shortPercentOfFloat?: { raw?: number };
        beta?: { raw?: number };
        trailingEps?: { raw?: number };
        pegRatio?: { raw?: number };
        priceToBook?: { raw?: number };
        enterpriseToEbitda?: { raw?: number };
      };
      // v4.1: Added modules
      financialData?: {
        freeCashflow?: { raw?: number };
        operatingCashflow?: { raw?: number };
        totalRevenue?: { raw?: number };
        revenueGrowth?: { raw?: number };
        earningsGrowth?: { raw?: number };
        profitMargins?: { raw?: number };
        operatingMargins?: { raw?: number };
        returnOnEquity?: { raw?: number };
        debtToEquity?: { raw?: number };
        currentRatio?: { raw?: number };
        totalCash?: { raw?: number };
        totalDebt?: { raw?: number };
        targetMeanPrice?: { raw?: number };
        recommendationMean?: { raw?: number };
        numberOfAnalystOpinions?: { raw?: number };
      };
      earningsTrend?: {
        trend?: Array<{
          period?: string;
          epsTrend?: {
            current?: { raw?: number };
            '7daysAgo'?: { raw?: number };
            '30daysAgo'?: { raw?: number };
            '60daysAgo'?: { raw?: number };
            '90daysAgo'?: { raw?: number };
          };
          epsRevisions?: {
            upLast7days?: { raw?: number };
            upLast30days?: { raw?: number };
            downLast7days?: { raw?: number };
            downLast30days?: { raw?: number };
          };
        }>;
      };
      earningsHistory?: {
        history?: Array<{
          quarter?: { raw?: number };
          epsActual?: { raw?: number };
          epsEstimate?: { raw?: number };
          surprisePercent?: { raw?: number };
        }>;
      };
      netSharePurchaseActivity?: {
        period?: string;
        buyInfoCount?: { raw?: number };
        buyInfoShares?: { raw?: number };
        sellInfoCount?: { raw?: number };
        sellInfoShares?: { raw?: number };
        netInfoShares?: { raw?: number };
      };
      assetProfile?: {
        sector?: string;
        industry?: string;
        country?: string;
        fullTimeEmployees?: number;
      };
    }>;
  };
}

export interface YahooOptionsResponse {
  optionChain?: {
    result?: Array<{
      expirationDates?: number[];
      quote?: {
        regularMarketPrice?: number;
      };
      options?: Array<{
        expirationDate?: number;
        calls?: Array<{
          strike?: number;
          impliedVolatility?: number;
          volume?: number;
          openInterest?: number;
        }>;
        puts?: Array<{
          strike?: number;
          impliedVolatility?: number;
          volume?: number;
          openInterest?: number;
        }>;
      }>;
    }>;
  };
}

export interface YahooSearchResponse {
  news?: Array<{
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
  }>;
}

export interface YahooFinancialsResponse {
  quoteSummary?: {
    result?: Array<{
      incomeStatementHistory?: {
        incomeStatementHistory?: Array<{
          endDate?: { raw?: number };
          totalRevenue?: { raw?: number };
          grossProfit?: { raw?: number };
          operatingIncome?: { raw?: number };
          netIncome?: { raw?: number };
        }>;
      };
      balanceSheetHistory?: {
        balanceSheetStatements?: Array<{
          totalAssets?: { raw?: number };
          totalLiab?: { raw?: number };
          totalStockholderEquity?: { raw?: number };
          cash?: { raw?: number };
          longTermDebt?: { raw?: number };
          totalCurrentAssets?: { raw?: number };
          totalCurrentLiabilities?: { raw?: number };
        }>;
      };
      cashflowStatementHistory?: {
        cashflowStatements?: Array<{
          totalCashFromOperatingActivities?: { raw?: number };
          capitalExpenditures?: { raw?: number };
          dividendsPaid?: { raw?: number };
        }>;
      };
      financialData?: {
        revenueGrowth?: { raw?: number };
        earningsGrowth?: { raw?: number };
      };
      defaultKeyStatistics?: {
        trailingEps?: { raw?: number };
        pegRatio?: { raw?: number };
        priceToBook?: { raw?: number };
        priceToSalesTrailing12Months?: { raw?: number };
        enterpriseToEbitda?: { raw?: number };
        forwardPE?: { raw?: number };
      };
    }>;
  };
}

export interface YahooHoldingsResponse {
  quoteSummary?: {
    result?: Array<{
      institutionOwnership?: {
        ownershipList?: Array<{
          organization?: string;
          pctHeld?: { raw?: number };
          value?: { raw?: number };
          reportDate?: { raw?: number };
        }>;
      };
      majorHoldersBreakdown?: {
        institutionsPercentHeld?: { raw?: number };
      };
    }>;
  };
}
