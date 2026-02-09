/**
 * PCS Market Regime Command
 *
 * Analyzes market conditions and recommends PCS strategy adjustments.
 * In bear markets, PCS should be avoided or heavily reduced.
 */

import chalk from 'chalk';
import { logger } from '../utils/logger.ts';
import {
  fetchTickerCached,
  convertToQuoteData,
  convertToHistoricalData,
  isProxyConfigured,
} from '@portfolio/providers';
import { RSI, SMA } from 'technicalindicators';
import { getRegimeAdjustments } from '../config/strategy.ts';

type MarketRegime = 'bull' | 'neutral' | 'bear';

function detectRegime(
  price: number,
  ma50: number | undefined,
  ma200: number | undefined,
  rsi: number | undefined
): MarketRegime {
  let bullPoints = 0;
  let bearPoints = 0;

  if (ma50 && price > ma50) bullPoints += 2;
  else if (ma50) bearPoints += 2;

  if (ma200 && price > ma200) bullPoints += 3;
  else if (ma200) bearPoints += 3;

  if (ma50 && ma200 && ma50 > ma200) bullPoints += 2;
  else if (ma50 && ma200) bearPoints += 2;

  if (rsi && rsi > 50) bullPoints += 1;
  else if (rsi) bearPoints += 1;

  if (bullPoints >= 6) return 'bull';
  if (bearPoints >= 5) return 'bear';
  return 'neutral';
}

export async function runRegime(options: { verbose?: boolean }): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  console.log();
  console.log(chalk.bold.magenta('  PCS Market Regime Analysis'));
  console.log(chalk.gray(`  Proxy: ${isProxyConfigured() ? 'YES' : 'NO'}`));
  console.log();

  // Analyze SPY
  const benchmarks = ['SPY', 'QQQ', 'IWM'];
  const regimes: MarketRegime[] = [];

  for (const symbol of benchmarks) {
    const proxyData = await fetchTickerCached(symbol);
    if (!proxyData) continue;

    const quote = convertToQuoteData(proxyData);
    const historical = convertToHistoricalData(proxyData);
    if (!quote?.regularMarketPrice || historical.length < 50) continue;

    const closes = historical.map((d) => d.close);
    const sma50 = SMA.calculate({ values: closes, period: 50 });
    const sma200 =
      closes.length >= 200
        ? SMA.calculate({ values: closes, period: 200 })
        : [];
    const rsiResult = RSI.calculate({ values: closes, period: 14 });

    const regime = detectRegime(
      quote.regularMarketPrice,
      sma50[sma50.length - 1],
      sma200[sma200.length - 1],
      rsiResult[rsiResult.length - 1]
    );

    regimes.push(regime);

    const regimeColor =
      regime === 'bull'
        ? chalk.green
        : regime === 'bear'
          ? chalk.red
          : chalk.yellow;

    console.log(
      chalk.bold.white(`  ${symbol.padEnd(5)}`) +
        chalk.gray(` $${quote.regularMarketPrice.toFixed(2)} `) +
        regimeColor(regime.toUpperCase()) +
        chalk.gray(` RSI:${rsiResult[rsiResult.length - 1]?.toFixed(0) ?? '?'}`)
    );
  }

  // Overall regime
  const bullCount = regimes.filter((r) => r === 'bull').length;
  const bearCount = regimes.filter((r) => r === 'bear').length;

  let overall: MarketRegime;
  if (bullCount >= 2) overall = 'bull';
  else if (bearCount >= 2) overall = 'bear';
  else overall = 'neutral';

  console.log();
  console.log(chalk.gray('─'.repeat(50)));
  console.log();

  const overallColor =
    overall === 'bull'
      ? chalk.green
      : overall === 'bear'
        ? chalk.red
        : chalk.yellow;

  console.log(
    chalk.bold.white('  Overall: ') + overallColor(overall.toUpperCase())
  );

  // PCS strategy adjustments
  const adjustments = getRegimeAdjustments(overall);

  console.log();
  console.log(chalk.bold.white('  PCS Strategy Adjustments:'));
  console.log(
    chalk.gray(`    Min score threshold: `) +
      chalk.white(adjustments.minScore.toString())
  );
  console.log(
    chalk.gray(`    Position size multiplier: `) +
      chalk.white(`${(adjustments.positionSizeMultiplier * 100).toFixed(0)}%`)
  );
  console.log(
    chalk.gray(`    Max concurrent positions: `) +
      chalk.white(adjustments.maxConcurrentPositions.toString())
  );

  if (overall === 'bear') {
    console.log();
    console.log(chalk.red.bold('  WARNING: Bear market detected'));
    console.log(chalk.red('  Avoid opening new PCS positions'));
    console.log(chalk.red('  Consider closing existing positions'));
  }

  console.log();
}
