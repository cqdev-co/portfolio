/**
 * Options Handler
 * 
 * Endpoint for options chain data
 */

import { jsonResponse } from '../utils/response';
import { getYahooAuth } from '../auth/crumb';
import { fetchOptions } from '../fetchers';

/**
 * Handle /options/:ticker endpoint
 */
export async function handleOptions(ticker: string): Promise<Response> {
  try {
    const auth = await getYahooAuth();
    const options = await fetchOptions(ticker, auth);
    
    if (!options) {
      return jsonResponse({ error: 'Options not found' }, 404);
    }
    
    return jsonResponse(options);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

