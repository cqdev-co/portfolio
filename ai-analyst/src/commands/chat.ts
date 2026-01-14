/**
 * Chat Command
 * Your AI Analyst Employee - A Financial Analyst for your Hedge Fund
 *
 * This is your first "employee" who:
 * - Proactively finds trade opportunities
 * - Recommends specific trades with full calculations
 * - Follows your Deep ITM Call Debit Spread strategy
 * - Reports to you like a real analyst would
 */

import * as readline from 'readline';
import chalk from 'chalk';
import YahooFinance from 'yahoo-finance2';
import {
  validateAIRequirement,
  chatWithTools,
  streamChatWithTools,
  type OllamaMode,
  type AgentMessage,
  type AgentResponse,
  type ToolDefinition,
  type ToolCall,
  type StreamingAgentResult,
} from '../services/ollama.ts';
import {
  getAllTrades,
  getTradesByTicker,
  getPerformanceSummary,
  isConfigured,
} from '../services/supabase.ts';
import {
  buildTickerHistory,
  detectPatterns,
  toonToString,
  buildTOONContext,
  encodeTickerToTOON,
  summarizeConversation,
  type TickerDataInput,
  type ConversationMessage as TOONConversationMessage,
} from '../context/toon.ts';
import {
  calculateSupportResistance,
  type SpreadRecommendation,
  type IVAnalysis,
  type SupportResistance,
  type NewsItem,
} from '../services/yahoo.ts';
import { getCalendarContext } from '../services/calendar.ts';
import {
  getMarketRegime as fetchMarketRegime,
  getRegimeBadge,
  formatRegimeForAI,
  type MarketRegime as MarketRegimeData,
} from '../services/market-regime.ts';
import {
  analyzeTradingRegime,
  formatTradingRegimeForAI,
  formatTradingRegimeTOON,
  type TradingRegimeAnalysis,
} from '../../../lib/ai-agent/market/index.ts';
import {
  encodeSearchToTOON as libEncodeSearchToTOON,
  encodeTickerToTOON as libEncodeTickerToTOON,
} from '../../../lib/ai-agent/toon/index.ts';
import { sessionCache } from '../../../lib/ai-agent/cache/index.ts';
import { log } from '../../../lib/ai-agent/utils/index.ts';
import { quickScan, type ScanResult } from '../services/scanner.ts';
import {
  searchWeb,
  formatSearchForAI,
  needsWebSearch,
  type WebSearchResponse,
} from '../services/web-search.ts';
import { getMarketStatus, type DataQuality } from '../services/yahoo.ts';
import {
  performFullAnalysis,
  type AdvancedAnalysis,
} from '../engine/trade-analyzer.ts';
import type { MarketRegime, Trade } from '../types/index.ts';
import type { PsychologicalFairValue } from '../../../lib/utils/ts/psychological-fair-value/types.ts';

// Shared AI Agent library (DATA PARITY: CLI uses same data as Frontend)
import {
  // Prompts
  buildVictorSystemPrompt,
  // Tools
  AGENT_TOOLS,
  BASIC_TOOLS,
  toOllamaTools,
  // DATA FETCHING (shared with Frontend for parity)
  fetchTickerData as sharedFetchTickerData,
  // Tool Handlers (shared implementations)
  handleGetFinancialsDeep,
  handleGetInstitutionalHoldings,
  handleGetUnusualOptionsActivity,
  handleGetIVByStrike,
  handleCalculateSpread,
} from '../../../lib/ai-agent/index.ts';

// Instantiate yahoo-finance2
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

// ============================================================================
// TYPES
// ============================================================================

export interface ChatOptions {
  aiMode: OllamaMode;
  aiModel?: string;
  accountSize?: number;
  /** Enable streaming responses for better UX */
  stream?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AnalystRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  bullishPercent: number;
}

interface OwnershipData {
  insidersPercent: number;
  institutionsPercent: number;
  recentSalesM: number;
}

interface TargetPrices {
  low: number;
  mean: number;
  high: number;
  upside: number;
}

interface PricePerformance {
  day5: number;
  month1: number;
  month3: number;
  ytd: number;
}

interface EarningsInfo {
  date?: string;
  daysUntil?: number;
  streak?: number;
  lastSurprise?: number;
  avgSurprise?: number;
}

interface SectorContext {
  name: string;
  avgPE?: number;
  vsAvg?: number;
}

interface VolumeAnalysisData {
  todayPct: number;
  trend: 'increasing' | 'stable' | 'declining';
  unusualDays: number;
}

interface TickerData {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  rsi?: number;
  adx?: number;
  trendStrength?: 'WEAK' | 'MODERATE' | 'STRONG';
  aboveMA200?: boolean;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  // 52-week range
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  // Fundamentals
  marketCap?: number;
  peRatio?: number;
  forwardPE?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  // Enhanced data
  spread?: SpreadRecommendation;
  spreadAlternatives?: SpreadRecommendation[];
  spreadReason?: string;
  earningsDays?: number | null;
  earningsWarning?: boolean;
  // Advanced analysis
  analysis?: AdvancedAnalysis;
  iv?: IVAnalysis;
  supportResistance?: SupportResistance;
  news?: NewsItem[];
  dataQuality?: DataQuality;
  // Psychological Fair Value
  pfv?: PsychologicalFairValue;
  // Analyst ratings
  analystRatings?: AnalystRatings;
  // Ownership data
  ownership?: OwnershipData;
  // Target prices
  targetPrices?: TargetPrices;
  // Price performance
  performance?: PricePerformance;
  // NEW: Additional context
  earnings?: EarningsInfo;
  sectorContext?: SectorContext;
  volumeAnalysis?: VolumeAnalysisData;
  // NEW: Historical volatility
  hv20?: number;
  // NEW: High-value additions
  shortInterest?: {
    shortPct: number;
    shortRatio: number;
  };
  relativeStrength?: {
    vsSPY: number;
  };
  optionsFlow?: {
    pcRatioOI: number;
    pcRatioVol: number;
  };
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

const DEFAULT_ACCOUNT_SIZE = 1500;

async function getMarketRegime(): Promise<{
  regime: MarketRegime;
  spyPrice: number;
}> {
  try {
    const spy = await yahooFinance.quote('SPY');
    const spyPrice = spy?.regularMarketPrice ?? 0;
    const ma50 = spy?.fiftyDayAverage ?? spyPrice;
    const ma200 = spy?.twoHundredDayAverage ?? spyPrice;

    let regime: MarketRegime = 'neutral';
    if (spyPrice > ma50 && spyPrice > ma200) {
      regime = 'bull';
    } else if (spyPrice < ma50 && spyPrice < ma200) {
      regime = 'bear';
    }

    return { regime, spyPrice };
  } catch {
    return { regime: 'neutral', spyPrice: 0 };
  }
}

/**
 * Fetch ticker data using the SHARED LIBRARY for data parity with Frontend.
 *
 * DATA PARITY: Both CLI and Frontend now use the same fetchTickerData from
 * lib/ai-agent, ensuring identical data, spreads, IV, and PFV calculations.
 *
 * CLI-specific enhancements (ownership, advanced analysis) are added on top.
 */
async function fetchTickerData(
  ticker: string,
  _fetchOptions: boolean = true
): Promise<TickerData | null> {
  try {
    // Use SHARED library for data parity with Frontend
    const sharedData = await sharedFetchTickerData(ticker);
    if (!sharedData) return null;

    log.debug(`[CLI] Using shared fetchTickerData for ${ticker} (data parity)`);

    // CLI-specific: Fetch additional ownership data (not in shared lib)
    let ownership: OwnershipData | undefined;
    try {
      const insights = await yahooFinance.quoteSummary(ticker, {
        modules: ['majorHoldersBreakdown', 'insiderTransactions'],
      });

      const holders = insights?.majorHoldersBreakdown;
      const insiderTxns = insights?.insiderTransactions?.transactions ?? [];

      if (holders) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentSales = insiderTxns
          .filter((t) => t.startDate && new Date(t.startDate) > sixMonthsAgo)
          .filter((t) => (t.shares ?? 0) < 0)
          .reduce((sum, t) => sum + Math.abs(t.value ?? 0), 0);

        ownership = {
          insidersPercent: (holders.insidersPercentHeld ?? 0) * 100,
          institutionsPercent: (holders.institutionsPercentHeld ?? 0) * 100,
          recentSalesM: Math.round(recentSales / 1e6),
        };
      }
    } catch {
      // Ownership data optional
    }

    // CLI-specific: Calculate support/resistance (for CLI display)
    const supportResistance = calculateSupportResistance({
      currentPrice: sharedData.price,
      ma20: sharedData.ma20,
      ma50: sharedData.ma50,
      ma200: sharedData.ma200,
      fiftyTwoWeekLow: sharedData.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: sharedData.fiftyTwoWeekHigh,
    });

    // CLI-specific: Perform advanced trade analysis with grading
    let analysis: AdvancedAnalysis | undefined;
    if (sharedData.spread) {
      const analysisResult = performFullAnalysis({
        ticker: sharedData.ticker,
        price: sharedData.price,
        rsi: sharedData.rsi,
        ma200: sharedData.ma200,
        aboveMA200: sharedData.aboveMA200,
        earningsDays: sharedData.earningsDays ?? null,
        longStrike: sharedData.spread.longStrike,
        shortStrike: sharedData.spread.shortStrike,
        debit: sharedData.spread.estimatedDebit,
        dte: sharedData.spread.dte,
        accountSize: 1750,
      });
      analysis = analysisResult ?? undefined;
    }

    // Convert shared types to local types and merge CLI-specific data
    // Note: Using type assertions for shared->local type compatibility
    return {
      // Core data from shared library (SAME AS FRONTEND)
      ticker: sharedData.ticker,
      price: sharedData.price,
      change: (sharedData.changePct * sharedData.price) / 100, // Derived
      changePct: sharedData.changePct,
      rsi: sharedData.rsi,
      adx: sharedData.adx,
      trendStrength: sharedData.trendStrength as 'WEAK' | 'MODERATE' | 'STRONG',
      aboveMA200: sharedData.aboveMA200,
      ma20: sharedData.ma20,
      ma50: sharedData.ma50,
      ma200: sharedData.ma200,
      fiftyTwoWeekLow: sharedData.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: sharedData.fiftyTwoWeekHigh,
      marketCap: sharedData.marketCap,
      peRatio: sharedData.peRatio,
      forwardPE: sharedData.forwardPE,
      eps: sharedData.eps,
      dividendYield: sharedData.dividendYield,
      beta: sharedData.beta,

      // Options data from shared library (SAME AS FRONTEND)
      // Type assertions needed due to minor interface differences
      spread: sharedData.spread as SpreadRecommendation | undefined,
      spreadAlternatives: [], // Not in shared lib
      spreadReason: undefined, // Not in shared lib
      earningsDays: sharedData.earningsDays,
      earningsWarning: sharedData.earningsWarning,
      iv: sharedData.iv as IVAnalysis | undefined,
      pfv: sharedData.pfv as PsychologicalFairValue | undefined,

      // Rich data from shared library (SAME AS FRONTEND)
      analystRatings: sharedData.analystRatings,
      targetPrices: sharedData.targetPrices,
      performance: sharedData.performance
        ? {
            day5: sharedData.performance.day5 ?? 0,
            month1: sharedData.performance.month1 ?? 0,
            month3: sharedData.performance.month3 ?? 0,
            ytd: sharedData.performance.ytd ?? 0,
          }
        : undefined,
      earnings: sharedData.earnings
        ? {
            date: sharedData.earnings.date,
            daysUntil: sharedData.earnings.daysUntil,
            streak: sharedData.earnings.streak,
            lastSurprise: sharedData.earnings.lastSurprise,
            avgSurprise: sharedData.earnings.avgSurprise,
          }
        : undefined,
      sectorContext: sharedData.sectorContext,
      hv20: sharedData.hv20,
      shortInterest: sharedData.shortInterest
        ? {
            shortPct: sharedData.shortInterest.shortPct,
            shortRatio: sharedData.shortInterest.shortRatio ?? 0,
          }
        : undefined,
      relativeStrength: sharedData.relativeStrength
        ? {
            vsSPY: sharedData.relativeStrength.vsSPY,
          }
        : undefined,
      optionsFlow: sharedData.optionsFlow
        ? {
            pcRatioOI: sharedData.optionsFlow.pcRatioOI,
            pcRatioVol: sharedData.optionsFlow.pcRatioVol,
          }
        : undefined,
      news: sharedData.news as NewsItem[] | undefined,
      dataQuality: sharedData.dataQuality,

      // CLI-specific additions
      ownership,
      supportResistance,
      analysis,
    };
  } catch (error) {
    log.error(`[CLI] Error fetching ${ticker}:`, error);
    return null;
  }
}

async function buildContextForAI(
  accountSize: number,
  startupRegime?: MarketRegimeData | null,
  tradingRegime?: TradingRegimeAnalysis | null,
  useTOON: boolean = false
): Promise<string> {
  const contextParts: string[] = [];

  // Add current date/time context
  const now = new Date();
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dayOfWeek = dayNames[now.getDay()];
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  contextParts.push(`TODAY: ${dayOfWeek}, ${dateStr} at ${timeStr}`);

  // Market status
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isMarketHours = !isWeekend && hour >= 9 && hour < 16;
  const isPreMarket = !isWeekend && hour >= 4 && hour < 9;
  const isAfterHours = !isWeekend && hour >= 16 && hour < 20;

  let marketStatus = 'CLOSED';
  if (isMarketHours) marketStatus = 'OPEN';
  else if (isPreMarket) marketStatus = 'PRE-MARKET';
  else if (isAfterHours) marketStatus = 'AFTER-HOURS';
  else if (isWeekend) marketStatus = 'WEEKEND (CLOSED)';

  contextParts.push(`Market Status: ${marketStatus}`);

  // Use startup regime if available (avoids re-fetch)
  let regime: MarketRegime = 'neutral';
  let spyPrice = 0;

  if (startupRegime) {
    regime =
      startupRegime.regime === 'RISK_ON'
        ? 'bull'
        : startupRegime.regime === 'RISK_OFF'
          ? 'bear'
          : 'neutral';
    spyPrice = startupRegime.spy.price;
  } else {
    const regimeData = await getMarketRegime();
    regime = regimeData.regime;
    spyPrice = regimeData.spyPrice;
  }

  // Include trading regime - use TOON format for simple questions
  // This eliminates need for AI to call get_trading_regime tool
  if (tradingRegime) {
    if (useTOON) {
      // Compact TOON format (~80% fewer tokens)
      // Include warning to prevent redundant tool calls
      contextParts.push(
        `MKTREGIME (pre-loaded):${formatTradingRegimeTOON(tradingRegime)}`
      );
    } else {
      // Full verbose format for trade analysis
      contextParts.push(
        `\n=== TRADING REGIME (pre-loaded - DO NOT call get_trading_regime) ===`
      );
      contextParts.push(formatTradingRegimeForAI(tradingRegime));
      contextParts.push(`=== END TRADING REGIME ===\n`);
    }
  } else if (startupRegime) {
    // Fallback to simple regime if detailed not available
    contextParts.push(`\n=== MARKET REGIME ===`);
    contextParts.push(formatRegimeForAI(startupRegime));
    contextParts.push(`=== END REGIME ===\n`);
  } else {
    contextParts.push(`Market Regime: ${regime} (SPY $${spyPrice.toFixed(2)})`);
  }

  // Add economic calendar
  const calendar = getCalendarContext();
  if (calendar.warnings.length > 0) {
    contextParts.push(`\n=== ECONOMIC CALENDAR WARNINGS ===`);
    for (const warning of calendar.warnings) {
      contextParts.push(warning);
    }
    contextParts.push(`=== END CALENDAR ===\n`);
  }

  // Get trade history if database is configured
  if (isConfigured()) {
    try {
      const trades = await getAllTrades();
      if (trades.length > 0) {
        const summary = await getPerformanceSummary();
        contextParts.push(
          `Portfolio: ${summary.totalTrades} trades, ` +
            `${summary.winRate.toFixed(0)}% win rate, ` +
            `$${summary.totalPnl.toFixed(0)} P&L`
        );

        // Group trades by ticker for TOON context
        const byTicker = new Map<string, Trade[]>();
        for (const trade of trades) {
          const existing = byTicker.get(trade.ticker) ?? [];
          existing.push(trade);
          byTicker.set(trade.ticker, existing);
        }

        // Build patterns map
        const patterns = new Map<string, string>();
        for (const [ticker, tickerTrades] of byTicker) {
          const detected = detectPatterns(tickerTrades);
          if (detected.length > 0) {
            patterns.set(ticker, detected[0]);
          }
        }

        const toonContext = buildTOONContext(
          accountSize,
          byTicker,
          regime,
          patterns
        );
        contextParts.push(`History (TOON): ${toonToString(toonContext)}`);
      } else {
        contextParts.push('No trade history yet');
      }
    } catch {
      contextParts.push('Trade history unavailable');
    }
  } else {
    contextParts.push('Database not configured - no trade history');
  }

  return contextParts.join('\n');
}

// ============================================================================
// QUESTION CLASSIFICATION (Smart Context Loading)
// ============================================================================

export type QuestionType =
  | 'price_check' // Simple price/quote questions
  | 'trade_analysis' // Full trade analysis with spreads
  | 'research' // News/why questions requiring web search
  | 'scan' // Market scanning requests
  | 'general'; // General conversation

interface QuestionClassification {
  type: QuestionType;
  needsOptions: boolean;
  needsPFV: boolean;
  needsSpread: boolean;
  needsNews: boolean;
  needsWebSearch: boolean;
  needsCalendar: boolean;
  /** Skip ticker data fetch - use conversation context instead */
  skipTickerFetch: boolean;
  /** Use minimal tool set to save tokens */
  minimalTools: boolean;
}

/**
 * Classify user question to determine what context to load
 * This allows us to skip unnecessary API calls and reduce tokens
 */
export function classifyQuestion(message: string): QuestionClassification {
  const lower = message.toLowerCase();

  // Scan requests - need full data
  if (/\b(scan|find|search|opportunities|setups|grade a|best)\b/.test(lower)) {
    return {
      type: 'scan',
      needsOptions: true,
      needsPFV: true,
      needsSpread: true,
      needsNews: false,
      needsWebSearch: false,
      needsCalendar: true,
      skipTickerFetch: false,
      minimalTools: false,
    };
  }

  // Research/news questions - need web search, NOT fresh ticker data
  // The AI already has ticker context from previous turns
  // Matches: "why is", "why did", "why has", "what news", "what happened", etc.
  if (
    /\b(why (is|did|has|does|was|are)|what.+news|research|look up|what.+(happening|happened)|what caused)\b/.test(
      lower
    )
  ) {
    return {
      type: 'research',
      needsOptions: false,
      needsPFV: false,
      needsSpread: false,
      needsNews: true,
      needsWebSearch: true,
      needsCalendar: false,
      skipTickerFetch: true, // Don't re-fetch - use conversation context
      minimalTools: true, // Only need web_search tool
    };
  }

  // Simple price check - minimal data needed
  if (
    /\b(price|quote|how much|what.+at|trading at)\b/.test(lower) &&
    !/\b(should|buy|sell|trade|analyze|entry)\b/.test(lower)
  ) {
    return {
      type: 'price_check',
      needsOptions: false,
      needsPFV: false,
      needsSpread: false,
      needsNews: false,
      needsWebSearch: false,
      needsCalendar: false,
      skipTickerFetch: false,
      minimalTools: true, // Only need get_stock_data tool
    };
  }

  // Trade analysis - full context needed
  // Includes "how does X look" patterns which imply wanting analysis
  if (
    /\b(analyze|should|buy|sell|entry|trade|spread|cds|setup|look|looking|opportunity|opportunities)\b/.test(
      lower
    )
  ) {
    return {
      type: 'trade_analysis',
      needsOptions: true,
      needsPFV: true,
      needsSpread: true,
      needsNews: true,
      needsWebSearch: false,
      needsCalendar: true,
      skipTickerFetch: false,
      minimalTools: false,
    };
  }

  // Default: if a ticker is mentioned, treat as trade analysis
  // Check for uppercase 2-5 letter words that look like tickers
  const tickerPattern = /\b[A-Z]{2,5}\b/;
  if (tickerPattern.test(message)) {
    return {
      type: 'trade_analysis',
      needsOptions: true,
      needsPFV: true,
      needsSpread: true,
      needsNews: true,
      needsWebSearch: false,
      needsCalendar: true,
      skipTickerFetch: false,
      minimalTools: false,
    };
  }

  // Default: general question with minimal context
  return {
    type: 'general',
    needsOptions: false,
    needsPFV: false,
    needsSpread: false,
    needsNews: false,
    needsWebSearch: false,
    needsCalendar: true,
    skipTickerFetch: false,
    minimalTools: true, // General questions don't need most tools
  };
}

// ============================================================================
// SYSTEM PROMPT - Uses shared lib/ai-agent
// ============================================================================

/**
 * Build system prompt using shared Victor persona from lib/ai-agent
 * Adds CLI-specific context like TOON data parsing hints
 */
function buildSystemPrompt(accountSize: number, context: string): string {
  // Add CLI-specific data hints to context
  const cliContext = `## Data & Tools
The LIVE DATA section contains ALL available market data including fundamentals:
• TOON format includes: Price, RSI, ADX, MAs, IV, Support/Resistance, Spread, \
**Market Cap (MC), P/E (PE)**
• If data shows "-", acknowledge the gap - don't invent values
• READ THE TOON DATA CAREFULLY - P/E and Market Cap are at the END of each line

${context}`;

  // Use shared prompt builder from lib/ai-agent
  return buildVictorSystemPrompt({
    accountSize,
    context: cliContext,
    includeToonSpec: true,
  });
}

// ============================================================================
// TOOL DEFINITIONS - Uses shared lib/ai-agent
// ============================================================================

/**
 * Tools available to Victor for research and analysis
 * Using shared definitions from lib/ai-agent, converted to Ollama format
 */
// Full tool set for complex queries
const FULL_TOOLS: ToolDefinition[] = toOllamaTools(AGENT_TOOLS);
// Minimal tool set for simple queries (saves ~500 tokens)
const MINIMAL_TOOLS: ToolDefinition[] = toOllamaTools(BASIC_TOOLS);
// Trade analysis tools - no web_search or regime (both pre-loaded)
const TRADE_ANALYSIS_TOOLS: ToolDefinition[] = toOllamaTools(
  AGENT_TOOLS.filter(
    (t) => t.name !== 'web_search' && t.name !== 'get_trading_regime'
  )
);

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
  toolCall: ToolCall,
  showStatus: (msg: string) => void
): Promise<string> {
  const { name, arguments: args } = toolCall.function;

  switch (name) {
    case 'web_search': {
      const query = args.query as string;
      showStatus(`🌐 Searching: "${query}"`);
      const results = await searchWeb(query, 5);
      // Use TOON for compact encoding (~40% fewer tokens)
      return libEncodeSearchToTOON(
        results.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        }))
      );
    }

    case 'get_ticker_data': {
      const ticker = (args.ticker as string).toUpperCase();
      showStatus(`📊 Fetching ${ticker} data...`);
      try {
        // Use shared lib directly for type compatibility
        const data = await sharedFetchTickerData(ticker);
        if (!data) {
          return `Could not fetch data for ${ticker}`;
        }
        // Use shared lib's TOON encoder (~40% fewer tokens)
        return libEncodeTickerToTOON(data);
      } catch {
        return `Error fetching data for ${ticker}`;
      }
    }

    case 'get_financials_deep': {
      const ticker = (args.ticker as string).toUpperCase();
      showStatus(`📈 Fetching ${ticker} financials...`);
      const result = await handleGetFinancialsDeep({ ticker });
      if (!result.success) {
        return result.error ?? `Could not fetch financials for ${ticker}`;
      }
      return result.formatted ?? 'No financial data available';
    }

    case 'get_institutional_holdings': {
      const ticker = (args.ticker as string).toUpperCase();
      showStatus(`🏦 Fetching ${ticker} institutional holdings...`);
      const result = await handleGetInstitutionalHoldings({ ticker });
      if (!result.success) {
        return result.error ?? `Could not fetch holdings for ${ticker}`;
      }
      return result.formatted ?? 'No holdings data available';
    }

    case 'get_unusual_options_activity': {
      const ticker = args.ticker as string | undefined;
      showStatus(
        ticker
          ? `🔥 Fetching unusual options for ${ticker}...`
          : `🔥 Fetching unusual options activity...`
      );
      const result = await handleGetUnusualOptionsActivity({
        ticker,
        minGrade: args.minGrade as string | undefined,
        limit: args.limit as number | undefined,
      });
      if (!result.success) {
        return result.error ?? 'Could not fetch unusual options activity';
      }
      return result.formatted ?? 'No unusual options signals found';
    }

    case 'get_trading_regime': {
      const ticker = args.ticker as string | undefined;
      showStatus(
        ticker
          ? `🚦 Analyzing trading regime for ${ticker}...`
          : `🚦 Analyzing market trading regime...`
      );
      try {
        const analysis = await analyzeTradingRegime();
        // Use TOON format for compact encoding
        return `REGIME:${formatTradingRegimeTOON(analysis)}`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return `Error analyzing trading regime: ${msg}`;
      }
    }

    case 'get_iv_by_strike': {
      const ticker = (args.ticker as string).toUpperCase();
      const strike = args.strike as number;
      const targetDTE = (args.targetDTE as number) ?? 30;
      showStatus(`📊 Fetching IV for ${ticker} $${strike} strike...`);
      const result = await handleGetIVByStrike({ ticker, strike, targetDTE });
      if (!result.success) {
        return result.error ?? `Could not fetch IV for ${ticker}`;
      }
      return result.formatted ?? 'No IV data available';
    }

    case 'calculate_spread': {
      const ticker = (args.ticker as string).toUpperCase();
      const longStrike = args.longStrike as number;
      const shortStrike = args.shortStrike as number;
      const targetDTE = (args.targetDTE as number) ?? 30;
      showStatus(
        `📊 Calculating ${ticker} $${longStrike}/$${shortStrike} spread...`
      );
      const result = await handleCalculateSpread({
        ticker,
        longStrike,
        shortStrike,
        targetDTE,
      });
      if (!result.success) {
        return result.error ?? `Could not calculate spread for ${ticker}`;
      }
      return result.formatted ?? 'No spread data available';
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Format ticker data for AI context (exported for tool usage)
 */
export function formatTickerDataForAI(t: TickerData): string {
  let output = `\n=== ${t.ticker} DATA ===\n`;
  output += `Price: $${t.price.toFixed(2)} (${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%)\n`;
  output += `RSI: ${t.rsi?.toFixed(1) ?? 'N/A'}\n`;
  if (t.ma20) output += `MA20: $${t.ma20.toFixed(2)}\n`;
  if (t.ma50) output += `MA50: $${t.ma50.toFixed(2)}\n`;
  if (t.ma200)
    output += `MA200: $${t.ma200.toFixed(2)} (${t.aboveMA200 ? 'ABOVE' : 'BELOW'})\n`;
  if (t.marketCap) {
    const mcapStr =
      t.marketCap >= 1e12
        ? `$${(t.marketCap / 1e12).toFixed(1)}T`
        : `$${(t.marketCap / 1e9).toFixed(0)}B`;
    output += `Market Cap: ${mcapStr}\n`;
  }
  if (t.peRatio) output += `P/E: ${t.peRatio.toFixed(1)}\n`;
  if (t.iv) {
    output += `IV: ${t.iv.currentIV}% (${t.iv.ivLevel}) - ${t.iv.ivPercentile}th percentile\n`;
  }
  if (t.spread) {
    output +=
      `Spread: $${t.spread.longStrike}/$${t.spread.shortStrike}, ` +
      `Debit: $${t.spread.estimatedDebit.toFixed(2)}, ` +
      `Cushion: ${t.spread.cushion.toFixed(1)}%\n`;
  }
  if (t.analysis) {
    output += `Grade: ${t.analysis.grade.grade} (${t.analysis.grade.score}/100)\n`;
    output += `Risk: ${t.analysis.risk.score}/10 (${t.analysis.risk.level})\n`;
    output += `Recommendation: ${t.analysis.grade.recommendation}\n`;
  }
  if (t.earningsDays !== null && t.earningsDays !== undefined) {
    output += `Earnings: ${t.earningsDays > 0 ? `in ${t.earningsDays} days` : 'PASSED'}\n`;
  }
  if (t.news && t.news.length > 0) {
    output += `Recent News:\n`;
    for (const n of t.news.slice(0, 3)) {
      output += `  • ${n.title}\n`;
    }
  }
  // Include Psychological Fair Value context
  if (t.pfv) {
    const deviation = t.pfv.deviationPercent >= 0 ? '+' : '';
    output += `\n--- PSYCHOLOGICAL FAIR VALUE ---\n`;
    output += `Fair Value: $${t.pfv.fairValue.toFixed(2)} (${deviation}${t.pfv.deviationPercent.toFixed(1)}% vs current)\n`;
    output += `Bias: ${t.pfv.bias} | Confidence: ${t.pfv.confidence}\n`;
  }
  output += `=== END ${t.ticker} ===\n`;
  return output;
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/**
 * Extract tickers mentioned in a message
 */
function extractTickers(message: string): string[] {
  // Match uppercase words that look like tickers (1-5 letters)
  const matches = message.match(/\b[A-Z]{1,5}\b/g) ?? [];

  // Filter out common words that aren't tickers
  const commonWords = new Set([
    'I',
    'A',
    'THE',
    'AND',
    'OR',
    'BUT',
    'IS',
    'IT',
    'TO',
    'FOR',
    'IN',
    'ON',
    'AT',
    'BY',
    'UP',
    'IF',
    'SO',
    'NO',
    'YES',
    'OK',
    'CDS',
    'PCS',
    'ITM',
    'OTM',
    'ATM',
    'RSI',
    'MA',
    'DTE',
    'AI',
    'BUY',
    'SELL',
    'HOLD',
    'WAIT',
    'PASS',
    'NOT',
    'CAN',
    'DO',
    'HOW',
    'WHAT',
    'WHY',
    'WHEN',
    'WHO',
    'MY',
    'PM',
    'AM',
  ]);

  return matches.filter((t) => !commonWords.has(t) && t.length >= 2);
}

/**
 * Prepared context for AI generation
 */
interface PreparedContext {
  systemPrompt: string;
  userPrompt: string;
  tickersFetched: TickerData[];
  scanResults: ScanResult[];
  webSearchResults?: WebSearchResponse;
  /** Use minimal tool set to save tokens */
  useMinimalTools: boolean;
  /** Whether web search is needed for this query */
  needsWebSearch: boolean;
}

/**
 * Status callback type for UI updates
 */
type StatusCallback = (status: string) => void;

/**
 * Prepare context for AI generation (fetches data, builds prompts)
 * Uses question classification for smart context loading
 *
 * @param startupRegime - Pre-fetched market regime from startup (avoids re-fetch)
 * @param tradingRegime - Pre-fetched detailed trading regime (GO/CAUTION/NO_TRADE)
 */
async function prepareContext(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  accountSize: number,
  onStatus?: StatusCallback,
  startupRegime?: MarketRegimeData | null,
  tradingRegime?: TradingRegimeAnalysis | null
): Promise<PreparedContext> {
  // Classify the question to determine what context we need
  const classification = classifyQuestion(userMessage);

  // Check if user wants to scan for opportunities
  const wantsScan =
    classification.type === 'scan' ||
    (classification.type === 'general' &&
      /\b(scan|find|search|opportunities|setups|grade a|best)\b/.test(
        userMessage.toLowerCase()
      ));

  let scanResults: ScanResult[] = [];
  let scanContext = '';

  if (wantsScan && !extractTickers(userMessage).length) {
    const isQuickScan = userMessage.toLowerCase().includes('quick');

    onStatus?.(`Scanning ${isQuickScan ? '15' : '35'}+ tickers...`);

    try {
      scanResults = isQuickScan
        ? await quickScan((curr, total, ticker) => {
            onStatus?.(`Scanning ${ticker} (${curr}/${total})...`);
          })
        : await quickScan((curr, total, ticker) => {
            onStatus?.(`Scanning ${ticker} (${curr}/${total})...`);
          });

      if (scanResults.length > 0) {
        scanContext = `\n\n=== SCAN RESULTS ===\n`;
        scanContext += `Found ${scanResults.length} opportunities:\n\n`;

        for (const r of scanResults.slice(0, 8)) {
          scanContext += `${r.ticker} - Grade ${r.grade.grade} | Risk ${r.risk.score}/10\n`;
          scanContext += `  Price: $${r.price.toFixed(2)} | ${r.grade.recommendation}\n`;
          if (r.spread) {
            scanContext += `  Spread: ${r.spread.strikes} @ $${r.spread.debit.toFixed(2)} | ${r.spread.cushion.toFixed(1)}% cushion\n`;
          }
          scanContext += `  Reasons: ${r.reasons.slice(0, 3).join(', ')}\n\n`;
        }
        scanContext += `=== END SCAN ===\n`;
      }
    } catch {
      scanContext = '\n(Scan failed - please try again)\n';
    }
  }

  // Check if user needs web search based on classification
  let webSearchResults: WebSearchResponse | undefined;
  let webSearchContext = '';

  if (classification.needsWebSearch) {
    const searchCheck = needsWebSearch(userMessage);
    if (searchCheck.needed && searchCheck.query) {
      onStatus?.(`🌐 Searching web...`);
      try {
        webSearchResults = await searchWeb(searchCheck.query, 5);
        if (
          webSearchResults.results.length > 0 ||
          webSearchResults.instantAnswer
        ) {
          webSearchContext = formatSearchForAI(webSearchResults);
        }
      } catch {
        // Web search optional
      }
    }
  }

  // Extract any tickers mentioned
  const tickers = extractTickers(userMessage);
  const tickersFetched: TickerData[] = [];

  // Fetch data for mentioned tickers
  // Skip if classification says to use conversation context instead (e.g., research questions)
  let tickerContext = '';
  if (tickers.length > 0 && !classification.skipTickerFetch) {
    onStatus?.(`Fetching ${tickers.join(', ')}...`);

    // Skip options data for simple price checks (faster + fewer tokens)
    const fetchOptions = classification.needsOptions;
    const tickerDataPromises = tickers
      .slice(0, 3)
      .map((t) => fetchTickerData(t, fetchOptions));
    const tickerDataResults = await Promise.all(tickerDataPromises);

    const validData = tickerDataResults.filter(
      (d): d is TickerData => d !== null
    );
    tickersFetched.push(...validData);

    if (validData.length > 0) {
      // Use TOON encoding for compact context (~80% token reduction)
      const toonData: TickerDataInput[] = validData.map((d) => ({
        ticker: d.ticker,
        price: d.price,
        changePct: d.changePct,
        rsi: d.rsi,
        adx: d.adx,
        trendStrength: d.trendStrength,
        ma20: d.ma20,
        ma50: d.ma50,
        ma200: d.ma200,
        aboveMA200: d.aboveMA200,
        iv: d.iv?.currentIV,
        ivLevel: d.iv?.ivLevel,
        nearestSupport: d.supportResistance?.nearestSupport?.price,
        nearestResistance: d.supportResistance?.nearestResistance?.price,
        spreadLong: d.spread?.longStrike,
        spreadShort: d.spread?.shortStrike,
        spreadDebit: d.spread?.estimatedDebit,
        cushion: d.spread?.cushion,
        grade: d.analysis?.grade.grade,
        riskScore: d.analysis?.risk.score,
        earningsDays: d.earningsDays,
        marketCap: d.marketCap,
        peRatio: d.peRatio,
        // Analyst ratings
        analystBullishPct: d.analystRatings?.bullishPercent,
        analystStrongBuy: d.analystRatings?.strongBuy,
        analystBuy: d.analystRatings?.buy,
        analystHold: d.analystRatings?.hold,
        analystSell: d.analystRatings?.sell,
        // Ownership
        insidersPct: d.ownership?.insidersPercent,
        institutionsPct: d.ownership?.institutionsPercent,
        recentSalesM: d.ownership?.recentSalesM,
        // Target prices
        targetLow: d.targetPrices?.low,
        targetMean: d.targetPrices?.mean,
        targetHigh: d.targetPrices?.high,
        targetUpside: d.targetPrices?.upside,
        // Price performance
        perf5d: d.performance?.day5,
        perf1m: d.performance?.month1,
        perf3m: d.performance?.month3,
        perfYtd: d.performance?.ytd,
        // Earnings info (earningsDays already set above)
        earningsDate: d.earnings?.date,
        earningsStreak: d.earnings?.streak,
        earningsSurprise: d.earnings?.lastSurprise,
        // Sector context
        sectorName: d.sectorContext?.name,
        sectorAvgPE: d.sectorContext?.avgPE,
        sectorVsAvg: d.sectorContext?.vsAvg,
        // Historical volatility
        hv20: d.hv20,
        // NEW: High-value additions
        shortPct: d.shortInterest?.shortPct,
        shortRatio: d.shortInterest?.shortRatio,
        vsSPY: d.relativeStrength?.vsSPY,
        pcRatioOI: d.optionsFlow?.pcRatioOI,
      }));

      tickerContext = '\n\n=== TICKER DATA (TOON) ===\n';
      for (const td of toonData) {
        tickerContext += encodeTickerToTOON(td) + '\n';
      }

      // Add earnings warning if present (important enough to keep verbose)
      for (const d of validData) {
        if (d.earningsWarning && d.earningsDays !== undefined) {
          tickerContext += `⚠️ ${d.ticker} EARNINGS in ${d.earningsDays}d - AVOID\n`;
        }
      }

      // Add news if classification needs it (compact format)
      if (classification.needsNews) {
        for (const d of validData) {
          if (d.news && d.news.length > 0) {
            tickerContext += `\n${d.ticker} NEWS:\n`;
            for (const n of d.news.slice(0, 2)) {
              const title =
                n.title.length > 60 ? n.title.slice(0, 57) + '...' : n.title;
              tickerContext += `• ${title}\n`;
            }
          }
        }
      }

      // Add PFV context for trade analysis
      if (classification.type === 'trade_analysis') {
        for (const d of validData) {
          if (d.pfv) {
            const dev = d.pfv.deviationPercent >= 0 ? '+' : '';
            tickerContext += `\n${d.ticker} PFV: $${d.pfv.fairValue.toFixed(2)} `;
            tickerContext += `(${dev}${d.pfv.deviationPercent.toFixed(1)}%) `;
            tickerContext += `${d.pfv.bias} | ${d.pfv.confidence}\n`;
          }
        }
      }

      tickerContext += '=== END TICKER DATA ===';

      // AUTO-FETCH FINANCIALS for high P/E stocks (>50) - adds growth context
      // This saves Victor from needing to call get_financials_deep
      const highPEStocks = validData.filter((d) => d.peRatio && d.peRatio > 50);
      if (highPEStocks.length > 0 && classification.type === 'trade_analysis') {
        onStatus?.(`Fetching financials for high P/E stocks...`);
        for (const stock of highPEStocks.slice(0, 2)) {
          try {
            const financials = await handleGetFinancialsDeep({
              ticker: stock.ticker,
            });
            if (financials.success && financials.formatted) {
              tickerContext += `\n\n${financials.formatted}`;
            }
          } catch {
            // Financials fetch optional
          }
        }
      }

      // Add note that data is pre-loaded (prevents redundant tool calls)
      tickerContext += `\n\n⚡ DATA PRE-LOADED: ${validData.map((d) => d.ticker).join(', ')}`;
      tickerContext += ` - Do NOT call get_ticker_data for these tickers.`;

      // Get trade history for mentioned tickers (compact format)
      if (isConfigured() && classification.type === 'trade_analysis') {
        onStatus?.(`Checking trade history...`);
        for (const ticker of tickers.slice(0, 3)) {
          try {
            const trades = await getTradesByTicker(ticker);
            if (trades.length > 0) {
              const history = buildTickerHistory(ticker, trades);
              // Super compact: NVDA:5tr/67%WR/$142PnL
              tickerContext += `\n${ticker}:${history.totalTrades}tr/${history.winRate.toFixed(0)}%WR/$${history.totalPnl.toFixed(0)}PnL`;
              if (history.patterns.length > 0) {
                tickerContext += `|${history.patterns[0].slice(0, 30)}`;
              }
            }
          } catch {
            // History unavailable
          }
        }
      }
    }
  }

  onStatus?.(`Generating response...`);

  // Build context (pass startup regime to avoid re-fetch)
  // Always use TOON format for regime - verbose adds little value vs token cost
  const useTOON = true;
  const context = await buildContextForAI(
    accountSize,
    startupRegime,
    tradingRegime,
    useTOON
  );
  const systemPrompt = buildSystemPrompt(
    accountSize,
    context + tickerContext + scanContext + webSearchContext
  );

  // Conversation history: summarize older turns, keep last 4 full
  let conversationContext = '';
  if (conversationHistory.length > 4) {
    // Summarize older messages to save tokens
    const olderHistory = conversationHistory.slice(0, -4);
    const toonHistory: TOONConversationMessage[] = olderHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    conversationContext = summarizeConversation(toonHistory) + '\n\n';
  }

  // Keep last 4 messages in full (most relevant context)
  const recentHistory = conversationHistory.slice(-4);
  const recentContext = recentHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  // Build the user prompt with summarized + recent history
  const userPrompt =
    conversationContext +
    recentContext +
    (recentContext ? '\n\n' : '') +
    `user: ${userMessage}`;

  return {
    systemPrompt,
    userPrompt,
    tickersFetched,
    scanResults,
    webSearchResults,
    useMinimalTools: classification.minimalTools,
    needsWebSearch: classification.needsWebSearch,
  };
}

// ============================================================================
// MAIN CHAT LOOP
// ============================================================================

export async function startChat(options: ChatOptions): Promise<void> {
  const accountSize = options.accountSize ?? DEFAULT_ACCOUNT_SIZE;

  // Get market regime FIRST (populates cache), then trading regime (uses cache)
  // Sequential to avoid duplicate VIX/SPY/sector fetches
  const regime = await fetchMarketRegime().catch(() => null);
  const tradingRegimeAnalysis = await analyzeTradingRegime().catch(() => null);

  console.log();
  console.log(chalk.bold.cyan('  📊 YOUR ANALYST'));
  console.log(
    chalk.gray(
      '  ════════════════════════════════════════════════════════════════════'
    )
  );
  console.log();

  // Check market status
  const marketStatus = getMarketStatus();

  // Show header with market regime
  let headerInfo = `Fund Size: $${accountSize.toLocaleString()} | Strategy: Deep ITM CDS`;

  // Add market status badge
  const statusBadge = marketStatus.isOpen
    ? chalk.green('🟢 OPEN')
    : marketStatus.status === 'PRE_MARKET'
      ? chalk.yellow('🌅 PRE-MKT')
      : marketStatus.status === 'AFTER_HOURS'
        ? chalk.yellow('🌙 AH')
        : chalk.red('🔴 CLOSED');
  headerInfo += ` | ${statusBadge}`;

  console.log(chalk.gray(`  ${headerInfo}`));

  // Show market regime badge
  if (regime) {
    const regimeBadge = getRegimeBadge(regime);
    const regimeColor =
      regime.regime === 'RISK_ON'
        ? chalk.green
        : regime.regime === 'RISK_OFF'
          ? chalk.red
          : regime.regime === 'HIGH_VOL'
            ? chalk.yellow
            : chalk.white;
    console.log(chalk.gray('  ') + regimeColor(regimeBadge));
  }

  console.log(chalk.gray("  Type 'quit' to end session"));
  console.log();

  // Show calendar warnings if any
  const calendarCtx = getCalendarContext();
  if (calendarCtx.warnings.length > 0) {
    console.log(
      chalk.dim(
        '  ┌─ Market Calendar ───────────────────────────────────────────────'
      )
    );
    for (const warning of calendarCtx.warnings) {
      console.log(chalk.dim('  │ ') + chalk.yellow(warning));
    }
    console.log(
      chalk.dim(
        '  └───────────────────────────────────────────────────────────────────'
      )
    );
    console.log();
  }

  // Show market regime recommendation if notable
  if (
    regime &&
    (regime.regime === 'HIGH_VOL' || regime.regime === 'RISK_OFF')
  ) {
    console.log(
      chalk.dim(
        '  ┌─ Market Regime Warning ────────────────────────────────────────'
      )
    );
    console.log(
      chalk.dim('  │ ') +
        chalk.yellow(`${regime.regime}: ${regime.tradingRecommendation}`)
    );
    console.log(
      chalk.dim(
        '  └───────────────────────────────────────────────────────────────────'
      )
    );
    console.log();
  }

  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  // Validate AI
  const aiValidation = await validateAIRequirement(options.aiMode);
  if (!aiValidation.available) {
    console.log(chalk.red(`  ✗ ${aiValidation.error}`));
    if (aiValidation.suggestion) {
      console.log(chalk.yellow(`\n  ${aiValidation.suggestion}`));
    }
    process.exit(1);
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const conversationHistory: ConversationMessage[] = [];

  // Initial greeting - Victor Chen checking in
  console.log(
    chalk.cyan('  Victor: ') +
      "Morning. Victor Chen here. Markets are open and I've"
  );
  console.log(
    chalk.cyan('          ') +
      'been watching the tape. Give me a ticker to analyze, ask me'
  );
  console.log(
    chalk.cyan('          ') +
      "to scan for setups, or let's review what we're holding."
  );
  console.log(chalk.cyan('          ') + "What's on your mind?");
  console.log();

  const askQuestion = (): void => {
    rl.question(chalk.green('  You: '), async (input) => {
      const userInput = input.trim();

      // Check for exit commands
      if (
        !userInput ||
        ['quit', 'exit', 'bye', 'q'].includes(userInput.toLowerCase())
      ) {
        console.log();
        console.log(
          chalk.cyan('  Victor: ') +
            "Understood. I'll keep my eyes on the screens. In 45 years,"
        );
        console.log(
          chalk.cyan('          ') +
            "I've learned patience wins. Come back when you're ready to"
        );
        console.log(chalk.cyan('          ') + 'make some money.');
        console.log();
        rl.close();
        return;
      }

      // Add user message to history
      conversationHistory.push({ role: 'user', content: userInput });

      try {
        // Status update callback
        const updateStatus = (status: string) => {
          process.stdout.write(`\r${' '.repeat(60)}\r`);
          process.stdout.write(chalk.dim(`  ⏳ ${status}`));
        };

        updateStatus('Processing...');

        // Prepare context (fetch tickers, build prompts)
        // Pass startup regime + trading regime to avoid redundant fetches
        const prepared = await prepareContext(
          userInput,
          conversationHistory.slice(0, -1),
          accountSize,
          updateStatus,
          regime,
          tradingRegimeAnalysis
        );

        // Clear status line
        process.stdout.write(`\r${' '.repeat(60)}\r`);

        // Show scan results if any
        if (prepared.scanResults.length > 0) {
          console.log();
          console.log(
            chalk.dim(
              '  ┌─ Scan Results ─────────────────────────────────────────────────'
            )
          );
          console.log(
            chalk.dim(`  │ `) +
              chalk.white(`Found ${prepared.scanResults.length} opportunities`)
          );

          for (const r of prepared.scanResults.slice(0, 5)) {
            const gradeColor = r.grade.grade.startsWith('A')
              ? chalk.green
              : r.grade.grade.startsWith('B')
                ? chalk.yellow
                : chalk.red;
            const riskColor =
              r.risk.score <= 4
                ? chalk.green
                : r.risk.score <= 6
                  ? chalk.yellow
                  : chalk.red;

            console.log(
              chalk.dim(`  │ `) +
                chalk.cyan(r.ticker) +
                ` $${r.price.toFixed(0)} ` +
                gradeColor(`Grade ${r.grade.grade}`) +
                chalk.dim(' · ') +
                riskColor(`Risk ${r.risk.score}/10`)
            );

            if (r.spread) {
              console.log(
                chalk.dim(`  │   `) +
                  chalk.dim(
                    `${r.spread.strikes} · $${r.spread.debit.toFixed(2)} · ${r.spread.cushion.toFixed(0)}% cushion`
                  )
              );
            }
          }

          if (prepared.scanResults.length > 5) {
            console.log(
              chalk.dim(`  │   ...and ${prepared.scanResults.length - 5} more`)
            );
          }
          console.log(
            chalk.dim(
              '  └───────────────────────────────────────────────────────────────────'
            )
          );
        }

        // Show web search results if any
        if (
          prepared.webSearchResults?.results?.length ||
          prepared.webSearchResults?.instantAnswer
        ) {
          console.log();
          console.log(
            chalk.dim(
              '  ┌─ 🌐 Web Search ───────────────────────────────────────────────'
            )
          );
          if (prepared.webSearchResults.instantAnswer) {
            const summary = prepared.webSearchResults.instantAnswer.substring(
              0,
              120
            );
            console.log(
              chalk.dim(`  │ `) +
                chalk.white(
                  summary +
                    (prepared.webSearchResults.instantAnswer.length > 120
                      ? '...'
                      : '')
                )
            );
          }
          for (const r of prepared.webSearchResults.results.slice(0, 2)) {
            const title =
              r.title.length > 55 ? r.title.substring(0, 52) + '...' : r.title;
            console.log(chalk.dim(`  │ • `) + chalk.cyan(title));
          }
          console.log(
            chalk.dim(
              '  └───────────────────────────────────────────────────────────────'
            )
          );
        }

        // Show tool calls if any tickers were fetched
        if (prepared.tickersFetched.length > 0) {
          console.log();

          // Show data staleness warning if applicable
          const staleData = prepared.tickersFetched.find(
            (t) => t.dataQuality?.isStale
          );
          if (staleData?.dataQuality?.warning) {
            console.log(chalk.yellow(`  ${staleData.dataQuality.warning}`));
          }

          console.log(
            chalk.dim(
              '  ┌─ Yahoo Finance ─────────────────────────────────────────────'
            )
          );
          for (const t of prepared.tickersFetched) {
            const changeStr = `${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(1)}%`;
            const rsiStr = t.rsi !== undefined ? `RSI ${t.rsi.toFixed(0)}` : '';
            const maStr =
              t.aboveMA200 !== undefined
                ? t.aboveMA200
                  ? chalk.green('↑MA200')
                  : chalk.red('↓MA200')
                : '';
            // Add trend strength indicator
            const trendStr = t.trendStrength
              ? t.trendStrength === 'STRONG'
                ? chalk.green(`📈${t.adx?.toFixed(0)}`)
                : t.trendStrength === 'MODERATE'
                  ? chalk.yellow(`→${t.adx?.toFixed(0)}`)
                  : chalk.dim(`↔${t.adx?.toFixed(0)}`)
              : '';
            console.log(
              chalk.dim(`  │ `) +
                chalk.white(t.ticker) +
                chalk.dim(` $${t.price.toFixed(2)} ${changeStr} ${rsiStr} `) +
                maStr +
                ' ' +
                trendStr
            );

            // Show MA levels
            if (t.ma20 || t.ma50 || t.ma200) {
              const maLevels = [];
              if (t.ma20) maLevels.push(`MA20 $${t.ma20.toFixed(0)}`);
              if (t.ma50) maLevels.push(`MA50 $${t.ma50.toFixed(0)}`);
              if (t.ma200) maLevels.push(`MA200 $${t.ma200.toFixed(0)}`);
              console.log(chalk.dim(`  │   ${maLevels.join(' · ')}`));
            }

            // Show fundamentals (compact)
            if (t.marketCap || t.peRatio) {
              const fundParts = [];
              if (t.marketCap) {
                const mcapStr =
                  t.marketCap >= 1e12
                    ? `${(t.marketCap / 1e12).toFixed(1)}T`
                    : t.marketCap >= 1e9
                      ? `${(t.marketCap / 1e9).toFixed(0)}B`
                      : `${(t.marketCap / 1e6).toFixed(0)}M`;
                fundParts.push(`MCap $${mcapStr}`);
              }
              if (t.peRatio !== undefined)
                fundParts.push(`P/E ${t.peRatio.toFixed(1)}`);
              if (t.beta !== undefined) fundParts.push(`β${t.beta.toFixed(1)}`);
              // Show sector vs avg P/E
              if (t.sectorContext?.vsAvg !== undefined) {
                const sectorStr =
                  t.sectorContext.vsAvg > 0
                    ? chalk.red(`+${t.sectorContext.vsAvg}% vs sector`)
                    : chalk.green(`${t.sectorContext.vsAvg}% vs sector`);
                fundParts.push(sectorStr);
              }
              if (fundParts.length > 0) {
                console.log(chalk.dim(`  │   ${fundParts.join(' · ')}`));
              }
            }

            // Show target prices and performance
            if (t.targetPrices) {
              const upsideColor =
                t.targetPrices.upside > 20
                  ? chalk.green
                  : t.targetPrices.upside > 0
                    ? chalk.yellow
                    : chalk.red;
              console.log(
                chalk.dim(`  │   `) +
                  chalk.cyan(
                    `🎯 Target: $${t.targetPrices.low.toFixed(0)}-$${t.targetPrices.mean.toFixed(0)}-$${t.targetPrices.high.toFixed(0)}`
                  ) +
                  chalk.dim(` (`) +
                  upsideColor(
                    `${t.targetPrices.upside > 0 ? '+' : ''}${t.targetPrices.upside.toFixed(0)}%`
                  ) +
                  chalk.dim(`)`)
              );
            }

            // Show price performance
            if (t.performance) {
              const perfParts = [];
              const colorPerf = (val: number) =>
                val > 0 ? chalk.green(`+${val}%`) : chalk.red(`${val}%`);
              perfParts.push(`5d: ${colorPerf(t.performance.day5)}`);
              perfParts.push(`1m: ${colorPerf(t.performance.month1)}`);
              perfParts.push(`YTD: ${colorPerf(t.performance.ytd)}`);
              console.log(
                chalk.dim(`  │   📊 Perf: `) + perfParts.join(chalk.dim(' · '))
              );
            }

            // Show analyst ratings
            if (t.analystRatings) {
              const bullish = t.analystRatings.bullishPercent;
              const bullishColor =
                bullish >= 80
                  ? chalk.green
                  : bullish >= 60
                    ? chalk.yellow
                    : chalk.red;
              console.log(
                chalk.dim(`  │   `) +
                  bullishColor(`👥 ${bullish}% Bullish`) +
                  chalk.dim(
                    ` (${t.analystRatings.strongBuy}SB ${t.analystRatings.buy}B ${t.analystRatings.hold}H ${t.analystRatings.sell}S)`
                  )
              );
            }

            // Show earnings info with beat/miss history
            if (
              t.earnings?.daysUntil !== undefined &&
              t.earnings.daysUntil > 0
            ) {
              const earnParts = [];

              // Days until earnings
              if (t.earningsWarning) {
                earnParts.push(
                  chalk.red(`⚠️ ${t.earnings.daysUntil}d - AVOID`)
                );
              } else if (t.earnings.daysUntil <= 30) {
                earnParts.push(
                  chalk.yellow(
                    `${t.earnings.date ?? t.earnings.daysUntil + 'd'}`
                  )
                );
              } else {
                earnParts.push(
                  chalk.green(
                    `${t.earnings.date ?? t.earnings.daysUntil + 'd'} (safe)`
                  )
                );
              }

              // Beat/miss streak
              if (t.earnings.streak !== undefined && t.earnings.streak !== 0) {
                const streakStr =
                  t.earnings.streak > 0
                    ? chalk.green(`${t.earnings.streak} beats`)
                    : chalk.red(`${Math.abs(t.earnings.streak)} misses`);
                earnParts.push(streakStr);
              }

              // Last surprise
              if (t.earnings.lastSurprise !== undefined) {
                const surpriseColor =
                  t.earnings.lastSurprise > 0 ? chalk.green : chalk.red;
                earnParts.push(
                  surpriseColor(
                    `${t.earnings.lastSurprise > 0 ? '+' : ''}${t.earnings.lastSurprise}% last`
                  )
                );
              }

              console.log(
                chalk.dim(`  │   📅 Earnings: `) +
                  earnParts.join(chalk.dim(' · '))
              );
            } else if (
              t.earningsDays !== null &&
              t.earningsDays !== undefined &&
              t.earningsDays > 0
            ) {
              // Fallback to old format
              if (t.earningsWarning) {
                console.log(
                  chalk.dim(`  │   `) +
                    chalk.red(
                      `⚠️ EARNINGS ${t.earningsDays}d - AVOID (within 14d)`
                    )
                );
              } else if (t.earningsDays <= 30) {
                console.log(
                  chalk.dim(`  │   `) +
                    chalk.yellow(`📅 Earnings: ${t.earningsDays} days`)
                );
              } else {
                console.log(
                  chalk.dim(`  │   `) +
                    chalk.green(`📅 Earnings: ${t.earningsDays}d (safe)`)
                );
              }
            } else {
              console.log(chalk.dim(`  │   📅 Earnings: Not available`));
            }

            // Show IV vs HV analysis
            if (t.iv || t.hv20) {
              const parts = [];

              // IV part
              if (t.iv) {
                const ivColor =
                  t.iv.ivLevel === 'LOW'
                    ? chalk.green
                    : t.iv.ivLevel === 'NORMAL'
                      ? chalk.white
                      : t.iv.ivLevel === 'ELEVATED'
                        ? chalk.yellow
                        : chalk.red;
                parts.push(ivColor(`IV: ${t.iv.currentIV}%`));
              }

              // HV part
              if (t.hv20) {
                parts.push(chalk.dim(`HV20: ${t.hv20.toFixed(1)}%`));
              }

              // Premium comparison (IV vs HV)
              if (t.iv && t.hv20) {
                const ratio = t.iv.currentIV / t.hv20;
                const premium =
                  ratio > 1.15 ? 'expensive' : ratio < 0.85 ? 'cheap' : 'fair';
                const premiumColor =
                  premium === 'cheap'
                    ? chalk.green
                    : premium === 'fair'
                      ? chalk.white
                      : chalk.red;
                parts.push(premiumColor(`Options ${premium}`));
              } else if (t.iv) {
                parts.push(chalk.dim(`${t.iv.ivPercentile}th pctl`));
              }

              console.log(
                chalk.dim(`  │   📈 `) + parts.join(chalk.dim(' · '))
              );
            }

            // Show short interest, relative strength, options flow
            const extraParts: string[] = [];

            // Short interest
            if (t.shortInterest && t.shortInterest.shortPct > 0) {
              const shortColor =
                t.shortInterest.shortPct > 10
                  ? chalk.yellow
                  : t.shortInterest.shortPct > 20
                    ? chalk.red
                    : chalk.dim;
              extraParts.push(
                shortColor(
                  `Short ${t.shortInterest.shortPct}% (${t.shortInterest.shortRatio}d)`
                )
              );
            }

            // Relative strength
            if (t.relativeStrength) {
              const rsColor =
                t.relativeStrength.vsSPY > 5
                  ? chalk.green
                  : t.relativeStrength.vsSPY < -5
                    ? chalk.red
                    : chalk.white;
              extraParts.push(
                rsColor(
                  `vs SPY ${t.relativeStrength.vsSPY > 0 ? '+' : ''}${t.relativeStrength.vsSPY}%`
                )
              );
            }

            // Options flow (put/call ratio)
            if (t.optionsFlow) {
              const flowColor =
                t.optionsFlow.pcRatioOI < 0.7
                  ? chalk.green
                  : t.optionsFlow.pcRatioOI > 1.0
                    ? chalk.red
                    : chalk.white;
              const sentiment =
                t.optionsFlow.pcRatioOI < 0.7
                  ? 'bullish'
                  : t.optionsFlow.pcRatioOI > 1.0
                    ? 'bearish'
                    : 'neutral';
              extraParts.push(
                flowColor(`P/C ${t.optionsFlow.pcRatioOI} (${sentiment})`)
              );
            }

            if (extraParts.length > 0) {
              console.log(
                chalk.dim(`  │   🔍 `) + extraParts.join(chalk.dim(' · '))
              );
            }

            // Show support/resistance
            if (t.supportResistance) {
              const parts = [];
              if (t.supportResistance.nearestSupport) {
                parts.push(
                  chalk.green(
                    `S: $${t.supportResistance.nearestSupport.price.toFixed(0)}`
                  )
                );
              }
              if (t.supportResistance.nearestResistance) {
                parts.push(
                  chalk.red(
                    `R: $${t.supportResistance.nearestResistance.price.toFixed(0)}`
                  )
                );
              }
              if (parts.length > 0) {
                console.log(chalk.dim(`  │   `) + parts.join(chalk.dim(' · ')));
              }
            }

            // Show options spread if available
            if (t.spread) {
              const debitDollars = (t.spread.estimatedDebit * 100).toFixed(0);
              const maxProfitDollars = (t.spread.maxProfit * 100).toFixed(0);
              const rrRatio = (
                t.spread.maxProfit / t.spread.estimatedDebit
              ).toFixed(1);
              const popStr = t.spread.pop ? `${t.spread.pop}% PoP` : '';
              console.log(
                chalk.dim(`  │   `) +
                  chalk.cyan(
                    `📈 $${t.spread.longStrike}/$${t.spread.shortStrike} · $${debitDollars} debit · ${t.spread.cushion.toFixed(1)}% cushion`
                  )
              );
              console.log(
                chalk.dim(`  │   `) +
                  chalk.blue(
                    `💰 R/R: $${maxProfitDollars}/$${debitDollars} (1:${rrRatio}) · ${t.spread.returnOnRisk.toFixed(1)}% return`
                  ) +
                  (popStr ? chalk.dim(` · `) + chalk.green(popStr) : '')
              );

              // Only show alternatives if there's a specific reason (e.g., budget constraint)
              if (t.spreadReason) {
                console.log(
                  chalk.dim(`  │   `) + chalk.yellow(`⚠️ ${t.spreadReason}`)
                );
                if (t.spreadAlternatives && t.spreadAlternatives.length > 0) {
                  console.log(chalk.dim(`  │   `) + chalk.dim(`Alternatives:`));
                  for (const alt of t.spreadAlternatives.slice(0, 2)) {
                    const altDebit = (alt.estimatedDebit * 100).toFixed(0);
                    console.log(
                      chalk.dim(
                        `  │      • $${alt.longStrike}/$${alt.shortStrike} ($${alt.spreadWidth}w) · $${altDebit} · ${alt.cushion.toFixed(1)}% cushion`
                      )
                    );
                  }
                }
              }

              // Show trade grade if analysis available
              if (t.analysis) {
                const gradeColor = t.analysis.grade.grade.startsWith('A')
                  ? chalk.green
                  : t.analysis.grade.grade.startsWith('B')
                    ? chalk.yellow
                    : t.analysis.grade.grade.startsWith('C')
                      ? chalk.hex('#FFA500')
                      : chalk.red;
                const riskColor =
                  t.analysis.risk.level === 'LOW'
                    ? chalk.green
                    : t.analysis.risk.level === 'MODERATE'
                      ? chalk.yellow
                      : chalk.red;
                console.log(
                  chalk.dim(`  │   `) +
                    gradeColor(`Grade: ${t.analysis.grade.grade}`) +
                    chalk.dim(` · `) +
                    riskColor(`Risk: ${t.analysis.risk.score}/10`) +
                    chalk.dim(` · ${t.analysis.grade.recommendation}`)
                );
              }
            }

            // Show recent news headlines
            if (t.news && t.news.length > 0) {
              console.log(
                chalk.dim(`  │   `) + chalk.magenta(`📰 Recent news:`)
              );
              for (const n of t.news.slice(0, 2)) {
                const title =
                  n.title.length > 50
                    ? n.title.substring(0, 47) + '...'
                    : n.title;
                console.log(chalk.dim(`  │      • ${title}`));
              }
            }

            // Show Psychological Fair Value
            if (t.pfv) {
              const biasColor =
                t.pfv.bias === 'BULLISH'
                  ? chalk.green
                  : t.pfv.bias === 'BEARISH'
                    ? chalk.red
                    : chalk.yellow;
              const confColor =
                t.pfv.confidence === 'HIGH'
                  ? chalk.green
                  : t.pfv.confidence === 'MEDIUM'
                    ? chalk.yellow
                    : chalk.dim;
              const deviationStr =
                t.pfv.deviationPercent >= 0
                  ? `+${t.pfv.deviationPercent.toFixed(1)}%`
                  : `${t.pfv.deviationPercent.toFixed(1)}%`;

              console.log(
                chalk.dim(`  │   `) +
                  chalk.magenta(`🧠 PFV: $${t.pfv.fairValue.toFixed(2)}`) +
                  chalk.dim(` (${deviationStr}) `) +
                  biasColor(t.pfv.bias) +
                  chalk.dim(' · ') +
                  confColor(t.pfv.confidence)
              );

              // Show key magnetic levels if available (full PFV type only)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pfvFull = t.pfv as any;
              if (pfvFull.magneticLevels) {
                const supports = pfvFull.magneticLevels
                  .filter((l: { distance?: number }) => (l.distance ?? 0) < 0)
                  .slice(0, 2);
                const resistances = pfvFull.magneticLevels
                  .filter((l: { distance?: number }) => (l.distance ?? 0) > 0)
                  .slice(0, 2);

                if (supports.length > 0 || resistances.length > 0) {
                  const levelParts: string[] = [];
                  if (supports.length > 0) {
                    levelParts.push(
                      chalk.green(
                        `S: $${supports[0].price.toFixed(0)} (${supports[0].type.replace('_', ' ')})`
                      )
                    );
                  }
                  if (resistances.length > 0) {
                    levelParts.push(
                      chalk.red(
                        `R: $${resistances[0].price.toFixed(0)} (${resistances[0].type.replace('_', ' ')})`
                      )
                    );
                  }
                  console.log(
                    chalk.dim(`  │      `) + levelParts.join(chalk.dim(' · '))
                  );
                }

                // Show mean reversion signal if present
                if (pfvFull.meanReversionSignal?.signal) {
                  const sigColor =
                    pfvFull.meanReversionSignal.direction === 'LONG'
                      ? chalk.green
                      : chalk.red;
                  console.log(
                    chalk.dim(`  │      `) +
                      sigColor(
                        `⚡ ${pfvFull.meanReversionSignal.direction} signal`
                      ) +
                      chalk.dim(
                        ` (${pfvFull.meanReversionSignal.strength}% strength)`
                      )
                  );
                }
              }
            }
          }
          console.log(
            chalk.dim(
              '  └───────────────────────────────────────────────────────────────'
            )
          );
        }

        // Run agent loop with tool calling
        console.log();

        // Build messages for agent
        const agentMessages: AgentMessage[] = [
          { role: 'system', content: prepared.systemPrompt },
          ...conversationHistory.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: prepared.userPrompt },
        ];

        let totalPromptTokens = 0; // Cumulative (for API cost tracking)
        let maxPromptTokens = 0; // Max per iteration (actual context size)
        let totalCompletionTokens = 0;
        let totalDuration = 0;
        let totalToolDuration = 0;
        let toolCallCount = 0;
        let finalContent = '';
        // finalThinking tracked for potential debugging/logging
        const _finalThinking = '';
        let modelName = '';

        // Status display function
        const showStatus = (msg: string) => {
          process.stdout.write(
            `\r  ${chalk.yellow('⏳')} ${chalk.dim(msg)}`.padEnd(70) + '\r'
          );
        };

        // Agent loop - continues until no tool calls
        // All iterations use non-streaming with tools (thinking disabled for tool compatibility)
        let iteration = 0;
        const maxIterations = 3; // Reduced from 5 - prevent over-researching

        while (iteration < maxIterations) {
          iteration++;

          // On final iteration, disable tools to force synthesis
          const isLastIteration = iteration === maxIterations;

          // Select tools based on query classification:
          // - minimal queries: MINIMAL_TOOLS (just web_search, get_ticker_data)
          // - trade analysis (no research): TRADE_ANALYSIS_TOOLS (no web_search)
          // - research queries: FULL_TOOLS (includes web_search)
          const getToolsForQuery = () => {
            if (isLastIteration) return undefined; // Force synthesis
            if (prepared.useMinimalTools) return MINIMAL_TOOLS;
            if (!prepared.needsWebSearch) return TRADE_ANALYSIS_TOOLS;
            return FULL_TOOLS;
          };

          let currentThinking = '';
          let currentContent = '';
          const currentToolCalls: ToolCall[] = [];

          // FIRST ITERATION: Non-streaming with tools (no thinking - it blocks tool calls)
          if (iteration === 1) {
            showStatus('Victor is analyzing...');

            // Use non-streaming call WITH tools
            const response: AgentResponse = await chatWithTools(
              { mode: options.aiMode, model: options.aiModel },
              agentMessages,
              getToolsForQuery(),
              false // Disable thinking (conflicts with tool calling in DeepSeek)
            );

            // Clear status
            process.stdout.write('\r'.padEnd(70) + '\r');

            // Display content with proper word wrapping
            const cleanedContent = cleanToolTokens(response.content);
            const coloredPrefix = chalk.cyan('  Victor: ');
            const plainPrefix = '  Victor: ';
            const indent = '          ';
            const lines = wrapText(cleanedContent, 65, plainPrefix, indent);
            for (let i = 0; i < lines.length; i++) {
              if (i === 0) {
                // First line: replace plain prefix with chalk-colored one
                console.log(lines[i].replace(plainPrefix, coloredPrefix));
              } else {
                console.log(formatWithStyles(lines[i]));
              }
            }

            currentThinking = response.thinking ?? '';
            currentContent = cleanToolTokens(response.content); // Clean raw tool tokens

            // IMPORTANT: On last iteration, ignore any tool calls
            // (model may still output them from context, but we force synthesis)
            if (response.toolCalls && !isLastIteration) {
              currentToolCalls.push(...response.toolCalls);
            }

            // Store token stats
            totalPromptTokens += response.promptTokens;
            maxPromptTokens = Math.max(maxPromptTokens, response.promptTokens);
            totalCompletionTokens += response.completionTokens;
            totalDuration += response.duration;
            modelName = response.model;
          } else {
            // SUBSEQUENT ITERATIONS: Use streaming on last iteration for
            // better UX
            if (isLastIteration && options.stream) {
              // Stream final synthesis
              const streamResult = await streamResponse(
                { mode: options.aiMode, model: options.aiModel },
                agentMessages,
                undefined, // No tools
                false // No thinking
              );

              currentContent = streamResult.content;
              totalPromptTokens += streamResult.promptTokens;
              maxPromptTokens = Math.max(
                maxPromptTokens,
                streamResult.promptTokens
              );
              totalCompletionTokens += streamResult.completionTokens;
              totalDuration += streamResult.duration;
              modelName = streamResult.model;
            } else {
              // Non-streaming for tool iterations
              showStatus(
                isLastIteration
                  ? 'Victor is synthesizing...'
                  : 'Processing tool results...'
              );

              const response: AgentResponse = await chatWithTools(
                { mode: options.aiMode, model: options.aiModel },
                agentMessages,
                getToolsForQuery(), // Same tool selection logic as first iteration
                false // No thinking
              );

              // Clear status
              process.stdout.write('\r'.padEnd(70) + '\r');

              // Display content with proper word wrapping
              const cleanedContent = cleanToolTokens(response.content);
              const prefix = chalk.cyan('  Victor: ');
              const indent = '          ';
              const lines = wrapText(cleanedContent, 65, '  Victor: ', indent);
              for (let i = 0; i < lines.length; i++) {
                if (i === 0) {
                  // First line: replace plain prefix with chalk-colored one
                  console.log(lines[i].replace('  Victor: ', prefix));
                } else {
                  console.log(formatWithStyles(lines[i]));
                }
              }

              currentContent = cleanToolTokens(response.content);

              // IMPORTANT: On last iteration, ignore any tool calls
              if (response.toolCalls && !isLastIteration) {
                currentToolCalls.push(...response.toolCalls);
              }

              // Store results
              totalPromptTokens += response.promptTokens;
              maxPromptTokens = Math.max(
                maxPromptTokens,
                response.promptTokens
              );
              totalCompletionTokens += response.completionTokens;
              totalDuration += response.duration;
              modelName = response.model;
            }
          }

          finalContent += currentContent;
          // finalThinking tracked for potential debugging/logging

          // Add assistant message to conversation
          agentMessages.push({
            role: 'assistant',
            content: currentContent,
            thinking: currentThinking,
            tool_calls:
              currentToolCalls.length > 0 ? currentToolCalls : undefined,
          });

          // If no tool calls, we're done
          if (currentToolCalls.length === 0) {
            break;
          }

          // Execute tool calls
          console.log(); // New line after content
          console.log();
          console.log(
            chalk.dim(
              '  ┌─ Tool Calls ────────────────────────────────────────────────'
            )
          );

          for (const toolCall of currentToolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;

            // Show tool being called
            console.log(
              chalk.dim(`  │ `) +
                chalk.yellow(`🔧 ${toolName}`) +
                chalk.dim(`: ${JSON.stringify(toolArgs)}`)
            );

            // Execute the tool with timing
            const toolStart = Date.now();
            const result = await executeToolCall(toolCall, (msg) => {
              console.log(chalk.dim(`  │ `) + chalk.dim(`   ${msg}`));
            });
            totalToolDuration += Date.now() - toolStart;
            toolCallCount++;

            // Show full result data for transparency
            const resultLines = result.split('\n');
            console.log(
              chalk.dim(`  │ `) +
                chalk.green(`   ✓ Got ${resultLines.length} lines of data:`)
            );
            for (const line of resultLines) {
              if (line.trim()) {
                // Truncate very long lines
                const displayLine =
                  line.length > 70 ? line.substring(0, 67) + '...' : line;
                console.log(chalk.dim(`  │      ${displayLine}`));
              }
            }

            // Add tool result to messages
            agentMessages.push({
              role: 'tool',
              content: result,
              tool_name: toolName,
            });
          }

          console.log(
            chalk.dim(
              '  └───────────────────────────────────────────────────────────────'
            )
          );
          console.log();
        }

        // CRITICAL: If we hit max iterations with tool results pending,
        // we need one final synthesis call
        const lastMessage = agentMessages[agentMessages.length - 1];
        if (iteration >= maxIterations && lastMessage?.role === 'tool') {
          // Use streaming for better UX if enabled
          if (options.stream) {
            const streamResult = await streamResponse(
              { mode: options.aiMode, model: options.aiModel },
              agentMessages,
              undefined, // No tools
              false // No thinking
            );

            finalContent += streamResult.content;
            totalPromptTokens += streamResult.promptTokens;
            maxPromptTokens = Math.max(
              maxPromptTokens,
              streamResult.promptTokens
            );
            totalCompletionTokens += streamResult.completionTokens;
            totalDuration += streamResult.duration;
          } else {
            showStatus('Victor is synthesizing results...');

            // Final synthesis call - explicitly disable tools
            const synthesisResponse: AgentResponse = await chatWithTools(
              { mode: options.aiMode, model: options.aiModel },
              agentMessages,
              undefined, // No tools
              false // No thinking
            );

            // Clear status
            process.stdout.write('\r'.padEnd(70) + '\r');

            // Display synthesis
            const synthesisContent = cleanToolTokens(synthesisResponse.content);
            if (synthesisContent.trim()) {
              const prefix = chalk.cyan('  Victor: ');
              const indent = '          ';
              const lines = wrapText(
                synthesisContent,
                65,
                '  Victor: ',
                indent
              );
              for (let i = 0; i < lines.length; i++) {
                if (i === 0) {
                  console.log(lines[i].replace('  Victor: ', prefix));
                } else {
                  console.log(formatWithStyles(lines[i]));
                }
              }
              finalContent += synthesisContent;
            }

            // Update token stats
            totalPromptTokens += synthesisResponse.promptTokens;
            maxPromptTokens = Math.max(
              maxPromptTokens,
              synthesisResponse.promptTokens
            );
            totalCompletionTokens += synthesisResponse.completionTokens;
            totalDuration += synthesisResponse.duration;
          }
        }

        // Ensure we end with a newline
        if (finalContent) {
          console.log();
        }

        // Add final response to conversation history
        conversationHistory.push({ role: 'assistant', content: finalContent });

        // Show token usage, timing, and quality metrics
        if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
          const cacheStats = sessionCache.getStats();
          // Use max prompt tokens (actual context) for efficiency display
          // totalPromptTokens is cumulative across iterations (for cost tracking)
          const displayPromptTokens = maxPromptTokens;
          const tokenEfficiency =
            displayPromptTokens > 0
              ? ((totalCompletionTokens / displayPromptTokens) * 100).toFixed(1)
              : '0';
          const inferenceTime = totalDuration - totalToolDuration;

          console.log();

          // Main stats line - show actual context size (max per iteration)
          console.log(
            chalk.dim(
              `  ─ ${modelName} · ` +
                `${displayPromptTokens}→${totalCompletionTokens} tokens ` +
                `(${tokenEfficiency}% eff) · ` +
                `${(totalDuration / 1000).toFixed(1)}s`
            )
          );

          // Detailed breakdown (if there were tool calls or cache activity)
          if (
            toolCallCount > 0 ||
            cacheStats.hits > 0 ||
            cacheStats.misses > 0
          ) {
            const parts: string[] = [];

            if (toolCallCount > 0) {
              parts.push(
                `${toolCallCount} tool${toolCallCount > 1 ? 's' : ''} ` +
                  `(${(totalToolDuration / 1000).toFixed(1)}s)`
              );
            }

            if (cacheStats.hits > 0 || cacheStats.misses > 0) {
              const hitRate = (cacheStats.hitRate * 100).toFixed(0);
              parts.push(`cache: ${hitRate}% hit`);
            }

            if (inferenceTime > 0 && toolCallCount > 0) {
              parts.push(`AI: ${(inferenceTime / 1000).toFixed(1)}s`);
            }

            if (parts.length > 0) {
              console.log(chalk.dim(`    ${parts.join(' · ')}`));
            }
          }
        }
        console.log();
      } catch (err) {
        process.stdout.write(`\r${' '.repeat(60)}\r`);
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`  ✗ Error: ${msg}`));
        console.log();
      }

      // Continue conversation
      askQuestion();
    });
  };

  // Start the conversation loop
  askQuestion();
}

/**
 * Clean raw DeepSeek tool call tokens from content
 * These leak through when model outputs tool calls as text instead of
 * structured calls
 */
function cleanToolTokens(text: string): string {
  // Remove DeepSeek's raw tool call tokens
  return text
    .replace(/<｜tool▁call▁begin｜>/g, '')
    .replace(/<｜tool▁call▁end｜>/g, '')
    .replace(/<｜tool▁calls▁end｜>/g, '')
    .replace(/<｜tool▁sep｜>/g, '')
    .replace(/\{"query":[^}]+\}/g, '') // Remove orphaned JSON queries
    .replace(/[ \t]+/g, ' ') // Collapse multiple spaces (but not newlines)
    .trim();
}

/**
 * Stream AI response to console with real-time display
 * Provides better UX by showing content as it's generated
 */
async function streamResponse(
  config: { mode: OllamaMode; model?: string },
  messages: AgentMessage[],
  tools?: ToolDefinition[],
  enableThinking: boolean = false
): Promise<{
  content: string;
  toolCalls: ToolCall[];
  promptTokens: number;
  completionTokens: number;
  duration: number;
  model: string;
}> {
  process.stdout.write(chalk.cyan('  Victor: '));

  const stream = streamChatWithTools(config, messages, tools, enableThinking);

  let content = '';
  const toolCalls: ToolCall[] = [];
  let lineLength = 10; // "  Victor: " prefix length
  const maxLineLength = 75;
  let finalResult: StreamingAgentResult | null = null;

  // Stream content chunks
  let iterResult = await stream.next();
  while (!iterResult.done) {
    const chunk = iterResult.value;
    if (chunk.type === 'content' && chunk.text) {
      const text = cleanToolTokens(chunk.text);
      if (text) {
        // Word wrap as we stream
        const words = text.split(/(\s+)/);
        for (const word of words) {
          if (word.trim() === '') {
            // Handle whitespace
            if (word.includes('\n')) {
              process.stdout.write('\n          '); // Indent continuation
              lineLength = 10;
            } else if (lineLength > 10) {
              process.stdout.write(' ');
              lineLength++;
            }
          } else {
            // Check if word would exceed line length
            if (lineLength + word.length > maxLineLength && lineLength > 10) {
              process.stdout.write('\n          '); // Indent continuation
              lineLength = 10;
            }
            process.stdout.write(word);
            lineLength += word.length;
          }
        }
        content += text;
      }
    } else if (chunk.type === 'tool_call' && chunk.toolCall) {
      toolCalls.push(chunk.toolCall);
    }
    iterResult = await stream.next();
  }

  // Get final result from done iteration
  if (iterResult.done && iterResult.value) {
    finalResult = iterResult.value;
  }

  process.stdout.write('\n');

  return {
    content: cleanToolTokens(content),
    toolCalls,
    promptTokens: finalResult?.promptTokens ?? 0,
    completionTokens: finalResult?.completionTokens ?? 0,
    duration: finalResult?.duration ?? 0,
    model: finalResult?.model ?? config.model ?? 'unknown',
  };
}

/**
 * Format text with chalk styles for markdown-like syntax
 * Converts **bold**, *italic*, and handles bullets
 */
function formatWithStyles(text: string): string {
  let formatted = text;

  // Convert **text** to bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return chalk.bold(content);
  });

  // Convert *text* to italic (dim in terminal)
  formatted = formatted.replace(/\*([^*]+)\*/g, (_, content) => {
    return chalk.italic(content);
  });

  // Highlight ticker symbols (all caps 2-5 letters)
  formatted = formatted.replace(/\b([A-Z]{2,5})\b/g, (match) => {
    // Don't highlight common words
    const skipWords = [
      'RSI',
      'ITM',
      'OTM',
      'ATM',
      'DTE',
      'MA',
      'THE',
      'AND',
      'FOR',
      'NOT',
      'YOU',
      'ARE',
      'BUT',
      'CAN',
      'HAS',
      'HAD',
      'WAS',
      'ALL',
      'ENTER',
      'WAIT',
      'PASS',
      'BUY',
      'SELL',
      'CALL',
      'PUT',
      'WHY',
      'MAX',
      'ABOVE',
      'BELOW',
    ];
    if (skipWords.includes(match)) return match;
    return chalk.yellow(match);
  });

  return formatted;
}

/**
 * Word wrap text to specified width with custom prefix/indent
 * @param text - Text to wrap
 * @param maxWidth - Max content width (not including prefix)
 * @param firstPrefix - Prefix for first line (e.g., "  Victor: ")
 * @param contIndent - Indent for continuation lines (e.g., "          ")
 */
function wrapText(
  text: string,
  maxWidth: number = 65,
  firstPrefix: string = '',
  contIndent: string = ''
): string[] {
  const paragraphs = text.split(/\n/);
  const allLines: string[] = [];
  let isFirstLine = true;

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    let currentLine = isFirstLine ? firstPrefix : contIndent;

    for (const word of words) {
      const prefix = isFirstLine ? firstPrefix : contIndent;
      const maxLineLen = maxWidth + prefix.length;
      const testLength = currentLine.length + 1 + word.length;

      if (testLength <= maxLineLen) {
        // Word fits on current line
        const separator = currentLine === prefix ? '' : ' ';
        currentLine += separator + word;
      } else {
        // Word doesn't fit - push current line and start new one
        if (currentLine.length > prefix.length || currentLine !== prefix) {
          allLines.push(currentLine);
          isFirstLine = false;
        }
        currentLine = contIndent + word;
      }
    }

    // Push remaining content
    if (currentLine.trim().length > 0) {
      allLines.push(currentLine);
      isFirstLine = false;
    }
  }

  return allLines;
}
