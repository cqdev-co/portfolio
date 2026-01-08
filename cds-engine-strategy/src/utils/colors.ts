/**
 * Enhanced Terminal Colors
 *
 * Provides gradient-based coloring for scores and values.
 * Creates a visually appealing, informative terminal output.
 */

import chalk from 'chalk';

// ============================================================================
// SCORE GRADIENTS
// ============================================================================

/**
 * Get color for a score (0-100 scale)
 * Uses a smooth gradient from red → yellow → green
 */
export function getScoreColor(score: number): (text: string) => string {
  if (score >= 85) return chalk.hex('#00FF00'); // Bright green
  if (score >= 75) return chalk.hex('#7FFF00'); // Yellow-green
  if (score >= 65) return chalk.hex('#ADFF2F'); // Green-yellow
  if (score >= 55) return chalk.hex('#FFD700'); // Gold
  if (score >= 45) return chalk.hex('#FFA500'); // Orange
  if (score >= 35) return chalk.hex('#FF6347'); // Tomato
  return chalk.hex('#FF4500'); // Red-orange
}

/**
 * Get color for percentage change
 * Green for positive, red for negative
 */
export function getChangeColor(pct: number): (text: string) => string {
  if (pct >= 5) return chalk.hex('#00FF00'); // Bright green (big gain)
  if (pct >= 2) return chalk.hex('#32CD32'); // Lime green
  if (pct >= 0) return chalk.hex('#90EE90'); // Light green
  if (pct >= -2) return chalk.hex('#FFB6C1'); // Light pink
  if (pct >= -5) return chalk.hex('#FF6B6B'); // Light red
  return chalk.hex('#FF0000'); // Bright red (big loss)
}

/**
 * Get color for RSI value
 * Green for oversold, red for overbought
 */
export function getRSIColor(rsi: number): (text: string) => string {
  if (rsi <= 30) return chalk.hex('#00FF00'); // Oversold (bullish)
  if (rsi <= 40) return chalk.hex('#7FFF00'); // Approaching oversold
  if (rsi <= 50) return chalk.hex('#FFFF00'); // Neutral-bearish
  if (rsi <= 60) return chalk.hex('#FFD700'); // Neutral-bullish
  if (rsi <= 70) return chalk.hex('#FFA500'); // Approaching overbought
  return chalk.hex('#FF4500'); // Overbought (bearish)
}

/**
 * Get color for VIX level
 */
export function getVIXColor(vix: number): (text: string) => string {
  if (vix <= 15) return chalk.hex('#00FF00'); // Calm (green)
  if (vix <= 20) return chalk.hex('#FFD700'); // Normal (gold)
  if (vix <= 30) return chalk.hex('#FFA500'); // Elevated (orange)
  if (vix <= 40) return chalk.hex('#FF6347'); // High (red)
  return chalk.hex('#FF0000'); // Extreme (bright red)
}

// ============================================================================
// VISUAL BARS
// ============================================================================

/**
 * Generate a horizontal bar for a score
 * @param value - Current value
 * @param max - Maximum value
 * @param width - Bar width in characters
 */
export function generateScoreBar(
  value: number,
  max: number,
  width: number = 20
): string {
  const pct = Math.min(value / max, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const color = getScoreColor(value);

  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

/**
 * Generate a gradient bar showing position in range
 * @param position - Position in range (0-1)
 * @param width - Bar width in characters
 */
export function generateRangeBar(position: number, width: number = 20): string {
  const pos = Math.max(0, Math.min(1, position));
  const marker = Math.round(pos * (width - 1));

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i === marker) {
      bar += chalk.cyan('●');
    } else if (i < marker) {
      // Use gradient from green (low) to yellow (mid) to red (high)
      const localPos = i / width;
      if (localPos < 0.33) {
        bar += chalk.green('─');
      } else if (localPos < 0.66) {
        bar += chalk.yellow('─');
      } else {
        bar += chalk.red('─');
      }
    } else {
      bar += chalk.gray('─');
    }
  }
  return `[${bar}]`;
}

/**
 * Generate confidence bar
 */
export function generateConfidenceBar(
  confidence: number,
  width: number = 15
): string {
  const filled = Math.round((confidence / 100) * width);
  const empty = width - filled;

  let color: (s: string) => string;
  if (confidence >= 70) {
    color = chalk.green;
  } else if (confidence >= 55) {
    color = chalk.yellow;
  } else {
    color = chalk.red;
  }

  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

// ============================================================================
// STATUS INDICATORS
// ============================================================================

/**
 * Get emoji/icon for decision status
 */
export function getDecisionIcon(decision: 'ENTER' | 'WAIT' | 'PASS'): string {
  switch (decision) {
    case 'ENTER':
      return '✅';
    case 'WAIT':
      return '⏳';
    case 'PASS':
      return '❌';
  }
}

/**
 * Get color for decision
 */
export function getDecisionColor(
  decision: 'ENTER' | 'WAIT' | 'PASS'
): (text: string) => string {
  switch (decision) {
    case 'ENTER':
      return chalk.green;
    case 'WAIT':
      return chalk.yellow;
    case 'PASS':
      return chalk.red;
  }
}

/**
 * Get trend indicator with color
 */
export function getTrendIndicator(
  trend: 'bullish' | 'bearish' | 'neutral'
): string {
  switch (trend) {
    case 'bullish':
      return chalk.green('↑');
    case 'bearish':
      return chalk.red('↓');
    case 'neutral':
      return chalk.yellow('→');
  }
}

/**
 * Get market regime badge
 */
export function getRegimeBadge(
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' | 'HIGH_VOL'
): string {
  switch (regime) {
    case 'RISK_ON':
      return chalk.bgGreen.black(' RISK ON ');
    case 'RISK_OFF':
      return chalk.bgRed.white(' RISK OFF ');
    case 'HIGH_VOL':
      return chalk.bgYellow.black(' HIGH VOL ');
    case 'NEUTRAL':
      return chalk.bgGray.white(' NEUTRAL ');
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format upside potential with appropriate color
 */
export function formatUpside(upside: number): string {
  const pct = (upside * 100).toFixed(0);
  const sign = upside >= 0 ? '+' : '';
  const color = getChangeColor(upside * 100);

  if (upside >= 0.3) return chalk.bold(color(`↑ ${sign}${pct}% upside`));
  if (upside >= 0.15) return color(`↑ ${sign}${pct}% upside`);
  if (upside >= 0) return chalk.yellow(`→ ${sign}${pct}% upside`);
  return chalk.red(`↓ ${pct}% downside`);
}

/**
 * Format score with stars and color
 */
export function formatScore(score: number): string {
  const color = getScoreColor(score);
  const stars =
    score >= 80 ? '★★★' : score >= 60 ? '★★' : score >= 40 ? '★' : '';

  return color(`${score}/100`) + (stars ? ` ${chalk.yellow(stars)}` : '');
}

/**
 * Format currency with appropriate precision
 */
export function formatCurrency(
  value: number,
  compact: boolean = false
): string {
  if (compact) {
    if (value >= 1_000_000_000_000) {
      return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage with color
 */
export function formatPercent(value: number, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  const formatted = `${sign}${value.toFixed(1)}%`;
  return getChangeColor(value)(formatted);
}

// ============================================================================
// SECTION HEADERS
// ============================================================================

/**
 * Print a major section divider
 */
export function printDivider(char: string = '═', width: number = 72): string {
  return chalk.gray(char.repeat(width));
}

/**
 * Print a sub-section divider
 */
export function printSubDivider(width: number = 68): string {
  return chalk.gray('  ' + '─'.repeat(width));
}

/**
 * Format a section header
 */
export function formatHeader(
  emoji: string,
  title: string,
  color: 'white' | 'green' | 'red' | 'cyan' | 'magenta' = 'white'
): string {
  const colorFn = {
    white: chalk.bold.white,
    green: chalk.bold.green,
    red: chalk.bold.red,
    cyan: chalk.bold.cyan,
    magenta: chalk.bold.magenta,
  }[color];

  return colorFn(`  ${emoji} ${title}`);
}
