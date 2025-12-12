/**
 * Analyze Command
 * Main ticker analysis with history, fair value, and strategy recommendation
 */

import chalk from "chalk";
import YahooFinance from "yahoo-finance2";
import { RSI, SMA } from "technicalindicators";

// Instantiate yahoo-finance2 (required in v3+)
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "rippiReport"],
});
import { getTickerHistory, formatHistoryForDisplay, getWinRateInsight } from "../context/history.ts";
import { buildTickerTOONContext, toonToString, getPrimaryPattern } from "../context/toon.ts";
import { calculateFairValue, formatFairValueForDisplay, type ValuationInputs } from "../engine/fair-value.ts";
import { selectStrategy, formatStrategyForDisplay, getStrategyEmoji } from "../engine/strategy.ts";
import { generateCompletion, validateAIRequirement, type OllamaMode } from "../services/ollama.ts";
import { getTradesByTicker } from "../services/supabase.ts";
import type { MarketRegime, TickerHistory, FairValueResult, StrategyRecommendation } from "../types/index.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ACCOUNT_SIZE = 1500;

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzeOptions {
  aiMode: OllamaMode;
  aiModel?: string;
  position?: string;
  noChart?: boolean;
  accountSize?: number;
}

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  sector: string;
  // Valuation
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  trailingEps?: number;
  forwardEps?: number;
  // Cash flow
  freeCashFlow?: number;
  sharesOutstanding?: number;
  // Growth
  earningsGrowth?: number;
  revenueGrowth?: number;
  // Analyst
  targetPrice?: number;
  numberOfAnalysts?: number;
  recommendationMean?: number;
  // Technical
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  ma50?: number;
  ma200?: number;
}

interface TechnicalData {
  rsi: number;
  ma20: number;
  ma50: number;
  ma200: number;
  aboveMA200: boolean;
  score: number;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchStockData(ticker: string): Promise<StockData | null> {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    // Get additional data
    let insights: Awaited<ReturnType<typeof yahooFinance.quoteSummary>> | null = null;
    try {
      insights = await yahooFinance.quoteSummary(ticker, {
        modules: [
          "financialData", 
          "defaultKeyStatistics", 
          "earningsHistory",
        ],
      });
    } catch {
      // Insights optional
    }

    const fd = insights?.financialData;
    const ks = insights?.defaultKeyStatistics;

    return {
      ticker: quote.symbol ?? ticker,
      name: quote.shortName ?? quote.longName ?? ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume: quote.averageDailyVolume10Day ?? 0,
      marketCap: quote.marketCap ?? 0,
      sector: quote.sector ?? "Unknown",
      trailingPE: quote.trailingPE,
      forwardPE: quote.forwardPE,
      pegRatio: ks?.pegRatio,
      trailingEps: quote.epsTrailingTwelveMonths,
      forwardEps: quote.epsForward,
      freeCashFlow: fd?.freeCashflow,
      sharesOutstanding: ks?.sharesOutstanding,
      earningsGrowth: fd?.earningsGrowth,
      revenueGrowth: fd?.revenueGrowth,
      targetPrice: fd?.targetMeanPrice,
      numberOfAnalysts: fd?.numberOfAnalystOpinions,
      recommendationMean: fd?.recommendationMean,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      ma50: quote.fiftyDayAverage,
      ma200: quote.twoHundredDayAverage,
    };
  } catch (err) {
    console.error("Error fetching stock data:", err);
    return null;
  }
}

async function fetchTechnicalData(ticker: string): Promise<TechnicalData | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 250);

    const history = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!history.quotes || history.quotes.length < 50) {
      return null;
    }

    const closes = history.quotes
      .map(q => q.close)
      .filter((c): c is number => c !== null && c !== undefined);

    if (closes.length < 50) {
      return null;
    }

    // Calculate indicators
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiValues[rsiValues.length - 1] ?? 50;

    const ma20Values = SMA.calculate({ values: closes, period: 20 });
    const ma50Values = SMA.calculate({ values: closes, period: 50 });
    const ma200Values = SMA.calculate({ values: closes, period: 200 });

    const ma20 = ma20Values[ma20Values.length - 1] ?? closes[closes.length - 1];
    const ma50 = ma50Values[ma50Values.length - 1] ?? closes[closes.length - 1];
    const ma200 = ma200Values[ma200Values.length - 1] ?? closes[closes.length - 1];

    const currentPrice = closes[closes.length - 1];
    const aboveMA200 = currentPrice > ma200;

    // Simple score calculation
    let score = 50;
    if (rsi < 40) score += 10;
    if (rsi > 70) score -= 10;
    if (aboveMA200) score += 15;
    if (currentPrice > ma50) score += 10;
    if (currentPrice > ma20) score += 5;

    return {
      rsi,
      ma20,
      ma50,
      ma200,
      aboveMA200,
      score: Math.max(0, Math.min(100, score)),
    };
  } catch (err) {
    console.error("Error fetching technical data:", err);
    return null;
  }
}

// ============================================================================
// MARKET REGIME
// ============================================================================

async function getMarketRegime(): Promise<{ regime: MarketRegime; spyPrice: number }> {
  try {
    const spy = await yahooFinance.quote("SPY");
    const spyPrice = spy?.regularMarketPrice ?? 0;
    
    // Simple regime detection based on SPY vs MA
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

// ============================================================================
// AI ANALYSIS
// ============================================================================

async function generateAIAnalysis(
  config: { mode: OllamaMode; model?: string },
  stock: StockData,
  technical: TechnicalData | null,
  history: TickerHistory | null,
  fairValue: FairValueResult,
  strategy: StrategyRecommendation,
  marketRegime: MarketRegime,
  accountSize: number
): Promise<string> {
  // Build TOON context if we have history
  let toonContext = "";
  if (history && history.totalTrades > 0) {
    const trades = await getTradesByTicker(stock.ticker);
    const pattern = getPrimaryPattern(trades);
    const context = buildTickerTOONContext(
      stock.ticker,
      trades,
      accountSize,
      marketRegime,
      pattern
    );
    toonContext = toonToString(context);
  }

  const systemPrompt = `You are an AI analyst for a small hedge fund ($${accountSize} account).
Your job is to provide concise, actionable analysis for options trading.
Focus on: entry timing, risk assessment, and personalized insights based on trade history.
Be direct and specific. Avoid generic advice.
If the user has trade history, reference their patterns and past performance.`;

  const userPrompt = `Analyze ${stock.ticker} (${stock.name}) for entry:

Current Price: $${stock.price.toFixed(2)}
Market Regime: ${marketRegime}
RSI: ${technical?.rsi?.toFixed(0) ?? "N/A"}
Above MA200: ${technical?.aboveMA200 ? "Yes" : "No"}
Score: ${technical?.score ?? "N/A"}/100

Fair Value: ${fairValue.verdict} (${fairValue.marginOfSafety.toFixed(0)}% margin)
Strategy: ${strategy.name}
${strategy.spread ? `Spread: $${strategy.spread.longStrike}/$${strategy.spread.shortStrike} (${strategy.spread.cushionPct.toFixed(1)}% cushion)` : ""}

${history && history.totalTrades > 0 ? `
Trade History (TOON): ${toonContext}
Win Rate: ${history.winRate.toFixed(0)}%
Total P&L: $${history.totalPnl.toFixed(0)}
Patterns: ${history.patterns.join("; ") || "None detected"}
` : "No prior trade history with this ticker."}

Provide a 2-3 sentence analysis covering:
1. Whether to enter now, wait, or pass (and why)
2. Key risk to watch
3. ${history && history.totalTrades > 0 ? "How this fits your trading patterns" : "Position sizing suggestion"}`;

  try {
    const response = await generateCompletion(config, systemPrompt, userPrompt);
    return response.content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `AI analysis unavailable: ${msg}`;
  }
}

// ============================================================================
// DISPLAY
// ============================================================================

function printDivider(char = "─"): void {
  console.log(chalk.gray(char.repeat(72)));
}

function printSubDivider(): void {
  console.log(chalk.gray("  " + "─".repeat(68)));
}

function displayHeader(stock: StockData, technical: TechnicalData | null): void {
  printDivider("═");
  console.log();
  console.log(`  ${chalk.bold.cyan(stock.ticker)}  ${chalk.gray(stock.name)}`);
  
  const changeColor = stock.change >= 0 ? chalk.green : chalk.red;
  const changeSign = stock.change >= 0 ? "+" : "";
  const scoreDisplay = technical?.score 
    ? (technical.score >= 70 ? chalk.green(`${technical.score}/100 ★★`) : 
       technical.score >= 50 ? chalk.yellow(`${technical.score}/100 ★`) :
       chalk.gray(`${technical.score}/100`))
    : chalk.gray("—");
  
  console.log(
    `  ${chalk.white("$" + stock.price.toFixed(2))}  ` +
    changeColor(`${changeSign}${stock.changePct.toFixed(1)}%`) + "  " +
    `Score: ${scoreDisplay}`
  );
  console.log();
  printDivider("═");
}

function displayHistory(history: TickerHistory): void {
  console.log();
  console.log(chalk.bold.magenta("  📜 YOUR HISTORY WITH " + history.ticker));
  printSubDivider();
  console.log();
  
  const lines = formatHistoryForDisplay(history);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function displayFairValue(fairValue: FairValueResult): void {
  console.log();
  console.log(chalk.bold.yellow("  💰 FAIR VALUE ANALYSIS"));
  printSubDivider();
  console.log();
  
  const lines = formatFairValueForDisplay(fairValue);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function displayStrategy(
  primary: StrategyRecommendation,
  alternatives: StrategyRecommendation[]
): void {
  console.log();
  console.log(chalk.bold.green("  🎯 STRATEGY RECOMMENDATION"));
  printSubDivider();
  console.log();
  
  // Primary recommendation
  const emoji = getStrategyEmoji(primary.type);
  console.log(`  ${emoji} ${chalk.bold("RECOMMENDED:")} ${primary.name}`);
  
  const lines = formatStrategyForDisplay(primary);
  for (const line of lines.slice(1)) {  // Skip first line (already shown)
    console.log(line);
  }
  console.log();
  
  // Alternatives
  if (alternatives.length > 0) {
    console.log(chalk.gray("  Alternatives:"));
    for (const alt of alternatives) {
      const altEmoji = getStrategyEmoji(alt.type);
      console.log(
        `  ${altEmoji} ${chalk.gray(alt.name)} ` +
        chalk.gray(`(${alt.confidence}% confidence)`)
      );
    }
    console.log();
  }
}

function displayAIAnalysis(analysis: string, model: string, mode: string): void {
  console.log();
  console.log(chalk.bold.blue("  🤖 AI ANALYSIS"));
  printSubDivider();
  console.log();
  
  // Word wrap the analysis
  const words = analysis.split(/\s+/);
  let currentLine = "  ";
  const maxWidth = 68;
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      console.log(currentLine);
      currentLine = "  " + word;
    } else {
      currentLine += (currentLine === "  " ? "" : " ") + word;
    }
  }
  if (currentLine.trim()) {
    console.log(currentLine);
  }
  
  console.log();
  console.log(chalk.gray(`  ─ Generated by ${model.split(":")[0]} (${mode})`));
  console.log();
}

function displayEntryDecision(
  stock: StockData,
  technical: TechnicalData | null,
  strategy: StrategyRecommendation,
  history: TickerHistory | null,
  fairValue: FairValueResult,
  marketRegime: MarketRegime
): void {
  console.log();
  console.log(chalk.bold.white("  🎯 ENTRY DECISION"));
  printSubDivider();
  console.log();
  
  // Determine action
  let action: "ENTER" | "WAIT" | "PASS" | "ENTER_WITH_CAUTION";
  const reasons: string[] = [];
  
  // Base conditions
  const aboveMA200 = technical?.aboveMA200 ?? false;
  const rsiOK = (technical?.rsi ?? 50) < 65;
  const scoreOK = (technical?.score ?? 50) >= 55;
  const valueOK = fairValue.verdict !== "overvalued";
  const strategyOK = strategy.confidence >= 50;
  
  if (!aboveMA200) {
    action = "WAIT";
    reasons.push("Below MA200 - wait for trend confirmation");
  } else if (!rsiOK) {
    action = "WAIT";
    reasons.push(`RSI elevated (${technical?.rsi?.toFixed(0)}) - wait for pullback`);
  } else if (!valueOK) {
    action = "PASS";
    reasons.push("Stock appears overvalued");
  } else if (!strategyOK) {
    action = "PASS";
    reasons.push("No favorable strategy available");
  } else if (scoreOK && strategyOK && aboveMA200) {
    // Check history patterns
    if (history && history.patterns.some(p => p.includes("RSI"))) {
      const rsiPattern = history.patterns.find(p => p.includes("RSI"));
      if (rsiPattern && (technical?.rsi ?? 50) > 55) {
        action = "ENTER_WITH_CAUTION";
        reasons.push(`Your pattern: ${rsiPattern}`);
      } else {
        action = "ENTER";
        reasons.push("Conditions favorable");
      }
    } else {
      action = "ENTER";
      reasons.push("Technical and fundamental conditions favorable");
    }
  } else {
    action = "WAIT";
    reasons.push("Mixed signals - wait for clarity");
  }
  
  // Display action
  const actionColor = action === "ENTER" ? chalk.green :
                      action === "ENTER_WITH_CAUTION" ? chalk.yellow :
                      action === "WAIT" ? chalk.yellow :
                      chalk.red;
  const actionEmoji = action === "ENTER" ? "✅" :
                      action === "ENTER_WITH_CAUTION" ? "⚠️" :
                      action === "WAIT" ? "⏳" :
                      "❌";
  
  console.log(`  ${actionEmoji} ${chalk.bold("ACTION:")} ${actionColor(action.replace("_", " "))}`);
  console.log();
  
  // Reasons
  for (const reason of reasons) {
    console.log(chalk.gray(`  • ${reason}`));
  }
  console.log();
  
  // Confidence and sizing
  console.log(chalk.gray(`  Confidence: ${strategy.confidence}/100`));
  console.log(chalk.gray(`  Position Size: ${strategy.positionSize.toFixed(0)}% of account ($${strategy.riskAmount.toFixed(0)} risk)`));
  console.log();
}

// ============================================================================
// MAIN ANALYZE FUNCTION
// ============================================================================

export async function analyzeCommand(
  ticker: string,
  options: AnalyzeOptions
): Promise<void> {
  const symbol = ticker.toUpperCase();
  const accountSize = options.accountSize ?? DEFAULT_ACCOUNT_SIZE;
  
  console.log();
  console.log(chalk.gray(`  Analyzing ${chalk.bold(symbol)}...`));
  console.log(chalk.gray(`  AI mode: ${options.aiMode}${options.aiModel ? ` (${options.aiModel})` : ""}`));
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

  // Fetch all data in parallel
  const [stockData, technicalData, marketData, trades] = await Promise.all([
    fetchStockData(symbol),
    fetchTechnicalData(symbol),
    getMarketRegime(),
    getTradesByTicker(symbol),
  ]);

  if (!stockData) {
    console.log(chalk.red(`  ✗ Failed to fetch data for ${symbol}`));
    process.exit(1);
  }

  // Build history if we have trades
  let history: TickerHistory | null = null;
  if (trades.length > 0) {
    const { buildTickerHistory } = await import("../context/toon.ts");
    history = buildTickerHistory(symbol, trades);
  }

  // Calculate fair value
  const valuationInputs: ValuationInputs = {
    ticker: symbol,
    currentPrice: stockData.price,
    sector: stockData.sector,
    trailingEps: stockData.trailingEps,
    forwardEps: stockData.forwardEps,
    trailingPE: stockData.trailingPE,
    forwardPE: stockData.forwardPE,
    pegRatio: stockData.pegRatio,
    freeCashFlow: stockData.freeCashFlow,
    sharesOutstanding: stockData.sharesOutstanding,
    earningsGrowth: stockData.earningsGrowth,
    revenueGrowth: stockData.revenueGrowth,
    targetPrice: stockData.targetPrice,
  };
  const fairValue = calculateFairValue(valuationInputs);

  // Select strategy
  const { primary: strategy, alternatives } = selectStrategy({
    ticker: symbol,
    currentPrice: stockData.price,
    accountSize,
    marketRegime: marketData.regime,
    score: technicalData?.score,
    rsiValue: technicalData?.rsi,
    aboveMA200: technicalData?.aboveMA200,
    fairValue,
    history: history ?? undefined,
    hasOptions: true, // Assume options available
  });

  // Generate AI analysis
  console.log(chalk.gray("  Generating AI insights..."));
  const aiAnalysis = await generateAIAnalysis(
    { mode: options.aiMode, model: options.aiModel },
    stockData,
    technicalData,
    history,
    fairValue,
    strategy,
    marketData.regime,
    accountSize
  );

  // Display results
  displayHeader(stockData, technicalData);

  if (history && history.totalTrades > 0) {
    displayHistory(history);
  }

  displayFairValue(fairValue);
  displayStrategy(strategy, alternatives);
  displayAIAnalysis(
    aiAnalysis, 
    options.aiModel ?? "deepseek-v3.1",
    options.aiMode
  );
  displayEntryDecision(
    stockData,
    technicalData,
    strategy,
    history,
    fairValue,
    marketData.regime
  );

  printDivider("═");
  console.log();
}

