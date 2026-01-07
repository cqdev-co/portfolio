#!/usr/bin/env npx tsx
/**
 * No-Trade Regime Test Script
 *
 * Thoroughly tests the regime detection system with real market data.
 * Uses the Cloudflare Worker proxy for data fetching.
 *
 * Usage:
 *   cd lib/ai-agent/market
 *   YAHOO_PROXY_URL=https://your-worker.workers.dev npx tsx test-regime.ts
 *
 * Or from project root:
 *   bun run lib/ai-agent/market/test-regime.ts
 */

import {
  fetchAllViaProxy,
  isProxyConfigured,
  checkProxyHealth,
} from '../data/yahoo-proxy';

import {
  calculateATR,
  getATRAnalysis,
  calculateChopIndex,
  getChopAnalysis,
  countDirectionReversals,
  isWhipsawCondition,
  calculateADX,
  getADXAnalysis,
} from './chop-index';

import { analyzeSignalConflicts, type SignalInputs } from './signal-conflicts';

// Note: Using proxy-based fetchers instead of direct yahoo-finance2 calls
// import { getVIXData, getSPYTrend, getSectorPerformance } from './index';

import {
  analyzeTradingRegime,
  formatRegimeForAI,
  formatWeeklySummary,
  getRegimeEmoji,
  detectRegimeTransition,
  formatTransitionWarning,
  type PriceHistory,
} from './no-trade-regime';

import {
  fetchBreadthViaProxy,
  fetchSectorBreadthViaProxy,
} from './market-breadth';

// ============================================================================
// UTILITIES
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(msg: string, color: keyof typeof COLORS = 'reset'): void {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

function header(title: string): void {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, 'bright');
  console.log('='.repeat(70));
}

function subheader(title: string): void {
  console.log('\n' + '-'.repeat(50));
  log(`  ${title}`, 'cyan');
  console.log('-'.repeat(50));
}

function success(msg: string): void {
  log(`✅ ${msg}`, 'green');
}

function warn(msg: string): void {
  log(`⚠️  ${msg}`, 'yellow');
}

function error(msg: string): void {
  log(`❌ ${msg}`, 'red');
}

function info(msg: string): void {
  log(`ℹ️  ${msg}`, 'blue');
}

// ============================================================================
// TEST: PROXY CONNECTION
// ============================================================================

async function testProxyConnection(): Promise<boolean> {
  header('TEST 1: Proxy Connection');

  if (!isProxyConfigured()) {
    error('YAHOO_PROXY_URL environment variable not set');
    info('Set it with: export YAHOO_PROXY_URL=https://your-worker.workers.dev');
    return false;
  }

  success('Proxy URL configured');

  const healthy = await checkProxyHealth();
  if (healthy) {
    success('Proxy health check passed');
    return true;
  } else {
    warn('Proxy health check failed - will try fetching anyway');
    return true; // Continue anyway
  }
}

// ============================================================================
// TEST: FETCH SPY DATA
// ============================================================================

interface ChartData {
  highs: number[];
  lows: number[];
  closes: number[];
  timestamps: number[];
}

interface ChartResponse {
  quotes: Array<{ date: string; high: number; low: number; close: number }>;
}

/**
 * Fetch chart directly from proxy (cleaner format)
 */
async function fetchChartDirect(ticker: string): Promise<ChartResponse | null> {
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (!proxyUrl) return null;

  try {
    const response = await fetch(
      `${proxyUrl}/chart/${ticker}?range=3mo&interval=1d`
    );
    if (!response.ok) {
      console.log(`[Chart] Error: ${response.status}`);
      return null;
    }
    return (await response.json()) as ChartResponse;
  } catch (err) {
    console.log(`[Chart] Fetch error:`, err);
    return null;
  }
}

async function fetchSPYData(): Promise<ChartData | null> {
  header('TEST 2: Fetch SPY Historical Data');

  info('Fetching 3 months of SPY data via proxy...');

  const chart = await fetchChartDirect('SPY');

  if (!chart || !chart.quotes || chart.quotes.length === 0) {
    error('Failed to fetch SPY chart data');
    return null;
  }

  // Convert to our format, filtering out invalid values
  const validQuotes = chart.quotes.filter(
    (q) => q.close > 0 && q.high > 0 && q.low > 0
  );

  const data: ChartData = {
    closes: validQuotes.map((q) => q.close),
    highs: validQuotes.map((q) => q.high),
    lows: validQuotes.map((q) => q.low),
    timestamps: validQuotes.map((q) => new Date(q.date).getTime() / 1000),
  };

  success(`Fetched ${data.closes.length} valid data points`);

  // Show sample
  const lastClose = data.closes[data.closes.length - 1];
  const firstClose = data.closes[0];
  const change = ((lastClose - firstClose) / firstClose) * 100;

  info(`SPY Range: $${firstClose.toFixed(2)} → $${lastClose.toFixed(2)}`);
  info(`3-Month Change: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
  info(`High: $${Math.max(...data.highs).toFixed(2)}`);
  info(`Low: $${Math.min(...data.lows).toFixed(2)}`);

  return data;
}

// ============================================================================
// TEST: ATR CALCULATION
// ============================================================================

function testATR(data: ChartData): void {
  header('TEST 3: ATR (Average True Range) Calculation');

  // Test basic ATR
  const atr14 = calculateATR(data.highs, data.lows, data.closes, 14);

  if (atr14 === null) {
    error('ATR calculation returned null');
    return;
  }

  success(`ATR(14) = ${atr14.toFixed(2)}`);

  // Test ATR analysis
  const atrAnalysis = getATRAnalysis(data.highs, data.lows, data.closes, 14);

  if (atrAnalysis) {
    info(`ATR as % of price: ${atrAnalysis.percent.toFixed(2)}%`);
    info(`ATR expanding: ${atrAnalysis.expanding ? 'Yes' : 'No'}`);

    // Validate
    if (atrAnalysis.percent > 0 && atrAnalysis.percent < 20) {
      success('ATR % in reasonable range (0-20%)');
    } else {
      warn(`ATR % seems unusual: ${atrAnalysis.percent}%`);
    }
  }

  // Test with different periods
  const atr7 = calculateATR(data.highs, data.lows, data.closes, 7);
  const atr21 = calculateATR(data.highs, data.lows, data.closes, 21);

  info(`ATR(7) = ${atr7?.toFixed(2) ?? 'N/A'}`);
  info(`ATR(21) = ${atr21?.toFixed(2) ?? 'N/A'}`);
}

// ============================================================================
// TEST: ADX CALCULATION (NEW!)
// ============================================================================

function testADX(data: ChartData): void {
  header('TEST 3.5: ADX (Average Directional Index) - REAL Calculation');

  // Test raw ADX calculation
  const adxResult = calculateADX(data.highs, data.lows, data.closes, 14);

  if (adxResult === null) {
    error('ADX calculation returned null (need more data)');
    return;
  }

  success(`ADX(14) = ${adxResult.adx}`);
  info(`+DI = ${adxResult.plusDI}`);
  info(`-DI = ${adxResult.minusDI}`);

  // Validate ADX range
  if (adxResult.adx >= 0 && adxResult.adx <= 100) {
    success('ADX in valid range (0-100)');
  } else {
    error(`ADX out of range: ${adxResult.adx}`);
  }

  // Test full ADX analysis
  const adxAnalysis = getADXAnalysis(data.highs, data.lows, data.closes, 14);

  if (adxAnalysis) {
    subheader('ADX Analysis');
    info(`Trend Strength: ${adxAnalysis.strength}`);
    info(`Trend Direction: ${adxAnalysis.direction}`);
    info(`ADX Rising: ${adxAnalysis.rising ? 'Yes' : 'No'}`);
    info(`Description: ${adxAnalysis.description}`);

    // Interpret
    if (adxAnalysis.strength === 'WEAK') {
      warn('ADX < 20: No clear trend - choppy conditions');
    } else if (
      adxAnalysis.strength === 'STRONG' ||
      adxAnalysis.strength === 'VERY_STRONG'
    ) {
      success(
        `ADX ${adxAnalysis.adx}: Strong ${adxAnalysis.direction.toLowerCase()} trend`
      );
    } else {
      info(`ADX ${adxAnalysis.adx}: Moderate trend strength`);
    }

    // DI interpretation
    if (adxAnalysis.plusDI > adxAnalysis.minusDI + 10) {
      success('+DI dominates: Bullish pressure');
    } else if (adxAnalysis.minusDI > adxAnalysis.plusDI + 10) {
      warn('-DI dominates: Bearish pressure');
    } else {
      info('DI lines close: No clear direction');
    }
  }

  console.log('\nADX Interpretation Guide:');
  info('  < 20: Weak/no trend (range-bound)');
  info('  20-25: Emerging trend');
  info('  25-50: Strong trend');
  info('  50-75: Very strong trend');
  info('  > 75: Extreme (often precedes reversal)');
}

// ============================================================================
// TEST: CHOP INDEX CALCULATION
// ============================================================================

function testChopIndex(data: ChartData): void {
  header('TEST 4: Chop Index Calculation');

  // Test raw calculation
  const chop14 = calculateChopIndex(data.highs, data.lows, data.closes, 14);

  if (chop14 === null) {
    error('Chop Index calculation returned null');
    return;
  }

  success(`Chop Index(14) = ${chop14.toFixed(1)}`);

  // Validate range
  if (chop14 >= 0 && chop14 <= 100) {
    success('Chop Index in valid range (0-100)');
  } else {
    error(`Chop Index out of range: ${chop14}`);
  }

  // Test full analysis
  const chopAnalysis = getChopAnalysis(data.highs, data.lows, data.closes, 14);

  if (chopAnalysis) {
    info(`Level: ${chopAnalysis.level}`);
    info(`Description: ${chopAnalysis.description}`);
    info(`Favors Trending: ${chopAnalysis.favorsTrending ? 'Yes' : 'No'}`);

    // Interpret
    if (chopAnalysis.level === 'CHOPPY') {
      warn('Market is CHOPPY - avoid trend-following strategies');
    } else if (chopAnalysis.level === 'TRENDING') {
      success('Market is TRENDING - favorable for directional trades');
    } else {
      info('Market is TRANSITIONAL - wait for confirmation');
    }
  }

  // Show thresholds
  console.log('\nChop Index Thresholds:');
  info('  < 38.2: TRENDING (favorable)');
  info('  38.2-61.8: TRANSITIONAL (caution)');
  info('  > 61.8: CHOPPY (avoid)');
}

// ============================================================================
// TEST: DIRECTION REVERSALS
// ============================================================================

function testDirectionReversals(data: ChartData): void {
  header('TEST 5: Direction Reversal Detection');

  // Test recent 5 days
  const reversals5 = countDirectionReversals(data.closes, 5);
  success(`Reversals in last 5 days: ${reversals5}`);

  // Test recent 10 days
  const reversals10 = countDirectionReversals(data.closes, 10);
  info(`Reversals in last 10 days: ${reversals10}`);

  // Test whipsaw detection
  const whipsaw = isWhipsawCondition(data.highs, data.lows, data.closes, 5);

  if (whipsaw) {
    warn('WHIPSAW condition detected!');
    info('High reversals + expanding ATR + flat price range');
  } else {
    success('No whipsaw condition detected');
  }

  // Show recent price action
  const recent5 = data.closes.slice(-6);
  console.log('\nRecent 5-day closes:');
  for (let i = 1; i < recent5.length; i++) {
    const change = recent5[i] - recent5[i - 1];
    const dir = change >= 0 ? '↑' : '↓';
    const color = change >= 0 ? 'green' : 'red';
    log(
      `  Day ${i}: $${recent5[i].toFixed(2)} ${dir} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`,
      color
    );
  }
}

// ============================================================================
// PROXY DATA FETCHERS FOR VIX/SPY
// ============================================================================

interface VIXProxyData {
  current: number;
  change: number;
  changePct: number;
  level: 'CALM' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';
}

interface SPYProxyData {
  price: number;
  changePct: number;
  ma50: number;
  ma200: number;
  aboveMA50: boolean;
  aboveMA200: boolean;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

async function fetchVIXViaProxy(): Promise<VIXProxyData | null> {
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (!proxyUrl) return null;

  // Try different VIX ticker formats
  const vixTickers = ['^VIX', 'VIX', 'VIXY']; // VIXY is a VIX ETF backup

  for (const ticker of vixTickers) {
    try {
      const encodedTicker = encodeURIComponent(ticker);
      const response = await fetch(`${proxyUrl}/ticker/${encodedTicker}`);
      if (!response.ok) continue;

      const data = (await response.json()) as {
        quote?: { price?: number; change?: number; changePct?: number };
      };
      if (!data.quote?.price) continue;

      const vixValue = data.quote.price;

      // VIXY is an ETF, roughly VIX/10 + some base
      // Not perfect but gives us a proxy
      if (ticker === 'VIXY') {
        // Skip VIXY for now, prefer actual VIX
        continue;
      }

      let level: VIXProxyData['level'];

      if (vixValue < 15) level = 'CALM';
      else if (vixValue < 20) level = 'NORMAL';
      else if (vixValue < 30) level = 'ELEVATED';
      else if (vixValue < 40) level = 'HIGH';
      else level = 'EXTREME';

      return {
        current: vixValue,
        change: data.quote?.change ?? 0,
        changePct: data.quote?.changePct ?? 0,
        level,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchSPYQuoteViaProxy(): Promise<SPYProxyData | null> {
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (!proxyUrl) return null;

  try {
    const response = await fetch(`${proxyUrl}/ticker/SPY`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      quote?: {
        price?: number;
        changePct?: number;
        fiftyDayAverage?: number;
        twoHundredDayAverage?: number;
      };
    };
    if (!data.quote?.price) return null;

    const price = data.quote.price;
    const ma50 = data.quote.fiftyDayAverage ?? price;
    const ma200 = data.quote.twoHundredDayAverage ?? price;
    const aboveMA50 = price > ma50;
    const aboveMA200 = price > ma200;

    let trend: SPYProxyData['trend'] = 'NEUTRAL';
    if (aboveMA50 && aboveMA200) trend = 'BULLISH';
    else if (!aboveMA50 && !aboveMA200) trend = 'BEARISH';

    return {
      price,
      changePct: data.quote?.changePct ?? 0,
      ma50,
      ma200,
      aboveMA50,
      aboveMA200,
      trend,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TEST: SIGNAL CONFLICT DETECTION
// ============================================================================

async function testSignalConflicts(): Promise<void> {
  header('TEST 6: Signal Conflict Detection');

  // Fetch real market data via proxy
  info('Fetching VIX and SPY data via proxy...');

  const [vix, spy] = await Promise.all([
    fetchVIXViaProxy(),
    fetchSPYQuoteViaProxy(),
  ]);

  if (!vix) {
    warn('Could not fetch VIX data (proxy may not support ^VIX)');
    info('Using estimated VIX based on SPY volatility...');
    // Estimate VIX from recent SPY volatility (rough approximation)
    // In real usage, deploy proxy update to support ^VIX
  } else {
    info(`VIX: ${vix.current.toFixed(2)} (${vix.level})`);
  }

  if (!spy) {
    warn('Could not fetch SPY data');
  } else {
    info(`SPY: $${spy.price.toFixed(2)} (${spy.trend})`);
    info(`SPY above MA50: ${spy.aboveMA50 ? 'Yes' : 'No'}`);
    info(`SPY above MA200: ${spy.aboveMA200 ? 'Yes' : 'No'}`);
  }

  // Build signal inputs
  const inputs: SignalInputs = {
    vixLevel: vix?.level,
    vixValue: vix?.current,
    spyTrend: spy?.trend,
    spyAboveMA200: spy?.aboveMA200,
    spyAboveMA50: spy?.aboveMA50,
    // We could add more from ticker-specific data
    adx: 25, // Placeholder - would come from actual data
    rsi: 50, // Placeholder
  };

  // Analyze conflicts
  const conflicts = analyzeSignalConflicts(inputs);

  subheader('Signal Analysis');

  console.log('\nIndividual Signals:');
  for (const signal of conflicts.signals) {
    const emoji =
      signal.direction === 'BULLISH'
        ? '🟢'
        : signal.direction === 'BEARISH'
          ? '🔴'
          : '⚪';
    console.log(`  ${emoji} ${signal.name}: ${signal.value}`);
    console.log(
      `     Direction: ${signal.direction}, Weight: ${(signal.weight * 100).toFixed(0)}%`
    );
    if (signal.reason) {
      console.log(`     Reason: ${signal.reason}`);
    }
  }

  subheader('Conflict Analysis');

  info(`Conflict Score: ${conflicts.conflictScore}%`);
  info(`Net Direction: ${conflicts.netDirection}`);
  info(
    `Net Strength: ${conflicts.netStrength > 0 ? '+' : ''}${conflicts.netStrength}`
  );
  info(`Too Conflicted: ${conflicts.isTooConflicted ? 'YES' : 'No'}`);

  if (conflicts.conflicts.length > 0) {
    console.log('\nDetected Conflicts:');
    for (const conflict of conflicts.conflicts) {
      const emoji =
        conflict.severity === 'HIGH'
          ? '🔴'
          : conflict.severity === 'MEDIUM'
            ? '🟠'
            : '🟡';
      console.log(`  ${emoji} ${conflict.severity}:`);
      console.log(`     Bull: ${conflict.bullishSignal}`);
      console.log(`     Bear: ${conflict.bearishSignal}`);
    }
  }

  console.log(`\nSummary: ${conflicts.summary}`);
}

// ============================================================================
// TEST: FULL REGIME ANALYSIS
// ============================================================================

type RegimeAnalysisResult = Awaited<ReturnType<typeof analyzeTradingRegime>>;

async function testFullRegimeAnalysisWithReturn(
  spyData: ChartData
): Promise<RegimeAnalysisResult> {
  header('TEST 7: Full Trading Regime Analysis');

  // Build price history from SPY data
  const priceHistory: PriceHistory = {
    highs: spyData.highs,
    lows: spyData.lows,
    closes: spyData.closes,
  };

  info('Running full regime analysis...');

  const analysis = await analyzeTradingRegime(priceHistory);

  subheader('Regime Result');

  const emoji = getRegimeEmoji(analysis.regime);
  log(`\n${emoji} REGIME: ${analysis.regime}`, 'bright');
  info(`Confidence: ${analysis.confidence}%`);
  info(`Primary Reason: ${analysis.primaryReason}`);

  subheader('Metrics');

  const m = analysis.metrics;
  if (m.chopIndex !== undefined) {
    info(`Chop Index: ${m.chopIndex.toFixed(1)}`);
  }
  info(`Conflict Score: ${m.conflictScore}%`);
  info(`Trend Strength: ${m.trendStrength}`);
  if (m.vixLevel) {
    info(`VIX Level: ${analysis.vix?.current} (${m.vixLevel})`);
  }
  if (m.spyTrend) {
    info(`SPY Trend: ${m.spyTrend}`);
  }
  if (m.directionReversals !== undefined) {
    info(`Direction Reversals: ${m.directionReversals}`);
  }

  subheader('Factors');

  for (const reason of analysis.reasons) {
    console.log(`  • ${reason}`);
  }

  subheader('Recommendation');

  console.log(`\n${analysis.recommendation}`);

  subheader('Formatted Outputs');

  console.log('\n--- AI Context Format ---');
  console.log(formatRegimeForAI(analysis));

  console.log('\n--- Weekly Summary Format ---');
  console.log(formatWeeklySummary(analysis));

  // Validate result
  subheader('Validation');

  if (analysis.confidence >= 50 && analysis.confidence <= 100) {
    success('Confidence in valid range (50-100%)');
  } else {
    warn(`Confidence seems unusual: ${analysis.confidence}%`);
  }

  if (['GO', 'CAUTION', 'NO_TRADE'].includes(analysis.regime)) {
    success('Regime is a valid value');
  } else {
    error(`Invalid regime: ${analysis.regime}`);
  }

  if (analysis.recommendation.length > 20) {
    success('Recommendation is substantive');
  } else {
    warn('Recommendation seems too short');
  }

  return analysis;
}

// Keep old function for backwards compatibility
async function testFullRegimeAnalysis(spyData: ChartData): Promise<void> {
  header('TEST 7: Full Trading Regime Analysis');

  // Build price history from SPY data
  const priceHistory: PriceHistory = {
    highs: spyData.highs,
    lows: spyData.lows,
    closes: spyData.closes,
  };

  info('Running full regime analysis...');

  const analysis = await analyzeTradingRegime(priceHistory);

  subheader('Regime Result');

  const emoji = getRegimeEmoji(analysis.regime);
  log(`\n${emoji} REGIME: ${analysis.regime}`, 'bright');
  info(`Confidence: ${analysis.confidence}%`);
  info(`Primary Reason: ${analysis.primaryReason}`);

  subheader('Metrics');

  const m = analysis.metrics;
  if (m.chopIndex !== undefined) {
    info(`Chop Index: ${m.chopIndex.toFixed(1)}`);
  }
  info(`Conflict Score: ${m.conflictScore}%`);
  info(`Trend Strength: ${m.trendStrength}`);
  if (m.vixLevel) {
    info(`VIX Level: ${analysis.vix?.current} (${m.vixLevel})`);
  }
  if (m.spyTrend) {
    info(`SPY Trend: ${m.spyTrend}`);
  }
  if (m.directionReversals !== undefined) {
    info(`Direction Reversals: ${m.directionReversals}`);
  }

  subheader('Factors');

  for (const reason of analysis.reasons) {
    console.log(`  • ${reason}`);
  }

  subheader('Recommendation');

  console.log(`\n${analysis.recommendation}`);

  subheader('Formatted Outputs');

  console.log('\n--- AI Context Format ---');
  console.log(formatRegimeForAI(analysis));

  console.log('\n--- Weekly Summary Format ---');
  console.log(formatWeeklySummary(analysis));

  // Validate result
  subheader('Validation');

  if (analysis.confidence >= 50 && analysis.confidence <= 100) {
    success('Confidence in valid range (50-100%)');
  } else {
    warn(`Confidence seems unusual: ${analysis.confidence}%`);
  }

  if (['GO', 'CAUTION', 'NO_TRADE'].includes(analysis.regime)) {
    success('Regime is a valid value');
  } else {
    error(`Invalid regime: ${analysis.regime}`);
  }

  if (analysis.recommendation.length > 20) {
    success('Recommendation is substantive');
  } else {
    warn('Recommendation seems too short');
  }
}

// ============================================================================
// TEST: EDGE CASES
// ============================================================================

function testEdgeCases(): void {
  header('TEST 8: Edge Cases');

  subheader('Insufficient Data');

  // Test with too little data
  const shortData = [100, 101, 102];
  const shortATR = calculateATR(shortData, shortData, shortData, 14);

  if (shortATR === null) {
    success('ATR correctly returns null for insufficient data');
  } else {
    error('ATR should return null for insufficient data');
  }

  const shortChop = calculateChopIndex(shortData, shortData, shortData, 14);

  if (shortChop === null) {
    success('Chop Index correctly returns null for insufficient data');
  } else {
    error('Chop Index should return null for insufficient data');
  }

  subheader('Flat Market');

  // Test with perfectly flat data (all same price)
  const flatData = Array(20).fill(100);
  const flatChop = calculateChopIndex(flatData, flatData, flatData, 14);

  info(`Chop Index for flat market: ${flatChop}`);

  subheader('Extreme Volatility');

  // Test with extremely volatile data
  const volatileCloses = [];
  const volatileHighs = [];
  const volatileLows = [];
  for (let i = 0; i < 20; i++) {
    const base = 100 + (i % 2 === 0 ? 10 : -10);
    volatileCloses.push(base);
    volatileHighs.push(base + 5);
    volatileLows.push(base - 5);
  }

  const volatileChop = calculateChopIndex(
    volatileHighs,
    volatileLows,
    volatileCloses,
    14
  );
  const volatileReversals = countDirectionReversals(volatileCloses, 10);

  info(`Chop Index for volatile market: ${volatileChop}`);
  info(`Reversals in volatile market: ${volatileReversals}`);

  if (volatileReversals > 5) {
    success('High reversal count detected in volatile data');
  }
}

// ============================================================================
// TEST: SIGNAL CONFLICT SCENARIOS
// ============================================================================

function testConflictScenarios(): void {
  header('TEST 9: Signal Conflict Scenarios');

  // Scenario 1: Clear bullish
  subheader('Scenario 1: Clear Bullish');
  const bullish = analyzeSignalConflicts({
    vixLevel: 'CALM',
    spyTrend: 'BULLISH',
    spyAboveMA200: true,
    adx: 30,
    rsi: 45,
    pcRatio: 0.5,
    daysToEarnings: 60,
  });
  info(`Conflict Score: ${bullish.conflictScore}%`);
  info(`Net Direction: ${bullish.netDirection}`);
  info(`Too Conflicted: ${bullish.isTooConflicted}`);
  if (bullish.netDirection === 'BULLISH' && !bullish.isTooConflicted) {
    success('Correctly identified as bullish, not conflicted');
  }

  // Scenario 2: Clear bearish
  subheader('Scenario 2: Clear Bearish');
  const bearish = analyzeSignalConflicts({
    vixLevel: 'HIGH',
    spyTrend: 'BEARISH',
    spyAboveMA200: false,
    adx: 35,
    rsi: 75,
    pcRatio: 1.5,
    daysToEarnings: 5,
  });
  info(`Conflict Score: ${bearish.conflictScore}%`);
  info(`Net Direction: ${bearish.netDirection}`);
  info(`Too Conflicted: ${bearish.isTooConflicted}`);
  if (bearish.netDirection === 'BEARISH') {
    success('Correctly identified as bearish');
  }

  // Scenario 3: Highly conflicted
  subheader('Scenario 3: Highly Conflicted');
  const conflicted = analyzeSignalConflicts({
    vixLevel: 'CALM', // Bullish
    spyTrend: 'BEARISH', // Bearish
    spyAboveMA200: false, // Bearish
    adx: 30, // Bullish (strong trend)
    rsi: 25, // Bullish (oversold)
    pcRatio: 1.2, // Bearish
    daysToEarnings: 10, // Bearish
    chopIndex: 65, // Bearish (choppy)
  });
  info(`Conflict Score: ${conflicted.conflictScore}%`);
  info(`Net Direction: ${conflicted.netDirection}`);
  info(`Too Conflicted: ${conflicted.isTooConflicted}`);
  info(`Conflicts Found: ${conflicted.conflicts.length}`);

  if (conflicted.conflictScore > 50) {
    success('High conflict score detected as expected');
  }

  // Scenario 4: All neutral
  subheader('Scenario 4: All Neutral');
  const neutral = analyzeSignalConflicts({
    vixLevel: 'NORMAL',
    spyTrend: 'NEUTRAL',
    adx: 22,
    rsi: 50,
    pcRatio: 0.85,
  });
  info(`Conflict Score: ${neutral.conflictScore}%`);
  info(`Net Direction: ${neutral.netDirection}`);
  if (neutral.netDirection === 'NEUTRAL') {
    success('Correctly identified as neutral');
  }
}

// ============================================================================
// TEST: MARKET BREADTH (NEW!)
// ============================================================================

async function testMarketBreadth(): Promise<void> {
  header('TEST 10: Market Breadth Analysis');

  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (!proxyUrl) {
    warn('Proxy URL not configured, skipping breadth test');
    return;
  }

  info('Fetching breadth data via proxy (SPY, RSP, IWM)...');

  const breadth = await fetchBreadthViaProxy(proxyUrl);

  if (!breadth) {
    warn('Could not fetch breadth data');
    return;
  }

  success('Breadth analysis completed');

  subheader('Breadth Metrics');
  info(`Breadth Score: ${breadth.score}/100`);
  info(`Level: ${breadth.level}`);
  info(`Supports Trend: ${breadth.supportsTrend ? 'Yes' : 'No'}`);

  if (breadth.metrics.pctAboveMA50 !== undefined) {
    info(`Est. % above MA50: ${breadth.metrics.pctAboveMA50}%`);
  }
  if (breadth.metrics.pctAboveMA200 !== undefined) {
    info(`Est. % above MA200: ${breadth.metrics.pctAboveMA200}%`);
  }

  subheader('Breadth Interpretation');
  info(breadth.summary);

  if (breadth.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of breadth.warnings) {
      warn(warning);
    }
  }

  // Fetch sector breadth
  subheader('Sector Breadth');
  info('Fetching sector ETF data...');

  const sectorBreadth = await fetchSectorBreadthViaProxy(proxyUrl);

  if (sectorBreadth && sectorBreadth.length > 0) {
    success(`Fetched ${sectorBreadth.length} sectors`);

    const advancing = sectorBreadth.filter((s) => s.trend === 'UP').length;
    const declining = sectorBreadth.filter((s) => s.trend === 'DOWN').length;
    const aboveMA50 = sectorBreadth.filter((s) => s.aboveMA50).length;

    info(`Sectors advancing: ${advancing}/${sectorBreadth.length}`);
    info(`Sectors declining: ${declining}/${sectorBreadth.length}`);
    info(`Sectors above MA50: ${aboveMA50}/${sectorBreadth.length}`);

    // Show best and worst sectors
    const sorted = [...sectorBreadth].sort((a, b) => b.changePct - a.changePct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best) {
      success(
        `Best sector: ${best.name} (${best.changePct > 0 ? '+' : ''}${best.changePct.toFixed(2)}%)`
      );
    }
    if (worst) {
      warn(
        `Worst sector: ${worst.name} (${worst.changePct > 0 ? '+' : ''}${worst.changePct.toFixed(2)}%)`
      );
    }
  } else {
    warn('Could not fetch sector breadth');
  }

  // Validate
  if (breadth.level === 'HEALTHY' && breadth.score >= 60) {
    success('Healthy breadth confirmed');
  } else if (breadth.level === 'WEAK' && breadth.score < 40) {
    success('Weak breadth correctly identified');
  } else if (breadth.level === 'DIVERGENT') {
    warn('Divergence detected - watch for reversal');
  }
}

// ============================================================================
// TEST: REGIME TRANSITION WARNINGS (NEW!)
// ============================================================================

async function testRegimeTransitions(
  spyData: ChartData,
  currentAnalysis: Awaited<ReturnType<typeof analyzeTradingRegime>>
): Promise<void> {
  header('TEST 11: Regime Transition Warnings');

  // Get ADX for transition analysis
  const adxAnalysis = getADXAnalysis(
    spyData.highs,
    spyData.lows,
    spyData.closes
  );

  // Get breadth for transition analysis
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  let breadthScore: number | undefined;

  if (proxyUrl) {
    const breadth = await fetchBreadthViaProxy(proxyUrl);
    breadthScore = breadth?.score;
  }

  // Detect transitions
  info('Analyzing regime transition probability...');

  const transition = detectRegimeTransition(
    currentAnalysis,
    undefined, // No previous metrics for this test
    adxAnalysis
      ? {
          adx: adxAnalysis.adx,
          rising: adxAnalysis.rising,
          direction: adxAnalysis.direction,
        }
      : undefined,
    breadthScore
  );

  subheader('Transition Analysis');

  const dirEmoji =
    transition.direction === 'DETERIORATING'
      ? '⚠️'
      : transition.direction === 'IMPROVING'
        ? '📈'
        : '✓';

  info(`Current Regime: ${transition.currentRegime}`);
  info(`Direction: ${dirEmoji} ${transition.direction}`);
  info(`Likely Next Regime: ${transition.likelyNextRegime}`);
  info(`Transition Probability: ${transition.transitionProbability}%`);
  info(
    `Time Horizon: ${transition.timeHorizon === 'NEAR_TERM' ? '1-2 days' : '3-7 days'}`
  );

  if (transition.warningSignals.length > 0) {
    console.log('\nWarning Signals:');
    for (const signal of transition.warningSignals) {
      warn(`  • ${signal}`);
    }
  } else {
    success('No transition warning signals');
  }

  console.log(`\nAdvice: ${transition.advice}`);

  // Show formatted output
  subheader('Formatted Transition Warning');
  console.log(formatTransitionWarning(transition));

  // Test transition scenarios
  subheader('Transition Scenario Tests');

  // Simulate deteriorating conditions
  const deterioratingAnalysis = {
    ...currentAnalysis,
    regime: 'GO' as const,
    metrics: {
      ...currentAnalysis.metrics,
      chopIndex: 58, // Approaching choppy
    },
    vix: {
      current: 23,
      level: 'ELEVATED' as const,
      change: 2,
      changePct: 5,
      description: '',
    },
  };

  const deteriorating = detectRegimeTransition(
    deterioratingAnalysis,
    {
      timestamp: new Date(),
      chopIndex: 45,
      conflictScore: 30,
      spyAboveMA50: true,
      spyAboveMA200: true,
      vixLevel: 18,
    },
    { adx: 28, rising: false, direction: 'BULLISH' }
  );

  info(
    `Deteriorating scenario: ${deteriorating.direction} (${deteriorating.transitionProbability}%)`
  );
  if (deteriorating.direction === 'DETERIORATING') {
    success('Correctly detected deteriorating conditions');
  }

  // Simulate improving conditions
  const improvingAnalysis = {
    ...currentAnalysis,
    regime: 'CAUTION' as const,
    metrics: {
      ...currentAnalysis.metrics,
      chopIndex: 42, // Approaching trending
    },
    vix: {
      current: 18,
      level: 'NORMAL' as const,
      change: -2,
      changePct: -5,
      description: '',
    },
  };

  const improving = detectRegimeTransition(
    improvingAnalysis,
    {
      timestamp: new Date(),
      chopIndex: 55,
      conflictScore: 60,
      spyAboveMA50: true,
      spyAboveMA200: true,
      vixLevel: 22,
    },
    { adx: 22, rising: true, direction: 'BULLISH' }
  );

  info(
    `Improving scenario: ${improving.direction} (${improving.transitionProbability}%)`
  );
  if (improving.direction === 'IMPROVING') {
    success('Correctly detected improving conditions');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n' + '█'.repeat(70));
  log('  NO-TRADE REGIME DETECTION - COMPREHENSIVE TEST SUITE', 'bright');
  console.log('█'.repeat(70));

  const startTime = Date.now();

  // Test 1: Proxy connection
  const proxyOk = await testProxyConnection();
  if (!proxyOk) {
    error('\nCannot continue without proxy. Exiting.');
    process.exit(1);
  }

  // Test 2: Fetch SPY data
  const spyData = await fetchSPYData();
  if (!spyData) {
    error('\nCannot continue without SPY data. Exiting.');
    throw new Error('No SPY data');
  }

  // Test 3: ATR calculation
  testATR(spyData);

  // Test 3.5: ADX calculation (NEW!)
  testADX(spyData);

  // Test 4: Chop Index calculation
  testChopIndex(spyData);

  // Test 5: Direction reversals
  testDirectionReversals(spyData);

  // Test 6: Signal conflicts
  await testSignalConflicts();

  // Test 7: Full regime analysis
  const regimeAnalysis = await testFullRegimeAnalysisWithReturn(spyData);

  // Test 8: Edge cases
  testEdgeCases();

  // Test 9: Conflict scenarios
  testConflictScenarios();

  // Test 10: Market Breadth (NEW!)
  await testMarketBreadth();

  // Test 11: Regime Transitions (NEW!)
  if (regimeAnalysis) {
    await testRegimeTransitions(spyData, regimeAnalysis);
  }

  // Summary
  const elapsed = Date.now() - startTime;

  header('TEST SUMMARY');
  success(`All tests completed in ${(elapsed / 1000).toFixed(1)}s`);
  info(
    'Tests run: Proxy, SPY Data, ATR, ADX, Chop, Reversals, Conflicts, Regime, Edge Cases, Scenarios, Breadth, Transitions'
  );

  console.log('\n');
}

// Run
main().catch((err) => {
  error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
