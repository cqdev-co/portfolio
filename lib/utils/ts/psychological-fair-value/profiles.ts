/**
 * Ticker Profile Definitions
 * 
 * Different stock types have different psychological profiles
 * affecting how price responds to various factors.
 */

import type { 
  TickerProfile, 
  TickerProfileType, 
  ProfileWeights,
  TechnicalData,
  OptionsExpiration,
} from './types';

// ============================================================================
// PROFILE DEFINITIONS
// ============================================================================

export const PROFILES: Record<TickerProfileType, TickerProfile> = {
  BLUE_CHIP: {
    type: 'BLUE_CHIP',
    name: 'Blue Chip',
    description: 'Large-cap institutional stocks (AAPL, MSFT, GOOGL)',
    weights: {
      maxPain: 0.25,
      gammaWalls: 0.10,
      technical: 0.30,
      volume: 0.25,
      roundNumber: 0.10,
    },
    characteristics: [
      'Institutional-driven price action',
      'VWAP and MA levels highly respected',
      'Options mechanics moderate influence',
      'Round numbers less impactful due to algo trading',
    ],
  },

  MEME_RETAIL: {
    type: 'MEME_RETAIL',
    name: 'Meme / High Retail',
    description: 'Retail-driven stocks (GME, AMC, PLTR, RIVN)',
    weights: {
      maxPain: 0.20,
      gammaWalls: 0.25,
      technical: 0.15,
      volume: 0.15,
      roundNumber: 0.25,
    },
    characteristics: [
      'Retail sentiment drives price',
      'Round numbers are VERY significant',
      'Gamma squeezes common',
      'Technical levels often ignored in frenzies',
    ],
  },

  ETF: {
    type: 'ETF',
    name: 'ETF',
    description: 'Index ETFs with massive options volume (SPY, QQQ, IWM)',
    weights: {
      maxPain: 0.35,
      gammaWalls: 0.10,
      technical: 0.25,
      volume: 0.20,
      roundNumber: 0.10,
    },
    characteristics: [
      'Massive options volume makes max pain reliable',
      'Institutional OPEX pinning is well-documented',
      'Round numbers at major levels ($500, $450)',
      'Highly efficient market',
    ],
  },

  LOW_FLOAT: {
    type: 'LOW_FLOAT',
    name: 'Low Float / Squeeze Candidate',
    description: 'Small float stocks prone to gamma squeezes',
    weights: {
      maxPain: 0.20,
      gammaWalls: 0.30,
      technical: 0.20,
      volume: 0.15,
      roundNumber: 0.15,
    },
    characteristics: [
      'Gamma effects are EXAGGERATED',
      'Can overshoot all levels during squeeze',
      'Use PFV as gravitational center post-squeeze',
      'High volatility expected',
    ],
  },

  DEFAULT: {
    type: 'DEFAULT',
    name: 'Standard',
    description: 'Balanced approach for unknown ticker types',
    weights: {
      maxPain: 0.30,
      gammaWalls: 0.10,
      technical: 0.25,
      volume: 0.20,
      roundNumber: 0.15,
    },
    characteristics: [
      'Balanced weighting across all factors',
      'Good starting point for analysis',
      'May need adjustment based on behavior',
    ],
  },
};

// ============================================================================
// KNOWN TICKER LISTS
// ============================================================================

const KNOWN_MEME_TICKERS = new Set([
  // Classic meme stocks
  'GME', 'AMC', 'BB', 'BBBY', 'KOSS', 'EXPR',
  // High retail interest
  'PLTR', 'RIVN', 'LCID', 'NIO', 'SOFI', 'WISH',
  'CLOV', 'SPCE', 'HOOD', 'DKNG', 'RBLX',
  // Crypto-adjacent
  'COIN', 'MSTR', 'RIOT', 'MARA', 'HUT', 'BITF',
]);

const KNOWN_ETF_TICKERS = new Set([
  // Major index ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI',
  // Sector ETFs
  'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU', 'XLP', 'XLY',
  // Leveraged ETFs
  'TQQQ', 'SQQQ', 'SPXL', 'SPXS', 'UVXY', 'VXX',
  // Bond ETFs
  'TLT', 'HYG', 'LQD', 'AGG',
  // International
  'EEM', 'EFA', 'FXI', 'EWZ',
]);

const KNOWN_BLUE_CHIP_TICKERS = new Set([
  // Mega cap tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA',
  // Large cap tech
  'TSLA', 'AMD', 'NFLX', 'CRM', 'ORCL', 'ADBE', 'INTC',
  'CSCO', 'QCOM', 'AVGO', 'TXN',
  // Finance
  'JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP', 'WFC', 'C',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT',
  // Consumer
  'WMT', 'COST', 'HD', 'TGT', 'NKE', 'SBUX', 'MCD', 'PG',
  // Industrial
  'BA', 'CAT', 'DE', 'UPS', 'FDX', 'HON', 'GE', 'MMM',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'OXY',
]);

// ============================================================================
// PROFILE DETECTION
// ============================================================================

/**
 * Detect ticker profile based on symbol and market data
 */
export function detectProfile(
  ticker: string,
  technicalData?: TechnicalData,
  expirations?: OptionsExpiration[]
): TickerProfile {
  const upperTicker = ticker.toUpperCase();

  // 1. Check known lists first
  if (KNOWN_ETF_TICKERS.has(upperTicker)) {
    return PROFILES.ETF;
  }

  if (KNOWN_MEME_TICKERS.has(upperTicker)) {
    return PROFILES.MEME_RETAIL;
  }

  if (KNOWN_BLUE_CHIP_TICKERS.has(upperTicker)) {
    return PROFILES.BLUE_CHIP;
  }

  // 2. Heuristic detection based on data
  if (technicalData && expirations && expirations.length > 0) {
    const profile = detectProfileFromData(technicalData, expirations);
    if (profile) return profile;
  }

  // 3. Default
  return PROFILES.DEFAULT;
}

/**
 * Heuristic profile detection from market data
 */
function detectProfileFromData(
  technical: TechnicalData,
  expirations: OptionsExpiration[]
): TickerProfile | null {
  const price = technical.currentPrice;
  
  // Calculate total options OI
  const totalOI = expirations.reduce((sum, exp) => 
    sum + exp.totalCallOI + exp.totalPutOI, 0
  );

  // Calculate price volatility proxy (52w range / price)
  const range = technical.fiftyTwoWeekHigh - technical.fiftyTwoWeekLow;
  const volatilityProxy = range / price;

  // High OI relative to likely market cap = likely ETF or popular stock
  // This is a rough heuristic
  
  // Very high volatility + moderate OI = likely meme/retail
  if (volatilityProxy > 1.5) {
    return PROFILES.MEME_RETAIL;
  }

  // Low price + high volatility = potential low float
  if (price < 20 && volatilityProxy > 1.0) {
    return PROFILES.LOW_FLOAT;
  }

  // High price + low volatility + high OI = likely blue chip
  if (price > 100 && volatilityProxy < 0.5 && totalOI > 100000) {
    return PROFILES.BLUE_CHIP;
  }

  return null;
}

/**
 * Get profile by type
 */
export function getProfile(type: TickerProfileType): TickerProfile {
  return PROFILES[type];
}

/**
 * Create custom profile with adjusted weights
 */
export function createCustomProfile(
  baseType: TickerProfileType,
  customWeights: Partial<ProfileWeights>,
  name?: string
): TickerProfile {
  const base = PROFILES[baseType];
  
  return {
    ...base,
    name: name || `Custom (${base.name})`,
    weights: {
      ...base.weights,
      ...customWeights,
    },
  };
}

/**
 * Validate that weights sum to 1.0
 */
export function validateWeights(weights: ProfileWeights): boolean {
  const sum = 
    weights.maxPain + 
    weights.gammaWalls + 
    weights.technical + 
    weights.volume + 
    weights.roundNumber;
  
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: ProfileWeights): ProfileWeights {
  const sum = 
    weights.maxPain + 
    weights.gammaWalls + 
    weights.technical + 
    weights.volume + 
    weights.roundNumber;

  if (sum === 0) {
    // Return equal weights if all zero
    return {
      maxPain: 0.20,
      gammaWalls: 0.20,
      technical: 0.20,
      volume: 0.20,
      roundNumber: 0.20,
    };
  }

  return {
    maxPain: weights.maxPain / sum,
    gammaWalls: weights.gammaWalls / sum,
    technical: weights.technical / sum,
    volume: weights.volume / sum,
    roundNumber: weights.roundNumber / sum,
  };
}

