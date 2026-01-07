/**
 * Position & Spread Types
 *
 * Type definitions for user portfolio positions and option spreads.
 * Used by both frontend and lib/ai-agent for position analysis.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Position type - stock or option
 */
export type PositionType = 'stock' | 'option';

/**
 * Option type - call or put (for options only)
 */
export type OptionType = 'call' | 'put';

/**
 * Spread strategy types
 */
export type SpreadType =
  | 'call_debit_spread' // Victor's favorite: buy lower call, sell higher
  | 'call_credit_spread' // Sell lower call, buy higher
  | 'put_debit_spread' // Buy higher put, sell lower
  | 'put_credit_spread' // Sell higher put, buy lower
  | 'iron_condor' // Put credit spread + call credit spread
  | 'iron_butterfly' // Sell ATM straddle + buy OTM strangle
  | 'straddle' // Buy/sell ATM call + put
  | 'strangle' // Buy/sell OTM call + put
  | 'calendar_spread' // Same strike, different expirations
  | 'diagonal_spread' // Different strikes, different expirations
  | 'custom'; // Any other multi-leg strategy

/**
 * Leg labels for spread positions
 */
export type LegLabel = 'long_call' | 'short_call' | 'long_put' | 'short_put';

// ============================================================================
// SPREAD TYPES
// ============================================================================

/**
 * Option spread (parent for multi-leg positions)
 */
export interface Spread {
  id: string;
  user_id: string;
  symbol: string;
  spread_type: SpreadType;
  net_debit_credit: number; // Positive = debit, negative = credit
  quantity: number; // Number of spread contracts
  entry_date: string;
  expiration_date: string;
  // Risk metrics
  max_profit?: number;
  max_loss?: number;
  breakeven_lower?: number;
  breakeven_upper?: number;
  width?: number; // Strike width
  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
  // Populated by JOIN
  legs?: Position[];
}

/**
 * Spread with live market data
 */
export interface SpreadWithMarketData extends Spread {
  current_value: number; // Current spread value
  pnl: number;
  pnl_percent: number;
  days_to_expiry: number;
  theta_decay?: number; // Daily theta
  // Underlying data
  underlying_price: number;
  // Leg data
  legs: PositionWithMarketData[];
}

// ============================================================================
// POSITION TYPES
// ============================================================================

/**
 * Base position stored in database
 * Can be standalone or a leg of a spread
 */
export interface Position {
  id: string;
  user_id: string;
  spread_id?: string; // Links to parent spread (NULL for standalone)
  symbol: string;
  position_type: PositionType;
  quantity: number; // Positive = long, negative = short
  entry_price: number;
  entry_date: string;
  // Option-specific fields
  option_type?: OptionType;
  strike_price?: number;
  expiration_date?: string;
  // Spread leg identifier
  leg_label?: LegLabel;
  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Position with live market data (after refresh)
 */
export interface PositionWithMarketData extends Position {
  current_price: number;
  pnl: number;
  pnl_percent: number;
  day_change?: number;
  day_change_percent?: number;
  // For options: underlying stock price (distinct from option contract price)
  underlying_price?: number;
  // For options: bid/ask for natural spread pricing
  bid?: number;
  ask?: number;
  // Technical data for AI analysis
  rsi?: number;
  support?: number;
  resistance?: number;
  iv?: number;
  iv_level?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
}

/**
 * Portfolio summary statistics
 */
export interface PositionSummary {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions_count: number;
  spreads_count: number;
  winners: number;
  losers: number;
  best_performer?: {
    symbol: string;
    pnl_percent: number;
  };
  worst_performer?: {
    symbol: string;
    pnl_percent: number;
  };
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Create position request (standalone or as spread leg)
 */
export interface CreatePositionRequest {
  spread_id?: string; // For spread legs
  symbol: string;
  position_type: PositionType;
  quantity: number; // Positive = long, negative = short
  entry_price: number;
  entry_date: string;
  // Option-specific
  option_type?: OptionType;
  strike_price?: number;
  expiration_date?: string;
  leg_label?: LegLabel;
  notes?: string;
}

/**
 * Create spread request (with legs)
 */
export interface CreateSpreadRequest {
  symbol: string;
  spread_type: SpreadType;
  net_debit_credit: number;
  quantity: number;
  entry_date: string;
  expiration_date: string;
  // Strikes for vertical spreads (can derive legs from these)
  lower_strike?: number;
  upper_strike?: number;
  // Optional pre-calculated metrics
  max_profit?: number;
  max_loss?: number;
  breakeven_lower?: number;
  breakeven_upper?: number;
  width?: number;
  notes?: string;
  // Legs to create (optional - can be auto-generated from strikes)
  legs?: CreatePositionRequest[];
}

/**
 * Update position request
 */
export interface UpdatePositionRequest {
  quantity?: number;
  entry_price?: number;
  entry_date?: string;
  notes?: string;
}

/**
 * Update spread request
 */
export interface UpdateSpreadRequest {
  net_debit_credit?: number;
  quantity?: number;
  notes?: string;
}

/**
 * Position API response
 */
export interface PositionsResponse {
  data: Position[];
  error?: string;
}

/**
 * Spread API response
 */
export interface SpreadsResponse {
  data: Spread[];
  error?: string;
}

/**
 * Position with market data API response
 */
export interface PositionsWithMarketDataResponse {
  data: PositionWithMarketData[];
  spreads: SpreadWithMarketData[];
  summary: PositionSummary;
  error?: string;
  refreshed_at: string;
}

// ============================================================================
// AI CONTEXT TYPES
// ============================================================================

/**
 * Position context for AI analysis prompts
 */
export interface PositionAIContext {
  symbol: string;
  type: PositionType;
  entry_price: number;
  current_price: number;
  quantity: number;
  pnl_percent: number;
  days_held: number;
  // Technical indicators
  rsi?: number;
  support?: number;
  resistance?: number;
  iv?: number;
  iv_level?: string;
  // Option details
  option_type?: OptionType;
  strike_price?: number;
  days_to_expiry?: number;
}

/**
 * Spread context for AI analysis
 */
export interface SpreadAIContext {
  symbol: string;
  spread_type: SpreadType;
  // Entry
  net_debit_credit: number;
  quantity: number;
  entry_date: string;
  // Current
  current_value: number;
  pnl: number;
  pnl_percent: number;
  // Risk
  max_profit: number;
  max_loss: number;
  breakeven_lower?: number;
  breakeven_upper?: number;
  // Time
  days_to_expiry: number;
  // Position relative to underlying
  underlying_price: number;
  distance_to_short_strike?: number; // % away from danger
  // Legs summary
  legs: {
    leg_label: string;
    strike: number;
    current_price: number;
  }[];
}

/**
 * Portfolio AI context for overall analysis
 */
export interface PortfolioAIContext {
  positions: PositionAIContext[];
  spreads: SpreadAIContext[];
  summary: PositionSummary;
  // Risk metrics
  concentration?: {
    largest_position_percent: number;
    top_3_percent: number;
  };
  sector_exposure?: Record<string, number>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate spread metrics from legs
 */
export function calculateSpreadMetrics(
  spreadType: SpreadType,
  legs: { strike_price: number; entry_price: number; quantity: number }[]
): {
  width: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
} {
  // Sort legs by strike
  const sorted = [...legs].sort((a, b) => a.strike_price - b.strike_price);

  if (spreadType === 'call_debit_spread' && sorted.length === 2) {
    // Long lower strike, short higher strike
    const longLeg = sorted[0]; // Lower strike (long)
    const shortLeg = sorted[1]; // Higher strike (short)
    const width = shortLeg.strike_price - longLeg.strike_price;
    const netDebit = longLeg.entry_price - shortLeg.entry_price;

    return {
      width,
      maxProfit: (width - netDebit) * 100, // Per contract
      maxLoss: netDebit * 100,
      breakeven: longLeg.strike_price + netDebit,
    };
  }

  if (spreadType === 'put_credit_spread' && sorted.length === 2) {
    // Short higher strike, long lower strike
    const longLeg = sorted[0]; // Lower strike (long)
    const shortLeg = sorted[1]; // Higher strike (short)
    const width = shortLeg.strike_price - longLeg.strike_price;
    const netCredit = shortLeg.entry_price - longLeg.entry_price;

    return {
      width,
      maxProfit: netCredit * 100,
      maxLoss: (width - netCredit) * 100,
      breakeven: shortLeg.strike_price - netCredit,
    };
  }

  // Default for other spread types
  const width =
    sorted.length >= 2
      ? sorted[sorted.length - 1].strike_price - sorted[0].strike_price
      : 0;
  const netCost = legs.reduce(
    (sum, leg) => sum + leg.entry_price * leg.quantity,
    0
  );

  return {
    width,
    maxProfit: width * 100 - Math.abs(netCost) * 100,
    maxLoss: Math.abs(netCost) * 100,
    breakeven: sorted[0]?.strike_price ?? 0,
  };
}

/**
 * Get human-readable spread type name
 */
export function getSpreadTypeName(type: SpreadType): string {
  const names: Record<SpreadType, string> = {
    call_debit_spread: 'Call Debit Spread',
    call_credit_spread: 'Call Credit Spread',
    put_debit_spread: 'Put Debit Spread',
    put_credit_spread: 'Put Credit Spread',
    iron_condor: 'Iron Condor',
    iron_butterfly: 'Iron Butterfly',
    straddle: 'Straddle',
    strangle: 'Strangle',
    calendar_spread: 'Calendar Spread',
    diagonal_spread: 'Diagonal Spread',
    custom: 'Custom Spread',
  };
  return names[type] || type;
}
