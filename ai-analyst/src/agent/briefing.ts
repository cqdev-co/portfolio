/**
 * Morning Briefing Generator
 * Creates daily market briefings with watchlist alerts and position updates
 */

import { getMarketRegime, type MarketRegime } from "../services/market-regime.ts";
import { 
  getCalendarContext, 
  type CalendarContext, 
  type MarketEvent 
} from "../services/calendar.ts";
import { 
  getWatchlist, 
  getPositions, 
  saveBriefing,
  markBriefingDelivered,
  type WatchlistItem, 
  type Position,
  type Briefing as DBBriefing,
} from "../services/supabase.ts";
import { scanForOpportunities, type ScanResult } from "../services/scanner.ts";
import { generateCompletion, type OllamaMode } from "../services/ollama.ts";
import { 
  sendMorningBriefing, 
  isDiscordConfigured,
  type BriefingEmbed,
} from "../services/discord.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface WatchlistAlert {
  ticker: string;
  reason: string;
  grade?: string;
  rsi?: number;
  cushion?: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface PositionUpdate {
  ticker: string;
  status: string;
  dte?: number;
  cushion?: number;
  action?: string;
}

export interface Briefing {
  date: Date;
  marketPulse: {
    spy: { price: number; changePct: number; trend: string };
    vix: { current: number; level: string };
    regime: string;
    summary: string;
  };
  calendar: {
    events: MarketEvent[];
    warnings: string[];
  };
  watchlistAlerts: WatchlistAlert[];
  positionUpdates: PositionUpdate[];
  aiCommentary: string;
}

// ============================================================================
// BRIEFING GENERATOR
// ============================================================================

/**
 * Generate a complete morning briefing
 */
export async function generateMorningBriefing(options?: {
  aiMode?: OllamaMode;
  aiModel?: string;
  skipDiscord?: boolean;
}): Promise<Briefing> {
  const now = new Date();
  
  // Fetch all data in parallel
  const [marketRegime, calendarContext, watchlist, positions] = await Promise.all([
    getMarketRegime(),
    getCalendarContext(),
    getWatchlist(),
    getPositions(),
  ]);

  // Scan watchlist tickers for opportunities
  const watchlistTickers = watchlist.map(w => w.ticker);
  const scanResults = watchlistTickers.length > 0
    ? await scanForOpportunities(watchlistTickers, {
        minGrade: "C",
        maxRisk: 10,
        minCushion: 0,
      })
    : [];

  // Generate watchlist alerts
  const watchlistAlerts = generateWatchlistAlerts(watchlist, scanResults);

  // Generate position updates
  const positionUpdates = generatePositionUpdates(positions);

  // Generate AI commentary
  const aiCommentary = await generateAICommentary({
    marketRegime,
    calendarContext,
    watchlistAlerts,
    positionUpdates,
    aiMode: options?.aiMode ?? "cloud",
    aiModel: options?.aiModel,
  });

  const briefing: Briefing = {
    date: now,
    marketPulse: {
      spy: {
        price: marketRegime.spy.price,
        changePct: marketRegime.spy.changePct,
        trend: marketRegime.spy.trend,
      },
      vix: {
        current: marketRegime.vix.current,
        level: marketRegime.vix.level,
      },
      regime: marketRegime.regime,
      summary: marketRegime.summary,
    },
    calendar: {
      events: calendarContext.upcomingEvents.slice(0, 5),
      warnings: calendarContext.warnings,
    },
    watchlistAlerts,
    positionUpdates,
    aiCommentary,
  };

  // Save briefing to database
  await saveBriefing({
    date: now,
    marketSummary: marketRegime.summary,
    marketData: {
      spy: briefing.marketPulse.spy,
      vix: briefing.marketPulse.vix,
      regime: briefing.marketPulse.regime,
    },
    watchlistAlerts,
    positionUpdates,
    calendarEvents: calendarContext.upcomingEvents,
    aiCommentary,
  });

  // Send to Discord if configured and not skipped
  if (!options?.skipDiscord && isDiscordConfigured()) {
    const discordBriefing = toBriefingEmbed(briefing);
    const success = await sendMorningBriefing(discordBriefing);
    
    if (success) {
      // Mark as delivered
      const dbBriefing = await saveBriefing({ date: now });
      if (dbBriefing) {
        await markBriefingDelivered(dbBriefing.id);
      }
    }
  }

  return briefing;
}

/**
 * Generate watchlist alerts from scan results
 */
function generateWatchlistAlerts(
  watchlist: WatchlistItem[],
  scanResults: ScanResult[]
): WatchlistAlert[] {
  const alerts: WatchlistAlert[] = [];

  for (const item of watchlist) {
    const result = scanResults.find(r => r.ticker === item.ticker);
    
    if (!result) continue;

    // Check if in buy zone based on item's thresholds
    const rsiInZone = result.grade.rsi !== undefined && 
      result.grade.rsi >= item.targetRsiLow && 
      result.grade.rsi <= item.targetRsiHigh;

    const cushionMet = result.spread?.cushion !== undefined &&
      result.spread.cushion >= item.minCushionPct;

    const gradeMet = gradeToValue(result.grade.grade) >= gradeToValue(item.minGrade);

    // Determine if this is an alert-worthy situation
    let reason: string | null = null;
    let priority: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (gradeMet && rsiInZone && cushionMet) {
      reason = `Grade ${result.grade.grade} setup - RSI ${result.grade.rsi?.toFixed(0)}, ${result.spread?.cushion.toFixed(1)}% cushion`;
      priority = result.grade.grade.startsWith("A") ? "HIGH" : "MEDIUM";
    } else if (gradeMet && rsiInZone) {
      reason = `RSI ${result.grade.rsi?.toFixed(0)} in buy zone - Grade ${result.grade.grade}`;
      priority = "MEDIUM";
    } else if (result.grade.rsi !== undefined && result.grade.rsi < 35) {
      reason = `RSI oversold at ${result.grade.rsi.toFixed(0)} - watch for bounce`;
      priority = "LOW";
    }

    if (reason) {
      alerts.push({
        ticker: item.ticker,
        reason,
        grade: result.grade.grade,
        rsi: result.grade.rsi,
        cushion: result.spread?.cushion,
        priority,
      });
    }
  }

  // Sort by priority
  alerts.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return alerts;
}

/**
 * Generate position updates from current positions
 */
function generatePositionUpdates(positions: Position[]): PositionUpdate[] {
  const updates: PositionUpdate[] = [];

  for (const pos of positions) {
    const dte = pos.dte ?? 0;
    const cushion = pos.entryUnderlying && pos.longStrike
      ? ((pos.entryUnderlying - pos.longStrike) / pos.entryUnderlying) * 100
      : undefined;

    let status = "";
    let action: string | undefined;

    // Check for risk conditions
    if (dte <= 5 && dte > 0) {
      status = `⚠️ ${dte} DTE remaining`;
      action = "Consider rolling or closing";
    } else if (dte <= 0) {
      status = "🔴 Expired or expiring today";
      action = "Close position";
    } else if (cushion !== undefined && cushion < 5) {
      status = `⚠️ Low cushion (${cushion.toFixed(1)}%)`;
      action = "Monitor closely, consider exit";
    } else if (dte <= 10) {
      status = `${dte} DTE - approaching expiration`;
      action = "Plan exit strategy";
    } else {
      status = `${dte} DTE - on track`;
    }

    updates.push({
      ticker: pos.ticker,
      status,
      dte,
      cushion,
      action,
    });
  }

  // Sort by DTE (lowest first)
  updates.sort((a, b) => (a.dte ?? 999) - (b.dte ?? 999));

  return updates;
}

/**
 * Generate AI commentary for the briefing
 */
async function generateAICommentary(context: {
  marketRegime: MarketRegime;
  calendarContext: CalendarContext;
  watchlistAlerts: WatchlistAlert[];
  positionUpdates: PositionUpdate[];
  aiMode: OllamaMode;
  aiModel?: string;
}): Promise<string> {
  const prompt = buildBriefingPrompt(context);

  try {
    const response = await generateCompletion(
      {
        mode: context.aiMode,
        model: context.aiModel,
      },
      "You are Victor, a trading assistant. Generate brief, actionable market commentary.",
      prompt
    );

    return response.content.trim();
  } catch (error) {
    console.error("Error generating AI commentary:", error);
    return "Unable to generate AI commentary at this time.";
  }
}

/**
 * Build prompt for AI briefing commentary
 */
function buildBriefingPrompt(context: {
  marketRegime: MarketRegime;
  calendarContext: CalendarContext;
  watchlistAlerts: WatchlistAlert[];
  positionUpdates: PositionUpdate[];
}): string {
  let prompt = `You are Victor, a trading assistant. Generate a brief morning commentary (2-3 sentences).

MARKET CONDITIONS:
- Regime: ${context.marketRegime.regime}
- VIX: ${context.marketRegime.vix.current} (${context.marketRegime.vix.level})
- SPY: ${context.marketRegime.spy.trend} trend
- ${context.marketRegime.tradingRecommendation}

`;

  if (context.calendarContext.warnings.length > 0) {
    prompt += `CALENDAR WARNINGS:\n`;
    for (const warning of context.calendarContext.warnings.slice(0, 3)) {
      prompt += `- ${warning}\n`;
    }
    prompt += "\n";
  }

  if (context.watchlistAlerts.length > 0) {
    prompt += `WATCHLIST ALERTS:\n`;
    for (const alert of context.watchlistAlerts.slice(0, 3)) {
      prompt += `- ${alert.ticker}: ${alert.reason}\n`;
    }
    prompt += "\n";
  }

  if (context.positionUpdates.length > 0) {
    prompt += `POSITION STATUS:\n`;
    for (const update of context.positionUpdates.slice(0, 3)) {
      prompt += `- ${update.ticker}: ${update.status}\n`;
    }
    prompt += "\n";
  }

  prompt += `Write a concise, actionable morning summary. Focus on:
1. Overall market stance (bullish/cautious/defensive)
2. Key focus for today (watchlist opportunity or position management)
3. Any calendar events to watch

Keep it conversational and direct. No greetings or sign-offs.`;

  return prompt;
}

/**
 * Convert Briefing to Discord embed format
 */
function toBriefingEmbed(briefing: Briefing): BriefingEmbed {
  return {
    date: briefing.date,
    marketPulse: briefing.marketPulse,
    calendar: briefing.calendar.events.slice(0, 3).map(e => ({
      name: e.name,
      date: e.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      impact: e.impact,
    })),
    watchlistAlerts: briefing.watchlistAlerts.slice(0, 5).map(a => ({
      ticker: a.ticker,
      reason: a.reason,
    })),
    positionUpdates: briefing.positionUpdates.slice(0, 5).map(p => ({
      ticker: p.ticker,
      status: p.status,
    })),
    aiCommentary: briefing.aiCommentary,
  };
}

/**
 * Format briefing for CLI display
 */
export function formatBriefingForCLI(briefing: Briefing): string {
  const dateStr = briefing.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let output = `
  ☀️  VICTOR'S MORNING BRIEFING
  ${dateStr}
  ────────────────────────────────────────────────────────────────────

  📊 MARKET PULSE
  SPY: $${briefing.marketPulse.spy.price.toFixed(2)} (${briefing.marketPulse.spy.changePct >= 0 ? "+" : ""}${briefing.marketPulse.spy.changePct.toFixed(1)}%) - ${briefing.marketPulse.spy.trend}
  VIX: ${briefing.marketPulse.vix.current.toFixed(1)} (${briefing.marketPulse.vix.level})
  Regime: ${briefing.marketPulse.regime}
  ${briefing.marketPulse.summary}

`;

  if (briefing.calendar.warnings.length > 0) {
    output += `  📅 CALENDAR WARNINGS\n`;
    for (const warning of briefing.calendar.warnings) {
      output += `  ${warning}\n`;
    }
    output += "\n";
  }

  if (briefing.calendar.events.length > 0) {
    output += `  📅 UPCOMING EVENTS\n`;
    for (const event of briefing.calendar.events.slice(0, 5)) {
      const eventDate = event.date.toLocaleDateString("en-US", { 
        weekday: "short", 
        month: "short", 
        day: "numeric" 
      });
      output += `  • ${eventDate}: ${event.name} [${event.impact}]\n`;
    }
    output += "\n";
  }

  if (briefing.watchlistAlerts.length > 0) {
    output += `  🎯 WATCHLIST ALERTS\n`;
    for (const alert of briefing.watchlistAlerts) {
      const priorityIcon = alert.priority === "HIGH" ? "🔴" : 
                          alert.priority === "MEDIUM" ? "🟡" : "🟢";
      output += `  ${priorityIcon} ${alert.ticker}: ${alert.reason}\n`;
    }
    output += "\n";
  } else {
    output += `  🎯 WATCHLIST ALERTS\n  No alerts at this time.\n\n`;
  }

  if (briefing.positionUpdates.length > 0) {
    output += `  💼 POSITION CHECK\n`;
    for (const update of briefing.positionUpdates) {
      output += `  • ${update.ticker}: ${update.status}\n`;
      if (update.action) {
        output += `    → ${update.action}\n`;
      }
    }
    output += "\n";
  } else {
    output += `  💼 POSITION CHECK\n  No open positions.\n\n`;
  }

  output += `  💭 VICTOR'S TAKE
  ${briefing.aiCommentary}

  ────────────────────────────────────────────────────────────────────
`;

  return output;
}

// ============================================================================
// HELPERS
// ============================================================================

function gradeToValue(grade: string): number {
  const grades: Record<string, number> = {
    'A+': 12, 'A': 11, 'A-': 10,
    'B+': 9, 'B': 8, 'B-': 7,
    'C+': 6, 'C': 5, 'C-': 4,
    'D': 3, 'F': 1,
  };
  return grades[grade] ?? 0;
}
