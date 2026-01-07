/**
 * Quote Handler
 *
 * Endpoint for quote-only data
 */

import { jsonResponse } from '../utils/response';
import { getYahooAuth } from '../auth/crumb';
import { fetchQuote } from '../fetchers';

/**
 * Handle /quote/:ticker endpoint
 */
export async function handleQuote(ticker: string): Promise<Response> {
  try {
    const auth = await getYahooAuth();
    const quote = await fetchQuote(ticker, auth);

    if (!quote) {
      return jsonResponse({ error: 'Quote not found' }, 404);
    }

    return jsonResponse(quote);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}
