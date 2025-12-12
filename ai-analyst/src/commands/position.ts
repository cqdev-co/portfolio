/**
 * Position Management Commands
 * Add, view, and remove open positions
 */

import chalk from "chalk";
import YahooFinance from "yahoo-finance2";
import {
  getPositions,
  getPositionsByTicker,
  addPosition,
  removePosition,
  isConfigured,
  type Position,
} from "../services/supabase.ts";
import { getMarketRegime } from "../services/market-regime.ts";
import { generateCompletion, type OllamaMode } from "../services/ollama.ts";

// Configure yahoo-finance2 to suppress validation warnings
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false, logOptionsErrors: false },
});

// ============================================================================
// SPREAD VALUE FETCHING
// ============================================================================

interface SpreadValue {
  longCallMid: number;
  shortCallMid: number;
  spreadMid: number;     // Long - Short (what you'd get if you closed now)
  spreadBid: number;     // Conservative exit price
  spreadAsk: number;     // What you'd pay to open this spread now
}

async function getSpreadCurrentValue(
  ticker: string,
  longStrike: number,
  shortStrike: number,
  expiration: Date
): Promise<SpreadValue | null> {
  try {
    // Get options chain for this expiration
    const expirations = await yahooFinance.options(ticker);
    if (!expirations?.expirationDates?.length) return null;

    // Find the matching expiration date
    const targetTime = expiration.getTime();
    const matchingExp = expirations.expirationDates.find(exp => {
      // Match within 2 days to account for date parsing differences
      return Math.abs(exp.getTime() - targetTime) < 2 * 24 * 60 * 60 * 1000;
    });

    if (!matchingExp) {
      // Try to find closest expiration
      let closest = expirations.expirationDates[0];
      let closestDiff = Math.abs(closest.getTime() - targetTime);
      for (const exp of expirations.expirationDates) {
        const diff = Math.abs(exp.getTime() - targetTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = exp;
        }
      }
      // Only use if within 7 days
      if (closestDiff > 7 * 24 * 60 * 60 * 1000) return null;
    }

    const expToUse = matchingExp ?? expirations.expirationDates[0];
    
    // Fetch options for that expiration
    const chain = await yahooFinance.options(ticker, { date: expToUse });
    if (!chain?.options?.[0]?.calls) return null;

    const calls = chain.options[0].calls;

    // Find the long and short calls
    const longCall = calls.find((c: { strike: number }) => Math.abs(c.strike - longStrike) < 0.5);
    const shortCall = calls.find((c: { strike: number }) => Math.abs(c.strike - shortStrike) < 0.5);

    if (!longCall || !shortCall) return null;

    const longMid = ((longCall.bid ?? 0) + (longCall.ask ?? 0)) / 2;
    const shortMid = ((shortCall.bid ?? 0) + (shortCall.ask ?? 0)) / 2;

    // Spread value = Long Call - Short Call
    // To CLOSE: you sell long, buy short = long.bid - short.ask (conservative)
    // Mid estimate: longMid - shortMid
    const spreadMid = longMid - shortMid;
    const spreadBid = (longCall.bid ?? 0) - (shortCall.ask ?? 0); // What you'd get closing
    const spreadAsk = (longCall.ask ?? 0) - (shortCall.bid ?? 0); // What it costs to open

    return {
      longCallMid: longMid,
      shortCallMid: shortMid,
      spreadMid: Math.max(0, spreadMid),
      spreadBid: Math.max(0, spreadBid),
      spreadAsk: Math.max(0, spreadAsk),
    };
  } catch (error) {
    // Options data not available
    return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface PositionAnalysis {
  position: Position;
  currentPrice: number;
  cushion: number;
  cushionPct: number;
  estimatedValue: number;
  pnl: number;
  pnlPct: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  riskReasons: string[];
}

export interface ListPositionsOptions {
  analyze?: boolean;
  aiMode?: OllamaMode;
}

// ============================================================================
// LIST POSITIONS
// ============================================================================

export async function listPositions(options: ListPositionsOptions = {}): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.yellow("\n  ⚠ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY\n"));
    return;
  }

  const positions = await getPositions();

  console.log();
  console.log(chalk.bold.cyan("  📊 OPEN POSITIONS"));
  console.log(chalk.gray("  ════════════════════════════════════════════════════════════════════"));

  if (positions.length === 0) {
    console.log(chalk.gray("\n  No open positions.\n"));
    console.log(chalk.dim("  Add one with: bun run position-add <ticker> <long> <short> <exp> <cost>"));
    console.log();
    return;
  }

  // If analyze mode, fetch live data
  if (options.analyze) {
    await listPositionsWithAnalysis(positions, options);
    return;
  }

  // Simple list (existing behavior)
  await displaySimplePositionList(positions);
}

async function displaySimplePositionList(positions: Position[]): Promise<void> {
  // Group by ticker
  const byTicker = new Map<string, Position[]>();
  for (const pos of positions) {
    const existing = byTicker.get(pos.ticker) ?? [];
    existing.push(pos);
    byTicker.set(pos.ticker, existing);
  }

  console.log();
  
  for (const [ticker, tickerPositions] of byTicker) {
    console.log(chalk.bold.white(`  ${ticker}`));
    
    for (const pos of tickerPositions) {
      const strikes = pos.longStrike && pos.shortStrike
        ? `$${pos.longStrike}/$${pos.shortStrike}`
        : '';
      const exp = pos.expiration
        ? pos.expiration.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      const dte = pos.dte !== undefined ? `(${pos.dte} DTE)` : '';
      const type = formatPositionType(pos.positionType);
      
      console.log(chalk.dim(`    ${type} ${strikes} ${exp} ${dte}`));
      console.log(chalk.dim(`    Entry: $${pos.entryPrice.toFixed(2)} × ${pos.quantity}`));
      
      if (pos.unrealizedPnl !== undefined) {
        const pnlColor = pos.unrealizedPnl >= 0 ? chalk.green : chalk.red;
        console.log(pnlColor(`    P&L: ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)}`));
      }
      
      if (pos.notes) {
        console.log(chalk.dim.italic(`    Note: ${pos.notes}`));
      }
      
      console.log();
    }
  }

  // Summary
  const totalCost = positions.reduce((sum, p) => sum + (p.entryPrice * p.quantity * 100), 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);
  
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log(chalk.dim(`  ${positions.length} position${positions.length === 1 ? '' : 's'} · Total deployed: $${totalCost.toFixed(0)}`));
  if (totalPnl !== 0) {
    const pnlColor = totalPnl >= 0 ? chalk.green : chalk.red;
    console.log(pnlColor(`  Unrealized P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`));
  }
  console.log();
}

// ============================================================================
// ANALYZED POSITIONS
// ============================================================================

async function listPositionsWithAnalysis(positions: Position[], options: ListPositionsOptions): Promise<void> {
  console.log();
  console.log(chalk.cyan("  Fetching live market data & options prices..."));
  
  // Get unique tickers
  const tickers = [...new Set(positions.map(p => p.ticker))];
  
  // Fetch current stock prices in parallel
  const pricePromises = tickers.map(async (ticker) => {
    try {
      const quote = await yahooFinance.quote(ticker);
      const price = quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice ?? 0;
      return { ticker, price };
    } catch (error) {
      console.log(chalk.dim(`    Warning: Could not fetch ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return { ticker, price: 0 };
    }
  });
  
  const prices = await Promise.all(pricePromises);
  const priceMap = new Map(prices.map(p => [p.ticker, p.price]));
  
  // Fetch actual spread values for each position
  const spreadValuePromises = positions.map(async (pos) => {
    if (!pos.longStrike || !pos.shortStrike || !pos.expiration) {
      return { posId: pos.id, value: null };
    }
    const value = await getSpreadCurrentValue(
      pos.ticker,
      pos.longStrike,
      pos.shortStrike,
      pos.expiration
    );
    return { posId: pos.id, value };
  });
  
  const spreadValues = await Promise.all(spreadValuePromises);
  const spreadValueMap = new Map(spreadValues.map(sv => [sv.posId, sv.value]));
  
  // Get market regime
  const regime = await getMarketRegime();
  
  // Analyze each position with actual spread values
  const analyses: (PositionAnalysis & { positionStatus: PositionStatus; actualSpreadValue?: SpreadValue; actualPnl?: number; actualPnlPct?: number })[] = [];
  
  for (const pos of positions) {
    const currentPrice = priceMap.get(pos.ticker) ?? 0;
    const spreadValue = spreadValueMap.get(pos.id);
    const analysis = analyzePosition(pos, currentPrice);
    
    // Override P&L with actual spread value if available
    if (spreadValue) {
      const actualPnl = (spreadValue.spreadMid - pos.entryPrice) * 100 * pos.quantity;
      const actualPnlPct = pos.entryPrice > 0 ? ((spreadValue.spreadMid - pos.entryPrice) / pos.entryPrice) * 100 : 0;
      analyses.push({ 
        ...analysis, 
        actualSpreadValue: spreadValue,
        actualPnl,
        actualPnlPct,
        pnl: actualPnl,  // Override the estimated P&L
        pnlPct: actualPnlPct,
      });
    } else {
      analyses.push(analysis);
    }
  }
  
  // Display each position with analysis
  console.log();
  
  let totalDeployed = 0;
  let totalPnl = 0;
  let itmCount = 0;
  let highRiskCount = 0;
  let hasActualData = false;
  
  for (const analysis of analyses) {
    const pos = analysis.position;
    const strikes = `$${pos.longStrike}/$${pos.shortStrike}`;
    const exp = pos.expiration?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';
    const dte = pos.dte !== undefined ? pos.dte : 0;
    const status = analysis.positionStatus;
    const hasSpreadData = !!analysis.actualSpreadValue;
    if (hasSpreadData) hasActualData = true;
    
    // Status based on actual P&L if available
    let statusIcon: string;
    let statusColor: typeof chalk.green;
    let statusText: string;
    
    const pnlForStatus = analysis.pnl;
    
    if (pnlForStatus < -30) {
      // Losing position
      statusIcon = "🔴";
      statusColor = chalk.red;
      statusText = "LOSING";
      highRiskCount++;
    } else if (status.status === "ITM" && pnlForStatus > 0) {
      statusIcon = "🟢";
      statusColor = chalk.green;
      statusText = "PROFITABLE";
      itmCount++;
    } else if (status.status === "UNDERWATER") {
      statusIcon = "🔴";
      statusColor = chalk.red;
      statusText = "UNDERWATER";
      highRiskCount++;
    } else if (analysis.risk === "HIGH") {
      statusIcon = "🔴";
      statusColor = chalk.red;
      statusText = "HIGH RISK";
      highRiskCount++;
    } else if (analysis.risk === "MEDIUM") {
      statusIcon = "🟡";
      statusColor = chalk.yellow;
      statusText = "MONITOR";
    } else {
      statusIcon = "🟢";
      statusColor = chalk.green;
      statusText = "OK";
    }
    
    // P&L color
    const pnlColor = analysis.pnl >= 0 ? chalk.green : chalk.red;
    const pnlSign = analysis.pnl >= 0 ? "+" : "";
    
    console.log(chalk.bold.white(`  ${pos.ticker}`) + chalk.dim(` @ $${analysis.currentPrice.toFixed(2)}`));
    console.log(chalk.dim(`    ${strikes} CDS · ${exp} (${dte} DTE)`));
    console.log(chalk.dim(`    Entry: $${pos.entryPrice.toFixed(2)} × ${pos.quantity}`));
    
    // Show actual spread value if available
    if (analysis.actualSpreadValue) {
      const sv = analysis.actualSpreadValue;
      const valueColor = sv.spreadMid >= pos.entryPrice ? chalk.green : chalk.red;
      console.log(valueColor(`    Current: $${sv.spreadMid.toFixed(2)} (bid: $${sv.spreadBid.toFixed(2)}, ask: $${sv.spreadAsk.toFixed(2)})`));
    }
    
    // Position status line (stock price relative to strikes)
    if (status.status === "ITM") {
      console.log(chalk.dim(`    Stock $${status.aboveShortBy.toFixed(2)} above short strike (ITM)`));
    } else if (status.status === "BETWEEN_STRIKES") {
      const cushionColor = analysis.cushionPct >= 8 ? chalk.green :
                           analysis.cushionPct >= 5 ? chalk.yellow : chalk.red;
      console.log(cushionColor(`    Cushion: $${analysis.cushion.toFixed(2)} (${analysis.cushionPct.toFixed(1)}%) to short strike`));
    } else if (status.status === "UNDERWATER") {
      console.log(chalk.red(`    ⚠️  Stock below long strike $${pos.longStrike}`));
    } else {
      console.log(chalk.yellow(`    At the money - watch for direction`));
    }
    
    // P&L - use actual if available
    const pnlLabel = analysis.actualSpreadValue ? "P&L" : "Est. P&L";
    console.log(pnlColor(`    ${pnlLabel}: ${pnlSign}$${analysis.pnl.toFixed(0)} (${pnlSign}${analysis.pnlPct.toFixed(0)}%)`));
    
    // Status/Recommendations
    console.log(statusColor(`    ${statusIcon} ${statusText}`));
    if (analysis.riskReasons.length > 0) {
      for (const reason of analysis.riskReasons) {
        const reasonColor = reason.includes("💰") ? chalk.green : chalk.dim.yellow;
        console.log(reasonColor(`       ↳ ${reason}`));
      }
    }
    
    console.log();
    
    totalDeployed += pos.entryPrice * pos.quantity * 100;
    totalPnl += analysis.pnl;
  }
  
  // Summary
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log(chalk.dim(`  ${positions.length} positions · $${totalDeployed.toFixed(0)} deployed`));
  
  const pnlLabel = hasActualData ? "Total P&L" : "Est. Total P&L";
  const pnlColor = totalPnl >= 0 ? chalk.green : chalk.red;
  console.log(pnlColor(`  ${pnlLabel}: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}`));
  
  if (itmCount > 0) {
    console.log(chalk.green(`  🟢 ${itmCount} profitable`));
  }
  if (highRiskCount > 0) {
    console.log(chalk.red(`  🔴 ${highRiskCount} losing/at risk`));
  }
  
  if (!hasActualData) {
    console.log(chalk.dim(`  ⚠️  Options data unavailable - P&L is estimated`));
  }
  
  console.log();
  
  // Victor's Take
  console.log(chalk.bold.cyan("  💭 VICTOR'S TAKE"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();
  
  const aiMode = options.aiMode ?? "cloud";
  const commentary = await generatePositionCommentary(analyses, regime, aiMode);
  
  // Word wrap the commentary
  const wrapped = wrapText(commentary, 68);
  for (const line of wrapped) {
    console.log(chalk.white(`  ${line}`));
  }
  console.log();
}

interface PositionStatus {
  status: "ITM" | "BETWEEN_STRIKES" | "OTM" | "UNDERWATER";
  intrinsicValue: number;     // Current intrinsic value of the spread
  intrinsicPct: number;       // % of max value captured (intrinsic only)
  aboveShortBy: number;       // How far above short strike (negative if below)
  aboveShortByPct: number;
}

function analyzePosition(pos: Position, currentPrice: number): PositionAnalysis & { positionStatus: PositionStatus } {
  const shortStrike = pos.shortStrike ?? 0;
  const longStrike = pos.longStrike ?? 0;
  const spreadWidth = shortStrike - longStrike;
  const dte = pos.dte ?? 99;
  
  // Calculate where price is relative to strikes
  const aboveShortBy = currentPrice - shortStrike;
  const aboveShortByPct = shortStrike > 0 ? (aboveShortBy / shortStrike) * 100 : 0;
  
  // Determine position status
  let status: PositionStatus["status"];
  let intrinsicValue: number;
  
  if (currentPrice >= shortStrike) {
    // Price above short strike - spread is deep ITM
    status = "ITM";
    intrinsicValue = spreadWidth; // Intrinsic is at max
  } else if (currentPrice > longStrike) {
    // Price between strikes
    status = "BETWEEN_STRIKES";
    intrinsicValue = currentPrice - longStrike;
  } else {
    // Price at or below long strike
    status = currentPrice < longStrike ? "UNDERWATER" : "OTM";
    intrinsicValue = 0;
  }
  
  const intrinsicPct = spreadWidth > 0 ? (intrinsicValue / spreadWidth) * 100 : 0;
  
  // Calculate cushion (distance from current price to short strike)
  // Positive = room before short strike, Negative = already past it
  const cushion = shortStrike - currentPrice;
  const cushionPct = currentPrice > 0 ? (cushion / currentPrice) * 100 : 0;
  
  // Estimate current spread value
  // When ITM with time remaining, spread is worth intrinsic + some time value
  // Simplified: assume spread approaches intrinsic value as DTE decreases
  let estimatedValue: number;
  if (status === "ITM") {
    // Deep ITM - spread worth close to intrinsic, but not quite max until expiration
    // Time decay factor: closer to expiration = closer to intrinsic
    const timeDecayFactor = Math.max(0.85, 1 - (dte / 365)); // 85-100% of intrinsic
    estimatedValue = spreadWidth * timeDecayFactor;
  } else if (status === "BETWEEN_STRIKES") {
    // Between strikes - linear approximation
    const pctThrough = (currentPrice - longStrike) / spreadWidth;
    estimatedValue = pctThrough * spreadWidth * 0.9; // Discount for time value
  } else {
    // OTM or underwater
    estimatedValue = Math.max(0, intrinsicValue * 0.5); // Minimal value
  }
  
  const pnl = (estimatedValue - pos.entryPrice) * 100 * pos.quantity;
  const pnlPct = pos.entryPrice > 0 ? (pnl / (pos.entryPrice * 100 * pos.quantity)) * 100 : 0;
  
  // Risk assessment
  const riskReasons: string[] = [];
  let riskScore = 0;
  
  // DTE considerations
  if (dte <= 5) {
    riskScore += 2;
    riskReasons.push(`Only ${dte} DTE - close or roll`);
  } else if (dte <= 14) {
    riskReasons.push(`${dte} DTE remaining`);
  }
  
  // Status-based recommendations
  if (status === "ITM") {
    // Deep ITM - recommend taking profits
    if (pnlPct >= 50) {
      riskReasons.push(`💰 ${pnlPct.toFixed(0)}% profit - consider closing`);
    }
    if (aboveShortByPct > 5) {
      riskReasons.push(`Price $${aboveShortBy.toFixed(2)} above short strike`);
    }
  } else if (status === "UNDERWATER") {
    riskScore += 3;
    riskReasons.push(`Price below long strike - at risk of max loss`);
  } else if (status === "BETWEEN_STRIKES") {
    if (cushionPct < 3) {
      riskScore += 2;
      riskReasons.push(`Thin cushion (${cushionPct.toFixed(1)}%)`);
    } else if (cushionPct < 5) {
      riskScore += 1;
      riskReasons.push(`Cushion ${cushionPct.toFixed(1)}%`);
    } else {
      riskReasons.push(`${cushionPct.toFixed(1)}% cushion to short strike`);
    }
  }
  
  // Determine risk level
  let risk: "LOW" | "MEDIUM" | "HIGH";
  if (status === "UNDERWATER") {
    risk = "HIGH";
  } else if (status === "ITM") {
    risk = "LOW"; // ITM positions are in good shape
  } else {
    risk = riskScore >= 3 ? "HIGH" : riskScore >= 1 ? "MEDIUM" : "LOW";
  }
  
  return {
    position: pos,
    currentPrice,
    cushion,
    cushionPct,
    estimatedValue,
    pnl,
    pnlPct,
    risk,
    riskReasons,
    positionStatus: {
      status,
      intrinsicValue,
      intrinsicPct,
      aboveShortBy,
      aboveShortByPct,
    },
  };
}

async function generatePositionCommentary(
  analyses: (PositionAnalysis & { positionStatus: PositionStatus; actualSpreadValue?: SpreadValue; actualPnl?: number; actualPnlPct?: number })[],
  regime: Awaited<ReturnType<typeof getMarketRegime>>,
  aiMode: OllamaMode
): Promise<string> {
  const positionSummaries = analyses.map(a => {
    const p = a.position;
    const pnlStr = `P&L ${a.pnl >= 0 ? "+" : ""}$${a.pnl.toFixed(0)} (${a.pnl >= 0 ? "+" : ""}${a.pnlPct.toFixed(0)}%)`;
    const spreadStr = a.actualSpreadValue 
      ? `Current value: $${a.actualSpreadValue.spreadMid.toFixed(2)} vs entry $${p.entryPrice.toFixed(2)}`
      : `Entry: $${p.entryPrice.toFixed(2)}`;
    return `${p.ticker}: $${p.longStrike}/$${p.shortStrike} CDS, ${p.dte} DTE, ${spreadStr}, ${pnlStr}`;
  }).join("\n");
  
  const profitableCount = analyses.filter(a => a.pnl > 0).length;
  const losingCount = analyses.filter(a => a.pnl < 0).length;
  const totalPnl = analyses.reduce((sum, a) => sum + a.pnl, 0);
  
  const prompt = `You are Victor, a trading assistant. Review these open call debit spread positions and provide brief, actionable commentary (3-4 sentences max).

Market Regime: ${regime.regime} (VIX: ${regime.vix.current.toFixed(1)}, SPY trend: ${regime.spyTrend})

Positions:
${positionSummaries}

Summary: ${profitableCount} profitable, ${losingCount} losing, Total P&L: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}

Guidelines:
- Profitable positions (30%+ gain): Consider taking profits
- Losing positions: Assess if thesis still valid, consider cutting losses
- Low DTE (<14 days): Time to decide - close, roll, or let ride

Be concise and direct. Give specific recommendations for each position that needs action.`;

  try {
    const response = await generateCompletion(
      { mode: aiMode },
      "You are Victor, a trading assistant. Be concise and actionable.",
      prompt
    );
    return response.content.trim();
  } catch (error) {
    return "Unable to generate commentary at this time.";
  }
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

// ============================================================================
// ADD POSITION
// ============================================================================

export interface AddPositionOptions {
  ticker: string;
  longStrike: number;
  shortStrike: number;
  expiration: string;  // YYYY-MM-DD or "Jan 17"
  cost: number;        // Entry debit per contract
  quantity?: number;
  underlying?: number;
  notes?: string;
}

export async function addNewPosition(options: AddPositionOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.yellow("\n  ⚠ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY\n"));
    return;
  }

  // Parse expiration date
  let expiration: Date;
  try {
    expiration = parseExpirationDate(options.expiration);
  } catch (err) {
    console.log(chalk.red(`\n  ✗ Invalid expiration date: ${options.expiration}`));
    console.log(chalk.dim("    Use format: YYYY-MM-DD or 'Jan 17' or 'Jan 17 2025'"));
    return;
  }

  const position = await addPosition({
    ticker: options.ticker.toUpperCase(),
    positionType: "call_debit_spread",
    longStrike: options.longStrike,
    shortStrike: options.shortStrike,
    expiration,
    quantity: options.quantity ?? 1,
    entryDate: new Date(),
    entryPrice: options.cost,
    entryUnderlying: options.underlying,
    notes: options.notes,
  });

  if (!position) {
    console.log(chalk.red("\n  ✗ Failed to add position\n"));
    return;
  }

  console.log();
  console.log(chalk.green("  ✓ Position added"));
  console.log();
  console.log(chalk.bold.white(`    ${position.ticker}`));
  console.log(chalk.dim(`    $${position.longStrike}/$${position.shortStrike} Call Debit Spread`));
  console.log(chalk.dim(`    Exp: ${expiration.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${position.dte} DTE)`));
  console.log(chalk.dim(`    Entry: $${position.entryPrice.toFixed(2)} × ${position.quantity}`));
  console.log();
}

// ============================================================================
// REMOVE POSITION
// ============================================================================

export async function closePosition(ticker: string, reason?: string): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.yellow("\n  ⚠ Supabase not configured.\n"));
    return;
  }

  const positions = await getPositionsByTicker(ticker);
  
  if (positions.length === 0) {
    console.log(chalk.yellow(`\n  No open positions found for ${ticker.toUpperCase()}\n`));
    return;
  }

  // Remove all positions for this ticker
  for (const pos of positions) {
    await removePosition(pos.id);
  }

  console.log();
  console.log(chalk.green(`  ✓ Closed ${positions.length} position${positions.length > 1 ? 's' : ''} for ${ticker.toUpperCase()}`));
  if (reason) {
    console.log(chalk.dim(`    Reason: ${reason}`));
  }
  console.log();
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPositionType(type: string): string {
  switch (type) {
    case "call_debit_spread": return "Call Debit Spread";
    case "put_credit_spread": return "Put Credit Spread";
    case "call_long": return "Long Call";
    case "put_long": return "Long Put";
    case "stock": return "Stock";
    default: return type;
  }
}

function parseExpirationDate(input: string): Date {
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(input + "T00:00:00");
  }

  // Try "Jan 17" or "Jan 17 2025" format
  const monthMatch = input.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (monthMatch) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", 
                        "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase().slice(0, 3));
    if (monthIndex === -1) throw new Error("Invalid month");
    
    const day = parseInt(monthMatch[2]);
    const year = monthMatch[3] ? parseInt(monthMatch[3]) : new Date().getFullYear();
    
    // If month is in the past and no year specified, use next year
    const date = new Date(year, monthIndex, day);
    if (!monthMatch[3] && date < new Date()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    
    return date;
  }

  throw new Error("Unrecognized date format");
}

