/**
 * Performance Command
 * v2.7.0: Analyze signal and trade performance over time
 *
 * Usage:
 *   cds:performance          # Overall performance summary
 *   cds:performance grades   # Performance by signal grade (A, B, C, D)
 *   cds:performance regimes  # Performance by market regime
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getPerformanceByGrade,
  getPerformanceByRegime,
  isConfigured,
} from '../storage/supabase.ts';

/**
 * Create the performance command
 */
export function createPerformanceCommand(): Command {
  const performance = new Command('performance').description(
    'Analyze signal and trade performance'
  );

  // Default: overall summary
  performance
    .command('summary', { isDefault: true })
    .description('Show overall performance summary')
    .action(async () => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        console.log(
          chalk.gray('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars')
        );
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  📊 CDS Strategy Performance'));
      console.log();

      // Get both grade and regime performance
      const [gradeStats, regimeStats] = await Promise.all([
        getPerformanceByGrade(),
        getPerformanceByRegime(),
      ]);

      // Calculate totals
      const totalTrades = gradeStats.reduce((sum, g) => sum + g.tradesTaken, 0);
      const totalWins = gradeStats.reduce((sum, g) => sum + g.wins, 0);
      const totalPnl = gradeStats.reduce((sum, g) => sum + g.totalPnl, 0);

      if (totalTrades === 0) {
        console.log(chalk.yellow('  No completed trades yet'));
        console.log(chalk.gray('  Run scans and record trades to see stats'));
        console.log();
        return;
      }

      const winRate = (totalWins / totalTrades) * 100;

      // Summary box
      console.log(chalk.bold('  Overall Summary'));
      console.log(chalk.gray('  ─'.repeat(30)));
      console.log(
        chalk.gray('  Total Trades:  ') + chalk.white(`${totalTrades}`)
      );
      console.log(
        chalk.gray('  Win Rate:      ') +
          (winRate >= 60 ? chalk.green : chalk.yellow)(`${winRate.toFixed(1)}%`)
      );
      console.log(
        chalk.gray('  Total P&L:     ') +
          (totalPnl >= 0 ? chalk.green : chalk.red)(`$${totalPnl.toFixed(0)}`)
      );
      console.log();

      // Performance by grade
      if (gradeStats.length > 0) {
        console.log(chalk.bold('  By Signal Grade'));
        const gradeTable = new Table({
          head: [
            chalk.cyan('Grade'),
            chalk.cyan('Trades'),
            chalk.cyan('Win %'),
            chalk.cyan('Avg Return'),
            chalk.cyan('Total P&L'),
          ],
          colWidths: [8, 10, 10, 12, 12],
          style: { head: [], border: ['gray'] },
        });

        for (const g of gradeStats.sort((a, b) =>
          a.grade.localeCompare(b.grade)
        )) {
          const gradeColor =
            g.grade === 'A'
              ? chalk.green
              : g.grade === 'B'
                ? chalk.yellow
                : chalk.white;

          gradeTable.push([
            gradeColor(g.grade),
            chalk.white(`${g.tradesTaken}`),
            g.winRate !== null
              ? (g.winRate >= 60 ? chalk.green : chalk.yellow)(
                  `${g.winRate.toFixed(1)}%`
                )
              : chalk.gray('-'),
            g.avgReturn !== null
              ? (g.avgReturn >= 0 ? chalk.green : chalk.red)(
                  `${g.avgReturn.toFixed(1)}%`
                )
              : chalk.gray('-'),
            (g.totalPnl >= 0 ? chalk.green : chalk.red)(
              `$${g.totalPnl.toFixed(0)}`
            ),
          ]);
        }

        console.log(gradeTable.toString());
        console.log();
      }

      // Performance by regime
      if (regimeStats.length > 0) {
        console.log(chalk.bold('  By Market Regime'));
        const regimeTable = new Table({
          head: [
            chalk.cyan('Regime'),
            chalk.cyan('Trades'),
            chalk.cyan('Win %'),
            chalk.cyan('Avg Return'),
            chalk.cyan('Total P&L'),
          ],
          colWidths: [12, 10, 10, 12, 12],
          style: { head: [], border: ['gray'] },
        });

        for (const r of regimeStats) {
          const regimeColor =
            r.regime === 'bull'
              ? chalk.green
              : r.regime === 'bear'
                ? chalk.red
                : chalk.yellow;

          regimeTable.push([
            regimeColor(r.regime.toUpperCase()),
            chalk.white(`${r.tradesTaken}`),
            r.winRate !== null
              ? (r.winRate >= 60 ? chalk.green : chalk.yellow)(
                  `${r.winRate.toFixed(1)}%`
                )
              : chalk.gray('-'),
            r.avgReturn !== null
              ? (r.avgReturn >= 0 ? chalk.green : chalk.red)(
                  `${r.avgReturn.toFixed(1)}%`
                )
              : chalk.gray('-'),
            (r.totalPnl >= 0 ? chalk.green : chalk.red)(
              `$${r.totalPnl.toFixed(0)}`
            ),
          ]);
        }

        console.log(regimeTable.toString());
        console.log();
      }

      // Key insights
      console.log(chalk.bold('  📈 Key Insights'));
      console.log(chalk.gray('  ─'.repeat(30)));

      // Best performing grade
      const bestGrade = gradeStats
        .filter((g) => g.tradesTaken >= 3)
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];

      if (bestGrade) {
        console.log(
          chalk.gray('  Best Grade:    ') +
            chalk.green(`${bestGrade.grade}`) +
            chalk.gray(` (${bestGrade.winRate?.toFixed(0)}% win rate)`)
        );
      }

      // Best performing regime
      const bestRegime = regimeStats
        .filter((r) => r.tradesTaken >= 3)
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];

      if (bestRegime) {
        console.log(
          chalk.gray('  Best Regime:   ') +
            chalk.green(`${bestRegime.regime}`) +
            chalk.gray(` (${bestRegime.winRate?.toFixed(0)}% win rate)`)
        );
      }

      // Recommendation
      console.log();
      if (winRate >= 65) {
        console.log(
          chalk.green('  ✓ Strategy performing well - stay the course')
        );
      } else if (winRate >= 50) {
        console.log(
          chalk.yellow(
            '  ⚠ Consider tightening entry criteria or position sizing'
          )
        );
      } else {
        console.log(
          chalk.red(
            '  ✗ Review trade selection - focus on higher-grade signals'
          )
        );
      }

      console.log();
    });

  // Grades subcommand
  performance
    .command('grades')
    .description('Detailed performance breakdown by signal grade')
    .action(async () => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  📊 Performance by Signal Grade'));
      console.log();

      const gradeStats = await getPerformanceByGrade();

      if (gradeStats.length === 0) {
        console.log(chalk.yellow('  No completed trades yet'));
        console.log();
        return;
      }

      for (const g of gradeStats.sort((a, b) =>
        a.grade.localeCompare(b.grade)
      )) {
        const gradeColor =
          g.grade === 'A'
            ? chalk.green.bold
            : g.grade === 'B'
              ? chalk.yellow.bold
              : g.grade === 'C'
                ? chalk.white.bold
                : chalk.gray.bold;

        console.log(gradeColor(`  Grade ${g.grade}`));
        console.log(chalk.gray('  ─'.repeat(20)));
        console.log(
          chalk.gray('  Signals Generated: ') + chalk.white(`${g.totalSignals}`)
        );
        console.log(
          chalk.gray('  Trades Taken:      ') + chalk.white(`${g.tradesTaken}`)
        );
        console.log(
          chalk.gray('  Win/Loss:          ') +
            chalk.green(`${g.wins}W`) +
            chalk.gray('/') +
            chalk.red(`${g.losses}L`)
        );
        console.log(
          chalk.gray('  Win Rate:          ') +
            (g.winRate !== null
              ? (g.winRate >= 60 ? chalk.green : chalk.yellow)(
                  `${g.winRate.toFixed(1)}%`
                )
              : chalk.gray('-'))
        );
        console.log(
          chalk.gray('  Average Return:    ') +
            (g.avgReturn !== null
              ? (g.avgReturn >= 0 ? chalk.green : chalk.red)(
                  `${g.avgReturn.toFixed(1)}%`
                )
              : chalk.gray('-'))
        );
        console.log(
          chalk.gray('  Total P&L:         ') +
            (g.totalPnl >= 0 ? chalk.green : chalk.red)(
              `$${g.totalPnl.toFixed(0)}`
            )
        );
        console.log();
      }
    });

  // Regimes subcommand
  performance
    .command('regimes')
    .description('Performance breakdown by market regime')
    .action(async () => {
      if (!isConfigured()) {
        console.log(chalk.red('❌ Supabase not configured'));
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  📊 Performance by Market Regime'));
      console.log();

      const regimeStats = await getPerformanceByRegime();

      if (regimeStats.length === 0) {
        console.log(chalk.yellow('  No completed trades yet'));
        console.log();
        return;
      }

      for (const r of regimeStats) {
        const regimeColor =
          r.regime === 'bull'
            ? chalk.green.bold
            : r.regime === 'bear'
              ? chalk.red.bold
              : r.regime === 'caution'
                ? chalk.hex('#FFA500').bold
                : chalk.yellow.bold;

        console.log(regimeColor(`  ${r.regime.toUpperCase()} Market`));
        console.log(chalk.gray('  ─'.repeat(20)));
        console.log(
          chalk.gray('  Trades Taken:   ') + chalk.white(`${r.tradesTaken}`)
        );
        console.log(
          chalk.gray('  Win Rate:       ') +
            (r.winRate !== null
              ? (r.winRate >= 60 ? chalk.green : chalk.yellow)(
                  `${r.winRate.toFixed(1)}%`
                )
              : chalk.gray('-'))
        );
        console.log(
          chalk.gray('  Average Return: ') +
            (r.avgReturn !== null
              ? (r.avgReturn >= 0 ? chalk.green : chalk.red)(
                  `${r.avgReturn.toFixed(1)}%`
                )
              : chalk.gray('-'))
        );
        console.log(
          chalk.gray('  Total P&L:      ') +
            (r.totalPnl >= 0 ? chalk.green : chalk.red)(
              `$${r.totalPnl.toFixed(0)}`
            )
        );
        console.log();
      }
    });

  return performance;
}
