/**
 * Strategy Selector
 * AI-assisted strategy selection based on market conditions,
 * account size, and historical performance
 */

import type { 
  StrategyType, 
  StrategyRecommendation, 
  MarketRegime,
  TickerHistory,
  FairValueResult 
} from "../types/index.ts";

// ============================================================================
// STRATEGY DEFINITIONS
// ============================================================================

interface StrategyProfile {
  type: StrategyType;
  name: string;
  description: string;
  minAccountSize: number;
  minPrice: number;       // Minimum stock price for this strategy
  maxPrice: number;       // Maximum practical stock price
  idealRegimes: MarketRegime[];
  winRateExpected: number; // Expected win rate (0-100)
  riskLevel: "low" | "medium" | "high";
}

const STRATEGIES: StrategyProfile[] = [
  {
    type: "deep_itm_cds",
    name: "Deep ITM Call Debit Spread",
    description: "Buy deep ITM call, sell ATM call. High probability, defined risk.",
    minAccountSize: 300,
    minPrice: 20,
    maxPrice: 500,
    idealRegimes: ["bull", "neutral"],
    winRateExpected: 70,
    riskLevel: "low",
  },
  {
    type: "put_credit_spread",
    name: "Put Credit Spread",
    description: "Sell OTM put, buy further OTM put. Collect premium, bullish bet.",
    minAccountSize: 500,
    minPrice: 30,
    maxPrice: 300,
    idealRegimes: ["bull"],
    winRateExpected: 65,
    riskLevel: "medium",
  },
  {
    type: "cash_secured_put",
    name: "Cash Secured Put",
    description: "Sell put with cash to buy shares. Income + potential ownership.",
    minAccountSize: 1000,
    minPrice: 10,
    maxPrice: 50,
    idealRegimes: ["bull", "neutral"],
    winRateExpected: 75,
    riskLevel: "medium",
  },
  {
    type: "stock_purchase",
    name: "Stock Purchase",
    description: "Direct stock ownership. Simple, no expiration risk.",
    minAccountSize: 100,
    minPrice: 1,
    maxPrice: 100,
    idealRegimes: ["bull", "neutral", "bear"],
    winRateExpected: 55,
    riskLevel: "medium",
  },
];

// ============================================================================
// SELECTION INPUTS
// ============================================================================

export interface StrategySelectionInput {
  ticker: string;
  currentPrice: number;
  accountSize: number;
  marketRegime: MarketRegime;
  
  // Technical context
  score?: number;
  rsiValue?: number;
  aboveMA200?: boolean;
  
  // Valuation context
  fairValue?: FairValueResult;
  
  // History context
  history?: TickerHistory;
  
  // Options context (if available)
  hasOptions?: boolean;
  nearestExpiration?: Date;
  spreadCandidates?: Array<{
    longStrike: number;
    shortStrike: number;
    expiration: Date;
    netDebit: number;
    maxProfit: number;
    breakeven: number;
    cushionPct: number;
  }>;
}

// ============================================================================
// STRATEGY SCORING
// ============================================================================

interface ScoredStrategy {
  profile: StrategyProfile;
  score: number;
  reasoning: string[];
  confidence: number;
}

/**
 * Score a strategy based on current conditions
 */
function scoreStrategy(
  profile: StrategyProfile,
  input: StrategySelectionInput
): ScoredStrategy {
  let score = 50; // Base score
  const reasoning: string[] = [];

  // 1. Account size check
  if (input.accountSize < profile.minAccountSize) {
    score -= 100; // Disqualify
    reasoning.push(`Account too small (need $${profile.minAccountSize}+)`);
  }

  // 2. Price range check
  if (input.currentPrice < profile.minPrice) {
    score -= 30;
    reasoning.push(`Price too low for ${profile.name}`);
  }
  if (input.currentPrice > profile.maxPrice) {
    score -= 20;
    reasoning.push(`Price on higher end for ${profile.name}`);
  }

  // 3. Market regime alignment
  if (profile.idealRegimes.includes(input.marketRegime)) {
    score += 20;
    reasoning.push(`${input.marketRegime} market favors this strategy`);
  } else {
    score -= 15;
    reasoning.push(`${input.marketRegime} market not ideal`);
  }

  // 4. Stock score bonus
  if (input.score !== undefined) {
    if (input.score >= 80) {
      score += 15;
      reasoning.push(`Strong stock score (${input.score})`);
    } else if (input.score >= 60) {
      score += 5;
    } else if (input.score < 50) {
      score -= 10;
      reasoning.push(`Weak stock score (${input.score})`);
    }
  }

  // 5. Historical performance with this strategy
  if (input.history && input.history.totalTrades >= 3) {
    const typeWins = input.history.recentTrades.filter(
      t => t.outcome === "win" || t.outcome === "max_profit"
    );
    const typeTrades = input.history.recentTrades.filter(
      t => getStrategyTypeFromTradeType(t.tradeType) === profile.type
    );
    
    if (typeTrades.length >= 2) {
      const typeWinRate = typeWins.length / typeTrades.length;
      if (typeWinRate >= 0.7) {
        score += 15;
        reasoning.push(`You have ${Math.round(typeWinRate * 100)}% win rate with this strategy`);
      } else if (typeWinRate < 0.4) {
        score -= 10;
        reasoning.push(`Lower win rate with this strategy historically`);
      }
    }
  }

  // 6. Valuation bonus for certain strategies
  if (input.fairValue) {
    if (profile.type === "stock_purchase" && input.fairValue.verdict === "undervalued") {
      score += 15;
      reasoning.push("Stock appears undervalued - good for ownership");
    }
    if (profile.type === "cash_secured_put" && input.fairValue.verdict === "undervalued") {
      score += 10;
      reasoning.push("Would be happy to own at lower price");
    }
  }

  // 7. RSI context
  if (input.rsiValue !== undefined) {
    if (profile.type === "deep_itm_cds" && input.rsiValue < 50) {
      score += 10;
      reasoning.push("RSI favorable for bullish spread");
    }
    if (profile.type === "put_credit_spread" && input.rsiValue > 60) {
      score -= 10;
      reasoning.push("RSI elevated - wait for pullback");
    }
  }

  // 8. Options availability
  if (!input.hasOptions && profile.type !== "stock_purchase") {
    score -= 50;
    reasoning.push("Options not available");
  }

  // 9. Spread candidates bonus
  if (input.spreadCandidates && input.spreadCandidates.length > 0) {
    if (profile.type === "deep_itm_cds") {
      const bestSpread = input.spreadCandidates[0];
      if (bestSpread.cushionPct >= 5) {
        score += 10;
        reasoning.push(`Good spread available (${bestSpread.cushionPct.toFixed(1)}% cushion)`);
      }
    }
  }

  // Calculate confidence (normalized score)
  const confidence = Math.max(0, Math.min(100, score));

  return {
    profile,
    score,
    reasoning,
    confidence,
  };
}

function getStrategyTypeFromTradeType(tradeType: string): StrategyType {
  switch (tradeType) {
    case "call_debit":
      return "deep_itm_cds";
    case "put_credit":
      return "put_credit_spread";
    case "put_debit":
      return "wait"; // Bear strategy
    case "call_credit":
      return "wait"; // Bear strategy
    default:
      return "stock_purchase";
  }
}

// ============================================================================
// MAIN SELECTOR
// ============================================================================

/**
 * Select the best strategy for current conditions
 */
export function selectStrategy(
  input: StrategySelectionInput
): { primary: StrategyRecommendation; alternatives: StrategyRecommendation[] } {
  // Score all strategies
  const scored = STRATEGIES.map(profile => scoreStrategy(profile, input));
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Convert to recommendations
  const recommendations = scored.map(s => buildRecommendation(s, input));
  
  // Primary = highest scoring that's viable (score > 0)
  const viable = recommendations.filter(r => r.confidence > 30);
  
  if (viable.length === 0) {
    // No good strategies - recommend waiting
    return {
      primary: {
        type: "wait",
        name: "Wait for Better Setup",
        description: "Current conditions don't favor any strategy",
        reasoning: ["Account size or market conditions not favorable"],
        confidence: 0,
        riskAmount: 0,
        positionSize: 0,
      },
      alternatives: [],
    };
  }
  
  return {
    primary: viable[0],
    alternatives: viable.slice(1, 3), // Top 2 alternatives
  };
}

/**
 * Build a strategy recommendation from scored strategy
 */
function buildRecommendation(
  scored: ScoredStrategy,
  input: StrategySelectionInput
): StrategyRecommendation {
  const { profile, reasoning, confidence } = scored;
  
  // Calculate position sizing (max 20% of account per position)
  const maxRisk = input.accountSize * 0.20;
  
  // Calculate actual risk based on strategy
  let riskAmount: number;
  let spread: StrategyRecommendation["spread"];
  
  if (profile.type === "deep_itm_cds" && input.spreadCandidates?.[0]) {
    const candidate = input.spreadCandidates[0];
    riskAmount = Math.min(candidate.netDebit * 100, maxRisk);
    spread = {
      longStrike: candidate.longStrike,
      shortStrike: candidate.shortStrike,
      expiration: candidate.expiration,
      netDebit: candidate.netDebit,
      maxProfit: candidate.maxProfit,
      breakeven: candidate.breakeven,
      cushionPct: candidate.cushionPct,
    };
  } else if (profile.type === "stock_purchase") {
    // Buy shares worth up to maxRisk
    riskAmount = Math.min(input.currentPrice, maxRisk);
  } else {
    // Default spread risk estimation
    riskAmount = Math.min(input.currentPrice * 0.05 * 100, maxRisk);
  }
  
  const positionSize = (riskAmount / input.accountSize) * 100;
  
  return {
    type: profile.type,
    name: profile.name,
    description: profile.description,
    reasoning,
    spread,
    confidence,
    riskAmount,
    positionSize,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format strategy recommendation for display
 */
export function formatStrategyForDisplay(
  rec: StrategyRecommendation
): string[] {
  const lines: string[] = [];
  
  // Strategy name and type
  const confidence = rec.confidence >= 70 ? "✅" : 
                     rec.confidence >= 50 ? "⚠️" : "❌";
  lines.push(`${confidence} ${rec.name}`);
  
  // Spread details if available
  if (rec.spread) {
    const expDate = rec.spread.expiration.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    lines.push(
      `   Buy $${rec.spread.longStrike}C / Sell $${rec.spread.shortStrike}C (${expDate})`
    );
    lines.push(
      `   Cost: $${(rec.spread.netDebit * 100).toFixed(0)} | ` +
      `Max Profit: $${(rec.spread.maxProfit * 100).toFixed(0)} | ` +
      `Cushion: ${rec.spread.cushionPct.toFixed(1)}%`
    );
  }
  
  // Key reasoning (first 2)
  for (const reason of rec.reasoning.slice(0, 2)) {
    lines.push(`   ${reason}`);
  }
  
  return lines;
}

/**
 * Get strategy emoji
 */
export function getStrategyEmoji(type: StrategyType): string {
  switch (type) {
    case "deep_itm_cds":
      return "📈";
    case "put_credit_spread":
      return "💰";
    case "cash_secured_put":
      return "🏦";
    case "stock_purchase":
      return "📊";
    case "wait":
      return "⏳";
  }
}

