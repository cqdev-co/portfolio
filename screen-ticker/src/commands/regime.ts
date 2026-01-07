/**
 * Trading Regime Command
 *
 * Check current market conditions before scanning.
 * Integrates with lib/ai-agent/market no-trade regime detection.
 *
 * Usage:
 *   bun run regime          # Check current regime
 *   bun run regime --weekly # Include transition warnings
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../utils/logger.ts';

// Import regime detection from lib
import {
  analyzeTradingRegime,
  detectRegimeTransition,
  // formatRegimeBadge - currently unused, kept for future use
  // formatRegimeForAI - currently unused, kept for future use
  getRegimeEmoji,
  type TradingRegimeAnalysis,
  type PriceHistory,
} from '../../../lib/ai-agent/market/no-trade-regime.ts';

// Import chart data fetcher for price history
import { fetchTickerViaProxy } from '../providers/shared-yahoo.ts';

// ============================================================================
// REGIME DISPLAY HELPERS
// ============================================================================

function getRegimeColor(regime: string): (text: string) => string {
  switch (regime) {
    case 'GO':
      return chalk.green;
    case 'CAUTION':
      return chalk.yellow;
    case 'NO_TRADE':
      return chalk.red;
    default:
      return chalk.white;
  }
}

function formatMetrics(analysis: TradingRegimeAnalysis): string {
  const lines: string[] = [];
  const m = analysis.metrics;

  lines.push(chalk.dim('METRICS:'));

  if (m.chopIndex !== undefined) {
    const chopColor =
      m.chopIndex > 61.8
        ? chalk.red
        : m.chopIndex < 38.2
          ? chalk.green
          : chalk.yellow;
    lines.push(`  Chop Index: ${chopColor(m.chopIndex.toFixed(1))}`);
  }

  const conflictColor =
    m.conflictScore > 60
      ? chalk.red
      : m.conflictScore > 40
        ? chalk.yellow
        : chalk.green;
  lines.push(`  Conflict Score: ${conflictColor(`${m.conflictScore}%`)}`);

  lines.push(`  Trend Strength: ${m.trendStrength}`);

  if (m.adxValue !== undefined) {
    const adxColor =
      m.adxValue >= 25
        ? chalk.green
        : m.adxValue < 20
          ? chalk.red
          : chalk.yellow;
    lines.push(
      `  ADX: ${adxColor(m.adxValue.toFixed(1))} (${m.adxTrend ?? 'N/A'})`
    );
  }

  if (m.breadthScore !== undefined) {
    const breadthColor =
      m.breadthScore >= 65
        ? chalk.green
        : m.breadthScore < 45
          ? chalk.red
          : chalk.yellow;
    lines.push(
      `  Breadth: ${breadthColor(`${m.breadthScore.toFixed(0)}%`)} ` +
        `(${m.breadthSignal ?? 'N/A'})`
    );
  }

  if (m.vixLevel) {
    const vixColor =
      m.vixLevel === 'CALM'
        ? chalk.green
        : m.vixLevel === 'ELEVATED'
          ? chalk.yellow
          : chalk.red;
    lines.push(
      `  VIX: ${analysis.vix?.current.toFixed(1) ?? 'N/A'} ` +
        `(${vixColor(m.vixLevel)})`
    );
  }

  if (m.spyTrend) {
    const spyColor =
      m.spyTrend === 'BULLISH'
        ? chalk.green
        : m.spyTrend === 'BEARISH'
          ? chalk.red
          : chalk.yellow;
    lines.push(`  SPY: ${spyColor(m.spyTrend)}`);
  }

  return lines.join('\n');
}

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) return '';

  return ['', chalk.dim('FACTORS:'), ...reasons.map((r) => `  • ${r}`)].join(
    '\n'
  );
}

function formatRecommendation(analysis: TradingRegimeAnalysis): string {
  const color = getRegimeColor(analysis.regime);
  return ['', color(`→ ${analysis.recommendation}`)].join('\n');
}

function formatSpreadGuidance(regime: string): string {
  const lines: string[] = ['', chalk.dim('SPREAD CRITERIA:')];

  switch (regime) {
    case 'GO':
      lines.push('  PoP: ≥70% | Cushion: ≥5% | Return: ≥20%');
      lines.push('  Position Size: 100% (normal)');
      break;
    case 'CAUTION':
      lines.push('  PoP: ≥75% | Cushion: ≥7% | Return: ≥25%');
      lines.push('  Position Size: 50% (reduced)');
      lines.push(chalk.yellow('  Only Grade A setups (score ≥ 80)'));
      break;
    case 'NO_TRADE':
      lines.push(chalk.red('  No new spreads recommended'));
      lines.push('  Position Size: 0% (preserve cash)');
      lines.push(chalk.dim('  Use --force to scan anyway'));
      break;
  }

  return lines.join('\n');
}

// ============================================================================
// PRICE HISTORY FETCHER
// ============================================================================

async function fetchSPYPriceHistory(): Promise<PriceHistory | undefined> {
  try {
    const data = await fetchTickerViaProxy('SPY');
    if (!data?.chart?.quotes || data.chart.quotes.length < 20) {
      return undefined;
    }

    const quotes = data.chart.quotes;
    return {
      highs: quotes.map((q) => q.high),
      lows: quotes.map((q) => q.low),
      closes: quotes.map((q) => q.close),
    };
  } catch (error) {
    logger.debug(`Failed to fetch SPY price history: ${error}`);
    return undefined;
  }
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

export function createRegimeCommand(): Command {
  const cmd = new Command('regime')
    .description('Check current trading regime before scanning')
    .option('-w, --weekly', 'Include transition warnings')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      console.log('');
      console.log(chalk.bold('Trading Regime Analysis'));
      console.log(chalk.dim('═'.repeat(60)));

      try {
        // Fetch SPY price history for chop/ADX calculation
        logger.debug('Fetching SPY price history...');
        const priceHistory = await fetchSPYPriceHistory();

        // Analyze trading regime
        logger.debug('Analyzing trading regime...');
        const analysis = await analyzeTradingRegime(priceHistory);

        if (options.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        // Display regime badge
        const emoji = getRegimeEmoji(analysis.regime);
        const color = getRegimeColor(analysis.regime);
        console.log('');
        console.log(
          color(
            `${emoji} ${analysis.regime} ` +
              `(${analysis.confidence}% confidence)`
          )
        );
        console.log('');

        // Display metrics
        console.log(formatMetrics(analysis));

        // Display reasons
        if (analysis.reasons.length > 0) {
          console.log(formatReasons(analysis.reasons));
        }

        // Display recommendation
        console.log(formatRecommendation(analysis));

        // Display spread guidance
        console.log(formatSpreadGuidance(analysis.regime));

        // Weekly mode: include transition warnings
        if (options.weekly) {
          console.log('');
          console.log(chalk.dim('─'.repeat(60)));
          console.log('');
          console.log(chalk.bold('Transition Warning'));

          const transition = detectRegimeTransition(
            analysis,
            undefined, // No previous metrics stored yet
            analysis.adx,
            analysis.breadth?.score
          );

          if (transition.direction === 'STABLE') {
            console.log(
              chalk.green('✓ Regime stable — no transition expected')
            );
          } else {
            const transitionEmoji =
              transition.direction === 'DETERIORATING' ? '⚠️' : '📈';
            const transitionColor =
              transition.direction === 'DETERIORATING'
                ? chalk.yellow
                : chalk.green;

            console.log(
              transitionColor(
                `${transitionEmoji} ${transition.currentRegime} → ` +
                  `${transition.likelyNextRegime} ` +
                  `(${transition.transitionProbability}% probability)`
              )
            );
            console.log(
              chalk.dim(
                `  Timeframe: ${transition.timeHorizon === 'NEAR_TERM' ? '1-2 days' : '3-7 days'}`
              )
            );

            if (transition.warningSignals.length > 0) {
              console.log('');
              console.log(chalk.dim('Warning Signals:'));
              for (const signal of transition.warningSignals) {
                console.log(`  • ${signal}`);
              }
            }

            console.log('');
            console.log(transitionColor(transition.advice));
          }
        }

        // Scan recommendation
        console.log('');
        console.log(chalk.dim('─'.repeat(60)));
        console.log('');

        if (analysis.regime === 'NO_TRADE') {
          console.log(chalk.red.bold('⛔ SCAN NOT RECOMMENDED'));
          console.log(
            chalk.dim('   Market conditions unfavorable for new entries.')
          );
          console.log(chalk.dim('   Use `bun run scan --force` to override.'));
        } else if (analysis.regime === 'CAUTION') {
          console.log(chalk.yellow.bold('⚠️  SCAN WITH CAUTION'));
          console.log(
            chalk.dim('   Focus on Grade A setups only (score ≥ 80).')
          );
          console.log(chalk.dim('   Reduce position sizes by 50%.'));
        } else {
          console.log(chalk.green.bold('✅ CLEAR TO SCAN'));
          console.log(chalk.dim('   Normal scanning and position sizing.'));
        }

        console.log('');
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  return cmd;
}

export default createRegimeCommand;
