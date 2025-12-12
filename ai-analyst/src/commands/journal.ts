/**
 * Journal Command
 * View and manage trade history
 */

import chalk from "chalk";
import Table from "cli-table3";
import { 
  getAllTrades, 
  getTradesByTicker,
  getPerformanceSummary,
  insertTrade 
} from "../services/supabase.ts";
import { buildTickerHistory, detectPatterns } from "../context/toon.ts";
import type { Trade, TradeType, TradeDirection } from "../types/index.ts";

// ============================================================================
// JOURNAL VIEW
// ============================================================================

export interface JournalOptions {
  ticker?: string;
  stats?: boolean;
  limit?: number;
}

/**
 * Display trade journal
 */
export async function viewJournal(options: JournalOptions): Promise<void> {
  if (options.stats) {
    await displayPerformanceStats();
    return;
  }

  if (options.ticker) {
    await displayTickerJournal(options.ticker.toUpperCase());
  } else {
    await displayAllTrades(options.limit ?? 20);
  }
}

/**
 * Display all trades
 */
async function displayAllTrades(limit: number): Promise<void> {
  const trades = await getAllTrades();
  
  if (trades.length === 0) {
    console.log();
    console.log(chalk.yellow("  No trades found in journal"));
    console.log(chalk.gray("  Import trades with: bun run import <csv-file>"));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold.white("  📒 TRADE JOURNAL"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  const table = new Table({
    head: [
      chalk.cyan("Date"),
      chalk.cyan("Ticker"),
      chalk.cyan("Type"),
      chalk.cyan("Strikes"),
      chalk.cyan("Status"),
      chalk.cyan("P&L"),
    ],
    colWidths: [12, 8, 6, 12, 10, 10],
    style: {
      head: [],
      border: ["gray"],
    },
  });

  const displayTrades = trades.slice(0, limit);
  
  for (const trade of displayTrades) {
    const dateStr = trade.openDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    
    const typeStr = formatTradeType(trade.tradeType);
    const strikes = `${trade.longStrike}/${trade.shortStrike}`;
    
    const statusColor = trade.status === "open" 
      ? chalk.yellow 
      : trade.outcome === "win" || trade.outcome === "max_profit"
        ? chalk.green
        : trade.outcome === "loss" || trade.outcome === "max_loss"
          ? chalk.red
          : chalk.gray;
    const statusStr = statusColor(trade.status);
    
    const pnl = trade.realizedPnl ?? 0;
    const pnlStr = trade.status === "open" 
      ? chalk.gray("—")
      : pnl >= 0 
        ? chalk.green(`+$${pnl.toFixed(0)}`)
        : chalk.red(`-$${Math.abs(pnl).toFixed(0)}`);

    table.push([
      dateStr,
      chalk.bold(trade.ticker),
      typeStr,
      strikes,
      statusStr,
      pnlStr,
    ]);
  }

  console.log(table.toString());
  
  if (trades.length > limit) {
    console.log(chalk.gray(`  Showing ${limit} of ${trades.length} trades`));
  }
  console.log();
}

/**
 * Display trades for a specific ticker
 */
async function displayTickerJournal(ticker: string): Promise<void> {
  const trades = await getTradesByTicker(ticker);
  
  if (trades.length === 0) {
    console.log();
    console.log(chalk.yellow(`  No trades found for ${ticker}`));
    console.log();
    return;
  }

  const history = buildTickerHistory(ticker, trades);
  const patterns = detectPatterns(trades);

  console.log();
  console.log(chalk.bold.white(`  📒 ${ticker} TRADE HISTORY`));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  // Summary stats
  console.log(chalk.bold.cyan("  Summary"));
  console.log(
    `  Total Trades: ${history.totalTrades} | ` +
    `Wins: ${chalk.green(history.wins.toString())} | ` +
    `Losses: ${chalk.red(history.losses.toString())} | ` +
    `Win Rate: ${history.winRate.toFixed(0)}%`
  );
  console.log(
    `  Total P&L: ${history.totalPnl >= 0 ? chalk.green(`+$${history.totalPnl.toFixed(0)}`) : chalk.red(`-$${Math.abs(history.totalPnl).toFixed(0)}`)} | ` +
    `Avg P&L: $${history.avgPnl.toFixed(0)} | ` +
    `Avg Days Held: ${history.avgDaysHeld.toFixed(0)}`
  );
  console.log();

  // Patterns
  if (patterns.length > 0) {
    console.log(chalk.bold.cyan("  Patterns Detected"));
    for (const pattern of patterns) {
      console.log(`  • ${pattern}`);
    }
    console.log();
  }

  // Trade table
  console.log(chalk.bold.cyan("  Recent Trades"));
  
  const table = new Table({
    head: [
      chalk.cyan("Date"),
      chalk.cyan("Type"),
      chalk.cyan("Strikes"),
      chalk.cyan("Days"),
      chalk.cyan("Outcome"),
      chalk.cyan("P&L"),
    ],
    colWidths: [12, 6, 12, 7, 12, 10],
    style: {
      head: [],
      border: ["gray"],
    },
  });

  for (const trade of trades.slice(0, 10)) {
    const dateStr = trade.openDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    
    const typeStr = formatTradeType(trade.tradeType);
    const strikes = `${trade.longStrike}/${trade.shortStrike}`;
    const daysStr = trade.daysHeld?.toString() ?? "—";
    
    const outcomeColor = trade.outcome === "win" || trade.outcome === "max_profit"
      ? chalk.green
      : trade.outcome === "loss" || trade.outcome === "max_loss"
        ? chalk.red
        : chalk.yellow;
    const outcomeStr = trade.outcome 
      ? outcomeColor(trade.outcome)
      : chalk.yellow("open");
    
    const pnl = trade.realizedPnl ?? 0;
    const pnlStr = trade.status === "open" 
      ? chalk.gray("—")
      : pnl >= 0 
        ? chalk.green(`+$${pnl.toFixed(0)}`)
        : chalk.red(`-$${Math.abs(pnl).toFixed(0)}`);

    table.push([
      dateStr,
      typeStr,
      strikes,
      daysStr,
      outcomeStr,
      pnlStr,
    ]);
  }

  console.log(table.toString());
  console.log();
}

/**
 * Display overall performance statistics
 */
async function displayPerformanceStats(): Promise<void> {
  const summary = await getPerformanceSummary();
  const trades = await getAllTrades();

  console.log();
  console.log(chalk.bold.white("  📊 PERFORMANCE SUMMARY"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  // Overall stats
  console.log(chalk.bold.cyan("  Overall"));
  console.log(`  Total Trades: ${summary.totalTrades}`);
  console.log(`  Open: ${chalk.yellow(summary.openTrades.toString())} | Closed: ${summary.closedTrades}`);
  console.log(
    `  Wins: ${chalk.green(summary.wins.toString())} | ` +
    `Losses: ${chalk.red(summary.losses.toString())} | ` +
    `Win Rate: ${summary.winRate.toFixed(0)}%`
  );
  console.log(
    `  Total P&L: ${summary.totalPnl >= 0 ? chalk.green(`+$${summary.totalPnl.toFixed(0)}`) : chalk.red(`-$${Math.abs(summary.totalPnl).toFixed(0)}`)}`
  );
  console.log();

  // By ticker breakdown
  if (trades.length > 0) {
    const byTicker = new Map<string, Trade[]>();
    for (const trade of trades) {
      const existing = byTicker.get(trade.ticker) ?? [];
      existing.push(trade);
      byTicker.set(trade.ticker, existing);
    }

    console.log(chalk.bold.cyan("  By Ticker"));
    
    const tickerTable = new Table({
      head: [
        chalk.cyan("Ticker"),
        chalk.cyan("Trades"),
        chalk.cyan("Win Rate"),
        chalk.cyan("P&L"),
      ],
      colWidths: [10, 10, 12, 12],
      style: {
        head: [],
        border: ["gray"],
      },
    });

    for (const [ticker, tickerTrades] of byTicker) {
      const history = buildTickerHistory(ticker, tickerTrades);
      const pnlStr = history.totalPnl >= 0 
        ? chalk.green(`+$${history.totalPnl.toFixed(0)}`)
        : chalk.red(`-$${Math.abs(history.totalPnl).toFixed(0)}`);
      
      tickerTable.push([
        chalk.bold(ticker),
        history.totalTrades.toString(),
        `${history.winRate.toFixed(0)}%`,
        pnlStr,
      ]);
    }

    console.log(tickerTable.toString());
  }
  console.log();
}

// ============================================================================
// LOG TRADE
// ============================================================================

export interface LogTradeOptions {
  ticker: string;
  type: string;
  strikes: string;
  premium: number;
  expiration?: string;
  thesis?: string;
}

/**
 * Log a new trade manually
 */
export async function logTrade(options: LogTradeOptions): Promise<void> {
  // Parse strikes (format: 120/125)
  const [longStr, shortStr] = options.strikes.split("/");
  const longStrike = parseFloat(longStr);
  const shortStrike = parseFloat(shortStr);

  if (isNaN(longStrike) || isNaN(shortStrike)) {
    console.log(chalk.red("  Invalid strikes format. Use: 120/125"));
    return;
  }

  // Parse trade type
  const typeMap: Record<string, TradeType> = {
    cds: "call_debit",
    pcs: "put_credit",
    ccs: "call_credit",
    pds: "put_debit",
  };
  
  const tradeType = typeMap[options.type.toLowerCase()];
  if (!tradeType) {
    console.log(chalk.red("  Invalid type. Use: cds, pcs, ccs, pds"));
    return;
  }

  // Determine direction
  const direction: TradeDirection = 
    tradeType === "call_debit" || tradeType === "put_credit" 
      ? "bullish" 
      : "bearish";

  // Parse expiration
  let expiration = new Date();
  expiration.setDate(expiration.getDate() + 30); // Default 30 days
  
  if (options.expiration) {
    expiration = new Date(options.expiration);
  }

  // Calculate max profit/loss
  const spreadWidth = Math.abs(shortStrike - longStrike);
  const maxProfit = tradeType.includes("debit")
    ? spreadWidth - options.premium
    : options.premium;
  const maxLoss = tradeType.includes("debit")
    ? options.premium
    : spreadWidth - options.premium;

  try {
    const trade = await insertTrade({
      ticker: options.ticker.toUpperCase(),
      tradeType,
      direction,
      longStrike,
      shortStrike,
      expiration,
      quantity: 1,
      openDate: new Date(),
      openPremium: options.premium,
      maxProfit,
      maxLoss,
      status: "open",
      thesis: options.thesis,
      tags: ["manual"],
    });

    if (trade) {
      console.log();
      console.log(chalk.green("  ✓ Trade logged successfully"));
      console.log(chalk.gray(`    ${trade.ticker} ${formatTradeType(trade.tradeType)} ${trade.longStrike}/${trade.shortStrike}`));
      console.log(chalk.gray(`    Premium: $${(trade.openPremium * 100).toFixed(0)} | Expires: ${trade.expiration.toLocaleDateString()}`));
      console.log();
    } else {
      console.log(chalk.red("  ✗ Failed to log trade"));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`  ✗ Error: ${msg}`));
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTradeType(type: TradeType): string {
  switch (type) {
    case "call_debit":
      return "CDS";
    case "put_credit":
      return "PCS";
    case "call_credit":
      return "CCS";
    case "put_debit":
      return "PDS";
    default:
      return type.toUpperCase();
  }
}

