/**
 * Positions API Client
 *
 * Client-side functions for interacting with the positions API.
 */

import { supabase } from '@/lib/supabase';
import type {
  Position,
  Spread,
  PositionWithMarketData,
  PositionSummary,
  CreatePositionRequest,
  CreateSpreadRequest,
  UpdatePositionRequest,
  PositionsResponse,
  PositionsWithMarketDataResponse,
} from '@/../../../lib/types/positions';

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return `Bearer ${session.access_token}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Fetch all positions for the current user
 */
export async function fetchPositions(): Promise<PositionsResponse> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { data: [], error: 'Not authenticated' };
  }

  const response = await fetch('/api/positions', {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    const error = await response.json();
    return { data: [], error: error.error || 'Failed to fetch positions' };
  }

  return response.json();
}

/**
 * Create a new position
 */
export async function createPosition(
  position: CreatePositionRequest
): Promise<{ data?: Position; error?: string }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { error: 'Not authenticated' };
  }

  const response = await fetch('/api/positions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(position),
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error || 'Failed to create position' };
  }

  const result = await response.json();
  return { data: result.data };
}

/**
 * Update an existing position
 */
export async function updatePosition(
  id: string,
  updates: UpdatePositionRequest
): Promise<{ data?: Position; error?: string }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { error: 'Not authenticated' };
  }

  const response = await fetch(`/api/positions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error || 'Failed to update position' };
  }

  const result = await response.json();
  return { data: result.data };
}

/**
 * Delete a position
 */
export async function deletePosition(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { error: 'Not authenticated' };
  }

  const response = await fetch(`/api/positions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error || 'Failed to delete position' };
  }

  return { success: true };
}

/**
 * Create a new spread position
 */
export async function createSpread(
  spread: CreateSpreadRequest
): Promise<{ data?: Spread; error?: string }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetch('/api/positions/spreads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(spread),
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error JSON, fall back to status text
      try {
        const error = await response.json();
        return { error: error.error || 'Failed to create spread' };
      } catch {
        return { error: `Failed to create spread (${response.status})` };
      }
    }

    const result = await response.json();
    return { data: result.data };
  } catch (err) {
    console.error('[createSpread] Error:', err);
    return { error: 'Network error - please try again' };
  }
}

/**
 * Delete a spread and its legs
 */
export async function deleteSpread(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`/api/positions/spreads/${id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        return { error: error.error || 'Failed to delete spread' };
      } catch {
        return { error: `Failed to delete spread (${response.status})` };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[deleteSpread] Error:', err);
    return { error: 'Network error - please try again' };
  }
}

// ============================================================================
// Market Data & Calculations
// ============================================================================

/**
 * Spread data for summary calculation
 */
export interface SpreadSummaryData {
  id: string;
  symbol: string;
  netEntryPrice: number; // Net debit/credit per spread
  netCurrentPrice: number; // Current value per spread
  quantity: number; // Number of spread contracts
}

/**
 * Calculate P&L and summary from positions with market data
 * Includes both standalone positions AND spreads
 */
export function calculatePositionSummary(
  positions: PositionWithMarketData[],
  spreads: SpreadSummaryData[] = []
): PositionSummary {
  // Separate standalone positions from spread legs
  const standalonePositions = positions.filter((p) => !p.spread_id);

  if (standalonePositions.length === 0 && spreads.length === 0) {
    return {
      total_value: 0,
      total_cost: 0,
      total_pnl: 0,
      total_pnl_percent: 0,
      positions_count: 0,
      spreads_count: 0,
      winners: 0,
      losers: 0,
    };
  }

  let totalValue = 0;
  let totalCost = 0;
  let winners = 0;
  let losers = 0;
  let bestPerformer = { symbol: '', pnl_percent: -Infinity };
  let worstPerformer = { symbol: '', pnl_percent: Infinity };

  // Calculate standalone positions
  for (const pos of standalonePositions) {
    const absQty = Math.abs(pos.quantity);
    const value = pos.current_price * absQty;
    const cost = pos.entry_price * absQty;

    if (pos.quantity > 0) {
      totalValue += value;
      totalCost += cost;
    } else {
      totalValue += cost - (value - cost);
      totalCost += cost;
    }

    if (pos.pnl >= 0) winners++;
    else losers++;

    if (pos.pnl_percent > bestPerformer.pnl_percent) {
      bestPerformer = { symbol: pos.symbol, pnl_percent: pos.pnl_percent };
    }
    if (pos.pnl_percent < worstPerformer.pnl_percent) {
      worstPerformer = { symbol: pos.symbol, pnl_percent: pos.pnl_percent };
    }
  }

  // Calculate spread values (options: multiply by 100)
  for (const spread of spreads) {
    const cost = spread.netEntryPrice * spread.quantity * 100;
    const value = spread.netCurrentPrice * spread.quantity * 100;
    totalCost += cost;
    totalValue += value;

    const pnl = value - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

    if (pnl >= 0) winners++;
    else losers++;

    if (pnlPercent > bestPerformer.pnl_percent) {
      bestPerformer = { symbol: spread.symbol, pnl_percent: pnlPercent };
    }
    if (pnlPercent < worstPerformer.pnl_percent) {
      worstPerformer = { symbol: spread.symbol, pnl_percent: pnlPercent };
    }
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent =
    totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  return {
    total_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_pnl: Math.round(totalPnl * 100) / 100,
    total_pnl_percent: Math.round(totalPnlPercent * 100) / 100,
    positions_count: standalonePositions.length,
    spreads_count: spreads.length,
    winners,
    losers,
    best_performer: bestPerformer.symbol ? bestPerformer : undefined,
    worst_performer: worstPerformer.symbol ? worstPerformer : undefined,
  };
}

/**
 * Option contract request for fetching prices
 */
interface OptionContractRequest {
  symbol: string;
  strike: number;
  expiration: string;
  type: 'call' | 'put';
}

/**
 * Option contract price response
 */
interface OptionContractPrice {
  symbol: string;
  strike: number;
  expiration: string;
  type: 'call' | 'put';
  price: number | null;
  bid: number | null;
  ask: number | null;
  iv: number | null;
  error?: string;
}

/**
 * Calculate intrinsic value for an option
 * Call: max(0, underlying - strike)
 * Put: max(0, strike - underlying)
 */
function calculateIntrinsicValue(
  underlyingPrice: number,
  strike: number,
  optionType: 'call' | 'put'
): number {
  if (optionType === 'call') {
    return Math.max(0, underlyingPrice - strike);
  } else {
    return Math.max(0, strike - underlyingPrice);
  }
}

/**
 * Fetch actual option contract prices from the options chain
 */
async function fetchOptionPrices(
  contracts: OptionContractRequest[]
): Promise<Map<string, OptionContractPrice>> {
  const priceMap = new Map<string, OptionContractPrice>();

  if (contracts.length === 0) return priceMap;

  try {
    const contractsJson = JSON.stringify(contracts);
    console.log(
      '[Options] Fetching prices for:',
      contracts
        .map((c) => `${c.symbol} ${c.strike} ${c.type} ${c.expiration}`)
        .join(', ')
    );

    const response = await fetch(
      `/api/positions/options-prices?contracts=${encodeURIComponent(contractsJson)}`
    );

    if (!response.ok) {
      console.error('[Options] Price fetch failed:', response.status);
      return priceMap;
    }

    const data = await response.json();
    console.log(
      '[Options] API response:',
      JSON.stringify(data).substring(0, 500)
    );

    for (const contract of data.contracts || []) {
      const key = `${contract.symbol}:${contract.strike}:${contract.type}`;
      priceMap.set(key, contract);
      console.log(
        `[Options] ${key}: price=${contract.price}, bid=${contract.bid}, ask=${contract.ask}, error=${contract.error}`
      );
    }

    return priceMap;
  } catch (error) {
    console.error('[Options] Error fetching prices:', error);
    return priceMap;
  }
}

/**
 * Refresh positions with live market data
 * - Stocks: fetches current stock prices
 * - Options/Spreads: fetches actual option contract prices from options chain
 */
export async function refreshPositionsWithMarketData(
  positions: Position[]
): Promise<PositionsWithMarketDataResponse> {
  console.log(
    '[Positions] Starting refresh with',
    positions.length,
    'positions'
  );

  if (positions.length === 0) {
    return {
      data: [],
      spreads: [],
      summary: calculatePositionSummary([]),
      refreshed_at: new Date().toISOString(),
    };
  }

  // Separate stock positions from options for different pricing strategies
  const stockPositions = positions.filter(
    (p) => p.position_type === 'stock' && !p.spread_id
  );
  const optionPositions = positions.filter((p) => p.position_type === 'option');

  const stockSymbols = [...new Set(stockPositions.map((p) => p.symbol))];
  const optionSymbols = [...new Set(optionPositions.map((p) => p.symbol))];

  console.log('[Positions] Stock symbols:', stockSymbols);
  console.log('[Positions] Option contracts:', optionPositions.length);

  // Combine all symbols for underlying prices
  const allSymbols = [...new Set([...stockSymbols, ...optionSymbols])];

  if (allSymbols.length === 0) {
    console.log('[Positions] No symbols to fetch prices for');
    return {
      data: positions.map((p) => ({
        ...p,
        current_price: p.entry_price,
        pnl: 0,
        pnl_percent: 0,
      })),
      spreads: [],
      summary: calculatePositionSummary([]),
      refreshed_at: new Date().toISOString(),
    };
  }

  try {
    // 1. Fetch stock/underlying prices
    console.log('[Positions] Fetching stock prices for:', allSymbols.join(','));
    const priceResponse = await fetch(
      `/api/positions/prices?symbols=${allSymbols.join(',')}`
    );

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error(
        '[Positions] Price fetch failed:',
        priceResponse.status,
        errorText
      );
      return {
        data: positions.map((p) => ({
          ...p,
          current_price: p.entry_price,
          pnl: 0,
          pnl_percent: 0,
        })),
        spreads: [],
        summary: calculatePositionSummary([]),
        error: `Failed to fetch market data (${priceResponse.status})`,
        refreshed_at: new Date().toISOString(),
      };
    }

    const priceData = await priceResponse.json();
    console.log('[Positions] Stock price data received');

    // Build stock price map
    const stockPriceMap = new Map<
      string,
      {
        price: number;
        change: number;
        changePct: number;
      }
    >();

    for (const item of priceData.prices || []) {
      if (item.price > 0) {
        stockPriceMap.set(item.symbol, {
          price: item.price,
          change: item.change,
          changePct: item.changePct,
        });
        console.log(`[Positions] ${item.symbol}: $${item.price}`);
      } else if (item.error) {
        console.warn(`[Positions] ${item.symbol} error:`, item.error);
      }
    }

    // 2. Fetch option contract prices for options positions
    const optionContractRequests: OptionContractRequest[] = optionPositions
      .filter((p) => p.strike_price && p.expiration_date && p.option_type)
      .map((p) => ({
        symbol: p.symbol,
        strike: p.strike_price!,
        expiration: p.expiration_date!.split('T')[0], // YYYY-MM-DD
        type: p.option_type!,
      }));

    console.log(
      '[Positions] Fetching',
      optionContractRequests.length,
      'option contracts'
    );
    const optionPriceMap = await fetchOptionPrices(optionContractRequests);
    console.log('[Positions] Got', optionPriceMap.size, 'option prices');

    // Enrich positions with market data
    const enrichedPositions: PositionWithMarketData[] = positions.map((pos) => {
      const isStock = pos.position_type === 'stock';
      const stockData = stockPriceMap.get(pos.symbol);

      let currentPrice = pos.entry_price;
      let optionBid: number | undefined;
      let optionAsk: number | undefined;

      if (isStock) {
        // Stock: use live market price
        if (stockData?.price) {
          currentPrice = stockData.price;
        }
      } else {
        // Option: try to get real option price from options chain
        const optionKey = `${pos.symbol}:${pos.strike_price}:${pos.option_type}`;
        const optionData = optionPriceMap.get(optionKey);

        // Store bid/ask for spread natural pricing (convert null to undefined)
        if (optionData) {
          optionBid = optionData.bid ?? undefined;
          optionAsk = optionData.ask ?? undefined;

          const hasBidAsk =
            optionData.bid &&
            optionData.bid > 0 &&
            optionData.ask &&
            optionData.ask > 0;

          if (hasBidAsk) {
            // Best case: use bid/ask mid (live market data)
            currentPrice = (optionData.bid! + optionData.ask!) / 2;
            console.log(
              `[Positions] ${optionKey}: mid=$${currentPrice.toFixed(2)} ` +
                `bid=$${optionBid} ask=$${optionAsk}`
            );
          } else if (optionData.price && optionData.price > 0) {
            // Use lastPrice from chain - this includes time value
            currentPrice = optionData.price;
            console.log(
              `[Positions] ${optionKey}: $${currentPrice.toFixed(2)} (lastPrice)`
            );
          } else {
            // Chain returned but no usable price - intrinsic fallback
            if (stockData?.price && pos.strike_price && pos.option_type) {
              const intrinsicValue = calculateIntrinsicValue(
                stockData.price,
                pos.strike_price,
                pos.option_type
              );
              if (intrinsicValue > 0) {
                currentPrice = intrinsicValue;
                console.log(
                  `[Positions] ${optionKey}: $${currentPrice.toFixed(2)} (intrinsic)`
                );
              }
            }
          }
        } else if (stockData?.price && pos.strike_price && pos.option_type) {
          // No chain data at all - intrinsic value fallback
          const intrinsicValue = calculateIntrinsicValue(
            stockData.price,
            pos.strike_price,
            pos.option_type
          );
          if (intrinsicValue > 0) {
            currentPrice = intrinsicValue;
            console.log(
              `[Positions] ${optionKey}: $${currentPrice.toFixed(2)} (intrinsic fallback)`
            );
          } else {
            console.log(`[Positions] ${optionKey}: using entry (OTM, no data)`);
          }
        } else {
          console.log(`[Positions] ${optionKey}: using entry (no data)`);
        }
      }

      // Calculate P&L (handle both long and short positions)
      // For options: qty represents contracts, multiply by 100 for shares
      const multiplier = isStock ? 1 : 100;
      const isLong = pos.quantity > 0;
      const priceDiff = currentPrice - pos.entry_price;
      const pnl = priceDiff * pos.quantity * multiplier;
      const pnlPercent =
        pos.entry_price > 0
          ? (priceDiff / pos.entry_price) * 100 * (isLong ? 1 : -1)
          : 0;

      return {
        ...pos,
        current_price: currentPrice,
        pnl: Math.round(pnl * 100) / 100,
        pnl_percent: Math.round(pnlPercent * 100) / 100,
        day_change: stockData?.change,
        day_change_percent: stockData?.changePct,
        // Store underlying price for options
        underlying_price: !isStock ? stockData?.price : undefined,
        // Store bid/ask for spread natural pricing
        bid: optionBid,
        ask: optionAsk,
      };
    });

    // Summary is calculated in the component with proper spread data
    // Here we just return basic summary without spreads
    const summary = calculatePositionSummary(enrichedPositions, []);
    console.log('[Positions] Summary calculated:', summary);

    return {
      data: enrichedPositions,
      spreads: [], // Spreads are derived from position legs
      summary,
      refreshed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Positions] Refresh error:', error);
    return {
      data: positions.map((p) => ({
        ...p,
        current_price: p.entry_price,
        pnl: 0,
        pnl_percent: 0,
      })),
      spreads: [],
      summary: calculatePositionSummary([]),
      error: 'Failed to refresh market data',
      refreshed_at: new Date().toISOString(),
    };
  }
}
