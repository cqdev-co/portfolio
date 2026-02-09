/**
 * PCS Scan Command
 *
 * Screens stocks for PCS suitability using technical, fundamental,
 * analyst, and IV signals. Outputs ranked list of candidates.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import {
  fetchSP500Tickers,
  fetchTickerCached,
  convertToQuoteData,
  convertToHistoricalData,
  convertToQuoteSummary,
  isProxyConfigured,
  TICKER_LISTS,
} from '@portfolio/providers';
import { screenStock } from '../engine/screener.ts';
import { savePCSSignal } from '../storage/supabase.ts';
import type { ScanOptions, PCSStockScore } from '../types/index.ts';

export async function runScan(options: ScanOptions): Promise<void> {
  logger.setVerbose(options.verbose);
  logger.header('PCS Stock Scanner');

  // Determine tickers
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

  logger.info(`Scanning ${tickers.length} tickers...`);
  logger.info(
    `Min score: ${options.minScore} | Proxy: ${isProxyConfigured() ? 'YES' : 'NO'}`
  );
  console.log();

  const results: PCSStockScore[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    if (!ticker) continue;

    process.stdout.write(
      chalk.gray(`  [${i + 1}/${tickers.length}] ${ticker.padEnd(6)}`)
    );

    try {
      const proxyData = await fetchTickerCached(ticker);
      if (!proxyData) {
        console.log(chalk.gray(' -- no data'));
        continue;
      }

      const quote = convertToQuoteData(proxyData);
      const summary = convertToQuoteSummary(proxyData);
      const historical = convertToHistoricalData(proxyData);

      if (!quote) {
        console.log(chalk.gray(' -- no quote'));
        continue;
      }

      // Get ATM IV if options data available
      const atmIV = proxyData.options?.atmIV ?? null;

      const score = screenStock(quote, summary, historical, atmIV);
      results.push(score);

      // Save to DB
      if (!options.dryRun) {
        await savePCSSignal(score);
      }

      // Display
      const scoreColor =
        score.totalScore >= 80
          ? chalk.green
          : score.totalScore >= 65
            ? chalk.yellow
            : chalk.gray;

      console.log(
        scoreColor(`${score.totalScore.toString().padStart(3)} pts`) +
          chalk.gray(
            `  T:${score.technicalScore} F:${score.fundamentalScore} A:${score.analystScore} IV:${score.ivScore}`
          ) +
          (score.ivRank !== undefined
            ? chalk.cyan(` IVR:${score.ivRank}%`)
            : '')
      );
    } catch (error) {
      console.log(
        chalk.red(
          ` -- Error: ${error instanceof Error ? error.message : 'Unknown'}`
        )
      );
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  // Results table
  const qualifying = results
    .filter((r) => r.totalScore >= options.minScore)
    .sort((a, b) => b.totalScore - a.totalScore);

  console.log();
  console.log(chalk.gray('─'.repeat(72)));

  if (qualifying.length === 0) {
    console.log(chalk.yellow('  No stocks meet PCS criteria'));
  } else {
    console.log(
      chalk.bold.green(`\n  Top ${qualifying.length} PCS Candidates:\n`)
    );

    const table = new Table({
      head: [
        chalk.magenta('Ticker'),
        chalk.magenta('Price'),
        chalk.magenta('Tech'),
        chalk.magenta('Fund'),
        chalk.magenta('Anlst'),
        chalk.magenta('IV'),
        chalk.magenta('Total'),
        chalk.magenta('IVR'),
        chalk.magenta('Signals'),
      ],
      colWidths: [8, 10, 7, 7, 7, 6, 8, 6, 30],
      style: { head: [], border: ['gray'] },
    });

    for (const s of qualifying.slice(0, 20)) {
      const topSignals = s.signals
        .sort((a, b) => b.points - a.points)
        .slice(0, 2)
        .map((sig) => sig.name)
        .join(', ');

      table.push([
        chalk.bold(s.ticker),
        chalk.white(`$${s.price.toFixed(2)}`),
        chalk.blue(s.technicalScore.toString()),
        chalk.yellow(s.fundamentalScore.toString()),
        chalk.cyan(s.analystScore.toString()),
        chalk.magenta(s.ivScore.toString()),
        s.totalScore >= 80
          ? chalk.green(s.totalScore.toString())
          : s.totalScore >= 65
            ? chalk.yellow(s.totalScore.toString())
            : chalk.gray(s.totalScore.toString()),
        s.ivRank !== undefined ? chalk.cyan(`${s.ivRank}%`) : chalk.gray('-'),
        chalk.gray(topSignals),
      ]);
    }

    console.log(table.toString());
  }

  console.log();
}
