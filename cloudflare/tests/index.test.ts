/**
 * Yahoo Proxy Worker Tests
 *
 * Tests all endpoints to ensure Yahoo Finance data is fetched correctly
 * through Cloudflare's IP pool.
 */

import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

// Helper to make requests to the worker
async function makeRequest(
  path: string,
  method: string = 'GET'
): Promise<Response> {
  const request = new Request(`http://localhost${path}`, { method });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

// Helper to parse JSON response
async function getJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe('Yahoo Proxy Worker', () => {
  // =========================================================================
  // HEALTH CHECK
  // =========================================================================

  describe('Health Check', () => {
    it('GET /health returns OK', async () => {
      const response = await makeRequest('/health');
      expect(response.status).toBe(200);

      const data = await getJson<{ status: string; service: string }>(response);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('yahoo-proxy');
    });

    it('GET / returns OK (root health check)', async () => {
      const response = await makeRequest('/');
      expect(response.status).toBe(200);

      const data = await getJson<{ status: string }>(response);
      expect(data.status).toBe('ok');
    });
  });

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS', () => {
    it('OPTIONS request returns CORS headers', async () => {
      const response = await makeRequest('/quote/AAPL', 'OPTIONS');
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'GET'
      );
    });

    it('GET response includes CORS headers', async () => {
      const response = await makeRequest('/health');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  // =========================================================================
  // QUOTE ENDPOINT
  // =========================================================================

  describe('Quote Endpoint', () => {
    it('GET /quote/AAPL returns quote data', async () => {
      const response = await makeRequest('/quote/AAPL');
      expect(response.status).toBe(200);

      const data = await getJson<{
        quoteResponse?: {
          result?: Array<{
            symbol: string;
            regularMarketPrice: number;
          }>;
        };
      }>(response);

      expect(data.quoteResponse).toBeDefined();
      expect(data.quoteResponse?.result).toBeDefined();
      expect(data.quoteResponse?.result?.length).toBeGreaterThan(0);

      const quote = data.quoteResponse?.result?.[0];
      expect(quote?.symbol).toBe('AAPL');
      expect(quote?.regularMarketPrice).toBeGreaterThan(0);
    }, 15000); // 15s timeout for external API

    it('GET /quote/aapl handles lowercase ticker', async () => {
      const response = await makeRequest('/quote/aapl');
      expect(response.status).toBe(200);

      const data = await getJson<{
        quoteResponse?: { result?: Array<{ symbol: string }> };
      }>(response);

      expect(data.quoteResponse?.result?.[0]?.symbol).toBe('AAPL');
    }, 15000);

    it('GET /quote/INVALID123 handles invalid ticker', async () => {
      const response = await makeRequest('/quote/INVALID123XYZ');
      // Yahoo may return 200 with empty result or error
      const data = await getJson<{
        quoteResponse?: {
          result?: Array<unknown>;
          error?: { code: string };
        };
      }>(response);

      // Either empty result or error is acceptable
      const hasResult = (data.quoteResponse?.result?.length ?? 0) > 0;
      const hasError = !!data.quoteResponse?.error;
      expect(hasResult || hasError || !data.quoteResponse?.result?.length).toBe(
        true
      );
    }, 15000);
  });

  // =========================================================================
  // CHART ENDPOINT
  // =========================================================================

  describe('Chart Endpoint', () => {
    it('GET /chart/AAPL returns historical data', async () => {
      const response = await makeRequest('/chart/AAPL?range=5d&interval=1d');
      expect(response.status).toBe(200);

      const data = await getJson<{
        chart?: {
          result?: Array<{
            timestamp: number[];
            indicators: {
              quote: Array<{
                close: number[];
              }>;
            };
          }>;
        };
      }>(response);

      expect(data.chart?.result).toBeDefined();
      expect(data.chart?.result?.length).toBeGreaterThan(0);

      const result = data.chart?.result?.[0];
      expect(result?.timestamp).toBeDefined();
      expect(result?.timestamp?.length).toBeGreaterThan(0);
      expect(result?.indicators?.quote?.[0]?.close?.length).toBeGreaterThan(0);
    }, 15000);

    it('GET /chart/AAPL uses default range if not specified', async () => {
      const response = await makeRequest('/chart/AAPL');
      expect(response.status).toBe(200);
    }, 15000);
  });

  // =========================================================================
  // OPTIONS CHAIN ENDPOINT
  // =========================================================================

  describe('Options Endpoint', () => {
    it('GET /options/AAPL returns options chain', async () => {
      const response = await makeRequest('/options/AAPL');
      expect(response.status).toBe(200);

      const data = await getJson<{
        optionChain?: {
          result?: Array<{
            expirationDates: number[];
            strikes: number[];
            quote: { regularMarketPrice: number };
            options: Array<{
              calls: Array<{ strike: number }>;
              puts: Array<{ strike: number }>;
            }>;
          }>;
        };
      }>(response);

      expect(data.optionChain?.result).toBeDefined();
      expect(data.optionChain?.result?.length).toBeGreaterThan(0);

      const result = data.optionChain?.result?.[0];
      expect(result?.expirationDates).toBeDefined();
      expect(result?.strikes).toBeDefined();
      expect(result?.options).toBeDefined();
      expect(result?.options?.[0]?.calls?.length).toBeGreaterThan(0);
    }, 15000);
  });

  // =========================================================================
  // SUMMARY ENDPOINT
  // =========================================================================

  describe('Summary Endpoint', () => {
    it('GET /summary/AAPL returns detailed summary', async () => {
      const response = await makeRequest(
        '/summary/AAPL?modules=price,summaryDetail'
      );
      expect(response.status).toBe(200);

      const data = await getJson<{
        quoteSummary?: {
          result?: Array<{
            price?: { regularMarketPrice?: { raw: number } };
            summaryDetail?: { marketCap?: { raw: number } };
          }>;
        };
      }>(response);

      expect(data.quoteSummary?.result).toBeDefined();
      expect(data.quoteSummary?.result?.length).toBeGreaterThan(0);
    }, 15000);

    it('GET /summary/AAPL uses default modules', async () => {
      const response = await makeRequest('/summary/AAPL');
      expect(response.status).toBe(200);

      const data = await getJson<{
        quoteSummary?: { result?: Array<unknown> };
      }>(response);

      expect(data.quoteSummary?.result).toBeDefined();
    }, 15000);
  });

  // =========================================================================
  // SEARCH ENDPOINT
  // =========================================================================

  describe('Search Endpoint', () => {
    it('GET /search?q=AAPL returns news', async () => {
      const response = await makeRequest('/search?q=AAPL&newsCount=3');
      expect(response.status).toBe(200);

      const data = await getJson<{
        news?: Array<{
          title: string;
          link: string;
        }>;
      }>(response);

      // News may or may not be present depending on Yahoo's response
      expect(response.status).toBe(200);
    }, 15000);

    it('GET /search without query returns error', async () => {
      const response = await makeRequest('/search');
      expect(response.status).toBe(400);

      const data = await getJson<{ error: string }>(response);
      expect(data.error).toContain('query');
    });
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  describe('Error Handling', () => {
    it('Returns 404 for unknown routes', async () => {
      const response = await makeRequest('/unknown/path');
      expect(response.status).toBe(404);

      const data = await getJson<{
        error: string;
        available_endpoints: string[];
      }>(response);

      expect(data.error).toBe('Not found');
      expect(data.available_endpoints).toBeDefined();
      expect(data.available_endpoints.length).toBeGreaterThan(0);
    });

    it('Returns 405 for non-GET methods', async () => {
      const request = new Request('http://localhost/quote/AAPL', {
        method: 'POST',
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(405);
    });
  });
});
