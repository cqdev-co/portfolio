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

import * as readline from "readline";
import chalk from "chalk";
import YahooFinance from "yahoo-finance2";
import { RSI, SMA, ADX } from "technicalindicators";
import { 
  validateAIRequirement, 
  chatWithTools,
  streamChatWithTools,
  type OllamaMode, 
  type AgentMessage,
  type AgentResponse,
  type ToolDefinition,
  type ToolCall,
  type StreamingAgentChunk,
  type StreamingAgentResult,
} from "../services/ollama.ts";
import { getAllTrades, getTradesByTicker, getPerformanceSummary, getPositions, getPositionsByTicker, isConfigured } from "../services/supabase.ts";
import { 
  buildTickerHistory, 
  detectPatterns, 
  toonToString, 
  buildTOONContext,
  getTOONDecoderSpec,
  encodeTickerToTOON,
  summarizeConversation,
  type TickerDataInput,
  type ConversationMessage as TOONConversationMessage,
} from "../context/toon.ts";
import { 
  findOptimalSpread, 
  getEarningsInfo, 
  getIVAnalysis,
  calculateSupportResistance,
  getTickerNews,
  formatNewsForAI,
  type SpreadRecommendation,
  type IVAnalysis,
  type SupportResistance,
  type NewsItem,
} from "../services/yahoo.ts";
import { getCalendarContext, formatCalendarForAI } from "../services/calendar.ts";
import { 
  getMarketRegime as fetchMarketRegime, 
  getRegimeBadge, 
  formatRegimeForAI,
  type MarketRegime as MarketRegimeData,
} from "../services/market-regime.ts";
import { 
  quickScan, 
  fullScan, 
  formatScanResults,
  type ScanResult,
} from "../services/scanner.ts";
import {
  searchWeb,
  formatSearchForAI,
  needsWebSearch,
  type WebSearchResponse,
} from "../services/web-search.ts";
import { 
  checkDataStaleness, 
  getMarketStatus,
  findSpreadWithAlternatives,
  type DataQuality,
  type SpreadAlternatives,
} from "../services/yahoo.ts";
import { 
  performFullAnalysis, 
  formatAnalysisForAI, 
  explainGradeRubric,
  GRADE_RUBRIC,
  type AdvancedAnalysis,
} from "../engine/trade-analyzer.ts";
import type { MarketRegime, Trade } from "../types/index.ts";

// Instantiate yahoo-finance2
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

// ============================================================================
// TYPES
// ============================================================================

export interface ChatOptions {
  aiMode: OllamaMode;
  aiModel?: string;
  accountSize?: number;
}

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
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
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

const DEFAULT_ACCOUNT_SIZE = 1500;

async function getMarketRegime(): Promise<{ regime: MarketRegime; spyPrice: number }> {
  try {
    const spy = await yahooFinance.quote("SPY");
    const spyPrice = spy?.regularMarketPrice ?? 0;
    const ma50 = spy?.fiftyDayAverage ?? spyPrice;
    const ma200 = spy?.twoHundredDayAverage ?? spyPrice;
    
    let regime: MarketRegime = "neutral";
    if (spyPrice > ma50 && spyPrice > ma200) {
      regime = "bull";
    } else if (spyPrice < ma50 && spyPrice < ma200) {
      regime = "bear";
    }
    
    return { regime, spyPrice };
  } catch {
    return { regime: "neutral", spyPrice: 0 };
  }
}

async function fetchTickerData(ticker: string, fetchOptions: boolean = true): Promise<TickerData | null> {
  try {
    const quote = await yahooFinance.quote(ticker);
    if (!quote?.regularMarketPrice) return null;

    // Check data freshness
    const dataQuality = checkDataStaleness(quote.regularMarketTime);

    // Get historical for RSI
    let rsi: number | undefined;
    let ma20: number | undefined;
    let ma50: number | undefined;
    let ma200: number | undefined;
    let adx: number | undefined;
    let trendStrength: 'WEAK' | 'MODERATE' | 'STRONG' | undefined;
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365); // Need 365 days for MA200

      const history = await yahooFinance.chart(ticker, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });

      if (history?.quotes && history.quotes.length >= 50) {
        const closes = history.quotes
          .map(q => q.close)
          .filter((c): c is number => c !== null && c !== undefined);
        
        const highs = history.quotes
          .map(q => q.high)
          .filter((h): h is number => h !== null && h !== undefined);
        
        const lows = history.quotes
          .map(q => q.low)
          .filter((l): l is number => l !== null && l !== undefined);

        if (closes.length >= 14) {
          const rsiValues = RSI.calculate({ values: closes, period: 14 });
          rsi = rsiValues[rsiValues.length - 1];
        }
        
        // Calculate ADX for trend strength (needs high, low, close)
        if (highs.length >= 28 && lows.length >= 28 && closes.length >= 28) {
          try {
            const adxValues = ADX.calculate({
              high: highs,
              low: lows,
              close: closes,
              period: 14,
            });
            if (adxValues.length > 0) {
              adx = adxValues[adxValues.length - 1].adx;
              // ADX interpretation: <20 = weak, 20-40 = moderate, >40 = strong
              trendStrength = adx < 20 ? 'WEAK' : adx < 40 ? 'MODERATE' : 'STRONG';
            }
          } catch {
            // ADX calculation can fail with certain data
          }
        }
        
        if (closes.length >= 20) {
          const ma20Values = SMA.calculate({ values: closes, period: 20 });
          ma20 = ma20Values[ma20Values.length - 1];
        }
        
        if (closes.length >= 50) {
          const ma50Values = SMA.calculate({ values: closes, period: 50 });
          ma50 = ma50Values[ma50Values.length - 1];
        }
        
        if (closes.length >= 200) {
          const ma200Values = SMA.calculate({ values: closes, period: 200 });
          ma200 = ma200Values[ma200Values.length - 1];
        }
      }
    } catch {
      // Technical data optional
    }

    // Fetch options spread recommendation, earnings, and IV (if requested)
    let spread: SpreadRecommendation | undefined;
    let spreadAlternatives: SpreadRecommendation[] = [];
    let spreadReason: string | undefined;
    let earningsDays: number | null = null;
    let earningsWarning = false;
    let iv: IVAnalysis | undefined;
    
    // Fetch news
    let news: NewsItem[] = [];
    
    if (fetchOptions) {
      try {
        // Fetch spreads with alternatives, earnings, IV, and news in parallel
        // No budget limit - show best spreads regardless of cost
        const [spreadResult, earningsResult, ivResult, newsResult] = await Promise.all([
          findSpreadWithAlternatives(ticker, 30),
          getEarningsInfo(ticker),
          getIVAnalysis(ticker),
          getTickerNews(ticker, 3),
        ]);
        
        spread = spreadResult.primary ?? undefined;
        spreadAlternatives = spreadResult.alternatives;
        spreadReason = spreadResult.reason;
        earningsDays = earningsResult.daysUntilEarnings;
        earningsWarning = earningsResult.withinEarningsWindow;
        iv = ivResult ?? undefined;
        news = newsResult;
      } catch {
        // Options data optional
      }
    }

    // Calculate support/resistance levels
    const supportResistance = calculateSupportResistance({
      currentPrice: quote.regularMarketPrice,
      ma20,
      ma50,
      ma200,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
    });

    // Perform advanced analysis if we have spread data
    let analysis: AdvancedAnalysis | undefined;
    if (spread) {
      const analysisResult = performFullAnalysis({
        ticker: quote.symbol ?? ticker,
        price: quote.regularMarketPrice,
        rsi,
        ma200,
        aboveMA200: ma200 ? quote.regularMarketPrice > ma200 : undefined,
        earningsDays,
        longStrike: spread.longStrike,
        shortStrike: spread.shortStrike,
        debit: spread.estimatedDebit,
        dte: spread.dte,
        accountSize: 1500,  // Default account size
      });
      analysis = analysisResult ?? undefined;
    }

    return {
      ticker: quote.symbol ?? ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
      rsi,
      aboveMA200: ma200 ? quote.regularMarketPrice > ma200 : undefined,
      ma20,
      ma50,
      ma200,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
      // Fundamentals
      marketCap: quote.marketCap ?? undefined,
      peRatio: quote.trailingPE ?? undefined,
      forwardPE: quote.forwardPE ?? undefined,
      eps: quote.epsTrailingTwelveMonths ?? undefined,
      dividendYield: quote.dividendYield ? quote.dividendYield * 100 : undefined,
      beta: quote.beta ?? undefined,
      // Technical indicators
      adx,
      trendStrength,
      // Enhanced data
      spread,
      spreadAlternatives,
      spreadReason,
      earningsDays,
      earningsWarning,
      analysis,
      iv,
      supportResistance,
      news,
      dataQuality,
    };
  } catch {
    return null;
  }
}

async function buildContextForAI(accountSize: number): Promise<string> {
  const contextParts: string[] = [];
  
  // Add current date/time context
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[now.getDay()];
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  contextParts.push(`TODAY: ${dayOfWeek}, ${dateStr} at ${timeStr}`);
  
  // Market status
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isMarketHours = !isWeekend && hour >= 9 && hour < 16;
  const isPreMarket = !isWeekend && hour >= 4 && hour < 9;
  const isAfterHours = !isWeekend && hour >= 16 && hour < 20;
  
  let marketStatus = "CLOSED";
  if (isMarketHours) marketStatus = "OPEN";
  else if (isPreMarket) marketStatus = "PRE-MARKET";
  else if (isAfterHours) marketStatus = "AFTER-HOURS";
  else if (isWeekend) marketStatus = "WEEKEND (CLOSED)";
  
  contextParts.push(`Market Status: ${marketStatus}`);
  
  // Get market regime
  const { regime, spyPrice } = await getMarketRegime();
  contextParts.push(`Market Regime: ${regime} (SPY $${spyPrice.toFixed(2)})`);
  
  // Add economic calendar
  const calendar = getCalendarContext();
  if (calendar.warnings.length > 0) {
    contextParts.push(`\n=== ECONOMIC CALENDAR WARNINGS ===`);
    for (const warning of calendar.warnings) {
      contextParts.push(warning);
    }
    contextParts.push(`=== END CALENDAR ===\n`);
  }
  
  // Get trade history and positions if database is configured
  if (isConfigured()) {
    // Get open positions first
    try {
      const positions = await getPositions();
      if (positions.length > 0) {
        contextParts.push(`\n=== YOUR OPEN POSITIONS ===`);
        for (const pos of positions) {
          const strikes = pos.longStrike && pos.shortStrike 
            ? `$${pos.longStrike}/$${pos.shortStrike}` 
            : '';
          const dte = pos.dte !== undefined ? `${pos.dte} DTE` : '';
          contextParts.push(`${pos.ticker}: ${strikes} ${dte}, entry $${pos.entryPrice.toFixed(2)}`);
        }
        contextParts.push(`=== END POSITIONS ===\n`);
      }
    } catch {
      // Positions unavailable
    }
    
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
        
        const toonContext = buildTOONContext(accountSize, byTicker, regime, patterns);
        contextParts.push(`History (TOON): ${toonToString(toonContext)}`);
      } else {
        contextParts.push("No trade history yet");
      }
    } catch {
      contextParts.push("Trade history unavailable");
    }
  } else {
    contextParts.push("Database not configured - no trade history");
  }
  
  return contextParts.join("\n");
}

// ============================================================================
// QUESTION CLASSIFICATION (Smart Context Loading)
// ============================================================================

export type QuestionType = 
  | 'price_check'    // Simple price/quote questions
  | 'trade_analysis' // Full trade analysis with spreads
  | 'research'       // News/why questions requiring web search
  | 'position_check' // Questions about existing positions
  | 'scan'           // Market scanning requests
  | 'general';       // General conversation

interface QuestionClassification {
  type: QuestionType;
  needsOptions: boolean;
  needsNews: boolean;
  needsWebSearch: boolean;
  needsPositions: boolean;
  needsCalendar: boolean;
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
      needsNews: false,
      needsWebSearch: false,
      needsPositions: false,
      needsCalendar: true,
    };
  }
  
  // Research/news questions - need web search
  if (/\b(why is|what.+news|research|look up|what.+happening)\b/.test(lower)) {
    return {
      type: 'research',
      needsOptions: false,
      needsNews: true,
      needsWebSearch: true,
      needsPositions: false,
      needsCalendar: false,
    };
  }
  
  // Position questions - need positions data
  if (/\b(my position|positions|holding|portfolio|what.+own)\b/.test(lower)) {
    return {
      type: 'position_check',
      needsOptions: false,
      needsNews: false,
      needsWebSearch: false,
      needsPositions: true,
      needsCalendar: false,
    };
  }
  
  // Simple price check - minimal data needed
  if (/\b(price|quote|how much|what.+at|trading at)\b/.test(lower) &&
      !/\b(should|buy|sell|trade|analyze|entry)\b/.test(lower)) {
    return {
      type: 'price_check',
      needsOptions: false,
      needsNews: false,
      needsWebSearch: false,
      needsPositions: false,
      needsCalendar: false,
    };
  }
  
  // Trade analysis - full context needed
  // Includes "how does X look" patterns which imply wanting analysis
  if (/\b(analyze|should|buy|sell|entry|trade|spread|cds|setup|look|looking|opportunity|opportunities)\b/.test(lower)) {
    return {
      type: 'trade_analysis',
      needsOptions: true,
      needsNews: true,
      needsWebSearch: false,
      needsPositions: true,
      needsCalendar: true,
    };
  }
  
  // Default: if a ticker is mentioned, treat as trade analysis
  // Check for uppercase 2-5 letter words that look like tickers
  const tickerPattern = /\b[A-Z]{2,5}\b/;
  if (tickerPattern.test(message)) {
    return {
      type: 'trade_analysis',
      needsOptions: true,
      needsNews: true,
      needsWebSearch: false,
      needsPositions: true,
      needsCalendar: true,
    };
  }
  
  // Default: general question with minimal context
  return {
    type: 'general',
    needsOptions: false,
    needsNews: false,
    needsWebSearch: false,
    needsPositions: false,
    needsCalendar: true,
  };
}

// ============================================================================
// SYSTEM PROMPT (Optimized - ~1000 tokens vs ~1500)
// ============================================================================

function buildSystemPrompt(accountSize: number, context: string): string {
  const maxPosition = Math.round(accountSize * 0.2);
  
  return `You are Victor Chen - 67yo Wall Street veteran, 45 years experience. You survived Black Monday, dot-com, 2008, COVID. Now my personal analyst managing a $${accountSize} account.

## Victor's Voice & Style
You speak CONVERSATIONALLY - like a seasoned trader explaining his thinking to a colleague over coffee. NOT bullet points or formal reports. Weave data naturally into your reasoning.

GOOD: "Look, IBM's sitting at $310 with RSI at 59 - that's a bit hot for my taste. I'd normally like to see RSI in the 40s or 50s before jumping in. And with FOMC tomorrow? That's a coin flip I'm not taking."

BAD: "• MY CALL: WAIT • THE NUMBERS: RSI 59 • KEY RISKS: FOMC tomorrow"

You're direct and decisive. You make CALLS, not suggestions. Reference your experience when relevant: "I've seen this pattern before..." or "In '08 when the Fed..." 

Your conviction comes through in HOW you say things, not bullet formatting.

## Strategy: Deep ITM Call Debit Spreads (CDS)
Buy deep ITM call (6-12% ITM, δ~0.80+), sell $5 higher strike. Target 21-45 DTE.

Entry Rules (RSI-based with ADX flexibility):
- BASE: RSI 35-55 = ideal entry zone
- EXCEPTION: In STRONG trends (ADX >40), RSI up to 65 is acceptable
- Above MA200, no earnings within 14d

CDS Math: BUY LOWER strike / SELL HIGHER strike. Max Loss = Debit. Breakeven = Long Strike + Debit.

## Key Rules
• Max position: $${maxPosition} (20% of account) | WHOLE CONTRACTS ONLY
• RSI > 60 = wait for pullback | FOMC/CPI within 3d = WAIT or reduce size
• IV HIGH (>50%) = spreads expensive, wait | IV LOW (<20%) = good entry
• Always compare breakeven to support levels

## Data & Tools
The LIVE DATA section contains ALL available market data including fundamentals:
• TOON format includes: Price, RSI, ADX, MAs, IV, Support/Resistance, Spread, **Market Cap (MC), P/E (PE)**
• If data shows "-", acknowledge the gap - don't invent values
• READ THE TOON DATA CAREFULLY - P/E and Market Cap are at the END of each line

## Tools - USE SPARINGLY
You have tools (web_search, get_ticker_data, scan_for_opportunities) but:
• ONLY use tools if user explicitly asks to "research", "look up", "search", or "find"
• The LIVE DATA section already has everything you need for basic analysis
• If data is in LIVE DATA, just USE IT - don't call tools to get the same data
• Most questions can be answered with the provided data alone

When you DO use tools:
• Make 1 tool call, synthesize results, then answer
• Never make more than 2 tool calls per question

## CRITICAL: No Hallucinations
• ONLY cite data EXPLICITLY in LIVE DATA - check the TOON line for exact values
• P/E is in the data (e.g., PE116 = P/E ratio of 116) - USE IT, don't invent different numbers
• NEVER make up prices, P/E ratios, percentages, or dates
• If you need news/sentiment data, say "I don't have recent news" - don't pretend to search
• Double-check ticker symbols and ALL numbers before citing them

## Data Rules
• ONLY use provided data - never invent prices/RSI/MAs
• Be PRECISE on MA comparisons (182 < 184 = BELOW MA20)
• Missing data ("-" in TOON) = acknowledge the gap, don't fill it

## Response Style
• Conversational, not listy - explain your reasoning naturally
• Quick questions: 50-100 words | Analysis: 150-200 words
• Lead with your verdict, then explain WHY with data
• End decisive conversations with a clear action: "My call: [ACTION]"
• When citing web search: only reference what was ACTUALLY returned, don't embellish
• If you don't know something specific, be honest: "I'd need to dig deeper on that"

${getTOONDecoderSpec()}

## LIVE DATA
${context}

Capital protection first, profits second.`;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Tools available to Victor for research and analysis
 */
const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current news, market analysis, or any " +
        "information not in the provided data. Use this when asked to research, " +
        "look up news, or find out why a stock is moving.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description: "The search query - be specific (e.g. 'NVDA stock " +
              "news today', 'FOMC meeting December 2024 impact')",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticker_data",
      description: "Fetch real-time stock data for a ticker including price, " +
        "RSI, moving averages, options spreads, and news. Use when analyzing " +
        "a specific stock.",
      parameters: {
        type: "object",
        required: ["ticker"],
        properties: {
          ticker: {
            type: "string",
            description: "Stock ticker symbol (e.g. NVDA, AAPL, TSLA)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_for_opportunities",
      description: "Scan the market for trade opportunities matching our " +
        "Deep ITM Call Debit Spread criteria. Returns graded setups.",
      parameters: {
        type: "object",
        required: [],
        properties: {},
      },
    },
  },
];

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
  toolCall: ToolCall,
  showStatus: (msg: string) => void
): Promise<string> {
  const { name, arguments: args } = toolCall.function;
  
  switch (name) {
    case "web_search": {
      const query = args.query as string;
      showStatus(`🌐 Searching: "${query}"`);
      const results = await searchWeb(query, 5);
      return formatSearchForAI(results);
    }
    
    case "get_ticker_data": {
      const ticker = (args.ticker as string).toUpperCase();
      showStatus(`📊 Fetching ${ticker} data...`);
      try {
        const data = await fetchTickerData(ticker, true);
        if (!data) {
          return `Could not fetch data for ${ticker}`;
        }
        return formatTickerDataForAI(data);
      } catch {
        return `Error fetching data for ${ticker}`;
      }
    }
    
    case "scan_for_opportunities": {
      showStatus(`🔍 Scanning market for opportunities...`);
      const results = await quickScan();
      if (results.length === 0) {
        return "No Grade A or B setups found in current market conditions.";
      }
      return formatScanResults(results);
    }
    
    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Format ticker data for AI context
 */
function formatTickerDataForAI(t: TickerData): string {
  let output = `\n=== ${t.ticker} DATA ===\n`;
  output += `Price: $${t.price.toFixed(2)} (${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%)\n`;
  output += `RSI: ${t.rsi?.toFixed(1) ?? 'N/A'}\n`;
  if (t.ma20) output += `MA20: $${t.ma20.toFixed(2)}\n`;
  if (t.ma50) output += `MA50: $${t.ma50.toFixed(2)}\n`;
  if (t.ma200) output += `MA200: $${t.ma200.toFixed(2)} (${t.aboveMA200 ? 'ABOVE' : 'BELOW'})\n`;
  if (t.marketCap) {
    const mcapStr = t.marketCap >= 1e12 ? `$${(t.marketCap / 1e12).toFixed(1)}T`
      : `$${(t.marketCap / 1e9).toFixed(0)}B`;
    output += `Market Cap: ${mcapStr}\n`;
  }
  if (t.peRatio) output += `P/E: ${t.peRatio.toFixed(1)}\n`;
  if (t.iv) {
    output += `IV: ${t.iv.currentIV}% (${t.iv.ivLevel}) - ${t.iv.ivPercentile}th percentile\n`;
  }
  if (t.spread) {
    output += `Spread: $${t.spread.longStrike}/$${t.spread.shortStrike}, ` +
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
    "I", "A", "THE", "AND", "OR", "BUT", "IS", "IT", "TO", "FOR",
    "IN", "ON", "AT", "BY", "UP", "IF", "SO", "NO", "YES", "OK",
    "CDS", "PCS", "ITM", "OTM", "ATM", "RSI", "MA", "DTE", "AI",
    "BUY", "SELL", "HOLD", "WAIT", "PASS", "NOT", "CAN", "DO",
    "HOW", "WHAT", "WHY", "WHEN", "WHO", "MY", "PM", "AM",
  ]);
  
  return matches.filter(t => !commonWords.has(t) && t.length >= 2);
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
}

/**
 * Status callback type for UI updates
 */
type StatusCallback = (status: string) => void;

/**
 * Prepare context for AI generation (fetches data, builds prompts)
 * Uses question classification for smart context loading
 */
async function prepareContext(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  accountSize: number,
  onStatus?: StatusCallback
): Promise<PreparedContext> {
  
  // Classify the question to determine what context we need
  const classification = classifyQuestion(userMessage);
  
  // Check if user wants to scan for opportunities
  const wantsScan = classification.type === 'scan' || 
    (classification.type === 'general' && 
     /\b(scan|find|search|opportunities|setups|grade a|best)\b/.test(userMessage.toLowerCase()));
  
  let scanResults: ScanResult[] = [];
  let scanContext = "";
  
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
      scanContext = "\n(Scan failed - please try again)\n";
    }
  }
  
  // Check if user needs web search based on classification
  let webSearchResults: WebSearchResponse | undefined;
  let webSearchContext = "";
  
  if (classification.needsWebSearch) {
    const searchCheck = needsWebSearch(userMessage);
    if (searchCheck.needed && searchCheck.query) {
      onStatus?.(`🌐 Searching web...`);
      try {
        webSearchResults = await searchWeb(searchCheck.query, 5);
        if (webSearchResults.results.length > 0 || webSearchResults.instantAnswer) {
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
  // Use classification to determine if we need full options data
  let tickerContext = "";
  if (tickers.length > 0) {
    onStatus?.(`Fetching ${tickers.join(', ')}...`);
    
    // Skip options data for simple price checks (faster + fewer tokens)
    const fetchOptions = classification.needsOptions;
    const tickerDataPromises = tickers.slice(0, 3).map(t => 
      fetchTickerData(t, fetchOptions)
    );
    const tickerDataResults = await Promise.all(tickerDataPromises);
    
    const validData = tickerDataResults.filter((d): d is TickerData => d !== null);
    tickersFetched.push(...validData);
    
    if (validData.length > 0) {
      // Use TOON encoding for compact context (~80% token reduction)
      const toonData: TickerDataInput[] = validData.map(d => ({
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
      }));
      
      tickerContext = "\n\n=== TICKER DATA (TOON) ===\n";
      for (const td of toonData) {
        tickerContext += encodeTickerToTOON(td) + "\n";
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
              const title = n.title.length > 60 ? n.title.slice(0, 57) + '...' : n.title;
              tickerContext += `• ${title}\n`;
            }
          }
        }
      }
      
      tickerContext += "=== END TICKER DATA ===";
      
      // Check for open positions only if classification needs it
      if (isConfigured() && classification.needsPositions) {
        onStatus?.(`Checking positions...`);
        for (const ticker of tickers.slice(0, 3)) {
          try {
            const positions = await getPositionsByTicker(ticker);
            if (positions.length > 0) {
              // Compact position format
              tickerContext += `\n🔔 OPEN: ${ticker}`;
              for (const pos of positions) {
                const strikes = pos.longStrike && pos.shortStrike 
                  ? `$${pos.longStrike}/$${pos.shortStrike}` 
                  : '';
                const dte = pos.dte !== undefined ? `${pos.dte}DTE` : '';
                tickerContext += ` ${strikes} ${dte} @$${pos.entryPrice.toFixed(2)}`;
              }
              tickerContext += '\n';
            }
          } catch {
            // Positions unavailable
          }
        }
        
        // Get trade history for these tickers (compact format)
        onStatus?.(`Checking trade history...`);
        for (const ticker of tickers.slice(0, 3)) {
          try {
            const trades = await getTradesByTicker(ticker);
            if (trades.length > 0) {
              const history = buildTickerHistory(ticker, trades);
              // Super compact: NVDA:5tr/67%WR/$142PnL
              tickerContext += `${ticker}:${history.totalTrades}tr/${history.winRate.toFixed(0)}%WR/$${history.totalPnl.toFixed(0)}PnL`;
              if (history.patterns.length > 0) {
                tickerContext += `|${history.patterns[0].slice(0, 30)}`;
              }
              tickerContext += '\n';
            }
          } catch {
            // History unavailable
          }
        }
      }
    }
  }
  
  onStatus?.(`Generating response...`);
  
  // Build context
  const context = await buildContextForAI(accountSize);
  const systemPrompt = buildSystemPrompt(
    accountSize, 
    context + tickerContext + scanContext + webSearchContext
  );
  
  // Conversation history: summarize older turns, keep last 4 full
  let conversationContext = "";
  if (conversationHistory.length > 4) {
    // Summarize older messages to save tokens
    const olderHistory = conversationHistory.slice(0, -4);
    const toonHistory: TOONConversationMessage[] = olderHistory.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    conversationContext = summarizeConversation(toonHistory) + "\n\n";
  }
  
  // Keep last 4 messages in full (most relevant context)
  const recentHistory = conversationHistory.slice(-4);
  const recentContext = recentHistory.map(m => `${m.role}: ${m.content}`).join("\n");
  
  // Build the user prompt with summarized + recent history
  const userPrompt = conversationContext + recentContext + 
    (recentContext ? "\n\n" : "") + `user: ${userMessage}`;
  
  return {
    systemPrompt,
    userPrompt,
    tickersFetched,
    scanResults,
    webSearchResults,
  };
}

// ============================================================================
// MAIN CHAT LOOP
// ============================================================================

export async function startChat(options: ChatOptions): Promise<void> {
  const accountSize = options.accountSize ?? DEFAULT_ACCOUNT_SIZE;
  
  // Get position count and market regime for header
  let positionCount = 0;
  let regime: MarketRegimeData | null = null;
  
  // Fetch in parallel
  const [positionsResult, regimeResult] = await Promise.all([
    isConfigured() 
      ? getPositions().catch(() => []) 
      : Promise.resolve([]),
    fetchMarketRegime().catch(() => null),
  ]);
  
  positionCount = positionsResult.length;
  regime = regimeResult;
  
  console.log();
  console.log(chalk.bold.cyan("  📊 YOUR ANALYST"));
  console.log(chalk.gray("  ════════════════════════════════════════════════════════════════════"));
  console.log();
  
  // Check market status
  const marketStatus = getMarketStatus();
  
  // Show header with position count and market regime
  let headerInfo = `Fund Size: $${accountSize.toLocaleString()} | Strategy: Deep ITM CDS`;
  if (positionCount > 0) {
    headerInfo += ` | ${chalk.yellow(`${positionCount} position${positionCount > 1 ? 's' : ''}`)}`;
  }
  
  // Add market status badge
  const statusBadge = marketStatus.isOpen 
    ? chalk.green('🟢 OPEN')
    : marketStatus.status === 'PRE_MARKET' ? chalk.yellow('🌅 PRE-MKT')
    : marketStatus.status === 'AFTER_HOURS' ? chalk.yellow('🌙 AH')
    : chalk.red('🔴 CLOSED');
  headerInfo += ` | ${statusBadge}`;
  
  console.log(chalk.gray(`  ${headerInfo}`));
  
  // Show market regime badge
  if (regime) {
    const regimeBadge = getRegimeBadge(regime);
    const regimeColor = regime.regime === 'RISK_ON' ? chalk.green
      : regime.regime === 'RISK_OFF' ? chalk.red
      : regime.regime === 'HIGH_VOL' ? chalk.yellow
      : chalk.white;
    console.log(chalk.gray('  ') + regimeColor(regimeBadge));
  }
  
  console.log(chalk.gray("  Type 'quit' to end session"));
  console.log();
  
  // Show calendar warnings if any
  const calendarCtx = getCalendarContext();
  if (calendarCtx.warnings.length > 0) {
    console.log(chalk.dim("  ┌─ Market Calendar ───────────────────────────────────────────────"));
    for (const warning of calendarCtx.warnings) {
      console.log(chalk.dim("  │ ") + chalk.yellow(warning));
    }
    console.log(chalk.dim("  └───────────────────────────────────────────────────────────────────"));
    console.log();
  }
  
  // Show market regime recommendation if notable
  if (regime && (regime.regime === 'HIGH_VOL' || regime.regime === 'RISK_OFF')) {
    console.log(chalk.dim("  ┌─ Market Regime Warning ────────────────────────────────────────"));
    console.log(chalk.dim("  │ ") + chalk.yellow(`${regime.regime}: ${regime.tradingRecommendation}`));
    console.log(chalk.dim("  └───────────────────────────────────────────────────────────────────"));
    console.log();
  }
  
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
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
  console.log(chalk.cyan("  Victor: ") + "Morning. Victor Chen here. Markets are open and I've");
  console.log(chalk.cyan("          ") + "been watching the tape. Give me a ticker to analyze, ask me");
  console.log(chalk.cyan("          ") + "to scan for setups, or let's review what we're holding.");
  console.log(chalk.cyan("          ") + "What's on your mind?");
  console.log();

  const askQuestion = (): void => {
    rl.question(chalk.green("  You: "), async (input) => {
      const userInput = input.trim();
      
      // Check for exit commands
      if (!userInput || ["quit", "exit", "bye", "q"].includes(userInput.toLowerCase())) {
          console.log();
          console.log(chalk.cyan("  Victor: ") + "Understood. I'll keep my eyes on the screens. In 45 years,");
          console.log(chalk.cyan("          ") + "I've learned patience wins. Come back when you're ready to");
          console.log(chalk.cyan("          ") + "make some money.");
          console.log();
          rl.close();
          return;
        }
      
      // Add user message to history
      conversationHistory.push({ role: "user", content: userInput });
      
      try {
        // Status update callback
        const updateStatus = (status: string) => {
          process.stdout.write(`\r${" ".repeat(60)}\r`);
          process.stdout.write(chalk.dim(`  ⏳ ${status}`));
        };
        
        updateStatus("Processing...");
        
        // Prepare context (fetch tickers, build prompts)
        const prepared = await prepareContext(
          userInput,
          conversationHistory.slice(0, -1),
          accountSize,
          updateStatus
        );
        
        // Clear status line
        process.stdout.write(`\r${" ".repeat(60)}\r`);
        
        // Show scan results if any
        if (prepared.scanResults.length > 0) {
          console.log();
          console.log(chalk.dim("  ┌─ Scan Results ─────────────────────────────────────────────────"));
          console.log(chalk.dim(`  │ `) + chalk.white(`Found ${prepared.scanResults.length} opportunities`));
          
          for (const r of prepared.scanResults.slice(0, 5)) {
            const gradeColor = r.grade.grade.startsWith('A') ? chalk.green
              : r.grade.grade.startsWith('B') ? chalk.yellow
              : chalk.red;
            const riskColor = r.risk.score <= 4 ? chalk.green
              : r.risk.score <= 6 ? chalk.yellow
              : chalk.red;
            
            console.log(chalk.dim(`  │ `) + chalk.cyan(r.ticker) + ` $${r.price.toFixed(0)} ` + 
              gradeColor(`Grade ${r.grade.grade}`) + chalk.dim(' · ') + riskColor(`Risk ${r.risk.score}/10`));
            
            if (r.spread) {
              console.log(chalk.dim(`  │   `) + chalk.dim(`${r.spread.strikes} · $${r.spread.debit.toFixed(2)} · ${r.spread.cushion.toFixed(0)}% cushion`));
            }
          }
          
          if (prepared.scanResults.length > 5) {
            console.log(chalk.dim(`  │   ...and ${prepared.scanResults.length - 5} more`));
          }
          console.log(chalk.dim("  └───────────────────────────────────────────────────────────────────"));
        }
        
        // Show web search results if any
        if (prepared.webSearchResults?.results?.length || prepared.webSearchResults?.instantAnswer) {
          console.log();
          console.log(chalk.dim("  ┌─ 🌐 Web Search ───────────────────────────────────────────────"));
          if (prepared.webSearchResults.instantAnswer) {
            const summary = prepared.webSearchResults.instantAnswer.substring(0, 120);
            console.log(chalk.dim(`  │ `) + chalk.white(summary + (prepared.webSearchResults.instantAnswer.length > 120 ? '...' : '')));
          }
          for (const r of prepared.webSearchResults.results.slice(0, 2)) {
            const title = r.title.length > 55 ? r.title.substring(0, 52) + '...' : r.title;
            console.log(chalk.dim(`  │ • `) + chalk.cyan(title));
          }
          console.log(chalk.dim("  └───────────────────────────────────────────────────────────────"));
        }
        
        // Show tool calls if any tickers were fetched
        if (prepared.tickersFetched.length > 0) {
          console.log();
          
          // Show data staleness warning if applicable
          const staleData = prepared.tickersFetched.find(t => t.dataQuality?.isStale);
          if (staleData?.dataQuality?.warning) {
            console.log(chalk.yellow(`  ${staleData.dataQuality.warning}`));
          }
          
          console.log(chalk.dim("  ┌─ Yahoo Finance ─────────────────────────────────────────────"));
          for (const t of prepared.tickersFetched) {
            const changeStr = `${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(1)}%`;
            const rsiStr = t.rsi !== undefined ? `RSI ${t.rsi.toFixed(0)}` : '';
            const maStr = t.aboveMA200 !== undefined 
              ? (t.aboveMA200 ? chalk.green('↑MA200') : chalk.red('↓MA200'))
              : '';
            // Add trend strength indicator
            const trendStr = t.trendStrength 
              ? (t.trendStrength === 'STRONG' ? chalk.green(`📈${t.adx?.toFixed(0)}`) 
                : t.trendStrength === 'MODERATE' ? chalk.yellow(`→${t.adx?.toFixed(0)}`)
                : chalk.dim(`↔${t.adx?.toFixed(0)}`))
              : '';
            console.log(chalk.dim(`  │ `) + chalk.white(t.ticker) + chalk.dim(` $${t.price.toFixed(2)} ${changeStr} ${rsiStr} `) + maStr + ' ' + trendStr);
            
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
                const mcapStr = t.marketCap >= 1e12 ? `${(t.marketCap / 1e12).toFixed(1)}T`
                  : t.marketCap >= 1e9 ? `${(t.marketCap / 1e9).toFixed(0)}B`
                  : `${(t.marketCap / 1e6).toFixed(0)}M`;
                fundParts.push(`MCap $${mcapStr}`);
              }
              if (t.peRatio !== undefined) fundParts.push(`P/E ${t.peRatio.toFixed(1)}`);
              if (t.beta !== undefined) fundParts.push(`β${t.beta.toFixed(1)}`);
              if (fundParts.length > 0) {
                console.log(chalk.dim(`  │   ${fundParts.join(' · ')}`));
              }
            }
            
            // Show earnings info (always show when available)
            if (t.earningsDays !== null && t.earningsDays !== undefined && t.earningsDays > 0) {
              if (t.earningsWarning) {
                console.log(chalk.dim(`  │   `) + chalk.red(`⚠️ EARNINGS ${t.earningsDays}d - AVOID (within 14d)`));
              } else if (t.earningsDays <= 30) {
                console.log(chalk.dim(`  │   `) + chalk.yellow(`📅 Earnings: ${t.earningsDays} days`));
              } else {
                console.log(chalk.dim(`  │   `) + chalk.green(`📅 Earnings: ${t.earningsDays}d (safe)`));
              }
            } else {
              console.log(chalk.dim(`  │   📅 Earnings: Not available`));
            }
            
            // Show IV analysis
            if (t.iv) {
              const ivColor = t.iv.ivLevel === 'LOW' ? chalk.green
                : t.iv.ivLevel === 'NORMAL' ? chalk.white
                : t.iv.ivLevel === 'ELEVATED' ? chalk.yellow
                : chalk.red;
              console.log(chalk.dim(`  │   `) + ivColor(`IV: ${t.iv.currentIV}% (${t.iv.ivLevel})`) + chalk.dim(` · ${t.iv.ivPercentile}th percentile`));
            }
            
            // Show support/resistance
            if (t.supportResistance) {
              const parts = [];
              if (t.supportResistance.nearestSupport) {
                parts.push(chalk.green(`S: $${t.supportResistance.nearestSupport.price.toFixed(0)}`));
              }
              if (t.supportResistance.nearestResistance) {
                parts.push(chalk.red(`R: $${t.supportResistance.nearestResistance.price.toFixed(0)}`));
              }
              if (parts.length > 0) {
                console.log(chalk.dim(`  │   `) + parts.join(chalk.dim(' · ')));
              }
            }
            
            // Show options spread if available
            if (t.spread) {
              const debitDollars = (t.spread.estimatedDebit * 100).toFixed(0);
              console.log(chalk.dim(`  │   `) + chalk.cyan(`📈 $${t.spread.longStrike}/$${t.spread.shortStrike} · $${debitDollars} debit · ${t.spread.cushion.toFixed(1)}% cushion`));
              
              // Only show alternatives if there's a specific reason (e.g., budget constraint)
              if (t.spreadReason) {
                console.log(chalk.dim(`  │   `) + chalk.yellow(`⚠️ ${t.spreadReason}`));
                if (t.spreadAlternatives && t.spreadAlternatives.length > 0) {
                  console.log(chalk.dim(`  │   `) + chalk.dim(`Alternatives:`));
                  for (const alt of t.spreadAlternatives.slice(0, 2)) {
                    const altDebit = (alt.estimatedDebit * 100).toFixed(0);
                    console.log(chalk.dim(`  │      • $${alt.longStrike}/$${alt.shortStrike} ($${alt.spreadWidth}w) · $${altDebit} · ${alt.cushion.toFixed(1)}% cushion`));
                  }
                }
              }
              
              // Show trade grade if analysis available
              if (t.analysis) {
                const gradeColor = t.analysis.grade.grade.startsWith('A') ? chalk.green
                  : t.analysis.grade.grade.startsWith('B') ? chalk.yellow
                  : t.analysis.grade.grade.startsWith('C') ? chalk.hex('#FFA500')
                  : chalk.red;
                const riskColor = t.analysis.risk.level === 'LOW' ? chalk.green
                  : t.analysis.risk.level === 'MODERATE' ? chalk.yellow
                  : chalk.red;
                console.log(chalk.dim(`  │   `) + gradeColor(`Grade: ${t.analysis.grade.grade}`) + chalk.dim(` · `) + riskColor(`Risk: ${t.analysis.risk.score}/10`) + chalk.dim(` · ${t.analysis.grade.recommendation}`));
              }
            }
            
            // Show recent news headlines
            if (t.news && t.news.length > 0) {
              console.log(chalk.dim(`  │   `) + chalk.magenta(`📰 Recent news:`));
              for (const n of t.news.slice(0, 2)) {
                const title = n.title.length > 50 ? n.title.substring(0, 47) + '...' : n.title;
                console.log(chalk.dim(`  │      • ${title}`));
              }
            }
          }
          console.log(chalk.dim("  └───────────────────────────────────────────────────────────────"));
        }
        
        // Run agent loop with tool calling
        console.log();
        
        // Build messages for agent
        const agentMessages: AgentMessage[] = [
          { role: "system", content: prepared.systemPrompt },
          ...conversationHistory.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: prepared.userPrompt },
        ];
        
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalDuration = 0;
        let finalContent = "";
        let finalThinking = "";
        let modelName = "";
        
        // Status display function
        const showStatus = (msg: string) => {
          process.stdout.write(`\r  ${chalk.yellow('⏳')} ${chalk.dim(msg)}`.padEnd(70) + '\r');
        };
        
        // Agent loop - continues until no tool calls
        // All iterations use non-streaming with tools (thinking disabled for tool compatibility)
        let iteration = 0;
        const maxIterations = 3;  // Reduced from 5 - prevent over-researching
        
        while (iteration < maxIterations) {
          iteration++;
          
          // On final iteration, disable tools to force synthesis
          const isLastIteration = iteration === maxIterations;
          
          let currentThinking = "";
          let currentContent = "";
          const currentToolCalls: ToolCall[] = [];
          
          // FIRST ITERATION: Non-streaming with tools (no thinking - it blocks tool calls)
          if (iteration === 1) {
            showStatus('Victor is analyzing...');
            
            // Use non-streaming call WITH tools (disabled on last iteration to force synthesis)
            const response: AgentResponse = await chatWithTools(
              { mode: options.aiMode, model: options.aiModel },
              agentMessages,
              isLastIteration ? undefined : AVAILABLE_TOOLS,  // Disable tools on last iteration
              false  // Disable thinking (conflicts with tool calling in DeepSeek)
            );
            
            // Clear status
            process.stdout.write('\r'.padEnd(70) + '\r');
            
            // Display content with proper word wrapping
            const cleanedContent = cleanToolTokens(response.content);
            const coloredPrefix = chalk.cyan("  Victor: ");
            const plainPrefix = "  Victor: ";
            const indent = "          ";
            const lines = wrapText(cleanedContent, 65, plainPrefix, indent);
            for (let i = 0; i < lines.length; i++) {
              if (i === 0) {
                // First line: replace plain prefix with chalk-colored one
                console.log(lines[i].replace(plainPrefix, coloredPrefix));
              } else {
                console.log(formatWithStyles(lines[i]));
              }
            }
            
            currentThinking = response.thinking ?? "";
            currentContent = cleanToolTokens(response.content);  // Clean raw tool tokens
            if (response.toolCalls) {
              currentToolCalls.push(...response.toolCalls);
            }
            
            // Store token stats
            totalPromptTokens += response.promptTokens;
            totalCompletionTokens += response.completionTokens;
            totalDuration += response.duration;
            modelName = response.model;
            
          } else {
            // SUBSEQUENT ITERATIONS: Non-streaming for clean output
            // On last iteration, disable tools to force final synthesis
            showStatus(isLastIteration ? 'Victor is synthesizing...' : 'Processing tool results...');
            
            const response: AgentResponse = await chatWithTools(
              { mode: options.aiMode, model: options.aiModel },
              agentMessages,
              isLastIteration ? undefined : AVAILABLE_TOOLS,  // Disable tools on last iteration
              false  // No thinking
            );
            
            // Clear status
            process.stdout.write('\r'.padEnd(70) + '\r');
            
            // Display content with proper word wrapping
            const cleanedContent = cleanToolTokens(response.content);
            const prefix = chalk.cyan("  Victor: ");
            const indent = "          ";
            const lines = wrapText(cleanedContent, 65, "  Victor: ", indent);
            for (let i = 0; i < lines.length; i++) {
              if (i === 0) {
                // First line: replace plain prefix with chalk-colored one
                console.log(lines[i].replace("  Victor: ", prefix));
              } else {
                console.log(formatWithStyles(lines[i]));
              }
            }
            
            currentContent = cleanToolTokens(response.content);  // Clean raw tool tokens
            if (response.toolCalls) {
              currentToolCalls.push(...response.toolCalls);
            }
            
            // Store results
            totalPromptTokens += response.promptTokens;
            totalCompletionTokens += response.completionTokens;
            totalDuration += response.duration;
            modelName = response.model;
          }
          
          finalContent += currentContent;
          finalThinking += currentThinking;
          
          // Add assistant message to conversation
          agentMessages.push({
            role: "assistant",
            content: currentContent,
            thinking: currentThinking,
            tool_calls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
          });
          
          // If no tool calls, we're done
          if (currentToolCalls.length === 0) {
            break;
          }
          
          // Execute tool calls
          console.log();  // New line after content
          console.log();
          console.log(chalk.dim("  ┌─ Tool Calls ────────────────────────────────────────────────"));
          
          for (const toolCall of currentToolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;
            
            // Show tool being called
            console.log(chalk.dim(`  │ `) + chalk.yellow(`🔧 ${toolName}`) + chalk.dim(`: ${JSON.stringify(toolArgs)}`));
            
            // Execute the tool
            const result = await executeToolCall(toolCall, (msg) => {
              console.log(chalk.dim(`  │ `) + chalk.dim(`   ${msg}`));
            });
            
            // Show full result data for transparency
            const resultLines = result.split('\n');
            console.log(chalk.dim(`  │ `) + chalk.green(`   ✓ Got ${resultLines.length} lines of data:`));
            for (const line of resultLines) {
              if (line.trim()) {
                // Truncate very long lines
                const displayLine = line.length > 70 ? line.substring(0, 67) + '...' : line;
                console.log(chalk.dim(`  │      ${displayLine}`));
              }
            }
            
            // Add tool result to messages
            agentMessages.push({
              role: "tool",
              content: result,
              tool_name: toolName,
            });
          }
          
          console.log(chalk.dim("  └───────────────────────────────────────────────────────────────"));
          console.log();
        }
        
        // Ensure we end with a newline
        if (finalContent) {
          console.log();
        }
        
        // Add final response to conversation history
        conversationHistory.push({ role: "assistant", content: finalContent });
        
        // Show token usage and timing
        if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
          console.log();
          console.log(chalk.dim(`  ─ ${modelName} · ${totalPromptTokens}→${totalCompletionTokens} tokens · ${(totalDuration / 1000).toFixed(1)}s`));
        }
        console.log();
        
      } catch (err) {
        process.stdout.write(`\r${" ".repeat(60)}\r`);
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
 * These leak through when model outputs tool calls as text instead of structured calls
 */
function cleanToolTokens(text: string): string {
  // Remove DeepSeek's raw tool call tokens
  return text
    .replace(/<｜tool▁call▁begin｜>/g, '')
    .replace(/<｜tool▁call▁end｜>/g, '')
    .replace(/<｜tool▁calls▁end｜>/g, '')
    .replace(/<｜tool▁sep｜>/g, '')
    .replace(/\{"query":[^}]+\}/g, '')  // Remove orphaned JSON queries
    .replace(/[ \t]+/g, ' ')  // Collapse multiple spaces (but not newlines)
    .trim();
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
    const skipWords = ['RSI', 'ITM', 'OTM', 'ATM', 'DTE', 'MA', 'THE', 'AND', 
      'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'HAS', 'HAD', 'WAS', 'ALL',
      'ENTER', 'WAIT', 'PASS', 'BUY', 'SELL', 'CALL', 'PUT', 'WHY', 'MAX',
      'ABOVE', 'BELOW'];
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
  firstPrefix: string = "", 
  contIndent: string = ""
): string[] {
  const paragraphs = text.split(/\n/);
  const allLines: string[] = [];
  let isFirstLine = true;
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push('');
      continue;
    }
    
    const words = paragraph.split(/\s+/).filter(w => w.length > 0);
    let currentLine = isFirstLine ? firstPrefix : contIndent;
    
    for (const word of words) {
      const prefix = isFirstLine ? firstPrefix : contIndent;
      const maxLineLen = maxWidth + prefix.length;
      const testLength = currentLine.length + 1 + word.length;
      
      if (testLength <= maxLineLen) {
        // Word fits on current line
        const separator = (currentLine === prefix) ? '' : ' ';
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

