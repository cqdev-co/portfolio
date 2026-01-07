import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/positions/options-prices
 *
 * Fetches actual option contract prices using the Cloudflare Yahoo proxy.
 * This avoids rate limiting by using the proxy's auth/crumb handling.
 *
 * Query params:
 *   contracts: JSON array of [{symbol, strike, expiration, type}]
 *
 * Example:
 *   /api/positions/options-prices?contracts=[
 *     {"symbol":"TSLA","strike":410,"expiration":"2025-01-29","type":"call"},
 *     {"symbol":"TSLA","strike":415,"expiration":"2025-01-29","type":"call"}
 *   ]
 */

const YAHOO_PROXY_URL =
  process.env.YAHOO_PROXY_URL || 'https://yahoo-proxy.conorquinlan.workers.dev';

interface ContractRequest {
  symbol: string;
  strike: number;
  expiration: string; // YYYY-MM-DD
  type: 'call' | 'put';
}

interface OptionContract {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

interface OptionsChainData {
  underlying: string;
  underlyingPrice: number;
  expirationDate: string;
  expirationTimestamp: number;
  calls: OptionContract[];
  puts: OptionContract[];
}

interface ContractPrice {
  symbol: string;
  strike: number;
  expiration: string;
  type: 'call' | 'put';
  price: number | null; // Mid price or last price
  bid: number | null;
  ask: number | null;
  iv: number | null;
  error?: string;
}

/**
 * Fetch options chain from Cloudflare proxy
 */
async function fetchOptionsChain(
  symbol: string,
  expirationTimestamp: number
): Promise<OptionsChainData | null> {
  try {
    const url = `${YAHOO_PROXY_URL}/options-chain/${symbol}?date=${expirationTimestamp}`;
    console.log(`[Options] Fetching from proxy: ${url}`);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Options] Proxy error for ${symbol}:`,
        response.status,
        text
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[Options] Error fetching chain for ${symbol}:`, error);
    return null;
  }
}

/**
 * Find a specific contract in the options chain data
 */
function findContract(
  chain: OptionsChainData,
  strike: number,
  type: 'call' | 'put'
): OptionContract | null {
  const contracts = type === 'call' ? chain.calls : chain.puts;
  if (!contracts) return null;

  // Find contract with matching strike
  return contracts.find((c) => c.strike === strike) || null;
}

/**
 * Convert date string to Unix timestamp for Yahoo API
 */
function dateToUnixTimestamp(dateStr: string): number {
  const date = new Date(dateStr + 'T16:00:00Z'); // 4 PM EST
  return Math.floor(date.getTime() / 1000);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractsParam = searchParams.get('contracts');

  if (!contractsParam) {
    return NextResponse.json(
      { error: 'contracts parameter is required (JSON array)' },
      { status: 400 }
    );
  }

  let contracts: ContractRequest[];
  try {
    contracts = JSON.parse(contractsParam);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in contracts parameter' },
      { status: 400 }
    );
  }

  if (!Array.isArray(contracts) || contracts.length === 0) {
    return NextResponse.json(
      { error: 'contracts must be a non-empty array' },
      { status: 400 }
    );
  }

  // Limit to 20 contracts per request
  if (contracts.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 contracts per request' },
      { status: 400 }
    );
  }

  console.log('[Options] Fetching prices for', contracts.length, 'contracts');

  // Group contracts by symbol and expiration for efficient fetching
  const grouped = new Map<string, ContractRequest[]>();
  for (const contract of contracts) {
    const key = `${contract.symbol}:${contract.expiration}`;
    const existing = grouped.get(key) || [];
    existing.push(contract);
    grouped.set(key, existing);
  }

  const results: ContractPrice[] = [];

  // Fetch each symbol's options chain from the proxy
  for (const [key, contractsForKey] of grouped) {
    const [symbol, expiration] = key.split(':');
    const expirationTimestamp = dateToUnixTimestamp(expiration);

    console.log(
      `[Options] Fetching ${symbol} chain for ${expiration} (${expirationTimestamp})`
    );

    const chain = await fetchOptionsChain(symbol, expirationTimestamp);

    if (!chain) {
      // Add error results for all contracts in this group
      for (const contract of contractsForKey) {
        results.push({
          symbol: contract.symbol,
          strike: contract.strike,
          expiration: contract.expiration,
          type: contract.type,
          price: null,
          bid: null,
          ask: null,
          iv: null,
          error: 'Failed to fetch options chain',
        });
      }
      continue;
    }

    // Find each requested contract
    for (const contract of contractsForKey) {
      const found = findContract(chain, contract.strike, contract.type);

      if (!found) {
        results.push({
          symbol: contract.symbol,
          strike: contract.strike,
          expiration: contract.expiration,
          type: contract.type,
          price: null,
          bid: null,
          ask: null,
          iv: null,
          error: 'Contract not found in chain',
        });
        continue;
      }

      // Calculate mid price if bid/ask available
      const bid = found.bid || 0;
      const ask = found.ask || 0;
      let price = found.lastPrice || null;

      if (bid > 0 && ask > 0) {
        price = (bid + ask) / 2;
      } else if (found.lastPrice && found.lastPrice > 0) {
        price = found.lastPrice;
      }

      console.log(
        `[Options] ${contract.symbol} ${contract.type} $${contract.strike}: ` +
          `bid=${bid}, ask=${ask}, last=${found.lastPrice}, price=${price}`
      );

      results.push({
        symbol: contract.symbol,
        strike: contract.strike,
        expiration: contract.expiration,
        type: contract.type,
        price,
        bid: bid || null,
        ask: ask || null,
        iv: found.impliedVolatility
          ? Math.round(found.impliedVolatility * 10000) / 100
          : null,
      });
    }
  }

  return NextResponse.json({
    contracts: results,
    fetched_at: new Date().toISOString(),
  });
}
