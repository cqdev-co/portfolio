/**
 * Chart Handler
 *
 * Endpoint for historical OHLCV data
 */

import { jsonResponse } from '../utils/response';
import { fetchChart } from '../fetchers';

/**
 * Handle /chart/:ticker endpoint
 */
export async function handleChart(
  ticker: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    const range = searchParams.get('range') || '3mo';
    const interval = searchParams.get('interval') || '1d';

    const chart = await fetchChart(ticker, range, interval);

    if (!chart) {
      return jsonResponse({ error: 'Chart not found' }, 404);
    }

    return jsonResponse(chart);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}
