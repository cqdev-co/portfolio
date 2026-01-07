#!/usr/bin/env bun
/**
 * AI Analyst CLI
 * Ticker-focused analysis for entry decisions and strategy recommendations
 */

import { config } from 'dotenv';
import { join } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCommand, type AnalyzeOptions } from './commands/analyze.ts';
import {
  importFromCSV,
  displayImportSummary,
  type ImportOptions,
} from './commands/import.ts';
import {
  viewJournal,
  logTrade,
  type JournalOptions,
  type LogTradeOptions,
} from './commands/journal.ts';
import { startChat, type ChatOptions } from './commands/chat.ts';
import {
  listWatchlist,
  addToWatch,
  removeFromWatch,
  configureWatch,
  type AddWatchOptions,
  type ConfigureWatchOptions,
} from './commands/watch.ts';
import {
  generateBriefingCommand,
  viewBriefingHistory,
  viewBriefing,
  type BriefingOptions,
} from './commands/briefing.ts';
import {
  startAgent,
  stopAgent,
  displayAgentStatus,
  runDryScan,
} from './agent/monitor.ts';
import {
  listAlerts,
  ackAlert,
  viewAlert,
  alertsSummary,
  type ListAlertsOptions,
} from './commands/alerts.ts';
import {
  shortTermCommand,
  type ShortTermOptions,
} from './commands/short-term.ts';
import { debugCommand, type DebugOptions } from './commands/debug.ts';
import { testDiscordWebhook } from './services/discord.ts';
import type { OllamaMode } from './services/ollama.ts';
import type { AlertType } from './services/supabase.ts';

// Load .env from repository root (parent of ai-analyst)
const rootEnvPath = join(process.cwd(), '..', '.env');
config({ path: rootEnvPath });

// Also try .env.local from root
const rootEnvLocalPath = join(process.cwd(), '..', '.env.local');
config({ path: rootEnvLocalPath });

const program = new Command();

program
  .name('ai-analyst')
  .description(
    'AI-powered ticker analysis for entry decisions and strategy recommendations'
  )
  .version('1.0.0');

// ============================================================================
// ANALYZE COMMAND
// ============================================================================

program
  .command('analyze <ticker>')
  .description(
    'Analyze a ticker for entry decision and strategy recommendation'
  )
  .alias('a')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .option('--ai-model <model>', 'Override default AI model')
  .option('-p, --position <spread>', "Your position (e.g., '120/125 CDS')")
  .option('--no-chart', 'Skip price chart visualization')
  .option('-a, --account <size>', 'Account size in dollars', '1500')
  .action(
    async (
      ticker: string,
      opts: {
        aiMode: string;
        aiModel?: string;
        position?: string;
        chart: boolean;
        account: string;
      }
    ) => {
      // Validate AI mode
      if (!['local', 'cloud'].includes(opts.aiMode)) {
        console.log(chalk.red(`  Invalid --ai-mode: ${opts.aiMode}`));
        console.log(chalk.gray('  Valid options: local, cloud'));
        process.exit(1);
      }

      const options: AnalyzeOptions = {
        aiMode: opts.aiMode as OllamaMode,
        aiModel: opts.aiModel,
        position: opts.position,
        noChart: !opts.chart,
        accountSize: parseInt(opts.account, 10) || 1500,
      };

      await analyzeCommand(ticker, options);
    }
  );

// ============================================================================
// DEBUG COMMAND
// ============================================================================

program
  .command('debug <ticker>')
  .description('Show ALL raw context that would be sent to AI (no AI call)')
  .option('-a, --account <size>', 'Account size in dollars', '1500')
  .option(
    '-c, --compact',
    'Compact output (hide full PFV magnetic levels)',
    false
  )
  .option('-l, --log', 'Save full output to a log file in logs/', false)
  .action(
    async (
      ticker: string,
      opts: {
        account: string;
        compact: boolean;
        log: boolean;
      }
    ) => {
      const options: DebugOptions = {
        accountSize: parseInt(opts.account, 10) || 1500,
        compact: opts.compact,
        log: opts.log,
      };

      await debugCommand(ticker, options);
    }
  );

// ============================================================================
// IMPORT COMMAND
// ============================================================================

program
  .command('import <file>')
  .description('Import trades from Robinhood CSV export')
  .option('-d, --dry-run', "Don't save to database", false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (file: string, opts: { dryRun: boolean; verbose: boolean }) => {
    console.log();
    console.log(chalk.bold.white('  📥 ROBINHOOD CSV IMPORT'));
    console.log(
      chalk.gray(
        '  ────────────────────────────────────────────────────────────────────'
      )
    );
    console.log();

    const options: ImportOptions = {
      filePath: file,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    };

    const result = await importFromCSV(options);
    displayImportSummary(result);
  });

// ============================================================================
// JOURNAL COMMAND
// ============================================================================

program
  .command('journal [ticker]')
  .description('View trade history and performance')
  .option('-s, --stats', 'Show performance statistics', false)
  .option('-l, --limit <number>', 'Limit number of trades shown', '20')
  .action(
    async (
      ticker: string | undefined,
      opts: {
        stats: boolean;
        limit: string;
      }
    ) => {
      const options: JournalOptions = {
        ticker,
        stats: opts.stats,
        limit: parseInt(opts.limit, 10) || 20,
      };

      await viewJournal(options);
    }
  );

// ============================================================================
// LOG COMMAND
// ============================================================================

program
  .command('log <ticker>')
  .description('Log a new trade manually')
  .requiredOption('-t, --type <type>', 'Trade type: cds, pcs, ccs, pds')
  .requiredOption('-s, --strikes <strikes>', 'Strikes (e.g., 120/125)')
  .requiredOption('-p, --premium <premium>', 'Premium per share')
  .option('-e, --expiration <date>', 'Expiration date (YYYY-MM-DD)')
  .option('--thesis <text>', 'Entry thesis')
  .action(
    async (
      ticker: string,
      opts: {
        type: string;
        strikes: string;
        premium: string;
        expiration?: string;
        thesis?: string;
      }
    ) => {
      const options: LogTradeOptions = {
        ticker,
        type: opts.type,
        strikes: opts.strikes,
        premium: parseFloat(opts.premium),
        expiration: opts.expiration,
        thesis: opts.thesis,
      };

      await logTrade(options);
    }
  );

// ============================================================================
// CHAT COMMAND
// ============================================================================

program
  .command('chat')
  .description('Start a conversation with your AI Analyst')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .option('--ai-model <model>', 'Override default AI model')
  .option('-a, --account <size>', 'Account size in dollars', '1500')
  .action(
    async (opts: { aiMode: string; aiModel?: string; account: string }) => {
      // Validate AI mode
      if (!['local', 'cloud'].includes(opts.aiMode)) {
        console.log(chalk.red(`  Invalid --ai-mode: ${opts.aiMode}`));
        console.log(chalk.gray('  Valid options: local, cloud'));
        process.exit(1);
      }

      const options: ChatOptions = {
        aiMode: opts.aiMode as OllamaMode,
        aiModel: opts.aiModel,
        accountSize: parseInt(opts.account, 10) || 1500,
      };

      await startChat(options);
    }
  );

// ============================================================================
// WATCHLIST COMMANDS
// ============================================================================

const watchCommand = program
  .command('watch')
  .description('Manage watchlist for automated monitoring');

watchCommand
  .command('list')
  .description('View current watchlist')
  .action(async () => {
    await listWatchlist();
  });

watchCommand
  .command('add <tickers...>')
  .description('Add ticker(s) to watchlist')
  .option('--rsi-low <n>', 'Minimum RSI threshold', '35')
  .option('--rsi-high <n>', 'Maximum RSI threshold', '55')
  .option('--iv <n>', 'IV percentile threshold', '50')
  .option('--cushion <n>', 'Minimum cushion %', '8')
  .option('--grade <g>', 'Minimum grade (A, B, C)', 'B')
  .option('--notes <text>', 'Notes about these tickers')
  .action(
    async (
      tickers: string[],
      opts: {
        rsiLow: string;
        rsiHigh: string;
        iv: string;
        cushion: string;
        grade: string;
        notes?: string;
      }
    ) => {
      const options: AddWatchOptions = {
        rsiLow: parseInt(opts.rsiLow, 10),
        rsiHigh: parseInt(opts.rsiHigh, 10),
        ivPercentile: parseInt(opts.iv, 10),
        cushion: parseInt(opts.cushion, 10),
        grade: opts.grade,
        notes: opts.notes,
      };
      await addToWatch(tickers, options);
    }
  );

watchCommand
  .command('remove <ticker>')
  .description('Remove ticker from watchlist')
  .action(async (ticker: string) => {
    await removeFromWatch(ticker);
  });

watchCommand
  .command('configure <ticker>')
  .description('Configure watchlist item thresholds')
  .option('--rsi-low <n>', 'Minimum RSI threshold')
  .option('--rsi-high <n>', 'Maximum RSI threshold')
  .option('--iv <n>', 'IV percentile threshold')
  .option('--cushion <n>', 'Minimum cushion %')
  .option('--grade <g>', 'Minimum grade (A, B, C)')
  .option('--notes <text>', 'Notes about this ticker')
  .option('--active', 'Enable monitoring')
  .option('--inactive', 'Disable monitoring')
  .action(
    async (
      ticker: string,
      opts: {
        rsiLow?: string;
        rsiHigh?: string;
        iv?: string;
        cushion?: string;
        grade?: string;
        notes?: string;
        active?: boolean;
        inactive?: boolean;
      }
    ) => {
      const options: ConfigureWatchOptions = {
        rsiLow: opts.rsiLow ? parseInt(opts.rsiLow, 10) : undefined,
        rsiHigh: opts.rsiHigh ? parseInt(opts.rsiHigh, 10) : undefined,
        ivPercentile: opts.iv ? parseInt(opts.iv, 10) : undefined,
        cushion: opts.cushion ? parseInt(opts.cushion, 10) : undefined,
        grade: opts.grade,
        notes: opts.notes,
        active: opts.active ? true : opts.inactive ? false : undefined,
      };
      await configureWatch(ticker, options);
    }
  );

// ============================================================================
// BRIEFING COMMANDS
// ============================================================================

const briefingCommand = program
  .command('briefing')
  .description('Generate or view morning briefings');

briefingCommand
  .command('generate', { isDefault: true })
  .description('Generate morning briefing')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .option('--ai-model <model>', 'Override default AI model')
  .option('--no-discord', 'Skip sending to Discord')
  .action(
    async (opts: { aiMode: string; aiModel?: string; discord: boolean }) => {
      const options: BriefingOptions = {
        aiMode: opts.aiMode as OllamaMode,
        aiModel: opts.aiModel,
        skipDiscord: !opts.discord,
      };
      await generateBriefingCommand(options);
    }
  );

briefingCommand
  .command('history')
  .description('View past briefings')
  .option('-l, --limit <n>', 'Number of briefings to show', '7')
  .action(async (opts: { limit: string }) => {
    await viewBriefingHistory(parseInt(opts.limit, 10) || 7);
  });

briefingCommand
  .command('view <date>')
  .description('View a specific briefing by date (YYYY-MM-DD)')
  .action(async (date: string) => {
    await viewBriefing(date);
  });

// ============================================================================
// AGENT COMMANDS
// ============================================================================

const agentCommand = program
  .command('agent')
  .description('Background monitoring agent controls');

agentCommand
  .command('start')
  .description('Start the background monitoring agent')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .option('--ai-model <model>', 'Override default AI model')
  .option('--extended-hours', 'Scan 24/7 (not just market hours)')
  .option('--debug', 'Log rejection reasons for each ticker')
  .action(
    async (opts: {
      aiMode: string;
      aiModel?: string;
      extendedHours?: boolean;
      debug?: boolean;
    }) => {
      await startAgent({
        aiMode: opts.aiMode as OllamaMode,
        aiModel: opts.aiModel,
        extendedHours: opts.extendedHours,
        debug: opts.debug,
      });
      // Keep the process running
      await new Promise(() => {});
    }
  );

agentCommand
  .command('dry-run')
  .description('Run a single scan with full debug output (no alerts sent)')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .action(async (opts: { aiMode: string }) => {
    await runDryScan({ aiMode: opts.aiMode as OllamaMode });
  });

agentCommand
  .command('stop')
  .description('Stop the background monitoring agent')
  .action(() => {
    stopAgent();
  });

agentCommand
  .command('status')
  .description('Check agent health and statistics')
  .action(() => {
    displayAgentStatus();
  });

agentCommand
  .command('test-discord')
  .description('Test Discord webhook configuration')
  .action(async () => {
    console.log();
    console.log(chalk.bold.white('  🔔 TESTING DISCORD WEBHOOK'));
    console.log(
      chalk.gray(
        '  ────────────────────────────────────────────────────────────────────'
      )
    );
    console.log();

    const success = await testDiscordWebhook();

    if (success) {
      console.log(chalk.green('  ✓ Discord webhook test successful!'));
      console.log(
        chalk.gray('  Check your Discord channel for the test message.')
      );
    } else {
      console.log(chalk.red('  ✗ Discord webhook test failed.'));
      console.log(
        chalk.gray('  Make sure DISCORD_WEBHOOK_URL is set in your .env file.')
      );
    }
    console.log();
  });

// ============================================================================
// ALERTS COMMANDS
// ============================================================================

const alertsCommand = program
  .command('alerts')
  .description('View and manage triggered alerts');

alertsCommand
  .command('list', { isDefault: true })
  .description('View recent alerts')
  .option('-l, --limit <n>', 'Number of alerts to show', '20')
  .option('-t, --ticker <ticker>', 'Filter by ticker')
  .option('--type <type>', 'Filter by type (ENTRY_SIGNAL, POSITION_RISK, etc.)')
  .option('-u, --unack', 'Show only unacknowledged alerts')
  .action(
    async (opts: {
      limit: string;
      ticker?: string;
      type?: string;
      unack?: boolean;
    }) => {
      const options: ListAlertsOptions = {
        limit: parseInt(opts.limit, 10) || 20,
        ticker: opts.ticker,
        type: opts.type as AlertType | undefined,
        unacknowledgedOnly: opts.unack,
      };
      await listAlerts(options);
    }
  );

alertsCommand
  .command('ack <id>')
  .description('Acknowledge an alert (can use partial ID)')
  .action(async (id: string) => {
    await ackAlert(id);
  });

alertsCommand
  .command('view <id>')
  .description('View details of a specific alert')
  .action(async (id: string) => {
    await viewAlert(id);
  });

alertsCommand
  .command('summary')
  .description('View alerts summary and statistics')
  .action(async () => {
    await alertsSummary();
  });

// ============================================================================
// SHORT-TERM COMMAND
// ============================================================================

program
  .command('short-term')
  .description('Scan SPY/QQQ for 1-3 day swing trade entries')
  .alias('st')
  .option('--ai-mode <mode>', 'Ollama mode: local or cloud', 'cloud')
  .option('--ai-model <model>', 'Override default AI model')
  .option('-a, --account <size>', 'Account size in dollars', '1500')
  .option('-v, --verbose', 'Show detailed analysis', false)
  .action(
    async (opts: {
      aiMode: string;
      aiModel?: string;
      account: string;
      verbose: boolean;
    }) => {
      // Validate AI mode
      if (!['local', 'cloud'].includes(opts.aiMode)) {
        console.log(chalk.red(`  Invalid --ai-mode: ${opts.aiMode}`));
        console.log(chalk.gray('  Valid options: local, cloud'));
        process.exit(1);
      }

      const options: ShortTermOptions = {
        aiMode: opts.aiMode as OllamaMode,
        aiModel: opts.aiModel,
        accountSize: parseInt(opts.account, 10) || 1500,
        verbose: opts.verbose,
      };

      await shortTermCommand(options);
    }
  );

// ============================================================================
// HELP EXAMPLES
// ============================================================================

program.on('--help', () => {
  console.log();
  console.log('Examples:');
  console.log(
    '  $ bun run debug NVDA               # Show ALL raw context (no AI call)'
  );
  console.log(
    '  $ bun run debug NVDA --compact     # Shorter output, hide PFV details'
  );
  console.log();
  console.log('  $ bun run chat                     # Talk to your AI Analyst');
  console.log(
    '  $ bun run chat --account 3000      # With custom account size'
  );
  console.log();
  console.log(
    '  $ bun run short-term               # Scan SPY/QQQ for swing trades'
  );
  console.log(
    '  $ bun run short-term --account 500 # With custom account size'
  );
  console.log();
  console.log('  $ bun run watch list               # View watchlist');
  console.log(
    '  $ bun run watch add NVDA AAPL      # Add tickers to watchlist'
  );
  console.log('  $ bun run watch remove NVDA        # Remove from watchlist');
  console.log('  $ bun run watch configure NVDA --rsi-low 30 --cushion 10');
  console.log();
  console.log(
    '  $ bun run briefing                 # Generate morning briefing'
  );
  console.log('  $ bun run briefing history         # View past briefings');
  console.log('  $ bun run briefing view 2024-12-11 # View specific briefing');
  console.log();
  console.log(
    '  $ bun run agent start              # Start background monitoring'
  );
  console.log(
    '  $ bun run agent start --debug      # Start with rejection logging'
  );
  console.log('  $ bun run agent start --extended-hours  # Scan 24/7');
  console.log(
    '  $ bun run agent dry-run            # Single scan with full debug output'
  );
  console.log(
    '  $ bun run agent stop               # Stop background monitoring'
  );
  console.log('  $ bun run agent status             # Check agent status');
  console.log('  $ bun run agent test-discord       # Test Discord webhook');
  console.log();
  console.log('  $ bun run alerts                   # View recent alerts');
  console.log(
    '  $ bun run alerts --unack           # View unacknowledged alerts'
  );
  console.log('  $ bun run alerts ack abc123        # Acknowledge an alert');
  console.log('  $ bun run alerts summary           # View alerts statistics');
  console.log();
  console.log('  $ bun run analyze NVDA');
  console.log('  $ bun run analyze AAPL --account 3000');
  console.log('  $ bun run analyze GOOGL --ai-mode local');
  console.log();
  console.log('  $ bun run import ./robinhood-export.csv');
  console.log('  $ bun run import ./trades.csv --dry-run');
  console.log();
  console.log('  $ bun run journal');
  console.log('  $ bun run journal NVDA');
  console.log('  $ bun run journal --stats');
  console.log();
  console.log('  $ bun run log NVDA -t cds -s 120/125 -p 3.80');
  console.log();
});

// Parse and run
program.parse();
