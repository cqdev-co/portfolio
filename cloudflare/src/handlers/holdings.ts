/**
 * Holdings Handler
 *
 * Endpoint for institutional ownership data
 */

import { jsonResponse } from '../utils/response';
import { withRetry } from '../utils/retry';
import { getYahooAuth, fetchYahooAPI } from '../auth/crumb';
import type { YahooHoldingsResponse, HoldingsData } from '../types';

/**
 * Handle /holdings/:ticker endpoint
 */
export async function handleHoldings(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();
  // URL-encode to handle symbols with periods (BRK.B -> BRK%2EB)
  const encodedSymbol = encodeURIComponent(symbol);

  try {
    const auth = await getYahooAuth();

    const modules = ['institutionOwnership', 'majorHoldersBreakdown'].join(',');

    const data = await withRetry(
      () =>
        fetchYahooAPI<YahooHoldingsResponse>(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/` +
            `${encodedSymbol}?modules=${modules}`,
          auth
        ),
      `holdings/${symbol}`
    );

    const summary = data.quoteSummary?.result?.[0];
    if (!summary) {
      return jsonResponse({ error: 'Holdings data not found' }, 404);
    }

    const breakdown = summary.majorHoldersBreakdown;
    const ownership = summary.institutionOwnership?.ownershipList || [];

    const topHolders = ownership.slice(0, 10).map((h) => ({
      name: h.organization || 'Unknown',
      pctHeld: h.pctHeld?.raw
        ? Math.round(h.pctHeld.raw * 10000) / 100
        : undefined,
      value: h.value?.raw ?? 0,
      reportDate: h.reportDate?.raw
        ? new Date(h.reportDate.raw * 1000).toISOString().split('T')[0]
        : undefined,
    }));

    const result: HoldingsData = {
      ticker: symbol,
      institutionsPercent: breakdown?.institutionsPercentHeld?.raw
        ? Math.round(breakdown.institutionsPercentHeld.raw * 10000) / 100
        : 0,
      institutionsCount: ownership.length,
      topHolders,
    };

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}
