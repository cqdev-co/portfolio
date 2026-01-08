/**
 * Sector Rotation Analysis Command
 * v2.6.0: Analyze relative strength across sectors to identify rotation
 *
 * Uses sector ETFs to determine which sectors are:
 * - Leading (outperforming SPY)
 * - Lagging (underperforming SPY)
 * - Rotating in/out (changing leadership)
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { yahooProvider } from '../providers/yahoo.ts';

// Major sector ETFs
const SECTOR_ETFS: Record<string, { etf: string; name: string }> = {
  XLK: { etf: 'XLK', name: 'Technology' },
  XLF: { etf: 'XLF', name: 'Financials' },
  XLV: { etf: 'XLV', name: 'Healthcare' },
  XLY: { etf: 'XLY', name: 'Consumer Discretionary' },
  XLP: { etf: 'XLP', name: 'Consumer Staples' },
  XLE: { etf: 'XLE', name: 'Energy' },
  XLI: { etf: 'XLI', name: 'Industrials' },
  XLB: { etf: 'XLB', name: 'Materials' },
  XLU: { etf: 'XLU', name: 'Utilities' },
  XLRE: { etf: 'XLRE', name: 'Real Estate' },
  XLC: { etf: 'XLC', name: 'Communication Services' },
};

interface SectorAnalysis {
  etf: string;
  name: string;
  price: number;
  change1D: number;
  change5D: number;
  change1M: number;
  change3M: number;
  rsVsSpy1M: number; // Relative strength vs SPY
  rsVsSpy3M: number;
  trend: 'leading' | 'lagging' | 'neutral';
  momentum: 'improving' | 'stable' | 'deteriorating';
  rsi: number;
}

/**
 * Calculate relative strength
 */
function calculateRS(sectorChange: number, spyChange: number): number {
  // RS = sector return - benchmark return
  return sectorChange - spyChange;
}

/**
 * Calculate simple RSI from price array
 */
function calculateSimpleRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  const changes = closes
    .slice(-(period + 1))
    .map((c, i, arr) => {
      if (i === 0) return 0;
      const prev = arr[i - 1];
      return prev !== undefined ? c - prev : 0;
    })
    .slice(1);

  let gains = 0;
  let losses = 0;

  for (const change of changes) {
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Analyze sector rotation
 */
export async function analyzeSectorRotation(options: {
  verbose?: boolean;
}): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  console.log();
  console.log(chalk.bold.cyan('  📊 Sector Rotation Analysis'));
  console.log(chalk.gray('  Comparing sector ETFs to SPY benchmark'));
  console.log();

  // Fetch SPY data first (need 60+ days for 3M comparison)
  const spyHistorical = await yahooProvider.getHistorical('SPY', 120);
  if (!spyHistorical || spyHistorical.length < 30) {
    logger.error('Failed to fetch SPY data');
    return;
  }

  const spyCloses = spyHistorical.map((h) => h.close);
  const spyNow = spyCloses[spyCloses.length - 1] ?? 0;
  const spy5D = spyCloses[Math.max(0, spyCloses.length - 6)] ?? spyNow;
  const spy1M = spyCloses[Math.max(0, spyCloses.length - 22)] ?? spyNow;
  const spy3M = spyCloses[Math.max(0, spyCloses.length - 66)] ?? spyNow;

  const spyChange5D = ((spyNow - spy5D) / spy5D) * 100;
  const spyChange1M = ((spyNow - spy1M) / spy1M) * 100;
  const spyChange3M = ((spyNow - spy3M) / spy3M) * 100;

  // Analyze each sector
  const results: SectorAnalysis[] = [];

  for (const [, sector] of Object.entries(SECTOR_ETFS)) {
    process.stdout.write(chalk.gray(`  Analyzing ${sector.name}...`));

    try {
      const historical = await yahooProvider.getHistorical(sector.etf, 120);
      const quote = await yahooProvider.getQuote(sector.etf);

      if (!historical || historical.length < 30 || !quote) {
        console.log(chalk.yellow(' ⚠ insufficient data'));
        continue;
      }

      const closes = historical.map((h) => h.close);
      const now = closes[closes.length - 1] ?? 0;
      const d1 = closes[Math.max(0, closes.length - 2)] ?? now;
      const d5 = closes[Math.max(0, closes.length - 6)] ?? now;
      const m1 = closes[Math.max(0, closes.length - 22)] ?? now;
      const m3 = closes[Math.max(0, closes.length - 66)] ?? now;

      const change1D = ((now - d1) / d1) * 100;
      const change5D = ((now - d5) / d5) * 100;
      const change1M = ((now - m1) / m1) * 100;
      const change3M = ((now - m3) / m3) * 100;

      const rsVsSpy1M = calculateRS(change1M, spyChange1M);
      const rsVsSpy3M = calculateRS(change3M, spyChange3M);
      const rsi = calculateSimpleRSI(closes);

      // Determine trend based on RS
      let trend: SectorAnalysis['trend'];
      if (rsVsSpy1M > 2 && rsVsSpy3M > 2) {
        trend = 'leading';
      } else if (rsVsSpy1M < -2 && rsVsSpy3M < -2) {
        trend = 'lagging';
      } else {
        trend = 'neutral';
      }

      // Determine momentum (is RS improving?)
      let momentum: SectorAnalysis['momentum'];
      if (rsVsSpy1M > rsVsSpy3M + 1) {
        momentum = 'improving';
      } else if (rsVsSpy1M < rsVsSpy3M - 1) {
        momentum = 'deteriorating';
      } else {
        momentum = 'stable';
      }

      results.push({
        etf: sector.etf,
        name: sector.name,
        price: quote.regularMarketPrice ?? now,
        change1D,
        change5D,
        change1M,
        change3M,
        rsVsSpy1M,
        rsVsSpy3M,
        trend,
        momentum,
        rsi,
      });

      console.log(chalk.green(' ✓'));
    } catch (error) {
      console.log(chalk.red(' ✗'));
      logger.debug(`Failed: ${error}`);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  if (results.length === 0) {
    logger.error('No sector data available');
    return;
  }

  // Sort by 1M relative strength
  results.sort((a, b) => b.rsVsSpy1M - a.rsVsSpy1M);

  // Display SPY benchmark
  console.log();
  console.log(chalk.gray('  ─'.repeat(36)));
  console.log(
    chalk.white('  SPY Benchmark: ') +
      chalk.gray('5D: ') +
      (spyChange5D >= 0 ? chalk.green : chalk.red)(
        `${spyChange5D >= 0 ? '+' : ''}${spyChange5D.toFixed(1)}%`
      ) +
      chalk.gray(' | 1M: ') +
      (spyChange1M >= 0 ? chalk.green : chalk.red)(
        `${spyChange1M >= 0 ? '+' : ''}${spyChange1M.toFixed(1)}%`
      ) +
      chalk.gray(' | 3M: ') +
      (spyChange3M >= 0 ? chalk.green : chalk.red)(
        `${spyChange3M >= 0 ? '+' : ''}${spyChange3M.toFixed(1)}%`
      )
  );
  console.log(chalk.gray('  ─'.repeat(36)));
  console.log();

  // Display results table
  const table = new Table({
    head: [
      chalk.cyan('Sector'),
      chalk.cyan('ETF'),
      chalk.cyan('Price'),
      chalk.cyan('1D'),
      chalk.cyan('5D'),
      chalk.cyan('1M'),
      chalk.cyan('3M'),
      chalk.cyan('RS 1M'),
      chalk.cyan('Trend'),
      chalk.cyan('RSI'),
    ],
    colWidths: [22, 6, 9, 8, 8, 8, 8, 9, 12, 6],
    style: { head: [], border: ['gray'] },
  });

  for (const r of results) {
    const formatChange = (val: number) => {
      const str = `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
      return val >= 0 ? chalk.green(str) : chalk.red(str);
    };

    const formatRS = (val: number) => {
      const str = `${val >= 0 ? '+' : ''}${val.toFixed(1)}`;
      if (val > 2) return chalk.green(str);
      if (val < -2) return chalk.red(str);
      return chalk.white(str);
    };

    const formatTrend = (trend: string, mom: string) => {
      if (trend === 'leading') {
        return mom === 'improving'
          ? chalk.bold.green('↑ LEADING')
          : chalk.green('LEADING');
      }
      if (trend === 'lagging') {
        return mom === 'deteriorating'
          ? chalk.bold.red('↓ LAGGING')
          : chalk.red('LAGGING');
      }
      return mom === 'improving'
        ? chalk.yellow('↑ Rotating')
        : mom === 'deteriorating'
          ? chalk.yellow('↓ Rotating')
          : chalk.gray('Neutral');
    };

    table.push([
      chalk.white(r.name),
      chalk.gray(r.etf),
      chalk.white(`$${r.price.toFixed(2)}`),
      formatChange(r.change1D),
      formatChange(r.change5D),
      formatChange(r.change1M),
      formatChange(r.change3M),
      formatRS(r.rsVsSpy1M),
      formatTrend(r.trend, r.momentum),
      r.rsi > 70
        ? chalk.red(r.rsi.toFixed(0))
        : r.rsi < 30
          ? chalk.green(r.rsi.toFixed(0))
          : chalk.white(r.rsi.toFixed(0)),
    ]);
  }

  console.log(table.toString());

  // Summary
  const leading = results.filter((r) => r.trend === 'leading');
  const lagging = results.filter((r) => r.trend === 'lagging');
  const rotatingIn = results.filter(
    (r) => r.trend === 'neutral' && r.momentum === 'improving'
  );

  console.log();
  if (leading.length > 0) {
    console.log(
      chalk.green('  ✅ Leading Sectors: ') +
        chalk.white(leading.map((r) => r.name).join(', '))
    );
  }
  if (rotatingIn.length > 0) {
    console.log(
      chalk.yellow('  ↗️  Rotating In: ') +
        chalk.white(rotatingIn.map((r) => r.name).join(', '))
    );
  }
  if (lagging.length > 0) {
    console.log(
      chalk.red('  ⬇️  Lagging Sectors: ') +
        chalk.white(lagging.map((r) => r.name).join(', '))
    );
  }

  // Investment guidance
  console.log();
  console.log(chalk.bold.white('  📈 Rotation Guidance:'));
  if (leading.length > 0) {
    console.log(
      chalk.gray('     Focus on stocks in: ') +
        chalk.cyan(
          leading
            .slice(0, 3)
            .map((r) => r.name)
            .join(', ')
        )
    );
  }
  if (rotatingIn.length > 0) {
    console.log(
      chalk.gray('     Watch for opportunities in: ') +
        chalk.yellow(rotatingIn.map((r) => r.name).join(', '))
    );
  }
  if (lagging.length > 0) {
    console.log(
      chalk.gray('     Avoid or reduce: ') +
        chalk.red(
          lagging
            .slice(0, 3)
            .map((r) => r.name)
            .join(', ')
        )
    );
  }

  console.log();
}
