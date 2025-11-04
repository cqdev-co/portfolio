/**
 * Stock Price Data API
 * Fetches historical price data for charts and analysis
 */

export interface PriceDataPoint {
  time: string; // ISO timestamp
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectionPoint {
  time: string; // ISO timestamp
  price: number;
  optionType: 'call' | 'put';
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  premiumFlow: number;
  strike: number;
  expiry: string;
  signalId: string;
}

export type TimeRange = 
  '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

/**
 * Fetch historical stock price data
 * Uses Next.js API route to avoid CORS issues
 */
export async function fetchHistoricalPrices(
  ticker: string,
  range: TimeRange = '1M',
  interval: '1m' | '5m' | '15m' | '1h' | '1d' = '15m'
): Promise<PriceDataPoint[]> {
  try {
    // Map range to period for Yahoo Finance API
    const periodMap: Record<TimeRange, string> = {
      '1D': '1d',
      '1W': '5d',
      '1M': '1mo',
      '3M': '3mo',
      '6M': '6mo',
      '1Y': '1y',
      '5Y': '5y',
      'MAX': 'max'
    };

    // Adjust interval based on range
    const intervalMap: Record<TimeRange, string> = {
      '1D': '5m',
      '1W': '15m',
      '1M': '1h',
      '3M': '1d',
      '6M': '1d',
      '1Y': '1d',
      '5Y': '1wk',
      'MAX': '1mo'
    };

    const period = periodMap[range] || '1mo';
    const adjustedInterval = intervalMap[range] || interval;

    // Call our Next.js API route (server-side fetch)
    const url = 
      `/api/stock-prices?ticker=${encodeURIComponent(ticker)}` +
      `&range=${period}&interval=${adjustedInterval}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || 
        `Failed to fetch price data: ${response.statusText}`
      );
    }

    const result = await response.json();
    
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error('Invalid response format');
    }

    return result.data as PriceDataPoint[];

  } catch (error) {
    console.error('Error fetching historical prices:', error);
    throw error;
  }
}

/**
 * Get the price change and percentage for display
 */
export function getPriceChange(
  priceData: PriceDataPoint[]
): { change: number; changePercent: number; isPositive: boolean } {
  if (priceData.length < 2) {
    return { change: 0, changePercent: 0, isPositive: true };
  }

  const firstPrice = priceData[0].price;
  const lastPrice = priceData[priceData.length - 1].price;
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;

  return {
    change,
    changePercent,
    isPositive: change >= 0,
  };
}

/**
 * Get the current price (most recent data point)
 */
export function getCurrentPrice(
  priceData: PriceDataPoint[]
): number {
  if (priceData.length === 0) return 0;
  return priceData[priceData.length - 1].price;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }
  return `$${price.toFixed(2)}`;
}

/**
 * Format price change for display
 */
export function formatPriceChange(
  change: number, 
  changePercent: number
): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
}

/**
 * Get min and max prices from data for chart scaling
 */
export function getPriceRange(
  priceData: PriceDataPoint[]
): { min: number; max: number } {
  if (priceData.length === 0) {
    return { min: 0, max: 0 };
  }

  const prices = priceData.map(d => d.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

