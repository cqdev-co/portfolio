#!/usr/bin/env node
/**
 * Debug script to print raw data from the Yahoo Proxy Worker
 *
 * Usage:
 *   node scripts/debug-endpoint.mjs AAPL           # Combined endpoint (recommended)
 *   node scripts/debug-endpoint.mjs AAPL ticker    # Same as above (explicit)
 *   node scripts/debug-endpoint.mjs AAPL quote     # Quote only
 *   node scripts/debug-endpoint.mjs AAPL chart     # Chart data
 *   node scripts/debug-endpoint.mjs AAPL options   # Options chain
 *   node scripts/debug-endpoint.mjs AAPL summary   # Full summary
 *   node scripts/debug-endpoint.mjs AAPL search    # News/search
 *
 * Environment:
 *   YAHOO_PROXY_URL - Worker URL (from .env.local or environment)
 *
 * NOTE: Can't run worker locally due to yahoo-finance2 compatibility.
 *       Always test against production worker.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local if it exists
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('📁 Loaded .env.local');
}

const BASE_URL = process.env.YAHOO_PROXY_URL;

if (!BASE_URL) {
  console.error(`
❌ YAHOO_PROXY_URL not set!

Set it in your environment or .env file:
  export YAHOO_PROXY_URL=https://yahoo-proxy.conorquinlan.workers.dev

Or run with:
  YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev node scripts/debug-endpoint.mjs AAPL
`);
  process.exit(1);
}

const ticker = process.argv[2]?.toUpperCase();
const endpoint = process.argv[3]?.toLowerCase();

if (!ticker) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Yahoo Proxy Worker Debug Tool                                 ║
╠════════════════════════════════════════════════════════════════╣
║  Usage:                                                        ║
║    node scripts/debug-endpoint.mjs <TICKER> [endpoint]         ║
║                                                                ║
║  Examples:                                                     ║
║    node scripts/debug-endpoint.mjs AAPL         # All data     ║
║    node scripts/debug-endpoint.mjs TSLA quote   # Quote only   ║
║    node scripts/debug-endpoint.mjs NVDA options # Options      ║
║                                                                ║
║  Endpoints: quote, chart, options, summary, search, health     ║
║                                                                ║
║  Set YAHOO_PROXY_URL for production worker                     ║
╚════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const ENDPOINTS = {
  health: '/health',
  ticker: `/ticker/${ticker}`, // RECOMMENDED: All data in 1 request
  quote: `/quote/${ticker}`,
  chart: `/chart/${ticker}?range=3mo&interval=1d`,
  options: `/options/${ticker}`,
  summary: `/summary/${ticker}?modules=calendarEvents,recommendationTrend,financialData,defaultKeyStatistics`,
  search: `/search?q=${ticker}&newsCount=5`,
};

async function fetchEndpoint(name, path) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📡 ${name.toUpperCase()}: ${url}`);
  console.log('─'.repeat(70));

  try {
    const start = Date.now();
    const response = await fetch(url);
    const elapsed = Date.now() - start;

    console.log(
      `⏱️  Response: ${response.status} ${response.statusText} (${elapsed}ms)`
    );

    const data = await response.json();

    // Pretty print with syntax highlighting simulation
    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    // Summary stats
    if (name === 'quote' && data.quoteResponse?.result?.[0]) {
      const q = data.quoteResponse.result[0];
      console.log('\n📊 Quick Stats:');
      console.log(`   Price: $${q.regularMarketPrice}`);
      console.log(`   Change: ${q.regularMarketChangePercent?.toFixed(2)}%`);
      console.log(`   Market Cap: $${(q.marketCap / 1e9)?.toFixed(2)}B`);
    }

    if (name === 'options' && data.optionChain?.result?.[0]) {
      const o = data.optionChain.result[0];
      console.log('\n📊 Options Summary:');
      console.log(`   Expirations: ${o.expirationDates?.length || 0}`);
      console.log(`   Strikes: ${o.strikes?.length || 0}`);
      const opts = o.options?.[0];
      if (opts) {
        console.log(`   Calls: ${opts.calls?.length || 0}`);
        console.log(`   Puts: ${opts.puts?.length || 0}`);
      }
    }

    if (name === 'chart' && data.chart?.result?.[0]) {
      const c = data.chart.result[0];
      const quotes = c.quotes || [];
      console.log('\n📊 Chart Summary:');
      console.log(`   Data Points: ${quotes.length}`);
      if (quotes.length > 0) {
        console.log(`   First: ${quotes[0]?.date}`);
        console.log(`   Last: ${quotes[quotes.length - 1]?.date}`);
      }
    }

    if (name === 'summary' && data.quoteSummary?.result?.[0]) {
      const s = data.quoteSummary.result[0];
      console.log('\n📊 Summary Modules:');
      console.log(`   Keys: ${Object.keys(s).join(', ')}`);
      if (s.calendarEvents?.earnings?.earningsDate) {
        console.log(
          `   Earnings Date: ${s.calendarEvents.earnings.earningsDate[0]}`
        );
      }
      if (s.recommendationTrend?.trend?.[0]) {
        const t = s.recommendationTrend.trend[0];
        console.log(
          `   Analysts: ${t.strongBuy}SB/${t.buy}B/${t.hold}H/${t.sell}S`
        );
      }
    }

    if (name === 'search' && data.news) {
      console.log('\n📰 News:');
      data.news.slice(0, 3).forEach((n, i) => {
        console.log(`   ${i + 1}. ${n.title?.slice(0, 60)}...`);
      });
    }

    // Combined ticker endpoint summary
    if (name === 'ticker' && data.quote) {
      console.log('\n📊 Combined Response Summary:');
      console.log(`   Price: $${data.quote.regularMarketPrice}`);
      console.log(
        `   Change: ${data.quote.regularMarketChangePercent?.toFixed(2)}%`
      );
      console.log(
        `   Market Cap: $${(data.quote.marketCap / 1e9)?.toFixed(2)}B`
      );
      console.log(`   P/E: ${data.quote.trailingPE?.toFixed(1) || 'N/A'}`);

      if (data.chart?.quotes) {
        console.log(`   Chart: ${data.chart.quotes.length} data points`);
      }
      if (data.options?.options?.[0]) {
        const opts = data.options.options[0];
        console.log(
          `   Options: ${opts.calls?.length || 0} calls, ${opts.puts?.length || 0} puts`
        );
      }
      if (data.summary?.recommendationTrend?.trend?.[0]) {
        const t = data.summary.recommendationTrend.trend[0];
        console.log(
          `   Analysts: ${t.strongBuy}SB/${t.buy}B/${t.hold}H/${t.sell}S`
        );
      }
      if (data.news?.length) {
        console.log(`   News: ${data.news.length} articles`);
      }
      if (data.errors?.length) {
        console.log(`   ⚠️  Errors: ${data.errors.join(', ')}`);
      }
      console.log(`   ⏱️  Total time: ${data.elapsed_ms}ms`);
    }

    return { success: true, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`\n🔍 Yahoo Proxy Debug - ${ticker}`);
  console.log(`🌐 Worker URL: ${BASE_URL}`);

  // Check health first
  const health = await fetchEndpoint('health', ENDPOINTS.health);
  if (!health.success) {
    console.log('\n⚠️  Worker not responding!');
    console.log('   Check if worker is deployed correctly.');
    process.exit(1);
  }

  if (endpoint && ENDPOINTS[endpoint]) {
    // Single endpoint
    await fetchEndpoint(endpoint, ENDPOINTS[endpoint]);
  } else if (endpoint) {
    console.log(`\n❌ Unknown endpoint: ${endpoint}`);
    console.log(`   Available: ${Object.keys(ENDPOINTS).join(', ')}`);
  } else {
    // Default: Use combined ticker endpoint (most efficient)
    console.log(
      '\n💡 Using combined /ticker endpoint (1 request for all data)'
    );
    await fetchEndpoint('ticker', ENDPOINTS.ticker);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Debug complete');
}

main().catch(console.error);
