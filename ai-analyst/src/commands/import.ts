/**
 * Robinhood CSV Import Command
 * Parses transaction history and detects spreads
 */

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import chalk from "chalk";
import type { 
  RobinhoodTransaction, 
  ParsedSpread, 
  TradeType 
} from "../types/index.ts";
import { insertTrade } from "../services/supabase.ts";

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse Robinhood CSV export
 */
export function parseRobinhoodCSV(filePath: string): RobinhoodTransaction[] {
  const content = readFileSync(filePath, "utf-8");
  
  // Clean the CSV - remove empty lines and disclaimer at the end
  const lines = content.split("\n").filter(line => {
    const trimmed = line.trim();
    // Skip empty lines, disclaimer lines, and lines starting with just quotes
    if (!trimmed || trimmed === '""') return false;
    if (trimmed.includes("The data provided is for informational")) return false;
    return true;
  });
  
  const cleanedContent = lines.join("\n");
  
  const records = parse(cleanedContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,      // Handle multiline fields better
    relax_column_count: true, // Allow varying column counts
  });

  return records.map((row: Record<string, string>) => ({
    activityDate: parseDate(row["Activity Date"]),
    processDate: parseDate(row["Process Date"]),
    settleDate: parseDate(row["Settle Date"]),
    instrument: row["Instrument"] ?? "",
    description: row["Description"] ?? "",
    transCode: row["Trans Code"] ?? "",
    quantity: parseFloat(row["Quantity"]) || 0,
    price: parseFloat(row["Price"]) || 0,
    amount: parseFloat(row["Amount"]) || 0,
  }));
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Robinhood format: MM/DD/YYYY
  const [month, day, year] = dateStr.split("/");
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// ============================================================================
// OPTION TRANSACTION PARSING
// ============================================================================

interface ParsedOption {
  ticker: string;
  strike: number;
  expiration: Date;
  type: "call" | "put";
  action: "buy" | "sell";
  quantity: number;
  price: number;
  date: Date;
}

/**
 * Parse option description to extract details
 * Example: "NVDA 01/17/2025 130.00 Call"
 */
function parseOptionDescription(
  description: string,
  transCode: string,
  quantity: number,
  price: number,
  date: Date
): ParsedOption | null {
  // Pattern: TICKER MM/DD/YYYY STRIKE.00 Call/Put
  const match = description.match(
    /^([A-Z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+\.?\d*)\s+(Call|Put)$/i
  );

  if (!match) return null;

  const [, ticker, expStr, strikeStr, typeStr] = match;
  
  // Determine buy/sell from trans code
  let action: "buy" | "sell";
  if (transCode === "BTO" || transCode === "Buy to Open") {
    action = "buy";
  } else if (transCode === "STO" || transCode === "Sell to Open") {
    action = "sell";
  } else if (transCode === "BTC" || transCode === "Buy to Close") {
    action = "buy";
  } else if (transCode === "STC" || transCode === "Sell to Close") {
    action = "sell";
  } else {
    return null;
  }

  return {
    ticker,
    strike: parseFloat(strikeStr),
    expiration: parseDate(expStr),
    type: typeStr.toLowerCase() as "call" | "put",
    action,
    quantity: Math.abs(quantity),
    price: Math.abs(price),
    date,
  };
}

// ============================================================================
// SPREAD DETECTION
// ============================================================================

/**
 * Detect spreads from option transactions
 * Groups matching buy/sell pairs into spreads
 */
export function detectSpreads(
  transactions: RobinhoodTransaction[]
): ParsedSpread[] {
  const spreads: ParsedSpread[] = [];
  
  // Filter to option transactions only
  const optionTxns = transactions.filter(t => 
    t.transCode === "BTO" || 
    t.transCode === "STO" ||
    t.transCode === "Buy to Open" ||
    t.transCode === "Sell to Open"
  );

  // Parse each transaction
  const parsedOptions: ParsedOption[] = [];
  for (const txn of optionTxns) {
    const parsed = parseOptionDescription(
      txn.instrument,
      txn.transCode,
      txn.quantity,
      txn.price,
      txn.activityDate
    );
    if (parsed) {
      parsedOptions.push(parsed);
    }
  }

  // Group by ticker, expiration, type, and date (same day trades)
  const grouped = new Map<string, ParsedOption[]>();
  for (const opt of parsedOptions) {
    const key = `${opt.ticker}-${opt.expiration.toISOString()}-${opt.type}-${opt.date.toDateString()}`;
    const existing = grouped.get(key) ?? [];
    existing.push(opt);
    grouped.set(key, existing);
  }

  // Find spreads (matching buy + sell on same day)
  for (const [, options] of grouped) {
    const buys = options.filter(o => o.action === "buy");
    const sells = options.filter(o => o.action === "sell");

    if (buys.length > 0 && sells.length > 0) {
      // Match buys and sells to form spreads
      for (const buy of buys) {
        for (const sell of sells) {
          if (buy.quantity === sell.quantity && buy.strike !== sell.strike) {
            const spread = buildSpread(buy, sell, transactions);
            if (spread) {
              spreads.push(spread);
            }
          }
        }
      }
    }
  }

  return spreads;
}

/**
 * Build a spread from matched buy/sell options
 */
function buildSpread(
  buyOption: ParsedOption,
  sellOption: ParsedOption,
  allTransactions: RobinhoodTransaction[]
): ParsedSpread | null {
  // Determine spread type based on option type and strikes
  let tradeType: TradeType;
  let longStrike: number;
  let shortStrike: number;

  if (buyOption.type === "call") {
    // Call spread
    if (buyOption.strike < sellOption.strike) {
      // Bull call spread (debit)
      tradeType = "call_debit";
      longStrike = buyOption.strike;
      shortStrike = sellOption.strike;
    } else {
      // Bear call spread (credit)
      tradeType = "call_credit";
      longStrike = sellOption.strike;
      shortStrike = buyOption.strike;
    }
  } else {
    // Put spread
    if (buyOption.strike > sellOption.strike) {
      // Bear put spread (debit)
      tradeType = "put_debit";
      longStrike = buyOption.strike;
      shortStrike = sellOption.strike;
    } else {
      // Bull put spread (credit)
      tradeType = "put_credit";
      longStrike = sellOption.strike;
      shortStrike = buyOption.strike;
    }
  }

  // Calculate net premium
  // For debit spreads: buy.price - sell.price (pay net)
  // For credit spreads: sell.price - buy.price (receive net)
  let openPremium: number;
  if (tradeType === "call_debit" || tradeType === "put_debit") {
    openPremium = buyOption.price - sellOption.price;
  } else {
    openPremium = sellOption.price - buyOption.price;
  }

  // Find related transactions for this spread
  const relatedTxns = allTransactions.filter(t => 
    t.instrument.includes(buyOption.ticker) &&
    (t.activityDate.toDateString() === buyOption.date.toDateString())
  );

  return {
    ticker: buyOption.ticker,
    type: tradeType,
    longStrike,
    shortStrike,
    expiration: buyOption.expiration,
    quantity: buyOption.quantity,
    openDate: buyOption.date,
    openPremium,
    transactions: relatedTxns,
  };
}

// ============================================================================
// IMPORT COMMAND
// ============================================================================

export interface ImportOptions {
  filePath: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface ImportResult {
  totalTransactions: number;
  spreadsDetected: number;
  spreadsImported: number;
  errors: string[];
}

/**
 * Import trades from Robinhood CSV
 */
export async function importFromCSV(
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    totalTransactions: 0,
    spreadsDetected: 0,
    spreadsImported: 0,
    errors: [],
  };

  try {
    // Parse CSV
    console.log(chalk.gray(`  Reading ${options.filePath}...`));
    const transactions = parseRobinhoodCSV(options.filePath);
    result.totalTransactions = transactions.length;
    console.log(chalk.gray(`  Found ${transactions.length} transactions`));

    // Detect spreads
    console.log(chalk.gray("  Detecting spreads..."));
    const spreads = detectSpreads(transactions);
    result.spreadsDetected = spreads.length;
    console.log(chalk.gray(`  Detected ${spreads.length} spreads`));

    if (options.verbose) {
      for (const spread of spreads) {
        console.log(
          chalk.cyan(`    ${spread.ticker}`) +
          chalk.gray(` ${spread.longStrike}/${spread.shortStrike} `) +
          chalk.white(formatSpreadType(spread.type)) +
          chalk.gray(` exp ${spread.expiration.toLocaleDateString()}`)
        );
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow("  Dry run - not importing to database"));
      return result;
    }

    // Import to database
    console.log(chalk.gray("  Importing to database..."));
    for (const spread of spreads) {
      try {
        const spreadWidth = Math.abs(spread.shortStrike - spread.longStrike);
        const maxProfit = spread.type.includes("debit")
          ? spreadWidth - spread.openPremium
          : spread.openPremium;
        const maxLoss = spread.type.includes("debit")
          ? spread.openPremium
          : spreadWidth - spread.openPremium;

        await insertTrade({
          ticker: spread.ticker,
          tradeType: spread.type,
          direction: spread.type === "call_debit" || spread.type === "put_credit"
            ? "bullish"
            : "bearish",
          longStrike: spread.longStrike,
          shortStrike: spread.shortStrike,
          expiration: spread.expiration,
          quantity: spread.quantity,
          openDate: spread.openDate,
          openPremium: spread.openPremium,
          maxProfit,
          maxLoss,
          status: "open",
          tags: ["imported"],
        });
        result.spreadsImported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to import ${spread.ticker}: ${msg}`);
      }
    }

    console.log(
      chalk.green(`  ✓ Imported ${result.spreadsImported} spreads`)
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Import failed: ${msg}`);
    console.log(chalk.red(`  ✗ ${msg}`));
  }

  return result;
}

function formatSpreadType(type: TradeType): string {
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
      return type;
  }
}

/**
 * Display import summary
 */
export function displayImportSummary(result: ImportResult): void {
  console.log();
  console.log(chalk.bold.white("  Import Summary"));
  console.log(chalk.gray("  ────────────────────────────────────────"));
  console.log(`  Transactions: ${result.totalTransactions}`);
  console.log(`  Spreads Detected: ${result.spreadsDetected}`);
  console.log(`  Spreads Imported: ${result.spreadsImported}`);
  
  if (result.errors.length > 0) {
    console.log(chalk.red(`  Errors: ${result.errors.length}`));
    for (const error of result.errors) {
      console.log(chalk.red(`    • ${error}`));
    }
  }
  console.log();
}

