/**
 * Trade Command
 * v2.7.0: Record trade entries and exits for signal performance tracking
 *
 * Usage:
 *   cds:trade entry TICKER --date 2026-01-07 --spread 470/480 --debit 5.50
 *   cds:trade exit TICKER --date 2026-01-14 --credit 8.20 --reason target
 *   cds:trade list                            # Show recent signals for entry
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  recordEntry,
  recordExit,
  getRecentSignals,
  isConfigured,
} from '../storage/supabase.ts';
import { logger } from '../utils/logger.ts';

/**
 * Create the trade command
 */
export function createTradeCommand(): Command {
  const trade = new Command('trade').description(
    'Record trade entries and exits for performance tracking'
  );

  // Entry subcommand
  trade
    .command('entry <ticker>')
    .description('Record a trade entry')
    .requiredOption('-s, --spread <strikes>', 'Spread strikes (e.g., 470/480)')
    .requiredOption('-d, --debit <amount>', 'Debit paid per contract')
    .option(
      '--date <date>',
      'Entry date (YYYY-MM-DD)',
      new Date().toISOString().split('T')[0]
    )
    .option('--signal-date <date>', 'Signal date if different from entry')
    .option('-p, --price <price>', 'Stock price at entry')
    .option('-q, --quantity <qty>', 'Number of contracts', '1')
    .action(async (ticker: string, options) => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        console.log(
          chalk.gray('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars')
        );
        return;
      }

      const entryDate = new Date(options.date);
      const signalDate = options.signalDate
        ? new Date(options.signalDate)
        : entryDate;

      console.log();
      console.log(chalk.bold.cyan('  📝 Recording Trade Entry'));
      console.log();
      console.log(chalk.gray(`  Ticker:   ${chalk.white(ticker)}`));
      console.log(chalk.gray(`  Spread:   ${chalk.white(options.spread)}`));
      console.log(
        chalk.gray(`  Debit:    ${chalk.yellow('$' + options.debit)}`)
      );
      console.log(chalk.gray(`  Date:     ${chalk.white(options.date)}`));
      console.log(chalk.gray(`  Qty:      ${chalk.white(options.quantity)}`));
      console.log();

      const success = await recordEntry(ticker.toUpperCase(), signalDate, {
        entryDate,
        entryPrice: parseFloat(options.price) || 0,
        entryDebit: parseFloat(options.debit),
        entrySpread: options.spread,
        entryQuantity: parseInt(options.quantity, 10),
      });

      if (success) {
        console.log(chalk.green('  ✓ Entry recorded successfully'));
      } else {
        console.log(chalk.red('  ✗ Failed to record entry'));
        console.log(
          chalk.gray('  Make sure the signal exists (run scan-all first)')
        );
      }
      console.log();
    });

  // Exit subcommand
  trade
    .command('exit <ticker>')
    .description('Record a trade exit')
    .requiredOption('-c, --credit <amount>', 'Credit received per contract')
    .requiredOption(
      '-r, --reason <reason>',
      'Exit reason: target, stop, time, earnings, manual'
    )
    .option(
      '--date <date>',
      'Exit date (YYYY-MM-DD)',
      new Date().toISOString().split('T')[0]
    )
    .option('--signal-date <date>', 'Signal date for the trade')
    .option('-p, --price <price>', 'Stock price at exit')
    .option('-n, --notes <notes>', 'Additional notes')
    .action(async (ticker: string, options) => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        return;
      }

      const exitDate = new Date(options.date);
      const signalDate = options.signalDate
        ? new Date(options.signalDate)
        : exitDate;

      const validReasons = ['target', 'stop', 'time', 'earnings', 'manual'];
      if (!validReasons.includes(options.reason)) {
        console.log(
          chalk.red(`Invalid reason. Use: ${validReasons.join(', ')}`)
        );
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  📝 Recording Trade Exit'));
      console.log();
      console.log(chalk.gray(`  Ticker:   ${chalk.white(ticker)}`));
      console.log(
        chalk.gray(`  Credit:   ${chalk.green('$' + options.credit)}`)
      );
      console.log(chalk.gray(`  Reason:   ${chalk.white(options.reason)}`));
      console.log(chalk.gray(`  Date:     ${chalk.white(options.date)}`));
      console.log();

      const success = await recordExit(ticker.toUpperCase(), signalDate, {
        exitDate,
        exitPrice: parseFloat(options.price) || 0,
        exitCredit: parseFloat(options.credit),
        exitReason: options.reason as
          | 'target'
          | 'stop'
          | 'time'
          | 'earnings'
          | 'manual',
        notes: options.notes,
      });

      if (!success) {
        console.log(chalk.red('  ✗ Failed to record exit'));
        console.log(chalk.gray('  Make sure entry was recorded first'));
      }
      console.log();
    });

  // List subcommand - show recent signals for trade entry
  trade
    .command('list')
    .description('List recent signals available for trade entry')
    .option('-d, --days <days>', 'Days to look back', '7')
    .action(async (options) => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  📋 Recent Signals'));
      console.log();

      const signals = await getRecentSignals(parseInt(options.days, 10));

      if (signals.length === 0) {
        console.log(chalk.yellow('  No signals found'));
        console.log(chalk.gray('  Run scan-all to generate signals'));
        console.log();
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('Date'),
          chalk.cyan('Ticker'),
          chalk.cyan('Score'),
          chalk.cyan('Grade'),
          chalk.cyan('Spread'),
          chalk.cyan('Status'),
        ],
        colWidths: [12, 8, 8, 8, 14, 12],
        style: { head: [], border: ['gray'] },
      });

      for (const s of signals) {
        const gradeColor =
          s.grade === 'A'
            ? chalk.green
            : s.grade === 'B'
              ? chalk.yellow
              : chalk.white;

        const statusColor = s.hasOutcome ? chalk.green : chalk.gray;
        const status = s.hasOutcome ? 'traded' : 'available';

        table.push([
          chalk.gray(s.signalDate),
          chalk.bold(s.ticker),
          chalk.white(`${s.score}`),
          gradeColor(s.grade),
          s.spreadViable
            ? chalk.white(s.spreadStrikes ?? '-')
            : chalk.gray('-'),
          statusColor(status),
        ]);
      }

      console.log(table.toString());
      console.log();
      console.log(
        chalk.gray(
          '  To record a trade: bun run cds:trade entry TICKER ' +
            '--spread 470/480 --debit 5.50'
        )
      );
      console.log();
    });

  return trade;
}
