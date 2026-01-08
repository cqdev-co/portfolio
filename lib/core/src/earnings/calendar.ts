/**
 * Earnings Calendar Core Logic
 */

export interface EarningsInfo {
  ticker: string;
  earningsDate: Date | null;
  daysUntil: number | null;
  price: number;
}

export type EarningsAlertLevel = 'none' | 'warning' | 'critical' | 'imminent';

export interface QuoteSummaryProvider {
  getQuote: (ticker: string) => Promise<{ regularMarketPrice?: number } | null>;
  getQuoteSummary: (ticker: string) => Promise<{
    calendarEvents?: {
      earnings?: {
        earningsDate?: (Date | string)[];
      };
    };
  } | null>;
}

/**
 * Get earnings date for a ticker
 */
export async function getEarningsDate(
  ticker: string,
  provider: QuoteSummaryProvider
): Promise<EarningsInfo> {
  const result: EarningsInfo = {
    ticker,
    earningsDate: null,
    daysUntil: null,
    price: 0,
  };

  try {
    const [quote, summary] = await Promise.all([
      provider.getQuote(ticker),
      provider.getQuoteSummary(ticker),
    ]);

    result.price = quote?.regularMarketPrice ?? 0;

    const earningsDates = summary?.calendarEvents?.earnings?.earningsDate ?? [];
    if (earningsDates.length > 0) {
      const now = Date.now();
      for (const dateVal of earningsDates) {
        const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (date.getTime() > now) {
          result.earningsDate = date;
          result.daysUntil = Math.ceil(
            (date.getTime() - now) / (1000 * 60 * 60 * 24)
          );
          break;
        }
      }
    }
  } catch {
    // Return default result on error
  }

  return result;
}

/**
 * Check if earnings are imminent based on strategy rules
 */
export function isEarningsImminent(
  daysUntil: number | null,
  thresholds: { critical: number; warning: number } = {
    critical: 7,
    warning: 14,
  }
): EarningsAlertLevel {
  if (daysUntil === null) return 'none';
  if (daysUntil <= 3) return 'imminent';
  if (daysUntil <= thresholds.critical) return 'critical';
  if (daysUntil <= thresholds.warning) return 'warning';
  return 'none';
}
