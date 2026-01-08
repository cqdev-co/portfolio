import chalk from 'chalk';
import type { HistoricalData } from '../types/index.ts';
import { detectSupportResistance } from './support-resistance.ts';

interface ChartConfig {
  width: number;
  height: number;
}

const DEFAULT_CONFIG: ChartConfig = {
  width: 70,
  height: 12,
};

// Better Unicode block characters for smoother charts
const BLOCKS = {
  full: '█',
  upper: '▀',
  lower: '▄',
  light: '░',
  medium: '▒',
  dark: '▓',
};

/**
 * Generate a clean, high-quality ASCII price chart
 */
export function generatePriceChart(
  data: HistoricalData[],
  config: Partial<ChartConfig> = {}
): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const lines: string[] = [];

  if (data.length < 20) {
    return [chalk.gray('Insufficient data for chart')];
  }

  // Use last N days for chart
  const chartData = data.slice(-cfg.width);
  const closes = chartData.map((d) => d.close);

  // Calculate price range with padding
  const minPrice = Math.min(...closes) * 0.998;
  const maxPrice = Math.max(...closes) * 1.002;
  const priceRange = maxPrice - minPrice;
  const currentPrice = closes[closes.length - 1] ?? 0;

  // Calculate moving averages
  const allCloses = data.map((d) => d.close);
  const ma20 = calculateMA(allCloses, 20).slice(-cfg.width);
  const ma50 = calculateMA(allCloses, 50).slice(-cfg.width);

  // Detect support/resistance
  const levels = detectSupportResistance(data);
  const nearestSupport = levels
    .filter((l) => l.type === 'support' && l.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0];
  const nearestResistance = levels
    .filter((l) => l.type === 'resistance' && l.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0];

  // Build chart grid
  const grid: string[][] = Array(cfg.height)
    .fill(null)
    .map(() => Array(cfg.width).fill(' '));

  // Plot price candles
  for (let x = 0; x < closes.length; x++) {
    const price = closes[x];
    if (price === undefined) continue;

    const y = Math.round(((price - minPrice) / priceRange) * (cfg.height - 1));
    const row = cfg.height - 1 - y;

    if (row >= 0 && row < cfg.height) {
      const prevPrice = x > 0 ? closes[x - 1] : price;
      const isUp = price >= (prevPrice ?? price);
      grid[row]![x] = isUp ? chalk.green(BLOCKS.full) : chalk.red(BLOCKS.full);
    }
  }

  // Plot MA20 (cyan)
  for (let x = 0; x < ma20.length; x++) {
    const price = ma20[x];
    if (
      price === undefined ||
      isNaN(price) ||
      price < minPrice ||
      price > maxPrice
    )
      continue;

    const y = Math.round(((price - minPrice) / priceRange) * (cfg.height - 1));
    const row = cfg.height - 1 - y;

    if (row >= 0 && row < cfg.height && grid[row]![x] === ' ') {
      grid[row]![x] = chalk.cyan('─');
    }
  }

  // Plot MA50 (yellow)
  for (let x = 0; x < ma50.length; x++) {
    const price = ma50[x];
    if (
      price === undefined ||
      isNaN(price) ||
      price < minPrice ||
      price > maxPrice
    )
      continue;

    const y = Math.round(((price - minPrice) / priceRange) * (cfg.height - 1));
    const row = cfg.height - 1 - y;

    if (row >= 0 && row < cfg.height && grid[row]![x] === ' ') {
      grid[row]![x] = chalk.yellow('─');
    }
  }

  // Draw support line
  if (nearestSupport && nearestSupport.price >= minPrice) {
    const y = Math.round(
      ((nearestSupport.price - minPrice) / priceRange) * (cfg.height - 1)
    );
    const row = cfg.height - 1 - y;
    if (row >= 0 && row < cfg.height) {
      for (let x = 0; x < cfg.width; x++) {
        if (grid[row]![x] === ' ') {
          grid[row]![x] = chalk.green('┄');
        }
      }
    }
  }

  // Draw resistance line
  if (nearestResistance && nearestResistance.price <= maxPrice) {
    const y = Math.round(
      ((nearestResistance.price - minPrice) / priceRange) * (cfg.height - 1)
    );
    const row = cfg.height - 1 - y;
    if (row >= 0 && row < cfg.height) {
      for (let x = 0; x < cfg.width; x++) {
        if (grid[row]![x] === ' ') {
          grid[row]![x] = chalk.red('┄');
        }
      }
    }
  }

  // Build output
  const priceLabels = [
    maxPrice.toFixed(2),
    ((maxPrice + minPrice) / 2).toFixed(2),
    minPrice.toFixed(2),
  ];

  lines.push(
    chalk.gray(`  $${priceLabels[0]?.padStart(8)} ┌${'─'.repeat(cfg.width)}┐`)
  );

  for (let row = 0; row < cfg.height; row++) {
    let label = '          ';
    if (row === Math.floor(cfg.height / 2)) {
      label = chalk.gray(`  $${priceLabels[1]?.padStart(8)}`);
    }
    lines.push(
      `${label} ${chalk.gray('│')}${grid[row]!.join('')}${chalk.gray('│')}`
    );
  }

  lines.push(
    chalk.gray(`  $${priceLabels[2]?.padStart(8)} └${'─'.repeat(cfg.width)}┘`)
  );

  // Time axis
  const timeLabels = getTimeLabels(chartData, cfg.width);
  lines.push(chalk.gray(`             ${timeLabels}`));

  return lines;
}

/**
 * Generate a compact RSI indicator line
 */
export function generateRSILine(data: HistoricalData[]): {
  value: number;
  status: string;
  color: (s: string) => string;
  bar: string;
} {
  const closes = data.slice(-60).map((d) => d.close);
  const rsiValues = calculateRSI(closes, 14);
  const currentRSI = rsiValues[rsiValues.length - 1] ?? 50;

  let status: string;
  let color: (s: string) => string;

  if (currentRSI >= 70) {
    status = 'OVERBOUGHT';
    color = chalk.red;
  } else if (currentRSI <= 30) {
    status = 'OVERSOLD';
    color = chalk.green;
  } else if (currentRSI >= 60) {
    status = 'BULLISH';
    color = chalk.yellow;
  } else if (currentRSI <= 40) {
    status = 'BEARISH';
    color = chalk.yellow;
  } else {
    status = 'NEUTRAL';
    color = chalk.gray;
  }

  // Generate mini bar
  const filled = Math.round(currentRSI / 5);
  const bar =
    chalk.gray('[') +
    color('█'.repeat(filled)) +
    chalk.gray('░'.repeat(20 - filled)) +
    chalk.gray(']');

  return { value: currentRSI, status, color, bar };
}

/**
 * Get price trend analysis
 */
export function analyzeTrend(
  data: HistoricalData[],
  currentPrice: number
): {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
  signals: string[];
} {
  const closes = data.map((d) => d.close);
  const ma20 = calculateMA(closes, 20);
  const ma50 = calculateMA(closes, 50);
  const ma200 = calculateMA(closes, 200);

  const currentMA20 = ma20[ma20.length - 1];
  const currentMA50 = ma50[ma50.length - 1];
  const currentMA200 = ma200[ma200.length - 1];

  const signals: string[] = [];
  let bullishPoints = 0;
  let bearishPoints = 0;

  // Price vs MAs
  if (currentMA20 && currentPrice > currentMA20) {
    bullishPoints += 1;
    signals.push('Above 20-day MA');
  } else if (currentMA20) {
    bearishPoints += 1;
    signals.push('Below 20-day MA');
  }

  if (currentMA50 && currentPrice > currentMA50) {
    bullishPoints += 1;
    signals.push('Above 50-day MA');
  } else if (currentMA50) {
    bearishPoints += 1;
    signals.push('Below 50-day MA');
  }

  if (currentMA200 && currentPrice > currentMA200) {
    bullishPoints += 2;
    signals.push('Above 200-day MA (long-term bullish)');
  } else if (currentMA200) {
    bearishPoints += 2;
    signals.push('Below 200-day MA (long-term bearish)');
  }

  // Golden/Death cross
  if (currentMA50 && currentMA200) {
    if (currentMA50 > currentMA200) {
      bullishPoints += 2;
      signals.push('Golden Cross active (50 > 200 MA)');
    } else {
      bearishPoints += 2;
      signals.push('Death Cross active (50 < 200 MA)');
    }
  }

  // Recent momentum (5-day change)
  const recentCloses = closes.slice(-5);
  const fiveDayChange =
    recentCloses.length >= 5
      ? ((recentCloses[4] ?? 0) - (recentCloses[0] ?? 0)) /
        (recentCloses[0] ?? 1)
      : 0;

  if (fiveDayChange > 0.03) {
    bullishPoints += 1;
    signals.push(
      `Strong 5-day momentum (+${(fiveDayChange * 100).toFixed(1)}%)`
    );
  } else if (fiveDayChange < -0.03) {
    bearishPoints += 1;
    signals.push(`Weak 5-day momentum (${(fiveDayChange * 100).toFixed(1)}%)`);
  }

  // Determine overall
  const netScore = bullishPoints - bearishPoints;
  let direction: 'bullish' | 'bearish' | 'neutral';
  let strength: 'strong' | 'moderate' | 'weak';
  let description: string;

  if (netScore >= 4) {
    direction = 'bullish';
    strength = 'strong';
    description = 'Strong uptrend with multiple confirming signals';
  } else if (netScore >= 2) {
    direction = 'bullish';
    strength = 'moderate';
    description = 'Moderate uptrend, watch for continuation';
  } else if (netScore >= 1) {
    direction = 'bullish';
    strength = 'weak';
    description = 'Slight bullish bias, needs confirmation';
  } else if (netScore <= -4) {
    direction = 'bearish';
    strength = 'strong';
    description = 'Strong downtrend, exercise caution';
  } else if (netScore <= -2) {
    direction = 'bearish';
    strength = 'moderate';
    description = 'Moderate downtrend, wait for reversal signals';
  } else if (netScore <= -1) {
    direction = 'bearish';
    strength = 'weak';
    description = 'Slight bearish bias, may be consolidating';
  } else {
    direction = 'neutral';
    strength = 'weak';
    description = 'No clear trend, trading sideways';
  }

  return { direction, strength, description, signals };
}

/**
 * Get key price levels summary
 */
export function getKeyLevels(
  data: HistoricalData[],
  currentPrice: number
): {
  support1: number | null;
  support2: number | null;
  resistance1: number | null;
  resistance2: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  distanceToSupport: number | null;
  distanceToResistance: number | null;
} {
  const levels = detectSupportResistance(data);
  const closes = data.map((d) => d.close);

  const supports = levels
    .filter((l) => l.type === 'support' && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  const resistances = levels
    .filter((l) => l.type === 'resistance' && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const ma20Arr = calculateMA(closes, 20);
  const ma50Arr = calculateMA(closes, 50);
  const ma200Arr = calculateMA(closes, 200);

  const support1 = supports[0]?.price ?? null;
  const resistance1 = resistances[0]?.price ?? null;

  return {
    support1,
    support2: supports[1]?.price ?? null,
    resistance1,
    resistance2: resistances[1]?.price ?? null,
    ma20: ma20Arr[ma20Arr.length - 1] ?? null,
    ma50: ma50Arr[ma50Arr.length - 1] ?? null,
    ma200: ma200Arr[ma200Arr.length - 1] ?? null,
    distanceToSupport: support1
      ? ((currentPrice - support1) / currentPrice) * 100
      : null,
    distanceToResistance: resistance1
      ? ((resistance1 - currentPrice) / currentPrice) * 100
      : null,
  };
}

/**
 * Calculate simple moving average
 */
function calculateMA(values: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j] ?? 0;
    }
    result.push(sum / period);
  }

  return result;
}

/**
 * Calculate RSI
 */
function calculateRSI(closes: number[], period = 14): number[] {
  const result: number[] = [];

  if (closes.length < period + 1) {
    return result;
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < period; i++) {
    result.push(NaN);
  }

  for (let i = period; i < gains.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + (gains[i] ?? 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (losses[i] ?? 0)) / period;
    }

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}

/**
 * Get time axis labels
 */
function getTimeLabels(data: HistoricalData[], width: number): string {
  if (data.length === 0) return '';

  const firstData = data[0];
  const lastData = data[data.length - 1];

  if (!firstData || !lastData) return '';

  const first =
    firstData.date instanceof Date ? firstData.date : new Date(firstData.date);
  const last =
    lastData.date instanceof Date ? lastData.date : new Date(lastData.date);

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const firstLabel = `${months[first.getMonth()]} ${first.getDate()}`;
  const lastLabel = `${months[last.getMonth()]} ${last.getDate()}`;

  const padding = width - firstLabel.length - lastLabel.length;
  return firstLabel + ' '.repeat(Math.max(0, padding)) + lastLabel;
}

/**
 * Generate volume analysis
 */
export function analyzeVolume(data: HistoricalData[]): {
  trend: 'increasing' | 'decreasing' | 'stable';
  ratio: number;
  description: string;
} {
  const recent = data.slice(-5);
  const prior = data.slice(-20, -5);

  const recentAvg = recent.reduce((a, b) => a + b.volume, 0) / recent.length;
  const priorAvg = prior.reduce((a, b) => a + b.volume, 0) / prior.length;

  const ratio = recentAvg / priorAvg;

  let trend: 'increasing' | 'decreasing' | 'stable';
  let description: string;

  if (ratio > 1.5) {
    trend = 'increasing';
    description = `Volume surging ${((ratio - 1) * 100).toFixed(0)}% above average`;
  } else if (ratio > 1.2) {
    trend = 'increasing';
    description = `Volume elevated ${((ratio - 1) * 100).toFixed(0)}% above average`;
  } else if (ratio < 0.7) {
    trend = 'decreasing';
    description = `Volume declining ${((1 - ratio) * 100).toFixed(0)}% below average`;
  } else if (ratio < 0.85) {
    trend = 'decreasing';
    description = `Volume slightly below average`;
  } else {
    trend = 'stable';
    description = 'Volume at normal levels';
  }

  return { trend, ratio, description };
}
