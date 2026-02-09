/**
 * PCS Daily Briefing Command
 *
 * Provides a quick overview of market conditions and PCS opportunities.
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

export async function runBriefing(options: {
  verbose?: boolean;
}): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  console.log();
  console.log(chalk.bold.magenta('  PCS Daily Briefing'));
  console.log(chalk.gray(`  ${dateStr}`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log();

  // Market overview
  const indices = ['SPY', 'QQQ', 'IWM', 'VIX'];

  console.log(chalk.bold.white('  Market Overview:'));
  console.log();

  for (const symbol of indices) {
    const proxyData = await fetchTickerCached(symbol);
    if (!proxyData) continue;

    const quote = convertToQuoteData(proxyData);
    if (!quote?.regularMarketPrice) continue;

    const historical = convertToHistoricalData(proxyData);
    const closes = historical.map((d) => d.close);

    let rsi: number | undefined;
    if (closes.length >= 15) {
      const rsiResult = RSI.calculate({ values: closes, period: 14 });
      rsi = rsiResult[rsiResult.length - 1];
    }

    let ma50: number | undefined;
    if (closes.length >= 50) {
      const sma50 = SMA.calculate({ values: closes, period: 50 });
      ma50 = sma50[sma50.length - 1];
    }

    const aboveMA50 =
      ma50 !== undefined && quote.regularMarketPrice > ma50 ? 'above' : 'below';

    const change = proxyData.quote?.change ?? 0;
    const changeColor = change >= 0 ? chalk.green : chalk.red;
    const changeSign = change >= 0 ? '+' : '';

    console.log(
      chalk.bold.white(`    ${symbol.padEnd(5)}`) +
        chalk.white(`$${quote.regularMarketPrice.toFixed(2)} `) +
        changeColor(`${changeSign}${change.toFixed(2)}`) +
        chalk.gray(` | RSI:${rsi?.toFixed(0) ?? '?'} | ${aboveMA50} MA50`)
    );
  }

  // VIX assessment for PCS
  console.log();
  const vixData = await fetchTickerCached('VIX');
  if (vixData?.quote?.price) {
    const vix = vixData.quote.price;
    let vixAssessment: string;
    if (vix < 15) {
      vixAssessment = chalk.yellow('LOW - Minimal premium for PCS');
    } else if (vix < 20) {
      vixAssessment = chalk.green('MODERATE - Good for PCS');
    } else if (vix < 30) {
      vixAssessment = chalk.green.bold('ELEVATED - Excellent for PCS');
    } else {
      vixAssessment = chalk.red('HIGH - Proceed with caution');
    }

    console.log(chalk.bold.white('  VIX Assessment: ') + vixAssessment);
  }

  console.log();
  console.log(chalk.gray('  Run `bun run scan-all` for full PCS analysis'));
  console.log();
}
