/**
 * Yahoo Finance Proxy Worker v4.0
 *
 * Modular architecture with clean separation of concerns.
 *
 * Endpoints:
 *   GET /ticker/:symbol    - All data (quote, chart, options, earnings, etc.)
 *   GET /quote/:ticker     - Stock quote only
 *   GET /chart/:ticker     - Historical data
 *   GET /options/:ticker   - Options chain
 *   GET /financials/:ticker - Deep financial data
 *   GET /holdings/:ticker  - Institutional ownership
 *   GET /health            - Health check
 */

import { CONFIG } from './config';
import { jsonResponse, CORS_HEADERS } from './utils/response';
import { logger } from './utils/logger';
import {
  handleTicker,
  handleQuote,
  handleChart,
  handleOptions,
  handleOptionsChain,
  handleFinancials,
  handleHoldings,
} from './handlers';

export interface Env {}

// =============================================================================
// ROUTER
// =============================================================================

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return handleHealth();
      }

      // /ticker/:symbol - Main endpoint with all data
      // Supports: AAPL, BRK.B, ^VIX, ^GSPC (indices with ^)
      const tickerMatch = path.match(/^\/ticker\/([A-Z0-9.^-]+)$/i);
      if (tickerMatch) {
        return handleTicker(tickerMatch[1]);
      }

      // /quote/:ticker - Quote only
      const quoteMatch = path.match(/^\/quote\/([A-Z0-9.^-]+)$/i);
      if (quoteMatch) {
        return handleQuote(quoteMatch[1]);
      }

      // /chart/:ticker - Historical data
      const chartMatch = path.match(/^\/chart\/([A-Z0-9.^-]+)$/i);
      if (chartMatch) {
        return handleChart(chartMatch[1], searchParams);
      }

      // /options/:ticker - Options summary
      const optionsMatch = path.match(/^\/options\/([A-Z0-9.-]+)$/i);
      if (optionsMatch) {
        return handleOptions(optionsMatch[1]);
      }

      // /options-chain/:ticker - Raw options chain data with prices
      const optionsChainMatch = path.match(/^\/options-chain\/([A-Z0-9.-]+)$/i);
      if (optionsChainMatch) {
        return handleOptionsChain(optionsChainMatch[1], searchParams);
      }

      // /financials/:ticker - Deep financial data
      const financialsMatch = path.match(/^\/financials\/([A-Z0-9.-]+)$/i);
      if (financialsMatch) {
        return handleFinancials(financialsMatch[1]);
      }

      // /holdings/:ticker - Institutional holdings
      const holdingsMatch = path.match(/^\/holdings\/([A-Z0-9.-]+)$/i);
      if (holdingsMatch) {
        return handleHoldings(holdingsMatch[1]);
      }

      // 404 for unmatched routes
      return jsonResponse(
        {
          error: 'Not found',
          endpoints: [
            'GET /ticker/:symbol',
            'GET /quote/:ticker',
            'GET /chart/:ticker',
            'GET /options/:ticker',
            'GET /options-chain/:ticker?date=TIMESTAMP',
            'GET /financials/:ticker',
            'GET /holdings/:ticker',
            'GET /health',
          ],
        },
        404
      );
    } catch (error) {
      logger.error('[Yahoo Proxy] Error:', error);
      return jsonResponse(
        {
          error: 'Internal server error',
          details: String(error),
        },
        500
      );
    }
  },
};

// =============================================================================
// HEALTH CHECK
// =============================================================================

function handleHealth(): Response {
  return jsonResponse({
    status: 'ok',
    service: 'yahoo-proxy',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    architecture: 'modular',
    features: {
      manualCrumbAuth: true,
      caching: true,
      retryWithBackoff: true,
    },
    config: {
      cacheTTL: CONFIG.cache,
      retryMaxAttempts: CONFIG.retry.maxAttempts,
    },
    endpoints: [
      'GET /ticker/:symbol - All data',
      'GET /quote/:ticker - Quote only',
      'GET /chart/:ticker - Chart only',
      'GET /options/:ticker - Options summary',
      'GET /options-chain/:ticker?date=TIMESTAMP - Raw options chain',
      'GET /financials/:ticker - Deep financials',
      'GET /holdings/:ticker - Institutional ownership',
    ],
  });
}
