/**
 * AI Review Layer
 * Uses AI to validate alerts before sending
 */

import { generateCompletion, type OllamaMode } from "../services/ollama.ts";
import type { ScanResult } from "../services/scanner.ts";
import type { MarketRegime } from "../services/market-regime.ts";
import type { Position, Alert, AlertType, AlertPriority } from "../services/supabase.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface AIReviewResult {
  approved: boolean;
  conviction: number;      // 1-10
  reasoning: string;
  adjustedPriority?: AlertPriority;
}

export interface ReviewContext {
  regime: MarketRegime;
  positions: Position[];
  recentAlerts: Alert[];
}

// ============================================================================
// AI REVIEW
// ============================================================================

/**
 * Review an alert using AI before sending
 */
export async function reviewAlert(
  scanResult: ScanResult,
  alertType: AlertType,
  context: ReviewContext,
  options?: {
    aiMode?: OllamaMode;
    aiModel?: string;
  }
): Promise<AIReviewResult> {
  const prompt = buildReviewPrompt(scanResult, alertType, context);

  try {
    const response = await generateCompletion(
      {
        mode: options?.aiMode ?? "cloud",
        model: options?.aiModel,
      },
      "You are Victor, a trading assistant reviewing alerts. Respond concisely.",
      prompt
    );

    return parseReviewResponse(response.content);
  } catch (error) {
    console.error("AI review error:", error);
    // Default to moderate approval if AI fails
    return {
      approved: true,
      conviction: 5,
      reasoning: "AI review unavailable - proceeding with default approval",
    };
  }
}

/**
 * Build the prompt for AI review
 */
function buildReviewPrompt(
  scanResult: ScanResult,
  alertType: AlertType,
  context: ReviewContext
): string {
  let prompt = `You are Victor, a trading assistant reviewing a potential alert before sending.

ALERT TYPE: ${alertType}
TICKER: ${scanResult.ticker}

SCAN RESULT:
- Price: $${scanResult.price.toFixed(2)} (${scanResult.changePct >= 0 ? "+" : ""}${scanResult.changePct.toFixed(1)}%)
- Grade: ${scanResult.grade.grade}
- Risk Score: ${scanResult.risk.score}/10
`;

  if (scanResult.grade.rsi !== undefined) {
    prompt += `- RSI: ${scanResult.grade.rsi.toFixed(0)}\n`;
  }

  if (scanResult.spread) {
    prompt += `- Spread: ${scanResult.spread.strikes} @ $${scanResult.spread.debit.toFixed(2)}\n`;
    prompt += `- Cushion: ${scanResult.spread.cushion.toFixed(1)}%\n`;
    prompt += `- DTE: ${scanResult.spread.dte}\n`;
  }

  if (scanResult.reasons.length > 0) {
    prompt += `- Reasons: ${scanResult.reasons.join(", ")}\n`;
  }

  prompt += `
MARKET CONTEXT:
- Regime: ${context.regime.regime}
- VIX: ${context.regime.vix.current} (${context.regime.vix.level})
- SPY Trend: ${context.regime.spy.trend}
- Trading Rec: ${context.regime.tradingRecommendation}

`;

  // Check if user has a position in this ticker
  const existingPosition = context.positions.find(
    p => p.ticker === scanResult.ticker
  );
  if (existingPosition) {
    prompt += `EXISTING POSITION:
- ${existingPosition.positionType}
- Strikes: $${existingPosition.longStrike}/$${existingPosition.shortStrike}
- DTE: ${existingPosition.dte}

`;
  }

  prompt += `TASK:
Evaluate this alert and provide:
1. APPROVED: true or false
2. CONVICTION: 1-10 (how confident are you this is a good alert?)
3. REASONING: Brief explanation (1-2 sentences)
4. PRIORITY: HIGH, MEDIUM, or LOW (optional adjustment)

Consider:
- Is this a legitimate trading opportunity based on the criteria?
- Does the market regime support this trade?
- Any red flags (earnings, high VIX, below MA200)?
- Would you personally want to receive this alert?

Respond in this exact format:
APPROVED: [true/false]
CONVICTION: [1-10]
REASONING: [your reasoning]
PRIORITY: [HIGH/MEDIUM/LOW or UNCHANGED]`;

  return prompt;
}

/**
 * Parse the AI response into structured result
 */
function parseReviewResponse(response: string): AIReviewResult {
  const lines = response.trim().split("\n");
  
  let approved = true;
  let conviction = 5;
  let reasoning = "";
  let adjustedPriority: AlertPriority | undefined;

  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if (lower.startsWith("approved:")) {
      const value = line.split(":")[1]?.trim().toLowerCase();
      approved = value === "true" || value === "yes";
    } else if (lower.startsWith("conviction:")) {
      const value = parseInt(line.split(":")[1]?.trim() ?? "5", 10);
      conviction = Math.min(10, Math.max(1, value));
    } else if (lower.startsWith("reasoning:")) {
      reasoning = line.split(":").slice(1).join(":").trim();
    } else if (lower.startsWith("priority:")) {
      const value = line.split(":")[1]?.trim().toUpperCase();
      if (value === "HIGH" || value === "MEDIUM" || value === "LOW") {
        adjustedPriority = value;
      }
    }
  }

  // If we couldn't find reasoning, use the whole response
  if (!reasoning && response.length > 0) {
    // Try to extract something meaningful
    const reasoningMatch = response.match(/reasoning[:\s]+(.+?)(?=priority|$)/is);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    } else {
      reasoning = "Alert reviewed by AI.";
    }
  }

  return {
    approved,
    conviction,
    reasoning,
    adjustedPriority: adjustedPriority !== undefined ? adjustedPriority : undefined,
  };
}

/**
 * Quick validation without full AI review
 * Used for position risk alerts where we want faster response
 */
export function quickValidate(
  alertType: AlertType,
  priority: AlertPriority,
  context: ReviewContext
): AIReviewResult {
  // Position risks are always approved
  if (alertType === "POSITION_RISK") {
    return {
      approved: true,
      conviction: 8,
      reasoning: "Position risk alerts are automatically approved for immediate notification.",
    };
  }

  // Earnings warnings are always approved
  if (alertType === "EARNINGS_WARNING") {
    return {
      approved: true,
      conviction: 7,
      reasoning: "Earnings warnings are automatically approved.",
    };
  }

  // High priority in risk-off market = reduce priority
  if (priority === "HIGH" && context.regime.regime === "RISK_OFF") {
    return {
      approved: true,
      conviction: 5,
      reasoning: "Risk-off regime detected - reducing conviction for entry signals.",
      adjustedPriority: "MEDIUM",
    };
  }

  // High VIX = reduce conviction
  if (context.regime.vix.level === "HIGH" || context.regime.vix.level === "EXTREME") {
    return {
      approved: true,
      conviction: 4,
      reasoning: "Elevated VIX - proceed with caution.",
      adjustedPriority: priority === "HIGH" ? "MEDIUM" : priority,
    };
  }

  // Default approval
  return {
    approved: true,
    conviction: 6,
    reasoning: "Alert meets basic criteria.",
  };
}

/**
 * Batch review multiple alerts (for efficiency)
 */
export async function batchReviewAlerts(
  alerts: { scanResult: ScanResult; alertType: AlertType }[],
  context: ReviewContext,
  options?: {
    aiMode?: OllamaMode;
    aiModel?: string;
  }
): Promise<Map<string, AIReviewResult>> {
  const results = new Map<string, AIReviewResult>();

  // For now, review each one individually
  // In the future, we could batch them into a single prompt
  for (const alert of alerts) {
    const result = await reviewAlert(
      alert.scanResult,
      alert.alertType,
      context,
      options
    );
    results.set(alert.scanResult.ticker, result);
  }

  return results;
}
