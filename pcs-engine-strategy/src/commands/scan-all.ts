/**
 * PCS Scan-All Command
 *
 * Combines stock scanning with spread scanning for a complete
 * PCS opportunity analysis.
 */

import chalk from 'chalk';
import { logger } from '../utils/logger.ts';
import {
  fetchSP500Tickers,
  fetchTickerCached,
  convertToQuoteData,
  convertToHistoricalData,
  convertToQuoteSummary,
  isProxyConfigured,
  fetchOptionsChainCached,
  TICKER_LISTS,
} from '@portfolio/providers';
import { screenStock } from '../engine/screener.ts';
import { getPCSSpreadCriteria } from '../config/strategy.ts';
import { savePCSSignal } from '../storage/supabase.ts';
import type { PCSStockScore } from '../types/index.ts';

export interface ScanAllOptions {
  list?: string;
  tickers?: string;
  top?: number;
  minScore?: number;
  verbose?: boolean;
  summary?: boolean;
  watchlist?: boolean;
  fromDb?: boolean;
}

export async function runScanAll(options: ScanAllOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const minScore = options.minScore ?? 65;
  const criteria = getPCSSpreadCriteria();

  // Get tickers
  let tickers: string[];
  if (options.tickers) {
    tickers = options.tickers.split(',').map((t) => t.trim().toUpperCase());
  } else if (options.list && TICKER_LISTS[options.list]) {
    tickers = TICKER_LISTS[options.list]!;
  } else if (options.list === 'sp500') {
    tickers = await fetchSP500Tickers({ limit: options.top ?? 50 });
  } else {
    tickers = TICKER_LISTS['mega']!;
  }

  console.log();
  console.log(chalk.bold.magenta('  PCS Engine - Full Scan'));
  console.log(
    chalk.gray(`  Tickers: ${tickers.length} | Min Score: ${minScore}`)
  );
  console.log(chalk.gray(`  Proxy: ${isProxyConfigured() ? 'YES' : 'NO'}`));
  console.log();

  const scores: PCSStockScore[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    if (!ticker) continue;

    process.stdout.write(
      chalk.gray(`  [${i + 1}/${tickers.length}] ${ticker.padEnd(6)}`)
    );

    try {
      const proxyData = await fetchTickerCached(ticker);
      if (!proxyData) {
        console.log(chalk.gray(' -- skip'));
        continue;
      }

      const quote = convertToQuoteData(proxyData);
      const summary = convertToQuoteSummary(proxyData);
      const historical = convertToHistoricalData(proxyData);
      if (!quote) {
        console.log(chalk.gray(' -- no quote'));
        continue;
      }

      const atmIV = proxyData.options?.atmIV ?? null;
      const score = screenStock(quote, summary, historical, atmIV);
      scores.push(score);

      await savePCSSignal(score);

      const scoreColor =
        score.totalScore >= 80
          ? chalk.green
          : score.totalScore >= 65
            ? chalk.yellow
            : chalk.gray;

      console.log(
        scoreColor(`${score.totalScore.toString().padStart(3)} pts`) +
          (score.ivRank !== undefined
            ? chalk.cyan(` IVR:${score.ivRank}%`)
            : '')
      );
    } catch {
      console.log(chalk.gray(' -- error'));
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  // Summary
  const qualifying = scores
    .filter((s) => s.totalScore >= minScore)
    .sort((a, b) => b.totalScore - a.totalScore);

  console.log();
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
  console.log(
    chalk.bold.white(
      `  Scanned: ${scores.length} | Qualifying: ${qualifying.length} | Min: ${minScore}`
    )
  );

  if (qualifying.length > 0) {
    console.log();
    console.log(chalk.bold.green('  Top PCS Candidates:'));
    for (const s of qualifying.slice(0, 10)) {
      const ivInfo = s.ivRank !== undefined ? ` IVR:${s.ivRank}%` : '';
      console.log(
        chalk.bold.white(`    ${s.ticker.padEnd(6)}`) +
          chalk.green(`${s.totalScore} pts`) +
          chalk.cyan(ivInfo) +
          chalk.gray(` $${s.price.toFixed(2)}`)
      );
    }

    // Suggest which to scan for spreads
    console.log();
    const spreadTickers = qualifying
      .slice(0, 5)
      .map((s) => s.ticker)
      .join(',');
    console.log(
      chalk.gray(
        `  Scan spreads: bun run scan-spreads --tickers ${spreadTickers}`
      )
    );
  }

  console.log();
}
