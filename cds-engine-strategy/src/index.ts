#!/usr/bin/env bun
// Suppress dotenv logging noise
process.env.DOTENV_CONFIG_QUIET = 'true';

import { config } from 'dotenv';
import { join } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import type {
  StockScore,
  ScanOptions,
  TrendsOptions,
  HistoricalData,
} from './types/index.ts';
import { runScreener, analyzeTicker } from './engine/screener.ts';
import {
  upsertOpportunities,
  getScoreTrends,
  isConfigured,
} from './storage/supabase.ts';
import { logger } from './utils/logger.ts';
import {
  generatePriceChart,
  generateRSILine,
  analyzeTrend,
  getKeyLevels,
  analyzeVolume,
} from './utils/terminal-chart.ts';
import { compareToBenchmark } from './config/sectors.ts';
import { getMarketRegime, type MarketContext } from './utils/market-regime.ts';
import {
  parsePosition,
  analyzePosition,
  type ParsedPosition,
} from './utils/position-parser.ts';
import { calculateMomentum, type MomentumAnalysis } from './utils/momentum.ts';
import {
  getBeatMissDisplay,
  buildRevenueDisplay,
  buildEarningsDisplay,
  formatQuarterShort,
} from './utils/quarterly-earnings.ts';
import type { QuarterlyPerformance } from './types/index.ts';
import {
  evaluateEntry,
  formatPositionSize,
  formatConfidenceLevel,
  formatAction,
} from './engine/decision.ts';
import type { EntryDecision, DecisionEngineInput } from './types/decision.ts';
import { validateAIRequirement, type OllamaMode } from './services/ollama.ts';
import {
  generateFullAIAnalysis,
  createAIContext,
  type AIAnalysisResult,
  type PositionContext,
  type CatalystContext,
} from './utils/ai-narrative.ts';
import {
  scanSpreads,
  type ScanSpreadsOptions,
} from './commands/scan-spreads.ts';
import { createRegimeCommand } from './commands/regime.ts';
import { analyzeSectorRotation } from './commands/sector-rotation.ts';
import {
  addToWatchlist,
  removeFromWatchlist,
  checkWatchlist,
  showWatchlist,
} from './commands/watchlist.ts';
import { scanAll, type ScanAllOptions } from './commands/scan-all.ts';
import { runBacktest, type BacktestOptions } from './commands/backtest.ts';
import {
  showEarningsCalendar,
  type EarningsOptions,
} from './commands/earnings.ts';
import { showDailyBriefing } from './commands/briefing.ts';
import { createTradeCommand } from './commands/trade.ts';
import { createPerformanceCommand } from './commands/performance.ts';
import { yahooProvider } from './providers/yahoo.ts';
// import { getProxyStats, getCacheStats } from './providers/shared-yahoo.ts'; // Currently unused

// Load .env from repository root (parent of screen-ticker)
const rootEnvPath = join(process.cwd(), '..', '.env');
config({ path: rootEnvPath });

// Also try .env.local from root
const rootEnvLocalPath = join(process.cwd(), '..', '.env.local');
config({ path: rootEnvLocalPath });

const program = new Command();

process.env.DOTENV_CONFIG_QUIET = 'true';

program
  .name('stock-scanner')
  .description('CLI tool to identify high-conviction stock buy opportunities')
  .version('1.5.1');

/**
 * Analyze command - detailed analysis of a single ticker
 */
program
  .command('analyze <ticker>')
  .description('AI-powered analysis of a single stock')
  .alias('a')
  .option('--no-chart', 'Skip price chart visualization')
  .option('--no-market', 'Skip market regime analysis')
  .option(
    '-p, --position <spread>',
    "Your position (e.g., '111/112 Call Debit Spread')"
  )
  .option(
    '--ai-mode <mode>',
    'Ollama mode: local or cloud (default: cloud)',
    'cloud'
  )
  .option('--ai-model <model>', 'Override default AI model')
  .action(
    async (
      ticker: string,
      opts: {
        chart: boolean;
        market: boolean;
        position?: string;
        aiMode: string;
        aiModel?: string;
      }
    ) => {
      const symbol = ticker.toUpperCase();

      // Validate AI mode
      if (!['local', 'cloud'].includes(opts.aiMode)) {
        logger.error(`Invalid --ai-mode: ${opts.aiMode}`);
        logger.info('Valid options: local, cloud');
        process.exit(1);
      }

      console.log();
      console.log(chalk.gray(`  Analyzing ${chalk.bold(symbol)}...`));
      console.log(
        chalk.gray(
          `  AI mode: ${opts.aiMode}${opts.aiModel ? ` (${opts.aiModel})` : ''}`
        )
      );
      console.log();

      // Validate AI is available before proceeding
      const aiValidation = await validateAIRequirement(
        opts.aiMode as OllamaMode
      );
      if (!aiValidation.available) {
        logger.error(aiValidation.error ?? 'AI service unavailable');
        if (aiValidation.suggestion) {
          console.log();
          console.log(chalk.yellow('  How to fix:'));
          aiValidation.suggestion.split('\n').forEach((line) => {
            console.log(chalk.gray(`  ${line}`));
          });
        }
        console.log();
        process.exit(1);
      }

      try {
        // Parse position if provided
        const parsedPosition = opts.position
          ? parsePosition(opts.position)
          : null;
        if (opts.position && !parsedPosition) {
          logger.warn(`Could not parse position: "${opts.position}"`);
          logger.info(
            `Expected format: "111/112 Call Debit Spread" or "115/110 Put Credit Spread"`
          );
        }

        // Fetch market context and stock data in parallel
        const [marketContext, result] = await Promise.all([
          opts.market ? getMarketRegime() : Promise.resolve(null),
          analyzeTicker(symbol),
        ]);

        if (!result) {
          logger.error(`Failed to analyze ${symbol} - no data available`);
          process.exit(1);
          return; // TypeScript control flow hint
        }

        // Calculate momentum analysis
        const momentum = calculateMomentum(
          result.summary,
          result.historical,
          result.score.price
        );

        // Generate AI analysis (always enabled)
        console.log(chalk.gray('  Generating AI insights...'));
        console.log();
        let aiAnalysis: AIAnalysisResult | null = null;
        {
          // Get trend and RSI for AI context
          const trend =
            result.historical.length > 50
              ? analyzeTrend(result.historical, result.score.price)
              : null;
          const rsi =
            result.historical.length > 20
              ? generateRSILine(result.historical)
              : null;
          const levels =
            result.historical.length > 30
              ? getKeyLevels(result.historical, result.score.price)
              : null;

          // Convert null values to undefined for AI context
          const aiLevels = levels
            ? {
                support1: levels.support1 ?? undefined,
                support2: levels.support2 ?? undefined,
                resistance1: levels.resistance1 ?? undefined,
                resistance2: levels.resistance2 ?? undefined,
                ma20: levels.ma20 ?? undefined,
                ma50: levels.ma50 ?? undefined,
                ma200: levels.ma200 ?? undefined,
              }
            : null;

          // Build position context for AI if user has a position
          let positionContext: PositionContext | undefined;
          if (parsedPosition) {
            const posAnalysis = analyzePosition(
              parsedPosition,
              result.score.price,
              levels?.support1,
              levels?.support2
            );
            positionContext = {
              lowerStrike: parsedPosition.lowerStrike,
              higherStrike: parsedPosition.higherStrike,
              width: parsedPosition.width,
              type: parsedPosition.type,
              direction: parsedPosition.direction,
              criticalStrike: parsedPosition.criticalStrike,
              description: parsedPosition.description,
              cushion: posAnalysis.cushion,
              cushionPct: posAnalysis.cushionPct,
              probabilityOfProfit: posAnalysis.probabilityOfProfit,
              riskLevel: posAnalysis.riskLevel,
            };
          }

          // Build catalyst context
          const catalystContext: CatalystContext = {};
          if (result.score.context?.nextEarningsDate) {
            const earningsDate = result.score.context.nextEarningsDate;
            const daysToEarnings = Math.ceil(
              (earningsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            catalystContext.daysToEarnings = daysToEarnings;
            catalystContext.earningsDate = earningsDate.toLocaleDateString();
          }

          const aiContext = createAIContext(
            result.score,
            momentum,
            result.relativeStrength ?? null,
            result.quarterlyPerformance ?? null,
            marketContext,
            trend,
            rsi ? { value: rsi.value, status: rsi.status } : null,
            aiLevels,
            positionContext,
            Object.keys(catalystContext).length > 0
              ? catalystContext
              : undefined
          );

          aiAnalysis = await generateFullAIAnalysis(
            {
              mode: opts.aiMode as OllamaMode,
              model: opts.aiModel,
            },
            aiContext
          );

          if (aiAnalysis.error) {
            logger.error(`AI analysis failed: ${aiAnalysis.error}`);
            process.exit(1);
          }
        }

        displayNarrativeAnalysis(
          result.score,
          result.historical,
          opts.chart,
          result.relativeStrength,
          result.options,
          marketContext,
          parsedPosition,
          momentum,
          result.quarterlyPerformance,
          aiAnalysis
        );
      } catch (error) {
        logger.error(`Analysis failed: ${error}`);
        process.exit(1);
      }
    }
  );

/**
 * Quick decision for scan results (without options data)
 * Returns ENTER, WAIT, SCALE_IN, or PASS based on available data
 * v2.6.0: Added SCALE_IN for near-MA200-reclaim scenarios
 */
type QuickDecision = 'ENTER' | 'SCALE_IN' | 'WAIT' | 'PASS';

interface QuickDecisionResult {
  decision: QuickDecision;
  reason: string;
  checksPass: number;
  checksTotal: number;
}

function getQuickDecision(score: StockScore): QuickDecisionResult {
  const checks = {
    aboveMA200: false,
    aboveMA50: false, // v2.5: Also check short-term trend
    rsiOK: false,
    analystPositive: false,
    scoreHigh: false,
    hasUpside: false,
  };
  const issues: string[] = [];

  // Critical: Track if below MA200 (forces WAIT at minimum)
  const belowMA200 = score.context?.ma200 && score.price < score.context.ma200;
  // Also track MA50 for short-term trend
  const belowMA50 = score.context?.ma50 && score.price < score.context.ma50;

  // Check 1: Above MA200 (long-term trend)
  if (score.context?.ma200 && score.price > score.context.ma200) {
    checks.aboveMA200 = true;
  } else if (score.context?.ma200) {
    issues.push('Below MA200');
  }

  // Check 2: Above MA50 (short-term trend) - new in v2.5
  if (score.context?.ma50 && score.price > score.context.ma50) {
    checks.aboveMA50 = true;
  } else if (score.context?.ma50) {
    issues.push('Below MA50');
  }

  // Check 3: RSI not overbought (use numeric value, not string matching)
  const rsiSignal = score.signals.find((s) =>
    s.name.toLowerCase().includes('rsi')
  );
  if (rsiSignal && typeof rsiSignal.value === 'number') {
    const rsiValue = rsiSignal.value;
    if (rsiValue < 70) {
      checks.rsiOK = true;
    } else {
      issues.push(`RSI overbought (${rsiValue.toFixed(0)})`);
    }
  } else if (rsiSignal) {
    // Fallback to string matching if no numeric value
    const rsiDesc = rsiSignal.description.toLowerCase();
    if (rsiDesc.includes('overbought')) {
      issues.push('RSI overbought');
    } else {
      checks.rsiOK = true;
    }
  } else {
    checks.rsiOK = true; // No RSI signal = assume OK
  }

  // Check 4: Analyst sentiment (look for upgrade/revision signals)
  const analystSignals = score.signals.filter(
    (s) => s.category === 'analyst' && s.points > 0
  );
  if (analystSignals.length >= 2) {
    checks.analystPositive = true;
  } else {
    // Check warnings for negative analyst sentiment
    const analystWarning = score.warnings?.find(
      (w) =>
        w.description.toLowerCase().includes('analyst') ||
        w.description.toLowerCase().includes('downgrade')
    );
    if (!analystWarning) {
      checks.analystPositive = true;
    } else {
      issues.push('Analyst concerns');
    }
  }

  // Check 5: Score threshold
  if (score.totalScore >= 75) {
    checks.scoreHigh = true;
  } else {
    issues.push(`Score ${score.totalScore}`);
  }

  // Check 6: Upside potential
  if (score.upsidePotential >= 0.15) {
    checks.hasUpside = true;
  } else {
    issues.push(`Low upside (${(score.upsidePotential * 100).toFixed(0)}%)`);
  }

  // Count passed checks
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  // Determine decision
  let decision: QuickDecision;
  let reason: string;

  // v2.6.0: Check for near-MA200-reclaim scenario (within 5% of MA200)
  const nearMA200Reclaim =
    belowMA200 &&
    score.context?.ma200 &&
    (score.context.ma200 - score.price) / score.context.ma200 < 0.05;

  // Check for recovery signals in the signals array
  const hasReclaimSignal = score.signals.some((s) =>
    s.name.toLowerCase().includes('reclaim')
  );

  // Critical: Below MA200 handling
  if (nearMA200Reclaim && hasReclaimSignal && passedChecks >= 4) {
    // v2.6.0: Near MA200 with recovery signal = SCALE_IN
    decision = 'SCALE_IN';
    reason = 'Near MA200 reclaim';
  } else if (belowMA200) {
    decision = passedChecks >= 3 ? 'WAIT' : 'PASS';
    reason = 'Below MA200';
  } else if (belowMA50) {
    // v2.5: Below MA50 also forces WAIT (short-term downtrend)
    decision = passedChecks >= 4 ? 'WAIT' : 'PASS';
    reason = 'Below MA50';
  } else if (
    passedChecks >= 5 &&
    checks.aboveMA200 &&
    checks.aboveMA50 &&
    checks.rsiOK
  ) {
    // ENTER requires: above BOTH MAs + RSI ok + 5/6 checks
    decision = 'ENTER';
    reason = `${passedChecks}/${totalChecks} checks`;
  } else if (passedChecks >= 4 && checks.aboveMA200) {
    decision = 'WAIT';
    reason = issues[0] ?? 'Monitor';
  } else {
    decision = 'PASS';
    reason = issues[0] ?? 'Multiple issues';
  }

  return {
    decision,
    reason,
    checksPass: passedChecks,
    checksTotal: totalChecks,
  };
}

/**
 * Scan command - main screening functionality
 * v2.5.0: Added market regime awareness and debug indicators
 */
program
  .command('scan')
  .description('Scan stocks for buy opportunities')
  .option(
    '-l, --list <name>',
    'Predefined list: sp500 (large cap) or all (all stocks from DB)',
    'sp500'
  )
  .option('-t, --tickers <symbols>', 'Comma-separated tickers to scan')
  .option('--top <number>', 'Limit to top N tickers (for quick scans)')
  .option('-m, --min-score <number>', 'Minimum score threshold', '70')
  .option('-d, --dry-run', "Don't save to database", false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('-a, --actionable', 'Only show ENTER or WAIT decisions', false)
  .option('--debug', 'Show proxy/cache stats after scan', false)
  .option(
    '--debug-indicators',
    'Show detailed indicator values for each ticker',
    false
  )
  .option(
    '--ignore-regime',
    'Skip market regime check (use base min-score)',
    false
  )
  .action(async (opts) => {
    const baseMinScore = parseInt(opts.minScore, 10);
    const actionableOnly = opts.actionable;
    const showDebug = opts.debug;
    const debugIndicators = opts.debugIndicators;
    const ignoreRegime = opts.ignoreRegime;

    logger.setVerbose(opts.verbose);

    // Reset stats at the start of scan
    yahooProvider.resetStats();

    try {
      // ═══════════════════════════════════════════════════════════════════
      // MARKET REGIME CHECK (v2.5.0)
      // ═══════════════════════════════════════════════════════════════════
      let effectiveMinScore = baseMinScore;
      let marketContext: MarketContext | null = null;

      if (!ignoreRegime) {
        console.log(chalk.gray('  Checking market regime...'));
        marketContext = await getMarketRegime();

        if (marketContext) {
          // Import strategy config loader
          const { getRegimeAdjustments, checkNoTradeConditions } =
            await import('./config/strategy.ts');

          // Check for no-trade conditions
          const spyPctBelowMA200 =
            ((marketContext.spyPrice - marketContext.spyMA200) /
              marketContext.spyMA200) *
            100;
          const noTradeCheck = checkNoTradeConditions(
            spyPctBelowMA200,
            marketContext.vix
          );

          if (noTradeCheck.noTrade) {
            console.log();
            console.log(chalk.red.bold('  🚫 NO-TRADE CONDITIONS DETECTED'));
            console.log(chalk.red(`     ${noTradeCheck.reason}`));
            console.log(
              chalk.gray(
                '     Recommend avoiding new entries. ' +
                  'Use --ignore-regime to override.'
              )
            );
            console.log();
            return;
          }

          // Get regime-specific adjustments
          const adjustments = getRegimeAdjustments(marketContext.regime);

          // Display regime info
          const regimeEmoji =
            marketContext.regime === 'bull'
              ? '🟢'
              : marketContext.regime === 'bear'
                ? '🔴'
                : '🟡';
          const regimeColor =
            marketContext.regime === 'bull'
              ? chalk.green
              : marketContext.regime === 'bear'
                ? chalk.red
                : chalk.yellow;

          console.log();
          console.log(
            `  ${regimeEmoji} Market Regime: ` +
              regimeColor(marketContext.regime.toUpperCase())
          );
          console.log(
            chalk.gray(
              `     SPY: $${marketContext.spyPrice.toFixed(2)} | ` +
                `MA50: $${marketContext.spyMA50.toFixed(2)} | ` +
                `MA200: $${marketContext.spyMA200.toFixed(2)}`
            )
          );
          console.log(
            chalk.gray(`     ${marketContext.signals.slice(0, 3).join(' | ')}`)
          );

          // Adjust min score based on regime
          effectiveMinScore = Math.max(baseMinScore, adjustments.min_score);

          if (effectiveMinScore !== baseMinScore) {
            console.log(
              chalk.gray(
                `     Min score adjusted: ${baseMinScore} → ` +
                  chalk.white(effectiveMinScore.toString()) +
                  ` (${marketContext.regime} market)`
              )
            );
          }
          console.log();
        } else {
          console.log(
            chalk.yellow(
              '  ⚠ Could not determine market regime, using defaults'
            )
          );
          console.log();
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // RUN SCANNER
      // ═══════════════════════════════════════════════════════════════════
      const options: ScanOptions = {
        list: opts.list,
        tickers: opts.tickers,
        top: opts.top ? parseInt(opts.top, 10) : undefined,
        minScore: effectiveMinScore,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
        debugIndicators,
      };

      const results = await runScreener(options);

      if (results.length === 0) {
        logger.warn(`No opportunities found with score >= ${options.minScore}`);
        return;
      }

      // Calculate quick decisions for all results
      const resultsWithDecisions = results.map((r) => ({
        score: r,
        decision: getQuickDecision(r),
      }));

      // Filter if actionable only
      const filteredResults = actionableOnly
        ? resultsWithDecisions.filter(
            (r) =>
              r.decision.decision === 'ENTER' || r.decision.decision === 'WAIT'
          )
        : resultsWithDecisions;

      if (filteredResults.length === 0) {
        logger.warn(
          actionableOnly
            ? 'No actionable opportunities found (all PASS)'
            : `No opportunities found with score >= ${options.minScore}`
        );
        return;
      }

      // Display results table with decisions
      displayResultsTableWithDecisions(filteredResults, actionableOnly);

      // Save to database if not dry run (save all results, not filtered)
      if (!options.dryRun) {
        if (!isConfigured()) {
          logger.warn(
            'Supabase not configured. Set SUPABASE_URL and ' +
              'SUPABASE_SERVICE_KEY to save results.'
          );
        } else {
          await upsertOpportunities(results);
        }
      } else {
        logger.info('Dry run - results not saved to database');
      }

      // Show summary
      const enterCount = resultsWithDecisions.filter(
        (r) => r.decision.decision === 'ENTER'
      ).length;
      const waitCount = resultsWithDecisions.filter(
        (r) => r.decision.decision === 'WAIT'
      ).length;
      const passCount = resultsWithDecisions.filter(
        (r) => r.decision.decision === 'PASS'
      ).length;

      console.log(
        chalk.gray('  Decision Summary: ') +
          chalk.green(`${enterCount} ENTER`) +
          chalk.gray(' | ') +
          chalk.yellow(`${waitCount} WAIT`) +
          chalk.gray(' | ') +
          chalk.red(`${passCount} PASS`)
      );
      console.log();

      // Show debug stats if requested
      if (showDebug) {
        yahooProvider.getDebugStats();
      }
    } catch (error) {
      logger.error(`Scan failed: ${error}`);

      // Always show debug stats on error if --debug flag was passed
      if (showDebug) {
        yahooProvider.getDebugStats();
      }
      process.exit(1);
    }
  });

/**
 * Scan-spreads command - find tickers with viable deep ITM spreads
 *
 * Two-stage workflow:
 * 1. Run `bun run scan` to find technically sound stocks
 * 2. Run `bun run scan-spreads --from-scan` to find viable spreads
 */
program
  .command('scan-spreads')
  .description('Find tickers with viable deep ITM call spreads')
  .alias('ss')
  .option(
    '-l, --list <name>',
    'Predefined list: mega, growth, etf, value, db, sp500',
    'mega'
  )
  .option('-t, --tickers <symbols>', 'Comma-separated tickers to scan')
  .option('-v, --verbose', 'Verbose output', false)
  .option('-r, --relaxed', 'Use relaxed criteria (60% PoP, 3% cushion)', false)
  .option(
    '-f, --from-scan',
    "Use tickers from today's scan results (ENTER/WAIT)",
    false
  )
  .option(
    '-m, --min-score <number>',
    'Min score for --from-scan (default: 70)',
    '70'
  )
  .option(
    '-w, --widths <preset>',
    'Width preset: small ($2.5,$5), medium ($5,$10), large ($5,$10,$20), all',
    'medium'
  )
  .action(async (opts) => {
    const options: ScanSpreadsOptions = {
      list: opts.list,
      tickers: opts.tickers,
      verbose: opts.verbose,
      relaxed: opts.relaxed,
      fromScan: opts.fromScan,
      minScore: parseInt(opts.minScore, 10),
      widths: opts.widths,
    };

    try {
      await scanSpreads(options);
    } catch (error) {
      logger.error(`Scan failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Trends command - show stocks with improving scores
 */
program
  .command('trends')
  .description('Show stocks with improving scores over time')
  .option('-d, --days <number>', 'Days to look back', '7')
  .option('-m, --min-delta <number>', 'Minimum score improvement', '10')
  .action(async (opts) => {
    const options: TrendsOptions = {
      days: parseInt(opts.days, 10),
      minDelta: parseInt(opts.minDelta, 10),
    };

    if (!isConfigured()) {
      logger.error(
        'Supabase not configured. Set SUPABASE_URL and ' +
          'SUPABASE_SERVICE_KEY to view trends.'
      );
      process.exit(1);
    }

    try {
      const trends = await getScoreTrends(options.minDelta, options.days);

      if (trends.length === 0) {
        logger.warn(
          `No stocks found with score improvement >= ` +
            `${options.minDelta} pts in ${options.days} days`
        );
        return;
      }

      logger.header(`Score Trends (${options.days} day improvement)`);
      displayTrendsTable(trends);
    } catch (error) {
      logger.error(`Trends failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Regime command - check trading regime before scanning
 */
program.addCommand(createRegimeCommand());

/**
 * v2.7.0: Trade command - record entries and exits for performance tracking
 */
program.addCommand(createTradeCommand());

/**
 * v2.7.0: Performance command - analyze signal and trade performance
 */
program.addCommand(createPerformanceCommand());

/**
 * v2.6.0: Sector rotation analysis command
 */
program
  .command('sectors')
  .description('Analyze sector rotation and relative strength')
  .alias('sr')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    try {
      await analyzeSectorRotation({ verbose: opts.verbose });
    } catch (error) {
      logger.error(`Sector analysis failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * v2.6.0: Watchlist command with price alerts
 */
const watchlistCmd = program
  .command('watchlist')
  .description('Manage watchlist with price alerts')
  .alias('wl');

watchlistCmd
  .command('add <ticker>')
  .description('Add ticker to watchlist')
  .option('-a, --above <price>', 'Alert when price goes above')
  .option('-b, --below <price>', 'Alert when price goes below')
  .option('-n, --notes <text>', 'Add notes')
  .action(async (ticker, opts) => {
    try {
      await addToWatchlist(ticker, {
        targetAbove: opts.above ? parseFloat(opts.above) : undefined,
        targetBelow: opts.below ? parseFloat(opts.below) : undefined,
        notes: opts.notes,
      });
    } catch (error) {
      logger.error(`Failed to add to watchlist: ${error}`);
    }
  });

watchlistCmd
  .command('remove <ticker>')
  .description('Remove ticker from watchlist')
  .alias('rm')
  .action(async (ticker) => {
    try {
      await removeFromWatchlist(ticker);
    } catch (error) {
      logger.error(`Failed to remove from watchlist: ${error}`);
    }
  });

watchlistCmd
  .command('check')
  .description('Check watchlist for triggered alerts')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    try {
      await checkWatchlist({ verbose: opts.verbose });
    } catch (error) {
      logger.error(`Failed to check watchlist: ${error}`);
    }
  });

watchlistCmd
  .command('show')
  .description('Show watchlist without checking prices')
  .action(async () => {
    try {
      await showWatchlist();
    } catch (error) {
      logger.error(`Failed to show watchlist: ${error}`);
    }
  });

/**
 * v2.6.0: Scan-all command - integrated scan + spreads
 */
program
  .command('scan-all')
  .description('Full workflow: scan stocks then find spreads')
  .alias('sa')
  .option(
    '-l, --list <name>',
    'Ticker list: sp500, mega, growth, etc.',
    'sp500'
  )
  .option('-t, --tickers <symbols>', 'Comma-separated tickers')
  .option('-w, --watchlist', 'Scan watchlist tickers only', false)
  .option('--from-tickers', 'Scan from master tickers table (~2000)', false)
  .option('--exchange <name>', 'Filter by exchange (NYSE, NASDAQ, etc.)')
  .option('--sector <name>', 'Filter by sector (Technology, Healthcare, etc.)')
  .option('--from-db', 'Scan top scorers from stock_opportunities', false)
  .option('--from-signals', 'Re-scan tickers with recent signals', false)
  .option('--signal-days <days>', 'Days of history to use', '30')
  .option('--db-limit <count>', 'Max tickers to pull', '500')
  .option('-m, --min-score <number>', 'Minimum score threshold', '70')
  .option('-n, --top-n <number>', 'Top N results for spread analysis', '10')
  .option('-v, --verbose', 'Verbose output', false)
  .option('-s, --summary', 'Concise summary output', false)
  .option('--skip-spreads', 'Skip spread analysis (just scan)', false)
  .option('--no-capture', 'Skip auto-capturing signals to DB', false)
  .action(async (opts) => {
    const options: ScanAllOptions = {
      list: opts.list,
      tickers: opts.tickers,
      watchlist: opts.watchlist,
      fromTickers: opts.fromTickers,
      exchange: opts.exchange,
      sector: opts.sector,
      fromDb: opts.fromDb,
      fromSignals: opts.fromSignals,
      signalDays: parseInt(opts.signalDays, 10),
      dbLimit: parseInt(opts.dbLimit, 10),
      minScore: parseInt(opts.minScore, 10),
      topN: parseInt(opts.topN, 10),
      verbose: opts.verbose,
      summary: opts.summary,
      skipSpreads: opts.skipSpreads,
      noCapture: !opts.capture, // --no-capture sets capture to false
    };

    try {
      await scanAll(options);
    } catch (error) {
      logger.error(`Scan-all failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * v2.6.0: Backtest command - analyze historical signal performance
 */
program
  .command('backtest')
  .description('Backtest scanner signals against historical data')
  .alias('bt')
  .option('-d, --days <number>', 'Days of history to analyze', '30')
  .option('-m, --min-score <number>', 'Minimum score for entry signals', '75')
  .option('-h, --hold-days <number>', 'Maximum hold period in days', '14')
  .option('-t, --target <number>', 'Target profit percentage', '10')
  .option('-s, --stop <number>', 'Stop loss percentage', '5')
  .option('-v, --verbose', 'Show individual trade details', false)
  .action(async (opts) => {
    const options: BacktestOptions = {
      days: parseInt(opts.days, 10),
      minScore: parseInt(opts.minScore, 10),
      holdDays: parseInt(opts.holdDays, 10),
      targetProfit: parseFloat(opts.target),
      stopLoss: parseFloat(opts.stop),
      verbose: opts.verbose,
    };

    try {
      await runBacktest(options);
    } catch (error) {
      logger.error(`Backtest failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * v2.6.0: Earnings calendar command
 */
program
  .command('earnings')
  .description('Show upcoming earnings for tracked stocks')
  .alias('earn')
  .option('-t, --tickers <symbols>', 'Comma-separated tickers')
  .option('-w, --watchlist', 'Use watchlist tickers', false)
  .option('-d, --days <number>', 'Days to look ahead', '30')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    const options: EarningsOptions = {
      tickers: opts.tickers,
      watchlist: opts.watchlist,
      days: parseInt(opts.days, 10),
      verbose: opts.verbose,
    };

    try {
      await showEarningsCalendar(options);
    } catch (error) {
      logger.error(`Earnings calendar failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Daily Briefing - one-stop morning routine
 */
program
  .command('briefing')
  .description('Daily briefing - regime, watchlist alerts, earnings')
  .option('-v, --verbose', 'Show detailed output', false)
  .action(async (opts) => {
    try {
      await showDailyBriefing({ verbose: opts.verbose });
    } catch (error) {
      logger.error(`Briefing failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Debug command - show proxy and cache status
 */
program
  .command('debug')
  .description('Show proxy and cache status for troubleshooting')
  .option('-t, --test <ticker>', 'Test fetching a specific ticker')
  .action(async (opts) => {
    console.log(chalk.bold.cyan('\n🔍 Yahoo Provider Debug Status\n'));

    // Show proxy configuration
    const proxyUrl = process.env.YAHOO_PROXY_URL;
    console.log(chalk.white('Environment Configuration:'));
    console.log(
      chalk.gray('  YAHOO_PROXY_URL: ') +
        (proxyUrl ? chalk.green(proxyUrl) : chalk.red('NOT SET'))
    );

    // Show current stats
    yahooProvider.getDebugStats();

    // Test a ticker if requested
    if (opts.test) {
      const ticker = opts.test.toUpperCase();
      console.log(chalk.white(`\nTesting fetch for ${ticker}...`));
      console.log(chalk.gray('─'.repeat(50)));

      logger.setVerbose(true);

      try {
        const startTime = Date.now();
        const data = await yahooProvider.getAllData(ticker);
        const elapsed = Date.now() - startTime;

        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.white('Results:'));
        console.log(
          chalk.gray('  Quote: ') +
            (data.quote
              ? chalk.green(`$${data.quote.regularMarketPrice}`)
              : chalk.red('FAILED'))
        );
        console.log(
          chalk.gray('  Summary: ') +
            (data.summary ? chalk.green('OK') : chalk.red('FAILED'))
        );
        console.log(
          chalk.gray('  Historical: ') +
            (data.historical.length > 0
              ? chalk.green(`${data.historical.length} days`)
              : chalk.red('FAILED'))
        );
        console.log(chalk.gray('  Time: ') + chalk.cyan(`${elapsed}ms`));

        // Show stats after test
        console.log(chalk.white('\nPost-test Stats:'));
        yahooProvider.getDebugStats();
      } catch (error) {
        console.log(chalk.red(`\n❌ Test failed: ${error}`));
        yahooProvider.getDebugStats();
      }
    }
  });

// ============================================================================
// NARRATIVE DISPLAY - Tell a story about the stock
// ============================================================================

/**
 * Display a narrative-driven analysis that tells a coherent story
 */
function displayNarrativeAnalysis(
  score: StockScore,
  historical: HistoricalData[],
  showChart: boolean,
  relativeStrength?: {
    rs20: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    rs50: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    rs200: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  },
  options?: import('./engine/screener.ts').OptionsData | null,
  marketContext?: MarketContext | null,
  userPosition?: ParsedPosition | null,
  momentum?: MomentumAnalysis | null,
  quarterlyPerformance?: QuarterlyPerformance | null,
  aiAnalysis?: AIAnalysisResult | null
): void {
  const {
    ticker,
    name,
    price,
    technicalScore,
    fundamentalScore,
    analystScore,
    totalScore,
    upsidePotential,
    signals,
  } = score;

  // Group signals
  const technicalSignals = signals.filter((s) => s.category === 'technical');
  const fundamentalSignals = signals.filter(
    (s) => s.category === 'fundamental'
  );
  const analystSignals = signals.filter((s) => s.category === 'analyst');

  // Analyze trend and RSI
  const trend = historical.length > 50 ? analyzeTrend(historical, price) : null;
  const rsi = historical.length > 20 ? generateRSILine(historical) : null;
  const volume = historical.length > 20 ? analyzeVolume(historical) : null;
  const levels =
    historical.length > 30 ? getKeyLevels(historical, price) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────────────────────────────────
  printDivider('═');
  console.log();
  console.log(`  ${chalk.bold.cyan(ticker)}  ${chalk.gray(name ?? '')}`);
  console.log(
    `  ${chalk.white('$' + price.toFixed(2))}  ` +
      `${getUpsideDisplay(upsidePotential)}  ` +
      `${getScoreDisplay(totalScore)}`
  );
  console.log();
  printDivider('═');

  // ─────────────────────────────────────────────────────────────────────────
  // YOUR POSITION (if provided)
  // ─────────────────────────────────────────────────────────────────────────
  if (userPosition && levels) {
    const posAnalysis = analyzePosition(
      userPosition,
      price,
      levels.support1,
      levels.support2
    );

    console.log();
    console.log(chalk.bold.magenta('  📍 YOUR POSITION'));
    printSubDivider();
    console.log();

    // Position description
    console.log(`  ${chalk.white(userPosition.description)}`);
    console.log();

    // Current status
    const statusEmoji =
      posAnalysis.riskLevel === 'low'
        ? '🟢'
        : posAnalysis.riskLevel === 'medium'
          ? '🟡'
          : posAnalysis.riskLevel === 'high'
            ? '🟠'
            : '🔴';
    const statusColor =
      posAnalysis.riskLevel === 'low'
        ? chalk.green
        : posAnalysis.riskLevel === 'medium'
          ? chalk.yellow
          : posAnalysis.riskLevel === 'high'
            ? chalk.hex('#FFA500')
            : chalk.red;

    console.log(
      `  ${statusEmoji} ${statusColor(posAnalysis.riskLevel.toUpperCase() + ' RISK')} — ` +
        chalk.white(`${posAnalysis.probabilityOfProfit}% probability of profit`)
    );
    console.log();

    // Visual representation of price vs strikes
    const critStrike = userPosition.criticalStrike;
    const cushionDisplay =
      posAnalysis.cushionPct >= 0
        ? chalk.green(`+${posAnalysis.cushionPct.toFixed(1)}% cushion`)
        : chalk.red(`${posAnalysis.cushionPct.toFixed(1)}% BREACHED`);

    console.log(
      chalk.gray('  Current Price: ') + chalk.white(`$${price.toFixed(2)}`)
    );
    console.log(
      chalk.gray('  Critical Strike: ') +
        chalk.cyan(`$${critStrike.toFixed(2)}`) +
        chalk.gray(
          ` (${userPosition.direction === 'bullish' ? 'must stay above' : 'must stay below'})`
        )
    );
    console.log(
      chalk.gray('  Cushion: ') +
        cushionDisplay +
        chalk.gray(` ($${Math.abs(posAnalysis.cushion).toFixed(2)})`)
    );
    console.log();

    // Support levels relative to critical strike
    if (userPosition.direction === 'bullish') {
      // For bullish spreads, show if support is below critical (extra protection)
      const s1 = posAnalysis.supportAnalysis.s1;
      const s2 = posAnalysis.supportAnalysis.s2;

      console.log(chalk.gray('  Support vs Your Strike:'));

      if (s1) {
        const s1Status = s1.belowCritical
          ? chalk.green('✅ BELOW your strike (extra cushion)')
          : chalk.yellow('⚠️ ABOVE your strike');
        console.log(
          chalk.gray('    S1 $') +
            chalk.white(s1.price.toFixed(2)) +
            chalk.gray(' — ') +
            s1Status
        );
      }

      if (s2) {
        const s2Status = s2.belowCritical
          ? chalk.green('✅ BELOW your strike')
          : chalk.yellow('⚠️ ABOVE your strike');
        console.log(
          chalk.gray('    S2 $') +
            chalk.white(s2.price.toFixed(2)) +
            chalk.gray(' — ') +
            s2Status
        );
      }
      console.log();
    }

    // Action recommendation
    const recColor =
      posAnalysis.riskLevel === 'low'
        ? chalk.green
        : posAnalysis.riskLevel === 'medium'
          ? chalk.yellow
          : chalk.red;
    console.log(chalk.gray('  → ') + recColor(posAnalysis.recommendation));
    console.log();

    // Alert levels
    if (userPosition.direction === 'bullish') {
      const warningLevel = critStrike * 1.03;
      const dangerLevel = critStrike * 1.01;
      console.log(chalk.gray('  Set Alerts:'));
      console.log(
        chalk.gray('    Warning: ') +
          chalk.yellow(`$${warningLevel.toFixed(2)}`) +
          chalk.gray(' (3% above critical)')
      );
      console.log(
        chalk.gray('    Danger: ') +
          chalk.red(`$${dangerLevel.toFixed(2)}`) +
          chalk.gray(' (1% above critical)')
      );
    }
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MARKET CONTEXT
  // ─────────────────────────────────────────────────────────────────────────
  if (marketContext) {
    console.log();
    console.log(chalk.bold.white('  🌍 MARKET CONTEXT'));
    printSubDivider();
    console.log();

    // Market regime indicator
    const regimeEmoji =
      marketContext.regime === 'bull'
        ? '🟢'
        : marketContext.regime === 'bear'
          ? '🔴'
          : '🟡';
    const regimeColor =
      marketContext.regime === 'bull'
        ? chalk.green
        : marketContext.regime === 'bear'
          ? chalk.red
          : chalk.yellow;
    const regimeLabel = marketContext.regime.toUpperCase() + ' MARKET';

    console.log(
      `  ${regimeEmoji} ${regimeColor(regimeLabel)} — ` +
        chalk.white(`SPY $${marketContext.spyPrice.toFixed(2)}`)
    );

    // Key signals
    const signalLimit = 3;
    const topSignals = marketContext.signals.slice(0, signalLimit);
    console.log(chalk.gray(`     ${topSignals.join(' | ')}`));

    // Recommendation based on market regime
    console.log();
    if (marketContext.regime === 'bull') {
      console.log(
        chalk.gray('  → ') + chalk.white(marketContext.recommendation)
      );
    } else if (marketContext.regime === 'bear') {
      console.log(
        chalk.gray('  → ') + chalk.yellow(marketContext.recommendation)
      );
    } else {
      console.log(
        chalk.gray('  → ') + chalk.white(marketContext.recommendation)
      );
    }
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 52-WEEK CONTEXT
  // ─────────────────────────────────────────────────────────────────────────
  if (score.context && (score.context.low52 || score.context.high52)) {
    console.log();
    console.log(chalk.bold.white('  📅 52-WEEK CONTEXT'));
    printSubDivider();
    console.log();

    const ctx = score.context;

    // 52-week range
    if (ctx.low52 && ctx.high52) {
      const rangeBar = generate52WeekBar(ctx.positionInRange ?? 0.5);
      console.log(
        `  52-Week Range: $${ctx.low52.toFixed(2)} ${rangeBar} $${ctx.high52.toFixed(2)}`
      );

      // Position description
      if (ctx.pctFromLow !== undefined && ctx.pctFromHigh !== undefined) {
        const fromLow = (ctx.pctFromLow * 100).toFixed(1);
        const fromHigh = (ctx.pctFromHigh * 100).toFixed(1);
        console.log(
          chalk.gray(
            `               +${fromLow}% from low  |  -${fromHigh}% from high`
          )
        );
      }
      console.log();
    }

    // Position assessment
    if (ctx.positionInRange !== undefined) {
      const pos = ctx.positionInRange;
      let assessment: string;
      let color: (s: string) => string;

      if (pos < 0.15) {
        assessment = 'Near 52-week lows — potential value opportunity';
        color = chalk.green;
      } else if (pos < 0.35) {
        assessment = 'In lower third of range — reasonable entry zone';
        color = chalk.green;
      } else if (pos < 0.65) {
        assessment = 'Mid-range — neutral positioning';
        color = chalk.yellow;
      } else if (pos < 0.85) {
        assessment = 'In upper third of range — consider waiting for pullback';
        color = chalk.yellow;
      } else {
        assessment = 'Near 52-week highs — elevated entry risk';
        color = chalk.red;
      }
      console.log(`  Position: ${color(assessment)}`);
    }

    // MA200 context
    if (ctx.ma200) {
      const aboveMA200 = price > ctx.ma200;
      const distToMA200 = (Math.abs(price - ctx.ma200) / price) * 100;
      console.log(
        `  MA200: $${ctx.ma200.toFixed(2)} — price is ` +
          (aboveMA200
            ? chalk.green(`${distToMA200.toFixed(1)}% above`)
            : chalk.red(`${distToMA200.toFixed(1)}% below`)) +
          chalk.gray(' (long-term trend)')
      );
    }

    // Market cap
    if (ctx.marketCap) {
      const capStr = formatMarketCap(ctx.marketCap);
      console.log(`  Market Cap: ${capStr}`);
    }

    // Next earnings date
    if (ctx.nextEarningsDate) {
      const days = daysUntil(ctx.nextEarningsDate);
      const dateStr = formatDate(ctx.nextEarningsDate);

      if (days <= 14) {
        console.log(
          `  Next Earnings: ${dateStr} (${days} days) ` + chalk.yellow('⚠️')
        );
      } else {
        console.log(`  Next Earnings: ${dateStr} (${days} days)`);
      }
    }

    // Sector
    if (ctx.sector) {
      console.log(`  Sector: ${ctx.sector}`);
    }
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUARTERLY PERFORMANCE - v1.4.0 (enhanced v1.4.1)
  // ─────────────────────────────────────────────────────────────────────────
  if (quarterlyPerformance && quarterlyPerformance.quarters.length > 0) {
    console.log();
    console.log(chalk.bold.white('  📊 QUARTERLY PERFORMANCE (Last 4Q)'));
    printSubDivider();
    console.log();

    const qp = quarterlyPerformance;
    const quarters = qp.quarters;

    // Quarter labels row
    const quarterLabels = quarters.map((q) => formatQuarterShort(q.quarter));
    console.log(
      chalk.gray('  Quarter:    ') +
        chalk.cyan(quarterLabels.join('      →      '))
    );

    // Revenue trend row with consistent formatting and growth %
    const revDisplay = buildRevenueDisplay(quarters);
    if (revDisplay.formatted.includes('$')) {
      const revTrendEmoji =
        qp.revenueTrend === 'growing'
          ? '📈'
          : qp.revenueTrend === 'declining'
            ? '📉'
            : '📊';
      const revTrendColor =
        qp.revenueTrend === 'growing'
          ? chalk.green
          : qp.revenueTrend === 'declining'
            ? chalk.red
            : chalk.yellow;
      console.log(
        chalk.gray('  Revenue:    ') +
          chalk.white(revDisplay.withGrowth) +
          chalk.gray(' ') +
          revTrendColor(`${revTrendEmoji}`)
      );
    }

    // Earnings trend row with consistent formatting and growth %
    const earnDisplay = buildEarningsDisplay(quarters);
    if (earnDisplay.formatted.includes('$')) {
      const earnTrendEmoji =
        qp.earningsTrend === 'improving'
          ? '📈'
          : qp.earningsTrend === 'declining'
            ? '📉'
            : '📊';
      const earnTrendColor =
        qp.earningsTrend === 'improving'
          ? chalk.green
          : qp.earningsTrend === 'declining'
            ? chalk.red
            : chalk.yellow;
      console.log(
        chalk.gray('  Earnings:   ') +
          chalk.white(earnDisplay.withGrowth) +
          chalk.gray(' ') +
          earnTrendColor(`${earnTrendEmoji}`)
      );
    }

    // Beat/Miss row with quarter context
    const beatMissWithLabels = quarters.map((q) => {
      const display = getBeatMissDisplay(q.beat, q.epsSurprise);
      if (display.type === 'beat') {
        return chalk.green(display.text);
      } else if (display.type === 'miss') {
        return chalk.red(display.text);
      }
      return chalk.gray('—');
    });

    const hasEpsData = quarters.some((q) => q.beat !== null);
    if (hasEpsData) {
      console.log(
        chalk.gray('  EPS:        ') +
          beatMissWithLabels.join(chalk.gray(' → '))
      );
    }

    console.log();

    // Summary line
    const bmRecord = qp.beatMissRecord;
    let summaryLine = '';

    // Profitability status
    if (qp.profitableQuarters < qp.totalQuarters) {
      if (qp.profitableQuarters === 0) {
        summaryLine += chalk.red('⚠️ Not profitable in any quarter. ');
      } else {
        summaryLine += chalk.yellow(
          `Profitable ${qp.profitableQuarters} of ${qp.totalQuarters} quarters. `
        );
      }
    } else {
      summaryLine += chalk.green(
        `✓ Profitable all ${qp.totalQuarters} quarters. `
      );
    }

    // Beat/miss summary
    if (bmRecord.total > 0) {
      const bmColor =
        bmRecord.beats >= bmRecord.misses ? chalk.green : chalk.yellow;
      summaryLine += bmColor(bmRecord.summary + '. ');
    }

    // Sequential improvement
    if (qp.sequentialImprovement) {
      summaryLine += chalk.cyan('📈 Margins improving QoQ.');
    }

    console.log(`  ${chalk.bold('Trend:')} ${summaryLine}`);

    // Surprise trend insight
    if (qp.surpriseTrend === 'consistently_beating') {
      console.log(
        `  ${chalk.bold('Insight:')} ` +
          chalk.green(
            'Consistently beating estimates — management under-promises'
          )
      );
    } else if (qp.surpriseTrend === 'consistently_missing') {
      console.log(
        `  ${chalk.bold('Insight:')} ` +
          chalk.red('Consistently missing estimates — execution concerns')
      );
    }

    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIVE STRENGTH - vs SPY benchmark
  // ─────────────────────────────────────────────────────────────────────────
  if (relativeStrength && relativeStrength.rs20) {
    console.log();
    console.log(chalk.bold.white('  📊 RELATIVE STRENGTH (vs SPY)'));
    printSubDivider();
    console.log();

    const displayRS = (
      rs: import('./utils/relative-strength.ts').RelativeStrengthResult | null,
      label: string
    ) => {
      if (!rs) return;

      const stockPct = (rs.stockReturn * 100).toFixed(1);
      const spyPct = (rs.spyReturn * 100).toFixed(1);
      const outPct = (rs.outperformance * 100).toFixed(1);

      const stockSign = rs.stockReturn >= 0 ? '+' : '';
      const spySign = rs.spyReturn >= 0 ? '+' : '';
      const outSign = rs.outperformance >= 0 ? '+' : '';

      const outColor = rs.isOutperforming ? chalk.green : chalk.red;
      const outEmoji = rs.isOutperforming ? '↑' : '↓';

      console.log(
        `  ${label}: ` +
          chalk.white(`Stock ${stockSign}${stockPct}%`) +
          chalk.gray(` vs SPY ${spySign}${spyPct}%`) +
          ` → ` +
          outColor(`${outSign}${outPct}% ${outEmoji}`)
      );
    };

    displayRS(relativeStrength.rs20, '20 days ');
    displayRS(relativeStrength.rs50, '50 days ');
    displayRS(relativeStrength.rs200, '200 days');

    // Overall assessment
    const trend = relativeStrength.overallTrend;
    let trendColor: (s: string) => string;
    let trendEmoji: string;

    if (trend === 'strong') {
      trendColor = chalk.green;
      trendEmoji = '🚀';
    } else if (trend === 'moderate') {
      trendColor = chalk.green;
      trendEmoji = '✓';
    } else if (trend === 'weak') {
      trendColor = chalk.yellow;
      trendEmoji = '~';
    } else {
      trendColor = chalk.red;
      trendEmoji = '⚠';
    }

    console.log();
    console.log(
      `  Overall: ` +
        trendColor(
          `${trend.charAt(0).toUpperCase() + trend.slice(1)} relative strength ${trendEmoji}`
        )
    );
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOMENTUM - Trend Direction (v1.3.2)
  // ─────────────────────────────────────────────────────────────────────────
  if (momentum && momentum.signals.length > 0) {
    console.log(chalk.bold.white('  📈 MOMENTUM (Trend Direction)'));
    printSubDivider();
    console.log();

    for (const signal of momentum.signals) {
      let dirEmoji: string;
      let dirColor: (s: string) => string;

      if (signal.direction === 'improving') {
        dirEmoji = '↑';
        dirColor = chalk.green;
      } else if (signal.direction === 'deteriorating') {
        dirEmoji = '↓';
        dirColor = chalk.red;
      } else {
        dirEmoji = '→';
        dirColor = chalk.yellow;
      }

      const dirLabel = signal.direction.toUpperCase();
      console.log(
        chalk.gray(`  ${signal.name}: `) +
          dirColor(`${dirEmoji} ${dirLabel}`) +
          chalk.gray(` — ${signal.description}`)
      );
    }

    // Overall momentum summary
    console.log();
    let summaryColor: (s: string) => string;
    let summaryEmoji: string;

    if (momentum.overallTrend === 'improving') {
      summaryColor = chalk.green;
      summaryEmoji = '🚀';
    } else if (momentum.overallTrend === 'deteriorating') {
      summaryColor = chalk.red;
      summaryEmoji = '⚠️';
    } else {
      summaryColor = chalk.yellow;
      summaryEmoji = '~';
    }

    console.log(
      `  Overall: ` + summaryColor(`${momentum.summary} ${summaryEmoji}`)
    );
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRICE ACTION - Chart and trend
  // ─────────────────────────────────────────────────────────────────────────
  if (showChart && historical.length > 30) {
    console.log(chalk.bold.white('  📈 PRICE ACTION'));
    printSubDivider();
    console.log();

    // Price chart
    const chartLines = generatePriceChart(historical);
    chartLines.forEach((line) => console.log(`  ${line}`));

    // Chart legend
    console.log();
    console.log(
      chalk.gray(
        `  ${chalk.green('█')} Up  ${chalk.red('█')} Down  ` +
          `${chalk.cyan('─')} MA20  ${chalk.yellow('─')} MA50  ` +
          `${chalk.green('┄')} Support  ${chalk.red('┄')} Resistance`
      )
    );
    console.log();

    // Trend summary
    if (trend) {
      const trendIcon =
        trend.direction === 'bullish'
          ? '↑'
          : trend.direction === 'bearish'
            ? '↓'
            : '→';
      const trendColor =
        trend.direction === 'bullish'
          ? chalk.green
          : trend.direction === 'bearish'
            ? chalk.red
            : chalk.yellow;

      console.log(
        `  ${chalk.bold('Trend:')} ` +
          `${trendColor(`${trendIcon} ${trend.direction.toUpperCase()}`)} ` +
          `(${trend.strength}) — ${trend.description}`
      );
    }

    // RSI
    if (rsi) {
      console.log(
        `  ${chalk.bold('RSI:')}   ` +
          `${rsi.bar} ${rsi.value.toFixed(1)} ` +
          `${rsi.color(rsi.status)}`
      );
    }

    // Volume
    if (volume) {
      const volIcon =
        volume.trend === 'increasing'
          ? '📈'
          : volume.trend === 'decreasing'
            ? '📉'
            : '📊';
      console.log(
        `  ${chalk.bold('Volume:')} ${volIcon} ${volume.description}`
      );
    }

    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THE BULL CASE - Why to buy
  // ─────────────────────────────────────────────────────────────────────────
  console.log(chalk.bold.green('  🟢 THE BULL CASE'));
  printSubDivider();
  console.log();

  const bullSignals = [
    ...technicalSignals,
    ...fundamentalSignals,
    ...analystSignals,
  ]
    .filter((s) => s.points >= 3)
    .sort((a, b) => b.points - a.points);

  if (bullSignals.length === 0) {
    console.log(chalk.gray('  No strong bullish signals at this time.'));
  } else {
    bullSignals.slice(0, 6).forEach((s) => {
      const categoryIcon =
        s.category === 'technical'
          ? '📊'
          : s.category === 'fundamental'
            ? '💰'
            : '🎯';
      console.log(
        `  ${categoryIcon} ${chalk.white(s.name)} ` +
          `${chalk.gray('—')} ${s.description}`
      );
    });
  }
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // THE BEAR CASE - Concerns
  // ─────────────────────────────────────────────────────────────────────────
  console.log(chalk.bold.red('  🔴 THE BEAR CASE'));
  printSubDivider();
  console.log();

  // Show fundamental warnings first (v1.3.0)
  const warnings = score.warnings ?? [];
  if (warnings.length > 0) {
    warnings.forEach((w) => {
      console.log(
        chalk.red(`  🚨 ${w.name}`) + chalk.gray(` — ${w.description}`)
      );
    });
  }

  const concerns = generateConcerns(
    score,
    trend,
    rsi,
    momentum,
    relativeStrength
  );
  if (concerns.length === 0 && warnings.length === 0) {
    console.log(chalk.gray('  No major concerns identified.'));
  } else if (concerns.length > 0) {
    concerns.slice(0, 6).forEach((c) => console.log(`  ⚠️  ${c}`));
  }
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // KEY LEVELS - Entry/Exit points
  // ─────────────────────────────────────────────────────────────────────────
  if (levels) {
    console.log(chalk.bold.white('  🎯 KEY LEVELS'));
    printSubDivider();
    console.log();

    console.log(`  ${chalk.bold('Current Price:')}  $${price.toFixed(2)}`);
    console.log();

    // Support levels
    if (levels.support1 || levels.support2) {
      console.log(chalk.green('  Support:'));
      if (levels.support1) {
        const dist = (((price - levels.support1) / price) * 100).toFixed(1);
        console.log(
          `    S1: $${levels.support1.toFixed(2)} ` +
            `${chalk.gray(`(-${dist}% from current)`)}`
        );
      }
      if (levels.support2) {
        const dist = (((price - levels.support2) / price) * 100).toFixed(1);
        console.log(
          `    S2: $${levels.support2.toFixed(2)} ` +
            `${chalk.gray(`(-${dist}% from current)`)}`
        );
      }
    }

    // Resistance levels
    if (levels.resistance1 || levels.resistance2) {
      console.log(chalk.red('  Resistance:'));
      if (levels.resistance1) {
        const dist = (((levels.resistance1 - price) / price) * 100).toFixed(1);
        console.log(
          `    R1: $${levels.resistance1.toFixed(2)} ` +
            `${chalk.gray(`(+${dist}% from current)`)}`
        );
      }
      if (levels.resistance2) {
        const dist = (((levels.resistance2 - price) / price) * 100).toFixed(1);
        console.log(
          `    R2: $${levels.resistance2.toFixed(2)} ` +
            `${chalk.gray(`(+${dist}% from current)`)}`
        );
      }
    }

    // Moving averages
    console.log(chalk.yellow('  Moving Averages:'));
    if (levels.ma20) {
      const pos = price > levels.ma20 ? 'above' : 'below';
      const icon = price > levels.ma20 ? '↑' : '↓';
      console.log(
        `    MA20: $${levels.ma20.toFixed(2)} ` +
          `${chalk.gray(`(price ${icon} ${pos})`)}`
      );
    }
    if (levels.ma50) {
      const pos = price > levels.ma50 ? 'above' : 'below';
      const icon = price > levels.ma50 ? '↑' : '↓';
      console.log(
        `    MA50: $${levels.ma50.toFixed(2)} ` +
          `${chalk.gray(`(price ${icon} ${pos})`)}`
      );
    }
    if (levels.ma200) {
      const pos = price > levels.ma200 ? 'above' : 'below';
      const icon = price > levels.ma200 ? '↑' : '↓';
      console.log(
        `    MA200: $${levels.ma200.toFixed(2)} ` +
          `${chalk.gray(`(price ${icon} ${pos})`)}`
      );
    }
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCORE BREAKDOWN - Quick reference
  // ─────────────────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  📊 SCORE BREAKDOWN'));
  printSubDivider();
  console.log();

  console.log(displayScoreBar('Technical', technicalScore, 50, '📊'));
  console.log(displayScoreBar('Fundamental', fundamentalScore, 30, '💰'));

  // Data quality indicator (v1.3.0)
  if (score.dataQuality === 'poor') {
    console.log(
      chalk.gray('     ') + chalk.red('⚠ Limited fundamental data available')
    );
  } else if (score.dataQuality === 'partial') {
    console.log(
      chalk.gray('     ') + chalk.yellow('ℹ Some fundamental metrics missing')
    );
  }

  // Sector comparison (v1.1.1 - use direct P/E from context, show bullish/bearish)
  if (score.context?.sector) {
    const ctx = score.context;
    const sectorComparisons = compareToBenchmark(
      ctx.sector,
      ctx.trailingPE ?? ctx.forwardPE,
      ctx.pegRatio,
      ctx.evEbitda
    );

    const comp = sectorComparisons[0];
    if (comp) {
      const compColor =
        comp.type === 'bullish'
          ? chalk.green
          : comp.type === 'bearish'
            ? chalk.yellow
            : chalk.gray;
      const icon = comp.type === 'bullish' ? '✓' : '⚠';
      console.log(
        chalk.gray(`     vs ${ctx.sector}: `) +
          compColor(`${icon} ${comp.text}`)
      );
    }
  }

  console.log(displayScoreBar('Analyst', analystScore, 20, '🎯'));
  console.log(chalk.gray('  ────────────────────────────────────────'));
  console.log(
    `  ${chalk.bold('TOTAL')}`.padEnd(22) +
      `${' '.repeat(24)}${chalk.bold(totalScore.toString())}${chalk.gray('/100')}`
  );
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // AI ANALYSIS - Unified comprehensive analysis (replaces Story + Insights + Verdict)
  // ─────────────────────────────────────────────────────────────────────────
  if (aiAnalysis?.unified) {
    const ai = aiAnalysis.unified;

    printDivider('═');
    console.log();
    console.log(chalk.bold.magenta('  🤖 AI ANALYSIS'));
    printSubDivider();
    console.log();

    // Recommendation badge with color
    const recColor =
      ai.recommendation === 'BUY'
        ? chalk.green
        : ai.recommendation === 'AVOID'
          ? chalk.red
          : chalk.yellow;
    const recEmoji =
      ai.recommendation === 'BUY'
        ? '🟢'
        : ai.recommendation === 'AVOID'
          ? '🔴'
          : '🟡';

    const confColor =
      ai.confidence === 'HIGH'
        ? chalk.green
        : ai.confidence === 'LOW'
          ? chalk.red
          : chalk.yellow;

    console.log(
      `  ${recEmoji} ` +
        recColor(chalk.bold(ai.recommendation)) +
        chalk.gray(' | Confidence: ') +
        confColor(ai.confidence)
    );
    console.log();

    // Main analysis with word wrap
    console.log(chalk.cyan('  ANALYSIS'));
    const analysisLines = wrapText(ai.analysis, 66, '  ');
    analysisLines.forEach((line) => console.log(chalk.white(line)));
    console.log();

    // Entry strategy
    console.log(chalk.cyan('  ENTRY STRATEGY'));
    const entryLines = wrapText(ai.entry, 66, '  ');
    entryLines.forEach((line) => console.log(chalk.white(line)));
    console.log();

    // Risk management
    console.log(chalk.cyan('  RISK MANAGEMENT'));
    const riskLines = wrapText(ai.risk, 66, '  ');
    riskLines.forEach((line) => console.log(chalk.white(line)));
    console.log();

    // Position Management Advice (only shown when user has a position)
    if (ai.positionAdvice) {
      const pa = ai.positionAdvice;
      console.log(chalk.cyan('  📍 POSITION MANAGEMENT'));

      // Action with color coding
      const actionColor =
        pa.action === 'HOLD'
          ? chalk.green
          : pa.action === 'CLOSE' || pa.action === 'TRIM'
            ? chalk.yellow
            : pa.action === 'ROLL'
              ? chalk.cyan
              : pa.action === 'ADD'
                ? chalk.green
                : chalk.white;

      const actionEmoji =
        pa.action === 'HOLD'
          ? '✓'
          : pa.action === 'CLOSE'
            ? '✗'
            : pa.action === 'ROLL'
              ? '↻'
              : pa.action === 'ADD'
                ? '+'
                : pa.action === 'TRIM'
                  ? '−'
                  : '•';

      console.log(`  ${actionEmoji} ` + actionColor(chalk.bold(pa.action)));
      console.log();

      const reasonLines = wrapText(pa.reasoning, 66, '  ');
      reasonLines.forEach((line) => console.log(chalk.white(line)));

      if (pa.rollTo) {
        console.log();
        console.log(chalk.gray('  Roll to: ') + chalk.cyan(pa.rollTo));
      }

      if (pa.alertLevels) {
        console.log();
        console.log(chalk.gray('  Set Alerts:'));
        console.log(
          chalk.yellow(`    ⚠ Warning: $${pa.alertLevels.warning.toFixed(2)}`)
        );
        console.log(
          chalk.red(`    🚨 Danger: $${pa.alertLevels.danger.toFixed(2)}`)
        );
      }
      console.log();
    }

    console.log(formatAIAttribution(ai.model, ai.mode));
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPTIONS STRATEGIES - Deep ITM Call Spreads (if options data available)
  // ─────────────────────────────────────────────────────────────────────────
  let spreadResult: SpreadGenerationResult | null = null;

  if (
    options &&
    options.calls &&
    options.calls.length > 0 &&
    totalScore >= 45
  ) {
    spreadResult = generateDeepITMSpreads(
      price,
      levels,
      options,
      score,
      rsi,
      momentum ?? null,
      score.context?.nextEarningsDate
        ? daysUntil(score.context.nextEarningsDate)
        : undefined
    );

    if (spreadResult.lines.length > 0) {
      console.log();
      console.log(chalk.bold.white('  📈 OPTIONS STRATEGIES'));
      printSubDivider();
      console.log();
      spreadResult.lines.forEach((line) => console.log(`  ${line}`));
      console.log();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENTRY DECISION - v1.5.0 Decision Engine (integrated with AI when enabled)
  // ─────────────────────────────────────────────────────────────────────────
  if (totalScore >= 45 && marketContext) {
    const decisionInput = buildDecisionInput(
      score,
      spreadResult?.checklist ?? {
        passed: false,
        checks: [],
        failReasons: ['No spread analysis available'],
      },
      momentum ?? null,
      relativeStrength,
      marketContext,
      spreadResult?.candidates ?? [],
      levels,
      rsi
    );

    const entryDecision = evaluateEntry(decisionInput);

    // Pass AI analysis to show unified recommendation
    displayEntryDecision(entryDecision, aiAnalysis?.unified ?? null);
  }

  printDivider('═');
  console.log();
}

/**
 * Generate concerns/bear case
 * FIX: Deduplicate similar concerns
 * v1.1: Add earnings warning, adjust for stock style
 * v1.4.2: Add momentum warnings to bear case
 * v1.4.3: Add relative strength warnings, analyst revisions, low upside
 */
function generateConcerns(
  score: StockScore,
  trend: ReturnType<typeof analyzeTrend> | null,
  rsi: ReturnType<typeof generateRSILine> | null,
  momentum?: MomentumAnalysis | null,
  relativeStrength?: {
    rs20: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    rs50: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    rs200: import('./utils/relative-strength.ts').RelativeStrengthResult | null;
    overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  } | null
): string[] {
  const concerns: string[] = [];
  const {
    technicalScore,
    fundamentalScore,
    analystScore,
    upsidePotential,
    context,
    stockStyle,
  } = score;

  // Track what we've already mentioned to avoid duplicates
  let mentionedTechnicalWeak = false;

  // Earnings warning - v1.1 feature
  if (context?.nextEarningsDate) {
    const days = daysUntil(context.nextEarningsDate);
    if (days <= 14 && days > 0) {
      concerns.push(
        `Earnings in ${days} days — consider waiting or sizing down`
      );
    }
  }

  // Technical concerns - FIXED: Don't duplicate trend and technical weakness
  if (trend?.direction === 'bearish') {
    // Extract actionable part of description (after the dash if present)
    const actionPart = trend.description.includes(',')
      ? trend.description.split(',')[1]?.trim()
      : 'monitor for reversal';
    concerns.push(
      `${trend.strength.charAt(0).toUpperCase() + trend.strength.slice(1)} downtrend — ` +
        `${actionPart}`
    );
    mentionedTechnicalWeak = true; // Trend implies technical weakness
  }

  // Only mention weak technicals if we haven't already mentioned downtrend
  if (technicalScore < 10 && !mentionedTechnicalWeak) {
    const technicalSignals = score.signals.filter(
      (s) => s.category === 'technical'
    );
    if (technicalSignals.length === 0) {
      concerns.push('No bullish technical signals detected');
    } else {
      concerns.push('Limited technical confirmation for entry');
    }
    mentionedTechnicalWeak = true;
  }

  // RSI concern
  if (rsi?.status === 'OVERBOUGHT') {
    concerns.push(
      `RSI overbought (${rsi.value.toFixed(0)}) — pullback risk elevated`
    );
  }

  // 52-week position concern
  if (
    context?.positionInRange !== undefined &&
    context.positionInRange > 0.85
  ) {
    concerns.push(
      `Trading near 52-week highs — limited upside, elevated downside`
    );
  }

  // Fundamental concerns - ADJUSTED for stock style
  // Don't warn about weak value metrics for growth stocks
  if (stockStyle !== 'growth') {
    if (fundamentalScore < 8) {
      concerns.push('Weak fundamentals — lacks value characteristics');
    } else if (fundamentalScore < 15) {
      concerns.push('Limited value signals detected');
    }
  }

  // v1.4.1: Valuation concerns for ALL stocks including growth
  // Even growth stocks can be overvalued relative to sector
  if (context?.trailingPE && context?.sector) {
    // Check if P/E is significantly above typical sector ranges
    const sectorPE: Record<string, number> = {
      Technology: 28,
      'Financial Services': 12,
      Healthcare: 22,
      'Consumer Cyclical': 20,
      'Communication Services': 18,
      Industrials: 20,
      'Consumer Defensive': 22,
      Energy: 12,
      Utilities: 18,
      'Real Estate': 35,
      'Basic Materials': 15,
    };
    const avgPE = sectorPE[context.sector] ?? 20;

    // Warn if P/E is 50%+ above sector average
    if (context.trailingPE > avgPE * 1.5) {
      const premium = ((context.trailingPE / avgPE - 1) * 100).toFixed(0);
      concerns.push(
        `P/E ${context.trailingPE.toFixed(0)} is ${premium}% above ` +
          `${context.sector} avg (${avgPE}) — valuation risk`
      );
    }
  }

  // v1.4.2: Momentum warnings in bear case
  if (momentum) {
    // Count deteriorating signals
    const deteriorating = momentum.signals.filter(
      (s) => s.direction === 'deteriorating'
    );

    // Price momentum warning (most critical)
    const priceMom = momentum.signals.find((s) => s.name === 'Price Momentum');
    if (priceMom?.direction === 'deteriorating') {
      const val = priceMom.value ?? 0;
      if (val < -15) {
        concerns.push(
          `Price down ${Math.abs(val).toFixed(0)}% (20d) — significant weakness`
        );
      } else if (val < -5) {
        concerns.push(
          `Negative price momentum (${val.toFixed(0)}% in 20 days)`
        );
      }
    }

    // EPS/Analyst sentiment warnings
    const epsMom = momentum.signals.find((s) => s.name === 'EPS Estimates');
    if (epsMom?.direction === 'deteriorating') {
      concerns.push(`EPS estimates being cut — analyst confidence waning`);
    }

    const ratingsMom = momentum.signals.find(
      (s) => s.name === 'Rating Changes'
    );
    if (ratingsMom?.direction === 'deteriorating') {
      concerns.push(`More downgrades than upgrades (90 days)`);
    }

    // Insider selling warning
    const insiderMom = momentum.signals.find(
      (s) => s.name === 'Insider Activity'
    );
    if (insiderMom?.direction === 'deteriorating') {
      concerns.push(`Insider selling detected — watch for more`);
    }

    // Overall momentum warning (if not covered by specifics)
    if (momentum.overallTrend === 'deteriorating' && deteriorating.length > 2) {
      if (!concerns.some((c) => c.includes('momentum'))) {
        concerns.push(`Multiple momentum signals deteriorating`);
      }
    }
  }

  // v1.4.3: Analyst Revisions warning (different from Rating Changes)
  const analystRevisions = momentum?.signals.find(
    (s) => s.name === 'Analyst Revisions'
  );
  if (analystRevisions?.direction === 'deteriorating') {
    concerns.push(`Analysts cutting EPS estimates — negative sentiment`);
  }

  // v1.4.3: Relative strength concerns
  if (relativeStrength?.overallTrend === 'underperforming') {
    // Count how many periods are underperforming
    const underCount = [
      relativeStrength.rs20?.isOutperforming === false,
      relativeStrength.rs50?.isOutperforming === false,
      relativeStrength.rs200?.isOutperforming === false,
    ].filter(Boolean).length;

    if (underCount >= 3) {
      concerns.push(`Underperforming SPY across all timeframes`);
    } else if (underCount >= 2) {
      concerns.push(`Lagging S&P 500 — weak relative strength`);
    }
  }

  // Analyst concerns - v1.4.3: Warn about low upside regardless of analyst score
  if (upsidePotential < 0) {
    concerns.push('Trading ABOVE analyst targets — potential downside risk');
  } else if (upsidePotential < 0.08) {
    // Less than 8% upside is minimal
    concerns.push(
      `Limited upside (${(upsidePotential * 100).toFixed(0)}%) — ` +
        `risk/reward may be unfavorable`
    );
  } else if (analystScore < 8) {
    concerns.push('Low analyst coverage or conviction');
  }

  return concerns;
}

// ============================================================================
// ENTRY DECISION DISPLAY
// ============================================================================

/**
 * Display entry decision from the decision engine
 * v1.5.0: Spread Entry Decision Engine
 * v1.6.1: Integrated with AI recommendation for unified view
 */
function displayEntryDecision(
  decision: EntryDecision,
  aiAnalysis: AIAnalysisResult['unified'] | null = null
): void {
  console.log();
  console.log(chalk.bold.white('  🎯 ENTRY DECISION'));
  printSubDivider();
  console.log();

  // Check if AI is in position management mode (HOLD recommendation)
  const aiHasPosition = aiAnalysis?.positionAdvice !== undefined;
  const aiPositionAction = aiAnalysis?.positionAdvice?.action;

  // Check if AI and decision engine conflict (only for new entries, not positions)
  const aiSaysWait =
    !aiHasPosition &&
    (aiAnalysis?.recommendation === 'WAIT' ||
      aiAnalysis?.recommendation === 'AVOID');
  const engineSaysEnter = decision.action === 'enter_now';
  const hasConflict = aiAnalysis && aiSaysWait && engineSaysEnter;

  // Determine unified action based on both signals
  let unifiedAction: string;
  let unifiedColor: (s: string) => string;
  let unifiedEmoji: string;

  if (aiHasPosition) {
    // Position management mode - defer to AI position advice
    if (aiPositionAction === 'HOLD' || aiPositionAction === 'ADD') {
      unifiedAction =
        aiPositionAction === 'ADD' ? 'ADD TO POSITION' : 'HOLD POSITION';
      unifiedColor = chalk.green;
      unifiedEmoji = '✅';
    } else if (aiPositionAction === 'ROLL') {
      unifiedAction = 'ROLL POSITION';
      unifiedColor = chalk.cyan;
      unifiedEmoji = '↻';
    } else if (aiPositionAction === 'TRIM') {
      unifiedAction = 'TRIM POSITION';
      unifiedColor = chalk.yellow;
      unifiedEmoji = '➖';
    } else {
      unifiedAction = 'CLOSE POSITION';
      unifiedColor = chalk.red;
      unifiedEmoji = '❌';
    }
  } else if (hasConflict) {
    // When there's a conflict, show caution
    unifiedAction = 'ENTER WITH CAUTION';
    unifiedColor = chalk.yellow;
    unifiedEmoji = '⚠️';
  } else if (aiAnalysis) {
    // When AI is enabled and agrees or doesn't conflict
    if (aiAnalysis.recommendation === 'BUY' && engineSaysEnter) {
      unifiedAction = 'ENTER NOW';
      unifiedColor = chalk.green;
      unifiedEmoji = '✅';
    } else if (aiAnalysis.recommendation === 'BUY') {
      unifiedAction = 'ENTER NOW';
      unifiedColor = chalk.green;
      unifiedEmoji = '✅';
    } else if (aiAnalysis.recommendation === 'WAIT') {
      unifiedAction = 'WAIT FOR BETTER ENTRY';
      unifiedColor = chalk.yellow;
      unifiedEmoji = '⏳';
    } else {
      unifiedAction = 'AVOID';
      unifiedColor = chalk.red;
      unifiedEmoji = '❌';
    }
  } else {
    // No AI - use decision engine only
    unifiedAction = formatAction(decision.action);
    unifiedColor =
      decision.action === 'enter_now'
        ? chalk.green
        : decision.action === 'wait_for_pullback'
          ? chalk.yellow
          : chalk.red;
    unifiedEmoji =
      decision.action === 'enter_now'
        ? '✅'
        : decision.action === 'wait_for_pullback'
          ? '⏳'
          : '❌';
  }

  console.log(
    `  ${unifiedEmoji} ${chalk.bold('ACTION:')} ` + unifiedColor(unifiedAction)
  );

  // Show conflict warning if applicable
  if (hasConflict) {
    console.log();
    console.log(
      chalk.yellow('  ⚠ AI recommends WAIT but technicals show entry setup')
    );
    console.log(
      chalk.gray('    Consider reduced position size or wait for confirmation')
    );
  }
  console.log();

  // Confidence score with visual bar
  const confidenceBar = generateConfidenceBar(decision.confidence.total);
  const confidenceColor =
    decision.confidence.total >= 70
      ? chalk.green
      : decision.confidence.total >= 55
        ? chalk.yellow
        : chalk.red;

  console.log(
    chalk.gray('  Confidence: ') +
      confidenceBar +
      ' ' +
      confidenceColor(`${decision.confidence.total}/100`) +
      chalk.gray(` (${formatConfidenceLevel(decision.confidence.level)})`)
  );

  // Confidence breakdown (compact)
  const cb = decision.confidence.breakdown;
  console.log(
    chalk.gray('    ├─ Stock: ') +
      chalk.white(`${cb.stockScore}/30`) +
      chalk.gray(' │ Checklist: ') +
      chalk.white(`${cb.checklistPassRate}/25`) +
      chalk.gray(' │ Momentum: ') +
      chalk.white(`${cb.momentum}/20`)
  );
  console.log(
    chalk.gray('    └─ Rel Strength: ') +
      chalk.white(`${cb.relativeStrength}/15`) +
      chalk.gray(' │ Market: ') +
      chalk.white(`${cb.marketRegime}/10`)
  );
  console.log();

  // Spread details (if available)
  if (decision.recommendedSpread && decision.spreadScore) {
    const spread = decision.recommendedSpread;
    const score = decision.spreadScore;

    const expDate = spread.expiration.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const spreadRatingColor =
      score.rating === 'excellent'
        ? chalk.green
        : score.rating === 'good'
          ? chalk.cyan
          : score.rating === 'fair'
            ? chalk.yellow
            : chalk.red;

    const spreadRatingStars =
      score.rating === 'excellent'
        ? '★★★'
        : score.rating === 'good'
          ? '★★'
          : score.rating === 'fair'
            ? '★'
            : '';

    console.log(
      chalk.gray('  Spread: ') +
        chalk.white(
          `Buy $${spread.longStrike}C / Sell $${spread.shortStrike}C`
        ) +
        chalk.gray(` (${expDate}, ${spread.dte} DTE)`)
    );
    console.log(
      chalk.gray('  Spread Score: ') +
        spreadRatingColor(`${score.total}/100 ${spreadRatingStars}`) +
        chalk.gray(` (${score.rating})`)
    );

    // Spread score breakdown (compact tree)
    const sb = score.breakdown;
    console.log(
      chalk.gray('    ├─ Intrinsic: ') +
        chalk.white(`${sb.intrinsicValue}/20`) +
        chalk.gray(' │ Cushion: ') +
        chalk.white(`${sb.cushion}/20`) +
        chalk.gray(' │ Delta: ') +
        chalk.white(`${sb.delta}/10`)
    );
    console.log(
      chalk.gray('    ├─ DTE: ') +
        chalk.white(`${sb.dte}/10`) +
        chalk.gray(' │ Return: ') +
        chalk.white(`${sb.returnOnRisk}/10`) +
        chalk.gray(' │ Support: ') +
        chalk.white(`${sb.supportProtection}/15`)
    );
    console.log(
      chalk.gray('    └─ Earnings: ') + chalk.white(`${sb.earningsRisk}/10`)
    );
    console.log();
  }

  // Position sizing
  const sizeColor =
    decision.positionSizing.size === 'full'
      ? chalk.green
      : decision.positionSizing.size === 'three_quarter'
        ? chalk.cyan
        : decision.positionSizing.size === 'half'
          ? chalk.yellow
          : decision.positionSizing.size === 'quarter'
            ? chalk.yellow
            : chalk.red;

  console.log(
    chalk.gray('  Position Size: ') +
      sizeColor(formatPositionSize(decision.positionSizing.size))
  );

  // Position sizing reasoning
  for (const reason of decision.positionSizing.reasoning.slice(0, 3)) {
    console.log(chalk.gray(`    • ${reason}`));
  }

  if (decision.positionSizing.maxContracts > 0 && decision.recommendedSpread) {
    const totalCost =
      decision.positionSizing.maxContracts *
      decision.recommendedSpread.netDebit *
      100;
    console.log(
      chalk.gray('  Suggested: ') +
        chalk.white(`${decision.positionSizing.maxContracts} contract(s)`) +
        chalk.gray(` ($${totalCost.toFixed(0)} total risk)`)
    );
  }
  console.log();

  // Timing analysis
  if (decision.action === 'wait_for_pullback' && decision.timing.waitTarget) {
    console.log(
      chalk.gray('  Wait Target: ') +
        chalk.yellow(`$${decision.timing.waitTarget.toFixed(2)}`)
    );
    if (decision.timing.waitReason) {
      console.log(chalk.gray(`    └─ ${decision.timing.waitReason}`));
    }
    console.log();
  }

  // Entry guidance
  if (decision.entryGuidance.length > 0) {
    console.log(chalk.gray('  Entry Guidance:'));
    for (const guide of decision.entryGuidance) {
      const icon = decision.action === 'enter_now' ? '✓' : '→';
      console.log(chalk.gray(`    ${icon} `) + chalk.white(guide));
    }
    console.log();
  }

  // Risk management
  if (decision.riskManagement.length > 0) {
    console.log(chalk.gray('  Risk Management:'));
    for (const risk of decision.riskManagement) {
      console.log(chalk.gray('    • ') + chalk.white(risk));
    }
    console.log();
  }

  // Warnings
  if (decision.warnings.length > 0) {
    for (const warning of decision.warnings.slice(0, 4)) {
      console.log(chalk.yellow(`  ${warning}`));
    }
    console.log();
  }
}

/**
 * Generate confidence bar visualization
 */
function generateConfidenceBar(score: number): string {
  const width = 15;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let color: (s: string) => string;
  if (score >= 70) {
    color = chalk.green;
  } else if (score >= 55) {
    color = chalk.yellow;
  } else {
    color = chalk.red;
  }

  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

/**
 * Build decision engine input from analysis data
 */
function buildDecisionInput(
  score: StockScore,
  checklist: {
    passed: boolean;
    checks: Array<{ passed: boolean }>;
    failReasons: string[];
  },
  momentum: import('./utils/momentum.ts').MomentumAnalysis | null,
  relativeStrength:
    | {
        overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
      }
    | undefined,
  marketContext: MarketContext | null,
  spreadCandidates: Array<{
    longStrike: number;
    shortStrike: number;
    expiration: Date;
    netDebit: number;
    maxProfit: number;
    breakeven: number;
    intrinsicPct: number;
    cushionPct: number;
    delta: number;
  }>,
  levels: ReturnType<typeof getKeyLevels> | null,
  rsi: ReturnType<typeof generateRSILine> | null
): DecisionEngineInput {
  return {
    ticker: score.ticker,
    currentPrice: score.price,
    stockScore: score.totalScore,
    technicalScore: score.technicalScore,
    fundamentalScore: score.fundamentalScore,
    analystScore: score.analystScore,

    checklistPassed: checklist.checks.filter((c) => c.passed).length,
    checklistTotal: checklist.checks.length,
    checklistFailReasons: checklist.failReasons,

    momentumOverall: momentum?.overallTrend ?? 'stable',
    momentumSignals:
      momentum?.signals.map((s) => ({
        name: s.name,
        direction: s.direction,
      })) ?? [],

    relativeStrengthTrend: relativeStrength?.overallTrend ?? 'moderate',

    marketRegime: marketContext?.regime ?? 'neutral',

    support1: levels?.support1 ?? undefined,
    support2: levels?.support2 ?? undefined,
    resistance1: levels?.resistance1 ?? undefined,
    ma20: levels?.ma20 ?? undefined,
    ma200: score.context?.ma200,
    rsiValue: rsi?.value,

    daysToEarnings: score.context?.nextEarningsDate
      ? daysUntil(score.context.nextEarningsDate)
      : undefined,

    spreadCandidates,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deep ITM Call Spread Entry Checklist
 * v1.4.4: Implements safe deep ITM vertical spread strategy
 */
interface SpreadChecklist {
  passed: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
  failReasons: string[];
}

function evaluateSpreadChecklist(
  currentPrice: number,
  score: StockScore,
  rsi: ReturnType<typeof generateRSILine> | null,
  momentum: MomentumAnalysis | null,
  daysToEarnings?: number
): SpreadChecklist {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const failReasons: string[] = [];

  // 1. Price above MA200 (long-term trend up)
  const ma200 = score.context?.ma200;
  const aboveMA200 = ma200 ? currentPrice > ma200 : false;
  checks.push({
    name: 'Above MA200',
    passed: aboveMA200,
    detail: ma200
      ? `$${currentPrice.toFixed(0)} ${aboveMA200 ? '>' : '<'} MA200 $${ma200.toFixed(0)}`
      : 'MA200 unavailable',
  });
  if (!aboveMA200) failReasons.push('Price below MA200');

  // 2. RSI in stable range (35-55)
  const rsiValue = rsi?.value ?? 50;
  const rsiStable = rsiValue >= 35 && rsiValue <= 55;
  const rsiNotOverbought = rsiValue < 70;
  checks.push({
    name: 'RSI Stable (35-55)',
    passed: rsiStable,
    detail: `RSI ${rsiValue.toFixed(0)} ${rsiStable ? '✓' : rsiValue > 55 ? 'elevated' : 'low'}`,
  });
  if (rsiValue > 70)
    failReasons.push(`RSI overbought (${rsiValue.toFixed(0)})`);

  // 3. Analyst revisions positive
  const analystRev = momentum?.signals.find(
    (s) => s.name === 'Analyst Revisions'
  );
  const revisionsPositive =
    analystRev?.direction === 'improving' || analystRev?.direction === 'stable';
  checks.push({
    name: 'Analyst Revisions',
    passed: revisionsPositive,
    detail: analystRev?.description ?? 'N/A',
  });
  if (analystRev?.direction === 'deteriorating') {
    failReasons.push('Analyst revisions negative');
  }

  // 4. No earnings within 10 days
  const earningsOK = !daysToEarnings || daysToEarnings > 10;
  checks.push({
    name: 'No Imminent Earnings',
    passed: earningsOK,
    detail: daysToEarnings
      ? `${daysToEarnings} days to earnings`
      : 'No earnings date',
  });
  if (!earningsOK) failReasons.push(`Earnings in ${daysToEarnings} days`);

  // 5. Price momentum not severely deteriorating
  const priceMom = momentum?.signals.find((s) => s.name === 'Price Momentum');
  const momValue = priceMom?.value ?? 0;
  const momNotBearish =
    priceMom?.direction !== 'deteriorating' || momValue > -15;
  checks.push({
    name: 'Momentum Stable',
    passed: momNotBearish,
    detail: priceMom?.description ?? 'N/A',
  });
  if (priceMom?.direction === 'deteriorating' && momValue < -15) {
    failReasons.push('Severe price decline');
  }

  // 6. Fundamentals decent (score >= 15/30) or strong growth
  const fundOK = score.fundamentalScore >= 15 || score.stockStyle === 'growth';
  checks.push({
    name: 'Fundamentals/Growth',
    passed: fundOK,
    detail: `${score.fundamentalScore}/30 ${score.stockStyle ? `(${score.stockStyle})` : ''}`,
  });

  // 7. Overall score reasonable
  const scoreOK = score.totalScore >= 55;
  checks.push({
    name: 'Score ≥ 55',
    passed: scoreOK,
    detail: `${score.totalScore}/100`,
  });
  if (!scoreOK) failReasons.push(`Score too low (${score.totalScore})`);

  // Determine overall pass
  const criticalPasses =
    aboveMA200 && rsiNotOverbought && earningsOK && scoreOK;
  const passCount = checks.filter((c) => c.passed).length;
  const passed = criticalPasses && passCount >= 5;

  return { passed, checks, failReasons };
}

/**
 * Spread candidate data for decision engine
 */
interface SpreadCandidate {
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  netDebit: number;
  maxProfit: number;
  breakeven: number;
  intrinsicPct: number;
  cushionPct: number;
  delta: number;
}

/**
 * Result from spread generation including both display and data
 */
interface SpreadGenerationResult {
  lines: string[];
  candidates: SpreadCandidate[];
  checklist: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
    failReasons: string[];
  };
}

/**
 * Generate Deep ITM Call Spread recommendations
 * v1.4.4: Buy intrinsic value, not hope
 * v1.5.0: Returns candidates for decision engine
 * - Deep ITM long call = like discounted stock ownership
 * - ATM/OTM short call = reduces cost basis
 * - Defined risk, low theta, low IV sensitivity
 */
function generateDeepITMSpreads(
  currentPrice: number,
  levels: ReturnType<typeof getKeyLevels> | null,
  options: import('./engine/screener.ts').OptionsData,
  score: StockScore,
  rsi: ReturnType<typeof generateRSILine> | null,
  momentum: MomentumAnalysis | null,
  daysToEarnings?: number
): SpreadGenerationResult {
  const lines: string[] = [];
  const candidates: SpreadCandidate[] = [];
  const emptyChecklist = {
    passed: false,
    checks: [],
    failReasons: ['No spread data available'],
  };

  if (!levels || !options.calls.length) {
    return { lines, candidates, checklist: emptyChecklist };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ENTRY CHECKLIST
  // ═══════════════════════════════════════════════════════════════════
  const checklist = evaluateSpreadChecklist(
    currentPrice,
    score,
    rsi,
    momentum,
    daysToEarnings
  );

  lines.push(chalk.bold.white('Entry Checklist:'));
  lines.push('');

  for (const check of checklist.checks) {
    const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
    const nameColor = check.passed ? chalk.white : chalk.gray;
    lines.push(
      `  ${icon} ${nameColor(check.name)}: ${chalk.gray(check.detail)}`
    );
  }
  lines.push('');

  // Show overall status
  const passCount = checklist.checks.filter((c) => c.passed).length;
  const totalChecks = checklist.checks.length;

  if (!checklist.passed) {
    lines.push(
      chalk.yellow(`⚠️  ${passCount}/${totalChecks} checks passed — `) +
        chalk.gray('conditions not ideal for spreads')
    );
    if (checklist.failReasons.length > 0) {
      lines.push(chalk.gray(`   Issues: ${checklist.failReasons.join(', ')}`));
    }
    return { lines, candidates, checklist };
  }

  lines.push(
    chalk.green(`✅ ${passCount}/${totalChecks} checks passed — `) +
      chalk.white('conditions favorable')
  );
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════
  // GENERATE DEEP ITM CALL SPREADS
  // ═══════════════════════════════════════════════════════════════════

  const expiration =
    options.expiration instanceof Date
      ? options.expiration
      : new Date(options.expiration);

  const expDate = expiration.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const dte = Math.ceil(
    (expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const callStrikes = options.calls.map((c) => c.strike).sort((a, b) => a - b);

  interface DeepITMSpread {
    longStrike: number; // Deep ITM (buy)
    shortStrike: number; // ATM/OTM (sell)
    netDebit: number;
    maxProfit: number;
    maxLoss: number; // = net debit
    breakeven: number;
    intrinsicValue: number;
    timeValue: number;
    delta: number;
  }

  const internalCandidates: DeepITMSpread[] = [];

  // Strategy: Buy deep ITM call, sell slightly less deep ITM call
  // BOTH legs are ITM for maximum safety and cushion
  // Creates a spread that behaves like discounted stock with protection

  // Get all ITM call strikes (below current price)
  const itmStrikes = callStrikes.filter((s) => s < currentPrice);

  // Try all ITM combinations looking for $5 width with deep ITM long
  for (const longStrike of itmStrikes) {
    // Long strike must be 6-12% ITM (deep ITM for safety)
    // Slightly relaxed to work with Yahoo Finance data availability
    const longItmPct = (currentPrice - longStrike) / currentPrice;
    if (longItmPct < 0.06 || longItmPct > 0.12) continue;

    for (const shortStrike of itmStrikes) {
      // Short must be higher than long
      if (shortStrike <= longStrike) continue;

      // Short strike should also be ITM (2-10% ITM for safety)
      const shortItmPct = (currentPrice - shortStrike) / currentPrice;
      if (shortItmPct < 0.02 || shortItmPct > 0.1) continue;

      // Width constraints: $5 target (allow $2.50-$7.50 for different strike increments)
      // Some options have $2.50 increments, others have $5
      const width = shortStrike - longStrike;
      if (width < 2.5 || width > 7.5) continue;

      // Prefer $5 width but accept $2.50 or $7.50 if $5 not available
      // Score will penalize non-$5 widths

      const longCall = options.calls.find((c) => c.strike === longStrike);
      const shortCall = options.calls.find((c) => c.strike === shortStrike);

      if (!longCall || !shortCall) continue;

      // Net debit = pay for long call - receive from short call
      const netDebit = longCall.ask - shortCall.bid;
      if (netDebit <= 0 || netDebit > width * 0.95) continue; // Must have profit potential

      // Intrinsic value of long call
      const intrinsicValue = Math.max(0, currentPrice - longStrike);
      const timeValue = netDebit - intrinsicValue;

      // For deep ITM spreads, time value is often NEGATIVE (paying less than intrinsic)
      // This is ideal! We only reject if time value is >50% of debit (overpaying)
      // Negative time value means we're getting a discount - always good
      if (intrinsicValue <= 0) continue;
      if (timeValue > 0 && timeValue / netDebit > 0.5) continue;

      const maxProfit = width - netDebit;
      const maxLoss = netDebit;
      const breakeven = longStrike + netDebit;

      // Approximate delta (deep ITM calls have high delta ~0.80+)
      const deltaApprox =
        0.85 - ((currentPrice - longStrike) / currentPrice) * 0.5;

      // Return on risk
      const returnOnRisk = (maxProfit / maxLoss) * 100;

      // Only include if decent return (>=10%) and breakeven below current
      // Deep ITM spreads have lower returns but much higher win rate
      if (returnOnRisk >= 10 && breakeven < currentPrice * 0.995) {
        internalCandidates.push({
          longStrike,
          shortStrike,
          netDebit,
          maxProfit,
          maxLoss,
          breakeven,
          intrinsicValue,
          timeValue,
          delta: Math.min(0.95, Math.max(0.7, deltaApprox)),
        });
      }
    }
  }

  // Sort by: lowest breakeven first (safest), then by return
  internalCandidates.sort((a, b) => {
    const breakDiff = a.breakeven - b.breakeven;
    if (Math.abs(breakDiff) > 1) return breakDiff;
    return b.maxProfit / b.maxLoss - a.maxProfit / a.maxLoss;
  });

  // Remove similar spreads
  const seen = new Set<string>();
  const unique = internalCandidates.filter((c) => {
    const key = `${c.longStrike}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    lines.push(chalk.gray('  No suitable deep ITM spreads found'));
    return { lines, candidates, checklist };
  }

  // Populate output candidates for decision engine
  for (const spread of unique) {
    const cushionPct = ((currentPrice - spread.breakeven) / currentPrice) * 100;
    const intrinsicPct = (spread.intrinsicValue / spread.netDebit) * 100;

    candidates.push({
      longStrike: spread.longStrike,
      shortStrike: spread.shortStrike,
      expiration,
      netDebit: spread.netDebit,
      maxProfit: spread.maxProfit,
      breakeven: spread.breakeven,
      intrinsicPct,
      cushionPct,
      delta: spread.delta,
    });
  }

  lines.push(chalk.bold.cyan('Deep ITM Call Spreads ($5 width):'));
  lines.push(
    chalk.gray(
      '  Buy intrinsic value, not hope | Low theta | $5 max risk per share'
    )
  );
  lines.push('');

  const topSpreads = unique.slice(0, 2);

  for (const spread of topSpreads) {
    const cushion = ((currentPrice - spread.breakeven) / currentPrice) * 100;
    // Intrinsic% > 100 means negative time value (even better - discount!)
    const intrinsicPct = (spread.intrinsicValue / spread.netDebit) * 100;
    const returnPct = (spread.maxProfit / spread.maxLoss) * 100;

    // Rating: prioritize low time value (intrinsicPct >= 100 = discount)
    let rating: string;
    let ratingColor: (s: string) => string;
    if (intrinsicPct >= 100 && cushion >= 2) {
      // Paying LESS than intrinsic = best deal
      rating = '★★★ BEST';
      ratingColor = chalk.green;
    } else if (intrinsicPct >= 70 && cushion >= 2) {
      rating = '★★ GOOD';
      ratingColor = chalk.green;
    } else {
      rating = '★ OK';
      ratingColor = chalk.yellow;
    }

    lines.push(
      chalk.white(`Buy $${spread.longStrike}C`) +
        chalk.gray(' / ') +
        chalk.white(`Sell $${spread.shortStrike}C`) +
        chalk.gray(` (${expDate}, ${dte} DTE)`) +
        chalk.gray(' — ') +
        ratingColor(rating)
    );
    lines.push(
      chalk.gray('  Debit: ') +
        chalk.yellow(`$${(spread.netDebit * 100).toFixed(0)}`) +
        chalk.gray(' | Max Profit: ') +
        chalk.green(`$${(spread.maxProfit * 100).toFixed(0)}`) +
        chalk.gray(` | Return: `) +
        chalk.white(`${returnPct.toFixed(0)}%`)
    );
    lines.push(
      chalk.gray('  Breakeven: ') +
        chalk.white(`$${spread.breakeven.toFixed(2)}`) +
        chalk.gray(` (`) +
        chalk.cyan(`${cushion.toFixed(1)}% below current`) +
        chalk.gray(`)`)
    );
    // Show intrinsic value status
    const intrinsicDisplay =
      intrinsicPct >= 100
        ? chalk.green(`${intrinsicPct.toFixed(0)}% (discount!)`)
        : chalk.yellow(`${intrinsicPct.toFixed(0)}%`);
    lines.push(
      chalk.gray('  Intrinsic: ') +
        intrinsicDisplay +
        chalk.gray(` of cost | Delta ≈ `) +
        chalk.white(`${(spread.delta * 100).toFixed(0)}`)
    );
    lines.push('');
  }

  return { lines, candidates, checklist };
}

/**
 * Calculate days until a date
 */
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Format date as "Dec 15, 2025"
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function printDivider(char = '─'): void {
  console.log(chalk.gray(char.repeat(72)));
}

function printSubDivider(): void {
  console.log(chalk.gray('  ' + '─'.repeat(68)));
}

/**
 * Word wrap text to specified width with optional indent
 * Preserves sentence structure and breaks on word boundaries
 */
function wrapText(
  text: string,
  maxWidth: number = 66,
  indent: string = '  '
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(indent + currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(indent + currentLine);
  }

  return lines;
}

/**
 * Format AI model attribution line
 */
function formatAIAttribution(model: string, mode: string): string {
  const shortModel = model.split(':')[0] ?? model;
  return chalk.gray(`  ─ Generated by ${shortModel} (${mode})`);
}

/**
 * Generate a visual 52-week range bar
 */
function generate52WeekBar(position: number): string {
  const width = 20;
  const pos = Math.max(0, Math.min(1, position));
  const marker = Math.round(pos * (width - 1));

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i === marker) {
      bar += chalk.cyan('●');
    } else if (i < marker) {
      bar += chalk.green('─');
    } else {
      bar += chalk.gray('─');
    }
  }
  return `[${bar}]`;
}

/**
 * Format market cap in human-readable form
 */
function formatMarketCap(cap: number): string {
  if (cap >= 1_000_000_000_000) {
    return `$${(cap / 1_000_000_000_000).toFixed(2)}T`;
  } else if (cap >= 1_000_000_000) {
    return `$${(cap / 1_000_000_000).toFixed(2)}B`;
  } else if (cap >= 1_000_000) {
    return `$${(cap / 1_000_000).toFixed(2)}M`;
  }
  return `$${cap.toLocaleString()}`;
}

function displayScoreBar(
  label: string,
  score: number,
  max: number,
  icon: string
): string {
  const pct = score / max;
  const filled = Math.round(pct * 20);
  const empty = 20 - filled;

  let color: (s: string) => string;
  if (pct >= 0.7) color = chalk.green;
  else if (pct >= 0.4) color = chalk.yellow;
  else color = chalk.red;

  const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

  return `  ${icon} ${label.padEnd(12)} ${bar} ${color(score.toString())}${chalk.gray('/' + max)}`;
}

function getUpsideDisplay(upside: number): string {
  const pct = (upside * 100).toFixed(0);
  const sign = upside >= 0 ? '+' : '';

  if (upside >= 0.3) return chalk.bold.green(`↑ ${sign}${pct}% upside`);
  if (upside >= 0.15) return chalk.green(`↑ ${sign}${pct}% upside`);
  if (upside >= 0) return chalk.yellow(`→ ${sign}${pct}% upside`);
  return chalk.red(`↓ ${pct}% downside`);
}

function getScoreDisplay(score: number): string {
  if (score >= 80) return chalk.bold.green(`Score: ${score}/100 ★★★`);
  if (score >= 60) return chalk.green(`Score: ${score}/100 ★★`);
  if (score >= 40) return chalk.yellow(`Score: ${score}/100 ★`);
  return chalk.gray(`Score: ${score}/100`);
}

/**
 * Display results table with decision column
 * v1.5.1: Shows quick decision status for each stock
 */
function displayResultsTableWithDecisions(
  results: Array<{ score: StockScore; decision: QuickDecisionResult }>,
  actionableOnly: boolean
): void {
  const table = new Table({
    head: [
      chalk.cyan('Rank'),
      chalk.cyan('Ticker'),
      chalk.cyan('Price'),
      chalk.cyan('Score'),
      chalk.cyan('Decision'),
      chalk.cyan('Reason'),
    ],
    colWidths: [6, 8, 10, 8, 12, 30],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  const displayLimit = actionableOnly ? 30 : 20;

  results.slice(0, displayLimit).forEach((item, index) => {
    const { score: result, decision } = item;

    const scoreColor =
      result.totalScore >= 80
        ? chalk.green
        : result.totalScore >= 70
          ? chalk.yellow
          : chalk.white;

    // Decision display with emoji and color
    // v2.6.0: Added SCALE_IN display
    let decisionDisplay: string;
    if (decision.decision === 'ENTER') {
      decisionDisplay = chalk.green('✅ ENTER');
    } else if (decision.decision === 'SCALE_IN') {
      decisionDisplay = chalk.cyan('📊 SCALE_IN');
    } else if (decision.decision === 'WAIT') {
      decisionDisplay = chalk.yellow('⏳ WAIT');
    } else {
      decisionDisplay = chalk.red('❌ PASS');
    }

    table.push([
      chalk.gray((index + 1).toString()),
      chalk.bold(result.ticker),
      `$${result.price.toFixed(2)}`,
      scoreColor(result.totalScore.toString()),
      decisionDisplay,
      chalk.gray(decision.reason),
    ]);
  });

  console.log();
  const title = actionableOnly
    ? 'Actionable Opportunities'
    : 'Top Buy Opportunities';
  console.log(
    chalk.bold.white(`  ${title} - ${new Date().toLocaleDateString()}`)
  );
  console.log(table.toString());
  console.log();
}

/**
 * Display trends in a formatted table
 */
function displayTrendsTable(
  trends: Array<{
    ticker: string;
    currentScore: number;
    previousScore: number;
    delta: number;
  }>
): void {
  const table = new Table({
    head: [
      chalk.cyan('Ticker'),
      chalk.cyan('Current'),
      chalk.cyan('Previous'),
      chalk.cyan('Change'),
    ],
    colWidths: [10, 12, 12, 12],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  trends.slice(0, 15).forEach((trend) => {
    const changeColor = trend.delta >= 20 ? chalk.green : chalk.yellow;

    table.push([
      chalk.bold(trend.ticker),
      trend.currentScore.toString(),
      chalk.gray(trend.previousScore.toString()),
      changeColor(`+${trend.delta}`),
    ]);
  });

  console.log(table.toString());
  console.log();
}

// Parse and run
program.parse();
