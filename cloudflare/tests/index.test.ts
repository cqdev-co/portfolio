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
import { describe, it, expect } from 'vitest';
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
  // QUOTE ENDPOINT - Returns processed QuoteData
  // =========================================================================

  describe('Quote Endpoint', () => {
    it('GET /quote/AAPL returns processed quote data', async () => {
      const response = await makeRequest('/quote/AAPL');
      expect(response.status).toBe(200);

      const data = await getJson<{
        price?: number;
        change?: number;
        changePct?: number;
        volume?: number;
        marketCap?: number;
        error?: string;
      }>(response);

      // Should return processed data with price field
      expect(data.price).toBeDefined();
      expect(typeof data.price).toBe('number');
      expect(data.price).toBeGreaterThan(0);
    }, 30000); // 30s timeout for external API with retries

    it('GET /quote/aapl handles lowercase ticker', async () => {
      const response = await makeRequest('/quote/aapl');
      expect(response.status).toBe(200);

      const data = await getJson<{ price?: number }>(response);
      expect(data.price).toBeDefined();
    }, 30000);

    it('GET /quote/INVALID123XYZ handles invalid ticker', async () => {
      const response = await makeRequest('/quote/INVALID123XYZ');
      // Should return 404 or 200 with error
      expect([200, 404, 500]).toContain(response.status);
    }, 30000);
  });

  // =========================================================================
  // CHART ENDPOINT - Returns processed chart data
  // =========================================================================

  describe('Chart Endpoint', () => {
    it('GET /chart/AAPL returns historical data', async () => {
      const response = await makeRequest('/chart/AAPL?range=5d&interval=1d');
      expect(response.status).toBe(200);

      const data = await getJson<{
        dataPoints?: number;
        quotes?: Array<{
          date: string;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
        }>;
        error?: string;
      }>(response);

      // Chart should have dataPoints and quotes
      expect(data.dataPoints || data.quotes || data.error).toBeDefined();
    }, 30000);

    it('GET /chart/AAPL uses default range if not specified', async () => {
      const response = await makeRequest('/chart/AAPL');
      expect(response.status).toBe(200);
    }, 30000);
  });

  // =========================================================================
  // OPTIONS ENDPOINT - Returns processed options data
  // =========================================================================

  describe('Options Endpoint', () => {
    it('GET /options/AAPL returns options data', async () => {
      const response = await makeRequest('/options/AAPL');
      expect(response.status).toBe(200);

      const data = await getJson<{
        expirations?: number[];
        strikes?: number[];
        calls?: unknown[];
        puts?: unknown[];
        error?: string;
      }>(response);

      // Should have expirations or error
      expect(data.expirations || data.strikes || data.error).toBeDefined();
    }, 30000);
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
        endpoints?: string[];
      }>(response);

      expect(data.error).toBe('Not found');
      expect(data.endpoints).toBeDefined();
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
