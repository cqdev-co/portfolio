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

