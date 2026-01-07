/**
 * Short-Term Trade Scanner
 * Identifies high-probability 1-3 day entry points on SPY/QQQ
 *
 * Strategy: Low-to-medium risk weekly debit spreads
 * - Entry on oversold conditions (RSI < 35)
 * - Support level bounces (20-day low, VWAP)
 * - 5-10 DTE debit spreads for defined risk
 * - 30-50% profit target, 40% stop loss
 */

import chalk from 'chalk';
import YahooFinance from 'yahoo-finance2';
import { RSI, SMA, EMA } from 'technicalindicators';
import { generateCompletion, type OllamaMode } from '../services/ollama.ts';

// Instantiate yahoo-finance2
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

// ============================================================================
// CONSTANTS
// ============================================================================

const INDEX_TICKERS = ['SPY', 'QQQ'] as const;
type IndexTicker = (typeof INDEX_TICKERS)[number];

// Entry thresholds (conservative for low capital)
const ENTRY_THRESHOLDS = {
  rsiOversold: 35, // RSI below this = oversold bounce candidate
  rsiOverbought: 70, // RSI above this = avoid longs
  vwapDeviation: -1.5, // % below VWAP for bounce
  vixElevated: 18, // VIX above this = higher premium
  vixExtreme: 25, // VIX above this = caution
  supportProximity: 1, // Within 1% of support = good entry
};

// Position management
const POSITION_RULES = {
  profitTarget: 0.35, // Take profit at 35%
  stopLoss: 0.4, // Cut loss at 40%
  maxRiskPct: 0.15, // Max 15% of account per trade
  targetDTE: { min: 5, max: 10 }, // Weekly options
};

// ============================================================================
// TYPES
// ============================================================================

export interface ShortTermOptions {
  aiMode: OllamaMode;
  aiModel?: string;
  accountSize: number;
  verbose?: boolean;
}

interface IndexData {
  ticker: IndexTicker;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  ma20: number;
  ma50: number;
  ma200: number;
}

interface TechnicalSignals {
  rsi: number;
  rsiSignal: 'oversold' | 'neutral' | 'overbought';
  vwap: number;
  vwapDeviation: number; // % above/below VWAP
  ema9: number;
  sma20: number;
  supportLevel: number;
  resistanceLevel: number;
  distanceToSupport: number; // %
  trend: 'bullish' | 'neutral' | 'bearish';
}

interface VIXData {
  value: number;
  level: 'low' | 'normal' | 'elevated' | 'extreme';
  implication: string;
}

interface EntrySignal {
  ticker: IndexTicker;
  signal: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'AVOID';
  confidence: number; // 0-100
  reasons: string[];
  warnings: string[];
  suggestedSpread?: {
    type: 'call_debit' | 'put_debit';
    direction: 'bullish' | 'bearish';
    longStrike: number;
    shortStrike: number;
    estimatedCost: number;
    maxProfit: number;
    targetExit: number;
    stopExit: number;
    dte: string;
  };
}

interface ShortTermAnalysis {
  timestamp: Date;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  vix: VIXData;
  spy: {
    data: IndexData;
    technicals: TechnicalSignals;
    signal: EntrySignal;
  };
  qqq: {
    data: IndexData;
    technicals: TechnicalSignals;
    signal: EntrySignal;
  };
  recommendation: string;
  aiInsight?: string;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchIndexData(ticker: IndexTicker): Promise<IndexData | null> {
  try {
    const quote = await yahooFinance.quote(ticker);

    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    return {
      ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume: quote.averageDailyVolume10Day ?? 0,
      dayHigh: quote.regularMarketDayHigh ?? quote.regularMarketPrice,
      dayLow: quote.regularMarketDayLow ?? quote.regularMarketPrice,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
      ma20: quote.fiftyDayAverage ?? quote.regularMarketPrice,
      ma50: quote.fiftyDayAverage ?? quote.regularMarketPrice,
      ma200: quote.twoHundredDayAverage ?? quote.regularMarketPrice,
    };
  } catch (err) {
    console.error(`Error fetching ${ticker}:`, err);
    return null;
  }
}

async function fetchTechnicals(
  ticker: IndexTicker
): Promise<TechnicalSignals | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    const history = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!history.quotes || history.quotes.length < 20) {
      return null;
    }

    const quotes = history.quotes.filter(
      (q) =>
        q.close !== null &&
        q.high !== null &&
        q.low !== null &&
        q.volume !== null
    );

    const closes = quotes.map((q) => q.close as number);
    const highs = quotes.map((q) => q.high as number);
    const lows = quotes.map((q) => q.low as number);
    const volumes = quotes.map((q) => q.volume as number);

    // Calculate RSI
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiValues[rsiValues.length - 1] ?? 50;

    // Calculate EMAs and SMAs
    const ema9Values = EMA.calculate({ values: closes, period: 9 });
    const sma20Values = SMA.calculate({ values: closes, period: 20 });

    const ema9 = ema9Values[ema9Values.length - 1] ?? closes[closes.length - 1];
    const sma20 =
      sma20Values[sma20Values.length - 1] ?? closes[closes.length - 1];

    // Calculate VWAP (simplified - daily average)
    const currentPrice = closes[closes.length - 1];
    const typicalPrices = quotes.map(
      (q, i) =>
        ((q.high as number) + (q.low as number) + (q.close as number)) / 3
    );
    const vwapValues = typicalPrices.slice(-5); // 5-day VWAP approximation
    const vwap = vwapValues.reduce((a, b) => a + b, 0) / vwapValues.length;
    const vwapDeviation = ((currentPrice - vwap) / vwap) * 100;

    // Support/Resistance (20-day low/high)
    const recent20Lows = lows.slice(-20);
    const recent20Highs = highs.slice(-20);
    const supportLevel = Math.min(...recent20Lows);
    const resistanceLevel = Math.max(...recent20Highs);
    const distanceToSupport =
      ((currentPrice - supportLevel) / supportLevel) * 100;

    // Trend determination
    let trend: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    if (currentPrice > ema9 && ema9 > sma20) {
      trend = 'bullish';
    } else if (currentPrice < ema9 && ema9 < sma20) {
      trend = 'bearish';
    }

    // RSI signal
    let rsiSignal: 'oversold' | 'neutral' | 'overbought' = 'neutral';
    if (rsi < ENTRY_THRESHOLDS.rsiOversold) {
      rsiSignal = 'oversold';
    } else if (rsi > ENTRY_THRESHOLDS.rsiOverbought) {
      rsiSignal = 'overbought';
    }

    return {
      rsi,
      rsiSignal,
      vwap,
      vwapDeviation,
      ema9,
      sma20,
      supportLevel,
      resistanceLevel,
      distanceToSupport,
      trend,
    };
  } catch (err) {
    console.error(`Error fetching technicals for ${ticker}:`, err);
    return null;
  }
}

async function fetchVIX(): Promise<VIXData> {
  try {
    const quote = await yahooFinance.quote('^VIX');
    const value = quote?.regularMarketPrice ?? 15;

    let level: VIXData['level'] = 'normal';
    let implication = 'Normal market conditions';

    if (value < 15) {
      level = 'low';
      implication = 'Low volatility - smaller moves expected';
    } else if (value >= ENTRY_THRESHOLDS.vixExtreme) {
      level = 'extreme';
      implication = '⚠️ High fear - larger swings, wider spreads';
    } else if (value >= ENTRY_THRESHOLDS.vixElevated) {
      level = 'elevated';
      implication = 'Elevated volatility - better premium but more risk';
    }

    return { value, level, implication };
  } catch {
    return {
      value: 15,
      level: 'normal',
      implication: 'VIX data unavailable',
    };
  }
}

function getMarketStatus(): ShortTermAnalysis['marketStatus'] {
  const now = new Date();
  const nyHour = parseInt(
    now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    })
  );
  const nyMinute = parseInt(
    now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      minute: 'numeric',
    })
  );
  const day = now.getDay();

  // Weekend
  if (day === 0 || day === 6) return 'closed';

  const timeInMinutes = nyHour * 60 + nyMinute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  const preMarket = 4 * 60; // 4:00 AM
  const afterHours = 20 * 60; // 8:00 PM

  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return 'open';
  } else if (timeInMinutes >= preMarket && timeInMinutes < marketOpen) {
    return 'pre';
  } else if (timeInMinutes >= marketClose && timeInMinutes < afterHours) {
    return 'post';
  }

  return 'closed';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the next Friday expiration date (weekly options)
 */
function getNextFridayExpiration(): {
  date: Date;
  formatted: string;
  dte: number;
} {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Calculate days until next Friday (5 = Friday)
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

  // If today is Friday, use next Friday
  if (daysUntilFriday === 0) {
    daysUntilFriday = 7;
  }

  // If Friday is less than 3 days away, use the following Friday
  if (daysUntilFriday < 3) {
    daysUntilFriday += 7;
  }

  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);

  const formatted = friday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return { date: friday, formatted, dte: daysUntilFriday };
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

function generateEntrySignal(
  ticker: IndexTicker,
  data: IndexData,
  technicals: TechnicalSignals,
  vix: VIXData,
  accountSize: number
): EntrySignal {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50; // Base score

  // 1. RSI Analysis (most important for mean reversion)
  if (technicals.rsiSignal === 'oversold') {
    score += 25;
    reasons.push(
      `RSI oversold at ${technicals.rsi.toFixed(0)} - bounce likely`
    );
  } else if (technicals.rsiSignal === 'overbought') {
    score -= 20;
    warnings.push(
      `RSI overbought at ${technicals.rsi.toFixed(0)} - risky entry`
    );
  }

  // 2. VWAP Deviation (mean reversion signal)
  if (technicals.vwapDeviation < ENTRY_THRESHOLDS.vwapDeviation) {
    score += 15;
    reasons.push(
      `${Math.abs(technicals.vwapDeviation).toFixed(1)}% below VWAP - ` +
        `mean reversion setup`
    );
  } else if (
    technicals.vwapDeviation > Math.abs(ENTRY_THRESHOLDS.vwapDeviation)
  ) {
    score -= 10;
    warnings.push(
      `${technicals.vwapDeviation.toFixed(1)}% above VWAP - extended`
    );
  }

  // 3. Support Level Proximity
  if (technicals.distanceToSupport < ENTRY_THRESHOLDS.supportProximity) {
    score += 15;
    reasons.push(
      `Near 20-day support ($${technicals.supportLevel.toFixed(2)})`
    );
  }

  // 4. Trend Alignment
  if (technicals.trend === 'bullish') {
    score += 10;
    reasons.push('Trend bullish (price > EMA9 > SMA20)');
  } else if (technicals.trend === 'bearish') {
    score -= 5;
    warnings.push('Short-term trend bearish');
  }

  // 5. VIX Consideration
  if (vix.level === 'extreme') {
    score -= 15;
    warnings.push(`VIX extreme (${vix.value.toFixed(1)}) - high risk`);
  } else if (vix.level === 'elevated') {
    score += 5; // Better premium opportunity
    reasons.push(`VIX elevated - good premium on spreads`);
  }

  // 6. MA200 Safety Check (long-term trend)
  if (data.price > data.ma200) {
    score += 10;
    reasons.push('Above 200-day MA - long-term uptrend intact');
  } else {
    score -= 10;
    warnings.push('Below 200-day MA - caution on longs');
  }

  // Determine signal level
  let signal: EntrySignal['signal'];
  if (score >= 80) {
    signal = 'STRONG_BUY';
  } else if (score >= 65) {
    signal = 'BUY';
  } else if (score >= 45) {
    signal = 'WAIT';
  } else {
    signal = 'AVOID';
  }

  // Generate spread suggestion if signal is favorable
  let suggestedSpread: EntrySignal['suggestedSpread'];
  if (signal === 'STRONG_BUY' || signal === 'BUY') {
    const maxRisk = accountSize * POSITION_RULES.maxRiskPct;
    const currentPrice = data.price;

    // Choose spread width based on account size
    // $5 wide = ~$350 cost, $3 wide = ~$210 cost, $2 wide = ~$140 cost
    let spreadWidth = 5;
    if (maxRisk < 350) spreadWidth = 3;
    if (maxRisk < 210) spreadWidth = 2;
    if (maxRisk < 140) spreadWidth = 1;

    // ITM long strike, ATM/OTM short strike
    const longStrike =
      Math.floor(currentPrice / spreadWidth) * spreadWidth - spreadWidth;
    const shortStrike = longStrike + spreadWidth;

    // Estimate cost (typically 60-75% of spread width for ITM)
    const estimatedCost = spreadWidth * 0.7 * 100; // Per contract
    const maxProfit = spreadWidth * 100 - estimatedCost;
    const contracts = Math.floor(maxRisk / estimatedCost);

    // Target exit prices
    const targetExit = estimatedCost * (1 + POSITION_RULES.profitTarget);
    const stopExit = estimatedCost * (1 - POSITION_RULES.stopLoss);

    // Get next Friday expiration
    const nextFriday = getNextFridayExpiration();

    if (contracts >= 1) {
      suggestedSpread = {
        type: 'call_debit',
        direction: 'bullish',
        longStrike,
        shortStrike,
        estimatedCost: estimatedCost * contracts,
        maxProfit: maxProfit * contracts,
        targetExit: targetExit * contracts,
        stopExit: stopExit * contracts,
        dte: `${nextFriday.formatted} expiration (${nextFriday.dte} DTE)`,
      };
    }
  }

  return {
    ticker,
    signal,
    confidence: Math.max(0, Math.min(100, score)),
    reasons,
    warnings,
    suggestedSpread,
  };
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

async function generateAIInsight(
  config: { mode: OllamaMode; model?: string },
  analysis: Omit<ShortTermAnalysis, 'aiInsight'>
): Promise<string> {
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const nextFriday = getNextFridayExpiration();

  const systemPrompt = `You are an expert short-term options trader 
specializing in SPY/QQQ swing trades. Your client has limited capital 
and cannot afford big losses. Focus on high-probability setups only.

Today is ${currentDate}.
The next weekly options expiration is Friday ${nextFriday.formatted} (${nextFriday.dte} DTE).

Be concise (100-150 words max). Lead with your recommendation.
When suggesting trades, use the ${nextFriday.formatted} expiration date.`;

  const spySignal = analysis.spy.signal;
  const qqqSignal = analysis.qqq.signal;

  const userPrompt = `Short-term trade scan results:

TODAY: ${currentDate}
NEXT EXPIRATION: Friday ${nextFriday.formatted} (${nextFriday.dte} DTE)

MARKET CONDITIONS:
- VIX: ${analysis.vix.value.toFixed(1)} (${analysis.vix.level})
- Market Status: ${analysis.marketStatus}

SPY ($${analysis.spy.data.price.toFixed(2)}):
- Signal: ${spySignal.signal} (${spySignal.confidence}% confidence)
- RSI: ${analysis.spy.technicals.rsi.toFixed(0)}
- VWAP Deviation: ${analysis.spy.technicals.vwapDeviation.toFixed(1)}%
- Trend: ${analysis.spy.technicals.trend}
${spySignal.reasons.map((r) => `✓ ${r}`).join('\n')}
${spySignal.warnings.map((w) => `⚠ ${w}`).join('\n')}

QQQ ($${analysis.qqq.data.price.toFixed(2)}):
- Signal: ${qqqSignal.signal} (${qqqSignal.confidence}% confidence)
- RSI: ${analysis.qqq.technicals.rsi.toFixed(0)}
- VWAP Deviation: ${analysis.qqq.technicals.vwapDeviation.toFixed(1)}%
- Trend: ${analysis.qqq.technicals.trend}
${qqqSignal.reasons.map((r) => `✓ ${r}`).join('\n')}
${qqqSignal.warnings.map((w) => `⚠ ${w}`).join('\n')}

Should we enter a trade today? If yes, which one and why? If no, what 
conditions would make it a go? Use the ${nextFriday.formatted} expiration.`;

  try {
    const response = await generateCompletion(config, systemPrompt, userPrompt);
    return response.content;
  } catch (err) {
    return 'AI analysis unavailable';
  }
}

// ============================================================================
// DISPLAY
// ============================================================================

function printHeader(): void {
  console.log();
  console.log(chalk.bold.cyan('  ⚡ SHORT-TERM TRADE SCANNER'));
  console.log(chalk.gray('  SPY/QQQ 1-3 Day Swing Trades'));
  console.log(chalk.gray('  ' + '═'.repeat(68)));
  console.log();
}

function printMarketStatus(
  status: ShortTermAnalysis['marketStatus'],
  vix: VIXData
): void {
  const statusColors = {
    open: chalk.green('● MARKET OPEN'),
    closed: chalk.red('● MARKET CLOSED'),
    pre: chalk.yellow('● PRE-MARKET'),
    post: chalk.yellow('● AFTER-HOURS'),
  };

  const vixColor =
    vix.level === 'extreme'
      ? chalk.red
      : vix.level === 'elevated'
        ? chalk.yellow
        : chalk.green;

  console.log(
    `  ${statusColors[status]}   ` +
      `VIX: ${vixColor(vix.value.toFixed(1))} (${vix.level})`
  );
  console.log(chalk.gray(`  ${vix.implication}`));
  console.log();
}

function printIndexCard(
  data: IndexData,
  technicals: TechnicalSignals,
  signal: EntrySignal
): void {
  const signalColors = {
    STRONG_BUY: chalk.bold.green,
    BUY: chalk.green,
    WAIT: chalk.yellow,
    AVOID: chalk.red,
  };

  const changeColor = data.changePct >= 0 ? chalk.green : chalk.red;
  const changeSign = data.changePct >= 0 ? '+' : '';

  console.log(chalk.gray('  ' + '─'.repeat(68)));
  console.log(
    `  ${chalk.bold.white(data.ticker)}  ` +
      `${chalk.white('$' + data.price.toFixed(2))}  ` +
      changeColor(`${changeSign}${data.changePct.toFixed(2)}%`)
  );
  console.log();

  // Signal
  console.log(
    `  Signal: ${signalColors[signal.signal](signal.signal)}  ` +
      chalk.gray(`(${signal.confidence}% confidence)`)
  );
  console.log();

  // Technicals
  const rsiColor =
    technicals.rsiSignal === 'oversold'
      ? chalk.green
      : technicals.rsiSignal === 'overbought'
        ? chalk.red
        : chalk.white;
  const trendIcon =
    technicals.trend === 'bullish'
      ? '📈'
      : technicals.trend === 'bearish'
        ? '📉'
        : '➡️';

  console.log(
    `  RSI: ${rsiColor(technicals.rsi.toFixed(0))}  ` +
      `VWAP: ${technicals.vwapDeviation >= 0 ? '+' : ''}` +
      `${technicals.vwapDeviation.toFixed(1)}%  ` +
      `Trend: ${trendIcon}`
  );
  console.log(
    chalk.gray(
      `  Support: $${technicals.supportLevel.toFixed(2)} ` +
        `(${technicals.distanceToSupport.toFixed(1)}% away)  ` +
        `Resistance: $${technicals.resistanceLevel.toFixed(2)}`
    )
  );
  console.log();

  // Reasons
  if (signal.reasons.length > 0) {
    for (const reason of signal.reasons.slice(0, 3)) {
      console.log(chalk.green(`  ✓ ${reason}`));
    }
  }

  // Warnings
  if (signal.warnings.length > 0) {
    for (const warning of signal.warnings.slice(0, 2)) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }
  }

  // Spread suggestion
  if (signal.suggestedSpread) {
    const spread = signal.suggestedSpread;
    console.log();
    console.log(chalk.cyan('  💡 Suggested Trade:'));
    console.log(
      chalk.white(
        `     Buy $${spread.longStrike}C / Sell $${spread.shortStrike}C`
      )
    );
    console.log(
      chalk.gray(
        `     Cost: $${spread.estimatedCost.toFixed(0)} → ` +
          `Target: $${spread.targetExit.toFixed(0)} (+35%) | ` +
          `Stop: $${spread.stopExit.toFixed(0)} (-40%)`
      )
    );
    console.log(chalk.gray(`     ${spread.dte}`));
  }

  console.log();
}

function printRecommendation(analysis: ShortTermAnalysis): void {
  const spySignal = analysis.spy.signal.signal;
  const qqqSignal = analysis.qqq.signal.signal;

  let rec: string;
  let recColor: typeof chalk.green;

  // Determine overall recommendation
  if (spySignal === 'STRONG_BUY' || qqqSignal === 'STRONG_BUY') {
    rec = '🟢 STRONG ENTRY OPPORTUNITY';
    recColor = chalk.bold.green;
  } else if (spySignal === 'BUY' || qqqSignal === 'BUY') {
    rec = '🟡 ENTRY OPPORTUNITY (be selective)';
    recColor = chalk.yellow;
  } else if (spySignal === 'AVOID' && qqqSignal === 'AVOID') {
    rec = '🔴 NO TRADES TODAY - conditions unfavorable';
    recColor = chalk.red;
  } else {
    rec = '⏳ WAIT - no high-probability setup yet';
    recColor = chalk.gray;
  }

  console.log(chalk.gray('  ' + '═'.repeat(68)));
  console.log();
  console.log(`  ${recColor(rec)}`);
  console.log();
}

function printAIInsight(insight: string): void {
  console.log(chalk.bold.blue('  🤖 AI INSIGHT'));
  console.log(chalk.gray('  ' + '─'.repeat(68)));
  console.log();

  // Word wrap the insight
  const words = insight.split(/\s+/);
  let line = '  ';
  for (const word of words) {
    if (line.length + word.length > 72) {
      console.log(line);
      line = '  ' + word;
    } else {
      line += (line.length > 2 ? ' ' : '') + word;
    }
  }
  if (line.length > 2) console.log(line);
  console.log();
}

function printRiskReminder(accountSize: number): void {
  const maxRisk = accountSize * POSITION_RULES.maxRiskPct;

  console.log(chalk.gray('  ' + '─'.repeat(68)));
  console.log();
  console.log(chalk.bold.white('  📋 RISK RULES'));
  console.log(
    chalk.gray(
      `  Max risk per trade: $${maxRisk.toFixed(0)} ` +
        `(${(POSITION_RULES.maxRiskPct * 100).toFixed(0)}% of $${accountSize})`
    )
  );
  console.log(
    chalk.gray(
      `  Profit target: ${(POSITION_RULES.profitTarget * 100).toFixed(0)}% | ` +
        `Stop loss: ${(POSITION_RULES.stopLoss * 100).toFixed(0)}%`
    )
  );
  console.log(chalk.gray(`  Hold time: 1-3 days max`));
  console.log();
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

export async function shortTermCommand(
  options: ShortTermOptions
): Promise<void> {
  printHeader();

  console.log(chalk.gray('  Scanning SPY and QQQ...'));
  console.log();

  // Fetch all data in parallel
  const [spyData, qqqData, spyTech, qqqTech, vix] = await Promise.all([
    fetchIndexData('SPY'),
    fetchIndexData('QQQ'),
    fetchTechnicals('SPY'),
    fetchTechnicals('QQQ'),
    fetchVIX(),
  ]);

  if (!spyData || !qqqData || !spyTech || !qqqTech) {
    console.log(chalk.red('  ✗ Failed to fetch market data'));
    throw new Error('Failed to fetch market data');
  }

  // Generate signals
  const spySignal = generateEntrySignal(
    'SPY',
    spyData,
    spyTech,
    vix,
    options.accountSize
  );
  const qqqSignal = generateEntrySignal(
    'QQQ',
    qqqData,
    qqqTech,
    vix,
    options.accountSize
  );

  // Build analysis object
  const analysis: Omit<ShortTermAnalysis, 'aiInsight'> = {
    timestamp: new Date(),
    marketStatus: getMarketStatus(),
    vix,
    spy: { data: spyData, technicals: spyTech, signal: spySignal },
    qqq: { data: qqqData, technicals: qqqTech, signal: qqqSignal },
    recommendation: '',
  };

  // Display results
  printMarketStatus(analysis.marketStatus, vix);
  printIndexCard(spyData, spyTech, spySignal);
  printIndexCard(qqqData, qqqTech, qqqSignal);
  printRecommendation(analysis as ShortTermAnalysis);
  printRiskReminder(options.accountSize);

  // Generate AI insight
  console.log(chalk.gray('  Generating AI insight...'));
  const aiInsight = await generateAIInsight(
    { mode: options.aiMode, model: options.aiModel },
    analysis
  );
  printAIInsight(aiInsight);

  console.log(chalk.gray('  ' + '═'.repeat(68)));
  console.log();
}
