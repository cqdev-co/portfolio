/**
 * PCS Spread Scanner Command
 *
 * Scans tickers to find viable OTM put credit spreads.
 * Core criteria from strategy.config.yaml (pcs sections):
 * - Short delta: 0.20-0.35 (OTM)
 * - Credit ratio: 20-45% of width
 * - Distance OTM: 5-15% below price
 * - PoP: >= 65%
 * - DTE: 21-45 days
 *
 * Key difference from CDS: scans PUTS (not calls), receives CREDIT (not debit).
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import {
  fetchSP500Tickers,
  isTickerDBConfigured,
  isProxyConfigured,
  fetchTickerCached,
  convertToQuoteData,
  fetchOptionsChainCached,
  TICKER_LISTS,
} from '@portfolio/providers';
import { getPCSSpreadCriteria } from '../config/strategy.ts';

interface SpreadResult {
  ticker: string;
  price: number;
  spread: string | null;
  credit: number | null;
  width: number | null;
  creditPct: number | null;
  cushion: number | null;
  pop: number | null;
  returnPct: number | null;
  dte: number | null;
  viable: boolean;
  reason: string;
}

/**
 * Normal CDF approximation for PoP calculation
 */
function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.sqrt(2);
  const y = Math.sqrt(
    1 - Math.exp((-a * a * (4 / Math.PI + 0.147 * a * a)) / (1 + 0.147 * a * a))
  );
  return 0.5 * (1 + sign * y);
}

/**
 * Calculate PoP for put credit spread
 * PCS profits if price stays ABOVE breakeven (short strike - credit)
 */
function calculatePoP(
  price: number,
  breakeven: number,
  iv: number,
  dte: number
): number {
  if (iv <= 0 || dte <= 0) return price > breakeven ? 75 : 25;
  const T = dte / 365;
  const z = Math.log(price / breakeven) / (iv * Math.sqrt(T));
  const pop = normalCDF(z) * 100;
  return Math.min(95, Math.max(5, Math.round(pop)));
}

/**
 * Find viable put credit spread for a ticker
 */
async function findViablePutSpread(
  ticker: string,
  criteria: ReturnType<typeof getPCSSpreadCriteria>
): Promise<SpreadResult> {
  const result: SpreadResult = {
    ticker,
    price: 0,
    spread: null,
    credit: null,
    width: null,
    creditPct: null,
    cushion: null,
    pop: null,
    returnPct: null,
    dte: null,
    viable: false,
    reason: '',
  };

  try {
    // Get price via proxy or direct
    let price: number | undefined;

    if (isProxyConfigured()) {
      const proxyData = await fetchTickerCached(ticker);
      if (proxyData) {
        const quoteData = convertToQuoteData(proxyData);
        price = quoteData?.regularMarketPrice;
      }
    }

    if (!price) {
      result.reason = 'No price data';
      return result;
    }
    result.price = price;

    // Get options chain (need PUTS)
    const optionsChain = await fetchOptionsChainCached(
      ticker,
      criteria.targetDTE
    );
    if (!optionsChain) {
      result.reason = 'No options';
      return result;
    }

    const { puts, expirationDate } = optionsChain;
    const expiration = new Date(expirationDate);
    const dte = Math.ceil(
      (expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    result.dte = dte;

    if (!puts || puts.length === 0) {
      result.reason = 'No puts';
      return result;
    }

    // Sort by strike descending (start from ATM, go OTM)
    const sortedPuts = [...puts].sort((a, b) => b.strike - a.strike);

    // Find OTM puts: strike should be below current price
    // Target: 5-15% below price (delta 0.20-0.35)
    const otmLowPct = 0.85; // 15% below price
    const otmHighPct = 0.97; // 3% below price (near ATM)
    const minOTM = price * otmLowPct;
    const maxOTM = price * otmHighPct;

    // Width options
    const widths = [5, 10];
    const minOI = criteria.minOI;

    let bestSpread: {
      short: number;
      long: number;
      credit: number;
      width: number;
      cushion: number;
      pop: number;
      returnPct: number;
    } | null = null;

    for (const shortPut of sortedPuts) {
      // Must be OTM
      if (shortPut.strike >= price) continue;
      if (shortPut.strike < minOTM || shortPut.strike > maxOTM) continue;
      if ((shortPut.openInterest || 0) < minOI) continue;

      for (const width of widths) {
        const longStrike = shortPut.strike - width;
        const longPut = sortedPuts.find((p) => p.strike === longStrike);
        if (!longPut) continue;
        if ((longPut.openInterest || 0) < 5) continue;

        // Calculate credit: sell short put bid - buy long put ask
        const credit = (shortPut.bid || 0) - (longPut.ask || 0);
        if (credit <= 0 || !isFinite(credit)) continue;

        const creditRatio = credit / width;
        if (creditRatio < criteria.minCreditRatio) continue;
        if (creditRatio > criteria.maxCreditRatio) continue;

        // Calculate metrics
        const breakeven = shortPut.strike - credit;
        const cushion = ((price - breakeven) / price) * 100;
        const maxProfit = credit;
        const maxLoss = width - credit;
        const returnOnRisk = maxProfit / maxLoss;

        if (cushion < criteria.minCushion) continue;

        // Calculate PoP
        const iv = shortPut.impliedVolatility || 0.3;
        const pop = calculatePoP(price, breakeven, iv, dte);
        if (pop < criteria.minPoP * 100) continue;

        // Found viable spread!
        if (!bestSpread || cushion > bestSpread.cushion) {
          bestSpread = {
            short: shortPut.strike,
            long: longStrike,
            credit,
            width,
            cushion,
            pop,
            returnPct: returnOnRisk * 100,
          };
        }
      }
    }

    if (bestSpread) {
      result.spread = `${bestSpread.short}/${bestSpread.long}`;
      result.credit = bestSpread.credit;
      result.width = bestSpread.width;
      result.creditPct = (bestSpread.credit / bestSpread.width) * 100;
      result.cushion = bestSpread.cushion;
      result.pop = bestSpread.pop;
      result.returnPct = bestSpread.returnPct;
      result.viable = true;
      result.reason = 'Viable';
    } else {
      result.reason = 'No viable put spreads found';
    }

    return result;
  } catch (error) {
    result.reason = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
    return result;
  }
}

export interface ScanSpreadsOptions {
  list: string;
  tickers?: string;
  verbose?: boolean;
  relaxed?: boolean;
  dte?: number;
  pop?: number;
}

/**
 * Main PCS scan-spreads command
 */
export async function scanSpreads(options: ScanSpreadsOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const criteria = getPCSSpreadCriteria();
  if (options.dte) criteria.targetDTE = options.dte;

  // Get tickers
  let tickers: string[];
  let sourceDescription: string;

  if (options.tickers) {
    tickers = options.tickers.split(',').map((t) => t.trim().toUpperCase());
    sourceDescription = 'specified tickers';
  } else {
    const listName = options.list.toLowerCase();
    if (listName === 'sp500' && isTickerDBConfigured()) {
      tickers = await fetchSP500Tickers({ limit: 50 });
      sourceDescription = `S&P 500 (${tickers.length})`;
    } else if (TICKER_LISTS[listName]) {
      tickers = TICKER_LISTS[listName]!;
      sourceDescription = `${listName} list`;
    } else {
      tickers = TICKER_LISTS['mega']!;
      sourceDescription = 'mega list (default)';
    }
  }

  console.log();
  console.log(chalk.bold.magenta('  Put Credit Spread Scanner'));
  console.log(chalk.gray(`  Source: ${sourceDescription}`));
  console.log(chalk.gray(`  Criteria:`));
  console.log(
    chalk.gray(
      `    Credit ratio: ${(criteria.minCreditRatio * 100).toFixed(0)}-${(criteria.maxCreditRatio * 100).toFixed(0)}% of width`
    )
  );
  console.log(chalk.gray(`    Cushion: >= ${criteria.minCushion}%`));
  console.log(chalk.gray(`    PoP: >= ${(criteria.minPoP * 100).toFixed(0)}%`));
  console.log(chalk.gray(`    DTE: ~${criteria.targetDTE} days`));
  console.log(
    chalk.gray(
      `    Short delta: ${criteria.shortDeltaMin}-${criteria.shortDeltaMax}`
    )
  );
  console.log();

  const results: SpreadResult[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    if (!ticker) continue;
    process.stdout.write(
      chalk.gray(`  [${i + 1}/${tickers.length}] ${ticker.padEnd(6)}`)
    );

    const result = await findViablePutSpread(ticker, criteria);
    results.push(result);

    if (result.viable) {
      console.log(
        chalk.green(' OK ') +
          chalk.white(result.spread) +
          chalk.gray(` ($${result.credit?.toFixed(2)} credit)`)
      );
    } else {
      console.log(chalk.gray(` -- ${result.reason}`));
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  // Display results
  const viable = results.filter((r) => r.viable);

  console.log();
  console.log(chalk.gray('─'.repeat(72)));
  console.log();

  if (viable.length === 0) {
    console.log(
      chalk.yellow('  No tickers found with viable put credit spreads')
    );
    console.log(
      chalk.gray('  Try a different list or check back when IV is higher')
    );
  } else {
    console.log(
      chalk.bold.green(`  Found ${viable.length} ticker(s) with viable PCS:\n`)
    );

    const table = new Table({
      head: [
        chalk.magenta('Ticker'),
        chalk.magenta('Price'),
        chalk.magenta('Spread'),
        chalk.magenta('Credit'),
        chalk.magenta('Cr%'),
        chalk.magenta('Cushion'),
        chalk.magenta('PoP'),
        chalk.magenta('Return'),
        chalk.magenta('DTE'),
      ],
      colWidths: [8, 10, 12, 8, 7, 9, 7, 9, 6],
      style: { head: [], border: ['gray'] },
    });

    for (const r of viable) {
      table.push([
        chalk.bold(r.ticker),
        chalk.white(`$${r.price.toFixed(2)}`),
        chalk.white(r.spread ?? '-'),
        chalk.green(`$${r.credit?.toFixed(2)}`),
        chalk.white(`${r.creditPct?.toFixed(0)}%`),
        chalk.green(`${r.cushion?.toFixed(1)}%`),
        chalk.cyan(`${r.pop}%`),
        chalk.green(`${r.returnPct?.toFixed(0)}%`),
        chalk.gray(`${r.dte}`),
      ]);
    }

    console.log(table.toString());
    console.log();

    const best = viable.sort((a, b) => (b.cushion ?? 0) - (a.cushion ?? 0))[0];
    if (best) {
      console.log(
        chalk.bold.white('  Best Setup: ') +
          chalk.magenta(best.ticker) +
          chalk.gray(' - ') +
          chalk.white(`Sell ${best.spread}P`) +
          chalk.gray(` @ $${best.credit?.toFixed(2)} credit`)
      );
      console.log(
        chalk.gray('     ') +
          chalk.green(`${best.cushion?.toFixed(1)}% cushion`) +
          chalk.gray(' | ') +
          chalk.cyan(`${best.pop}% PoP`) +
          chalk.gray(' | ') +
          chalk.green(`${best.returnPct?.toFixed(0)}% return`)
      );
    }
  }

  console.log();
}
