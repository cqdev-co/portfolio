/**
 * Agent Monitor
 * Background daemon for continuous market monitoring
 */

import chalk from "chalk";
import {
  getWatchlist,
  getConfig,
  createAlert,
  logScan,
  checkAlertCooldown,
  updateAlertCooldown,
  type WatchlistItem,
  type AlertType,
} from "../services/supabase.ts";
import { scanForOpportunities, type ScanResult } from "../services/scanner.ts";
import {
  sendDiscordAlert, 
  sendEntrySignal, 
  isDiscordConfigured,
} from "../services/discord.ts";
import {
  evaluateEntrySignal,
  shouldSendAlert,
  type AlertDecision,
  type MarketContext,
} from "./decision.ts";
import { reviewAlert } from "./ai-review.ts";
import { generateMorningBriefing } from "./briefing.ts";
import { getMarketRegime } from "../services/market-regime.ts";
import type { OllamaMode } from "../services/ollama.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentConfig {
  scanIntervalMs: number;      // Default: 30 min (1800000)
  briefingTime: string;        // Default: "09:00" ET
  alertCooldownMs: number;     // Default: 2 hours (7200000)
  discordEnabled: boolean;
  aiReviewEnabled: boolean;
  minConviction: number;       // 1-10, default: 6
  extendedHours: boolean;      // Scan outside market hours (default: false)
  debug: boolean;              // Log rejection reasons (default: false)
  aiMode: OllamaMode;
  aiModel?: string;
}

export interface AgentStatus {
  running: boolean;
  startedAt?: Date;
  lastScanAt?: Date;
  lastBriefingAt?: Date;
  scanCount: number;
  alertCount: number;
  errorCount: number;
}

// ============================================================================
// AGENT MONITOR
// ============================================================================

let isRunning = false;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let briefingTimeout: ReturnType<typeof setTimeout> | null = null;

const status: AgentStatus = {
  running: false,
  scanCount: 0,
  alertCount: 0,
  errorCount: 0,
};

/**
 * Load agent configuration from database
 */
async function loadConfig(): Promise<AgentConfig> {
  const [
    scanIntervalMs,
    briefingTime,
    alertCooldownMs,
    discordEnabled,
    aiReviewEnabled,
    minConviction,
    extendedHours,
  ] = await Promise.all([
    getConfig<number>("scan_interval_ms", 1800000),
    getConfig<string>("briefing_time", "09:00"),
    getConfig<number>("alert_cooldown_ms", 7200000),
    getConfig<boolean>("discord_enabled", true),
    getConfig<boolean>("ai_review_enabled", true),
    getConfig<number>("min_conviction", 6),
    getConfig<boolean>("extended_hours", false),
  ]);

  return {
    scanIntervalMs,
    briefingTime,
    alertCooldownMs,
    discordEnabled,
    aiReviewEnabled,
    minConviction,
    extendedHours,
    debug: false,
    aiMode: "cloud",
  };
}

/**
 * Start the agent monitor
 */
export async function startAgent(options?: {
  aiMode?: OllamaMode;
  aiModel?: string;
  extendedHours?: boolean;
  debug?: boolean;
}): Promise<void> {
  if (isRunning) {
    console.log(chalk.yellow("  Agent is already running"));
    return;
  }

  console.log();
  console.log(chalk.bold.green("  🤖 STARTING AGENTIC VICTOR"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  const config = await loadConfig();
  if (options?.aiMode) config.aiMode = options.aiMode;
  if (options?.aiModel) config.aiModel = options.aiModel;
  if (options?.extendedHours !== undefined) config.extendedHours = options.extendedHours;
  if (options?.debug !== undefined) config.debug = options.debug;

  isRunning = true;
  status.running = true;
  status.startedAt = new Date();
  status.scanCount = 0;
  status.alertCount = 0;
  status.errorCount = 0;

  // Show current ET time for clarity
  const etNow = getEasternTime();
  const etTimeStr = `${etNow.hour.toString().padStart(2, "0")}:${etNow.minute.toString().padStart(2, "0")}`;
  
  console.log(chalk.gray(`  Current time: ${etTimeStr} ET`));
  console.log(chalk.gray(`  Scan interval: ${config.scanIntervalMs / 60000} minutes`));
  console.log(chalk.gray(`  Briefing time: ${config.briefingTime} ET`));
  console.log(chalk.gray(`  Alert cooldown: ${config.alertCooldownMs / 3600000} hours`));
  console.log(chalk.gray(`  Discord: ${config.discordEnabled && isDiscordConfigured() ? "✓" : "✗"}`));
  console.log(chalk.gray(`  AI review: ${config.aiReviewEnabled ? "✓" : "✗"}`));
  if (config.extendedHours) {
    console.log(chalk.yellow(`  Extended hours: ✓ (scanning 24/7)`));
  } else {
    console.log(chalk.gray(`  Market hours only: 9:30 AM - 4:00 PM ET`));
  }
  if (config.debug) {
    console.log(chalk.magenta(`  Debug mode: ✓ (logging rejection reasons)`));
  }
  console.log();

  // Run initial scan
  console.log(chalk.cyan("  Running initial scan..."));
  await runScan(config);

  // Schedule regular scans
  scanInterval = setInterval(async () => {
    if (!config.extendedHours && !isMarketHours()) {
      return; // Skip scans outside market hours (unless extended hours enabled)
    }
    await runScan(config);
  }, config.scanIntervalMs);

  // Schedule morning briefing
  scheduleBriefing(config);

  console.log(chalk.green("  ✓ Agent started successfully"));
  console.log(chalk.gray("  Press Ctrl+C to stop"));
  console.log();

  // Handle shutdown
  process.on("SIGINT", () => {
    stopAgent();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopAgent();
    process.exit(0);
  });
}

/**
 * Stop the agent monitor
 */
export function stopAgent(): void {
  if (!isRunning) {
    console.log(chalk.yellow("  Agent is not running"));
    return;
  }

  console.log();
  console.log(chalk.yellow("  Stopping agent..."));

  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  if (briefingTimeout) {
    clearTimeout(briefingTimeout);
    briefingTimeout = null;
  }

  isRunning = false;
  status.running = false;

  console.log(chalk.green("  ✓ Agent stopped"));
  console.log(chalk.gray(`  Total scans: ${status.scanCount}`));
  console.log(chalk.gray(`  Total alerts: ${status.alertCount}`));
  console.log();
}

/**
 * Get agent status
 */
export function getAgentStatus(): AgentStatus {
  return { ...status };
}

// ============================================================================
// SCAN LOGIC
// ============================================================================

/**
 * Run a watchlist scan
 */
async function runScan(config: AgentConfig): Promise<void> {
  const startTime = Date.now();

  try {
    // Get watchlist and market regime in parallel
    const [watchlist, regime] = await Promise.all([
      getWatchlist(),
      getMarketRegime(),
    ]);

    if (watchlist.length === 0) {
      console.log(chalk.gray(`  [${getETTimestamp()}] No tickers in watchlist`));
      return;
    }

    // Build market context for dynamic threshold adjustments
    const marketContext: MarketContext = {
      regime: regime.regime,
      spyTrend: regime.spyTrend,
      vix: regime.vix.current,
      vixLevel: regime.vix.level,
    };

    // Scan watchlist tickers
    const tickers = watchlist.map((w: WatchlistItem) => w.ticker);
    const results = await scanForOpportunities(tickers, {
      minGrade: "C",
      maxRisk: 10,
      minCushion: 0,
    });

    // Evaluate each result for alerts (with market context for dynamic thresholds)
    let alertsTriggered = 0;
    const debugRejections: { ticker: string; reason: string; grade: string; adjustments?: string[] }[] = [];
    
    for (const result of results) {
      const watchlistItem = watchlist.find((w: WatchlistItem) => w.ticker === result.ticker);
      if (!watchlistItem) continue;

      // Check entry signal with market context
      const decision = evaluateEntrySignal(result, watchlistItem, marketContext);
      if (decision.trigger) {
        const sent = await processAlert(decision, config);
        if (sent) alertsTriggered++;
      } else if (config.debug) {
        // Log rejection reason in debug mode
        const adjustments = (decision.data?.adjustments as { reasons?: string[] })?.reasons;
        debugRejections.push({
          ticker: result.ticker,
          reason: decision.reason,
          grade: result.grade.grade,
          adjustments,
        });
      }
    }

    const executionTime = Date.now() - startTime;
    status.lastScanAt = new Date();
    status.scanCount++;

    // Log scan
    await logScan({
      scanType: "WATCHLIST",
      tickersScanned: tickers.length,
      opportunitiesFound: results.filter(r => 
        gradeToValue(r.grade.grade) >= gradeToValue("B")
      ).length,
      alertsTriggered,
      executionTimeMs: executionTime,
    });

    console.log(
      chalk.gray(`  [${getETTimestamp()}]`) +
      chalk.white(` Scanned ${tickers.length} tickers`) +
      chalk.gray(` | ${results.length} opportunities`) +
      chalk.yellow(` | ${alertsTriggered} alerts`) +
      chalk.gray(` | ${executionTime}ms`)
    );

    // Debug output: show market regime and rejection reasons
    if (config.debug) {
      // Show market context
      const regimeColor = marketContext.regime === "RISK_ON" ? chalk.green :
                         marketContext.regime === "RISK_OFF" ? chalk.red :
                         marketContext.regime === "VOLATILE" ? chalk.yellow : chalk.gray;
      const trendIcon = marketContext.spyTrend === "BULLISH" ? "📈" :
                       marketContext.spyTrend === "BEARISH" ? "📉" : "➡️";
      console.log(
        chalk.magenta(`\n  🌡️  MARKET CONTEXT: `) +
        regimeColor(`${marketContext.regime}`) +
        chalk.gray(` | SPY ${trendIcon} ${marketContext.spyTrend}`) +
        chalk.gray(` | VIX ${marketContext.vix.toFixed(1)} (${marketContext.vixLevel})`)
      );
      
      if (debugRejections.length > 0) {
        console.log(chalk.magenta(`\n  📋 REJECTION REASONS (${debugRejections.length} tickers):`));
        for (const rej of debugRejections) {
          const gradeColor = rej.grade.startsWith('A') ? chalk.green : 
                            rej.grade.startsWith('B') ? chalk.yellow : chalk.gray;
          console.log(
            chalk.gray(`     ${rej.ticker}`) + 
            gradeColor(` [${rej.grade}]`) + 
            chalk.dim(` → ${rej.reason}`)
          );
          // Show dynamic adjustments if any
          if (rej.adjustments && rej.adjustments.length > 0) {
            console.log(chalk.cyan(`        ⚡ Dynamic: ${rej.adjustments.join(", ")}`));
          }
        }
      }
      console.log();
    }

  } catch (error) {
    status.errorCount++;
    console.error(chalk.red(`  [${getETTimestamp()}] Scan error:`), error);
  }
}

/**
 * Process an alert decision
 */
async function processAlert(
  decision: AlertDecision,
  config: AgentConfig
): Promise<boolean> {
  const ticker = decision.data.ticker as string;

  // Check cooldown
  const inCooldown = await checkAlertCooldown(ticker, config.alertCooldownMs);
  if (inCooldown) {
    return false;
  }

  // AI review if enabled
  let aiConviction: number | undefined;
  let aiReasoning: string | undefined;

  if (config.aiReviewEnabled && decision.alertType === "ENTRY_SIGNAL") {
    try {
      const regime = await getMarketRegime();
      const review = await reviewAlert(
        decision.data as unknown as ScanResult,
        decision.alertType,
        { regime, recentAlerts: [] },
        { aiMode: config.aiMode, aiModel: config.aiModel }
      );

      aiConviction = review.conviction;
      aiReasoning = review.reasoning;

      if (!review.approved) {
        return false;
      }

      // Adjust priority if AI suggests
      if (review.adjustedPriority) {
        decision.priority = review.adjustedPriority;
      }
    } catch (error) {
      console.error(chalk.yellow("  AI review failed, sending anyway:"), error);
    }
  }

  // Check if we should send based on config
  if (!shouldSendAlert(decision, {
    minPriority: "MEDIUM",
    aiReviewEnabled: config.aiReviewEnabled,
    minConviction: config.minConviction,
  }, aiConviction)) {
    return false;
  }

  // Save alert to database
  const alert = await createAlert({
    ticker,
    alertType: decision.alertType,
    priority: decision.priority,
    headline: decision.reason,
    analysis: aiReasoning,
    data: decision.data,
    aiConviction,
    aiReasoning,
  });

  // Update cooldown
  await updateAlertCooldown(ticker, decision.alertType);

  // Send to Discord if enabled
  if (config.discordEnabled && isDiscordConfigured()) {
    if (decision.alertType === "ENTRY_SIGNAL") {
      const data = decision.data as {
        ticker: string;
        price: number;
        changePct: number;
        grade: string;
        rsi?: number;
        iv?: { current: number; percentile: number; level: string };
        spread?: { strikes: string; debit: number; cushion: number; dte: number };
      };

      await sendEntrySignal({
        ticker: data.ticker,
        price: data.price,
        changePct: data.changePct,
        rsi: data.rsi,
        iv: data.iv,
        grade: data.grade,
        spread: data.spread,
        aiCommentary: aiReasoning,
        conviction: aiConviction,
      });
    }
  }

  status.alertCount++;
  return true;
}

// ============================================================================
// BRIEFING SCHEDULING
// ============================================================================

/**
 * Schedule morning briefing
 */
function scheduleBriefing(config: AgentConfig): void {
  const [targetHours, targetMinutes] = config.briefingTime.split(":").map(Number);
  
  // Get current ET time
  const etNow = getEasternTime();
  const currentETMinutes = etNow.hour * 60 + etNow.minute;
  const targetETMinutes = targetHours * 60 + targetMinutes;
  
  // Calculate minutes until target time
  let minutesUntil: number;
  let daysToAdd = 0;
  
  if (targetETMinutes > currentETMinutes) {
    // Target is later today
    minutesUntil = targetETMinutes - currentETMinutes;
  } else {
    // Target is tomorrow
    minutesUntil = (24 * 60 - currentETMinutes) + targetETMinutes;
    daysToAdd = 1;
  }
  
  // Check if landing on weekend (need to check ET day)
  let targetDay = (etNow.day + daysToAdd) % 7;
  
  // Skip Saturday (6) and Sunday (0)
  while (targetDay === 0 || targetDay === 6) {
    minutesUntil += 24 * 60; // Add a day
    targetDay = (targetDay + 1) % 7;
  }
  
  const msUntilBriefing = minutesUntil * 60 * 1000;
  
  // Calculate display time
  const displayTime = new Date(Date.now() + msUntilBriefing);
  const displayStr = displayTime.toLocaleString("en-US", { 
    timeZone: "America/New_York",
    weekday: "short",
    month: "short", 
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  console.log(
    chalk.gray(`  Next briefing scheduled for `) +
    chalk.white(displayStr) +
    chalk.gray(" ET")
  );

  briefingTimeout = setTimeout(async () => {
    await runBriefing(config);
    // Reschedule for next day
    scheduleBriefing(config);
  }, msUntilBriefing);
}

/**
 * Run morning briefing
 */
async function runBriefing(config: AgentConfig): Promise<void> {
  console.log(chalk.cyan(`  [${getETTimestamp()}] Generating morning briefing...`));

  try {
    await generateMorningBriefing({
      aiMode: config.aiMode,
      aiModel: config.aiModel,
      skipDiscord: !config.discordEnabled,
    });

    status.lastBriefingAt = new Date();
    console.log(chalk.green(`  [${getETTimestamp()}] Morning briefing sent`));
  } catch (error) {
    status.errorCount++;
    console.error(chalk.red(`  [${getETTimestamp()}] Briefing error:`), error);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get current time in Eastern Time
 */
function getEasternTime(): { hour: number; minute: number; day: number } {
  const now = new Date();
  
  // Use Intl.DateTimeFormat for reliable parsing (handles DST automatically)
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  
  let hour = 0;
  let minute = 0;
  let dayName = "";
  
  for (const part of parts) {
    if (part.type === "hour") hour = parseInt(part.value, 10);
    if (part.type === "minute") minute = parseInt(part.value, 10);
    if (part.type === "weekday") dayName = part.value;
  }
  
  // Convert weekday name to day number (0 = Sunday)
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  const day = dayMap[dayName] ?? new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
  
  return { hour, minute, day };
}

/**
 * Get formatted ET timestamp for logging
 */
function getETTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { 
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }) + " ET";
}

/**
 * Check if currently within market hours (9:30 AM - 4:00 PM ET)
 */
function isMarketHours(): boolean {
  const { hour, minute, day } = getEasternTime();
  
  // Skip weekends (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  const timeInMinutes = hour * 60 + minute;

  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30;   // 9:30 AM ET
  const marketClose = 16 * 60;       // 4:00 PM ET

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

function gradeToValue(grade: string): number {
  const grades: Record<string, number> = {
    'A+': 12, 'A': 11, 'A-': 10,
    'B+': 9, 'B': 8, 'B-': 7,
    'C+': 6, 'C': 5, 'C-': 4,
    'D': 3, 'F': 1,
  };
  return grades[grade] ?? 0;
}

/**
 * Display agent status
 */
export function displayAgentStatus(): void {
  console.log();
  console.log(chalk.bold.white("  🤖 AGENT STATUS"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  const s = getAgentStatus();

  console.log(chalk.white("  Status:       ") + (s.running ? chalk.green("RUNNING") : chalk.red("STOPPED")));
  
  if (s.startedAt) {
    console.log(chalk.white("  Started:      ") + chalk.gray(s.startedAt.toLocaleString()));
  }
  if (s.lastScanAt) {
    console.log(chalk.white("  Last scan:    ") + chalk.gray(s.lastScanAt.toLocaleString()));
  }
  if (s.lastBriefingAt) {
    console.log(chalk.white("  Last brief:   ") + chalk.gray(s.lastBriefingAt.toLocaleString()));
  }

  console.log();
  console.log(chalk.white("  Scans:        ") + chalk.cyan(s.scanCount.toString()));
  console.log(chalk.white("  Alerts sent:  ") + chalk.yellow(s.alertCount.toString()));
  console.log(chalk.white("  Errors:       ") + (s.errorCount > 0 ? chalk.red(s.errorCount.toString()) : chalk.gray("0")));

  console.log();
}

// ============================================================================
// DRY RUN (SINGLE SCAN WITH DEBUG)
// ============================================================================

/**
 * Run a single scan with full debug output (no alerts sent)
 */
export async function runDryScan(options?: {
  aiMode?: OllamaMode;
}): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan("  🔍 DRY RUN SCAN"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log(chalk.dim("  This scan shows all rejection reasons. No alerts will be sent."));
  console.log();

  const startTime = Date.now();

  try {
    // Get watchlist and market regime
    const [watchlist, regime] = await Promise.all([
      getWatchlist(),
      getMarketRegime(),
    ]);

    if (watchlist.length === 0) {
      console.log(chalk.yellow("  No tickers in watchlist. Add tickers with:"));
      console.log(chalk.dim("    bun run watch add NVDA"));
      return;
    }

    // Build market context for dynamic threshold adjustments
    const marketContext: MarketContext = {
      regime: regime.regime,
      spyTrend: regime.spyTrend,
      vix: regime.vix.current,
      vixLevel: regime.vix.level,
    };

    // Show market context
    const regimeColor = marketContext.regime === "RISK_ON" ? chalk.green :
                       marketContext.regime === "RISK_OFF" ? chalk.red :
                       marketContext.regime === "VOLATILE" ? chalk.yellow : chalk.gray;
    const trendIcon = marketContext.spyTrend === "BULLISH" ? "📈" :
                     marketContext.spyTrend === "BEARISH" ? "📉" : "➡️";
    console.log(
      chalk.cyan(`  🌡️  Market: `) +
      regimeColor(`${marketContext.regime}`) +
      chalk.gray(` | SPY ${trendIcon} ${marketContext.spyTrend}`) +
      chalk.gray(` | VIX ${marketContext.vix.toFixed(1)} (${marketContext.vixLevel})`)
    );
    console.log(chalk.dim(`  Dynamic thresholds will adjust based on these conditions.`));
    console.log();

    console.log(chalk.gray(`  Scanning ${watchlist.length} tickers...`));
    console.log();

    // Scan watchlist tickers
    const tickers = watchlist.map(w => w.ticker);
    const results = await scanForOpportunities(tickers, {
      minGrade: "C",
      maxRisk: 10,
      minCushion: 0,
    });

    // Group results by alert decision
    const wouldAlert: { ticker: string; grade: string; reason: string; adjustments?: string[] }[] = [];
    const rejected: { ticker: string; grade: string; reason: string; details: string; adjustments?: string[] }[] = [];

    for (const result of results) {
      const watchlistItem = watchlist.find(w => w.ticker === result.ticker);
      if (!watchlistItem) continue;

      // Use market context for dynamic thresholds
      const decision = evaluateEntrySignal(result, watchlistItem, marketContext);
      const adjustments = (decision.data?.adjustments as { reasons?: string[] })?.reasons;
      const criteria = decision.data?.criteria as { rsiLow?: number; rsiHigh?: number; ivThreshold?: number } | undefined;
      
      if (decision.trigger) {
        wouldAlert.push({
          ticker: result.ticker,
          grade: result.grade.grade,
          reason: decision.reason,
          adjustments,
        });
      } else {
        // Build detailed info for rejected tickers (show EFFECTIVE thresholds)
        const details: string[] = [];
        
        // Show RSI with effective thresholds
        const effectiveRsiLow = criteria?.rsiLow ?? watchlistItem.targetRsiLow;
        const effectiveRsiHigh = criteria?.rsiHigh ?? watchlistItem.targetRsiHigh;
        if (result.grade.rsi !== undefined) {
          const rsiInRange = result.grade.rsi >= effectiveRsiLow && result.grade.rsi <= effectiveRsiHigh;
          details.push(`RSI: ${result.grade.rsi.toFixed(0)} (range: ${effectiveRsiLow}-${effectiveRsiHigh}) ${rsiInRange ? "✓" : "✗"}`);
        } else {
          details.push(`RSI: N/A (range: ${effectiveRsiLow}-${effectiveRsiHigh})`);
        }
        
        // Show IV with effective threshold
        const effectiveIv = criteria?.ivThreshold ?? watchlistItem.ivPercentileMin;
        if (result.iv?.percentile !== undefined && effectiveIv) {
          const ivOk = result.iv.percentile <= effectiveIv;
          details.push(`IV: ${result.iv.percentile}% (max: ${effectiveIv}%) ${ivOk ? "✓" : "✗"}`);
        }
        if (result.spread?.cushion !== undefined) {
          const cushionOk = result.spread.cushion >= watchlistItem.minCushionPct;
          details.push(`Cushion: ${result.spread.cushion.toFixed(1)}% (min: ${watchlistItem.minCushionPct}%) ${cushionOk ? "✓" : "✗"}`);
        }
        details.push(`Grade: ${result.grade.grade} (min: ${watchlistItem.minGrade}) ${gradeToValue(result.grade.grade) >= gradeToValue(watchlistItem.minGrade) ? "✓" : "✗"}`);
        
        rejected.push({
          ticker: result.ticker,
          grade: result.grade.grade,
          reason: decision.reason,
          details: details.join(", "),
          adjustments,
        });
      }
    }

    const executionTime = Date.now() - startTime;

    // Display results
    if (wouldAlert.length > 0) {
      console.log(chalk.green.bold(`  ✅ WOULD TRIGGER ALERTS (${wouldAlert.length}):`));
      for (const item of wouldAlert) {
        const gradeColor = item.grade.startsWith('A') ? chalk.green : chalk.yellow;
        console.log(
          chalk.green(`     ${item.ticker}`) +
          gradeColor(` [${item.grade}]`) +
          chalk.dim(` — ${item.reason}`)
        );
        if (item.adjustments && item.adjustments.length > 0) {
          console.log(chalk.cyan(`        ⚡ Dynamic: ${item.adjustments.join(", ")}`));
        }
      }
      console.log();
    }

    if (rejected.length > 0) {
      console.log(chalk.yellow.bold(`  ❌ FILTERED OUT (${rejected.length}):`));
      for (const item of rejected) {
        const gradeColor = item.grade.startsWith('A') ? chalk.green : 
                          item.grade.startsWith('B') ? chalk.yellow : chalk.gray;
        console.log(
          chalk.white(`     ${item.ticker}`) +
          gradeColor(` [${item.grade}]`)
        );
        console.log(chalk.red(`        → ${item.reason}`));
        console.log(chalk.dim(`        ${item.details}`));
        if (item.adjustments && item.adjustments.length > 0) {
          console.log(chalk.cyan(`        ⚡ Dynamic: ${item.adjustments.join(", ")}`));
        }
      }
      console.log();
    }

    // Summary
    console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
    console.log(
      chalk.white(`  ${results.length} opportunities scanned`) +
      chalk.green(` | ${wouldAlert.length} would alert`) +
      chalk.yellow(` | ${rejected.length} filtered`) +
      chalk.gray(` | ${executionTime}ms`)
    );
    console.log();

  } catch (error) {
    console.error(chalk.red("  Scan error:"), error);
  }
}
