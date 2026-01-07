/**
 * Briefing Command
 * Generate and view morning briefings
 */

import chalk from 'chalk';
import {
  generateMorningBriefing,
  formatBriefingForCLI,
  type Briefing,
} from '../agent/briefing.ts';
import {
  getRecentBriefings,
  getBriefing,
  isConfigured,
  type Briefing as DBBriefing,
} from '../services/supabase.ts';
import type { OllamaMode } from '../services/ollama.ts';
import type { EventType } from '../services/calendar.ts';

// ============================================================================
// GENERATE BRIEFING COMMAND
// ============================================================================

export interface BriefingOptions {
  aiMode?: OllamaMode;
  aiModel?: string;
  skipDiscord?: boolean;
}

/**
 * Generate and display morning briefing
 */
export async function generateBriefingCommand(
  options: BriefingOptions = {}
): Promise<void> {
  console.log();
  console.log(chalk.bold.white('  ☀️  GENERATING MORNING BRIEFING...'));
  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  try {
    console.log(chalk.gray('  Fetching market data...'));

    const briefing = await generateMorningBriefing({
      aiMode: options.aiMode ?? 'cloud',
      aiModel: options.aiModel,
      skipDiscord: options.skipDiscord,
    });

    // Display briefing
    const formatted = formatBriefingForCLI(briefing);
    console.log(chalk.white(formatted));

    if (!options.skipDiscord) {
      console.log(chalk.green('  ✓ Briefing sent to Discord'));
    }
    console.log();
  } catch (error) {
    console.error(chalk.red('  ✗ Error generating briefing:'), error);
    console.log();
  }
}

// ============================================================================
// VIEW HISTORY COMMAND
// ============================================================================

/**
 * View past briefings
 */
export async function viewBriefingHistory(limit: number = 7): Promise<void> {
  console.log();
  console.log(chalk.bold.white('  📚 BRIEFING HISTORY'));
  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  try {
    const briefings = await getRecentBriefings(limit);

    if (briefings.length === 0) {
      console.log(chalk.gray('  No briefings found.'));
      console.log();
      console.log(
        chalk.gray('  Generate a briefing with: bun run analyst briefing')
      );
      console.log();
      return;
    }

    // Header
    console.log(
      chalk.gray('  ') +
        chalk.bold.white('Date'.padEnd(14)) +
        chalk.bold.white('Regime'.padEnd(12)) +
        chalk.bold.white('Discord'.padEnd(10)) +
        chalk.bold.white('Alerts')
    );
    console.log(chalk.gray('  ' + '─'.repeat(50)));

    for (const briefing of briefings) {
      const dateStr = briefing.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const regime =
        (briefing.marketData as { regime?: string })?.regime ?? '—';
      const discordStatus = briefing.deliveredDiscord ? '✓' : '—';
      const alertCount = (briefing.watchlistAlerts as unknown[])?.length ?? 0;

      console.log(
        chalk.gray('  ') +
          chalk.cyan(dateStr.padEnd(14)) +
          chalk.white(regime.padEnd(12)) +
          chalk.green(discordStatus.padEnd(10)) +
          chalk.white(alertCount.toString())
      );
    }

    console.log();
    console.log(
      chalk.gray(`  Showing ${briefings.length} most recent briefings`)
    );
    console.log();
  } catch (error) {
    console.error(chalk.red('  ✗ Error fetching briefings:'), error);
    console.log();
  }
}

// ============================================================================
// VIEW SPECIFIC BRIEFING
// ============================================================================

/**
 * View a specific briefing by date
 */
export async function viewBriefing(dateStr: string): Promise<void> {
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.log(chalk.red('  ✗ Invalid date format. Use YYYY-MM-DD'));
      console.log();
      return;
    }

    const briefing = await getBriefing(date);

    if (!briefing) {
      console.log(chalk.yellow(`  ⚠️  No briefing found for ${dateStr}`));
      console.log();
      return;
    }

    // Convert DB briefing to display format
    const displayBriefing = dbBriefingToDisplay(briefing);
    const formatted = formatBriefingForCLI(displayBriefing);
    console.log(chalk.white(formatted));
  } catch (error) {
    console.error(chalk.red('  ✗ Error fetching briefing:'), error);
    console.log();
  }
}

/**
 * Convert DB briefing to display Briefing type
 */
function dbBriefingToDisplay(db: DBBriefing): Briefing {
  const marketData = db.marketData as {
    spy?: { price: number; changePct: number; trend: string };
    vix?: { current: number; level: string };
    regime?: string;
  };

  return {
    date: db.date,
    marketPulse: {
      spy: marketData.spy ?? { price: 0, changePct: 0, trend: 'UNKNOWN' },
      vix: marketData.vix ?? { current: 0, level: 'UNKNOWN' },
      regime: marketData.regime ?? 'UNKNOWN',
      summary: db.marketSummary ?? '',
    },
    calendar: {
      events: (db.calendarEvents ?? []) as unknown as {
        date: Date;
        name: string;
        type: EventType;
        impact: 'HIGH' | 'MEDIUM' | 'LOW';
      }[],
      warnings: [],
    },
    watchlistAlerts:
      (db.watchlistAlerts as {
        ticker: string;
        reason: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
      }[]) ?? [],
    positionUpdates:
      (db.positionUpdates as {
        ticker: string;
        status: string;
        dte?: number;
        action?: string;
      }[]) ?? [],
    aiCommentary: db.aiCommentary ?? 'No commentary available.',
  };
}
