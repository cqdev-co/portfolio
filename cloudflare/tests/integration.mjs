#!/usr/bin/env node
/**
 * Integration Test Script
 * 
 * Tests the Yahoo Proxy Worker against a running instance.
 * 
 * Usage:
 *   # Test local dev server
 *   npm run dev &
 *   node tests/integration.mjs
 * 
 *   # Test deployed worker
 *   WORKER_URL=https://yahoo-proxy.xxx.workers.dev node tests/integration.mjs
 */

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8787";

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log(colors.green("✓"));
    passed++;
  } catch (error) {
    console.log(colors.red("✗"));
    console.log(colors.dim(`    ${error.message}`));
    failed++;
  }
}

async function fetchJson(path) {
  const response = await fetch(`${WORKER_URL}${path}`);
  const data = await response.json();
  return { response, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// TESTS
// ============================================================================

console.log(`\n${colors.yellow("Yahoo Proxy Worker Integration Tests")}`);
console.log(colors.dim(`Target: ${WORKER_URL}\n`));

// Health Check
console.log("Health Check:");
await test("GET /health returns OK", async () => {
  const { data } = await fetchJson("/health");
  assert(data.status === "ok", `Expected status "ok", got "${data.status}"`);
  assert(data.service === "yahoo-proxy", `Expected service "yahoo-proxy"`);
});

// Quote Tests
console.log("\nQuote Endpoint:");
await test("GET /quote/AAPL returns price", async () => {
  const { data } = await fetchJson("/quote/AAPL");
  assert(data.quoteResponse?.result?.[0], "No quote result");
  const quote = data.quoteResponse.result[0];
  assert(quote.symbol === "AAPL", `Expected symbol AAPL, got ${quote.symbol}`);
  assert(quote.regularMarketPrice > 0, "Price should be > 0");
  console.log(colors.dim(`    AAPL: $${quote.regularMarketPrice.toFixed(2)}`));
});

await test("GET /quote/MSFT returns price", async () => {
  const { data } = await fetchJson("/quote/MSFT");
  const quote = data.quoteResponse?.result?.[0];
  assert(quote?.regularMarketPrice > 0, "MSFT price should be > 0");
});

// Chart Tests
console.log("\nChart Endpoint:");
await test("GET /chart/AAPL returns historical data", async () => {
  const { data } = await fetchJson("/chart/AAPL?range=5d&interval=1d");
  const result = data.chart?.result?.[0];
  // yahoo-finance2 returns 'quotes' array instead of timestamp/indicators
  const hasQuotes = result?.quotes?.length > 0;
  const hasTimestamp = result?.timestamp?.length > 0;
  assert(hasQuotes || hasTimestamp, "Should have quotes or timestamps");
  const count = result?.quotes?.length || result?.timestamp?.length || 0;
  console.log(colors.dim(`    ${count} data points`));
});

// Options Tests (requires crumb auth - may not work in serverless)
console.log("\nOptions Endpoint:");
await test("GET /options/AAPL returns response", async () => {
  const { response, data } = await fetchJson("/options/AAPL");
  assert(response.ok, "Should return 200");
  // Note: May return empty/error due to Yahoo's crumb requirements
  const hasData = data.optionChain?.result?.[0]?.options?.length > 0;
  const hasAuthError = data.finance?.error?.code === "Unauthorized" || 
                       data.optionChain?.error;
  if (hasData) {
    const result = data.optionChain.result[0];
    console.log(colors.dim(
      `    ${result.expirationDates?.length || 0} expirations (full data)`
    ));
  } else if (hasAuthError) {
    console.log(colors.dim(
      `    ⚠ Yahoo requires auth - options limited`
    ));
  }
  assert(hasData || hasAuthError, "Should return data or auth error");
});

// Summary Tests (requires crumb auth - may not work in serverless)
console.log("\nSummary Endpoint:");
await test("GET /summary/AAPL returns response", async () => {
  const { response, data } = await fetchJson(
    "/summary/AAPL?modules=price,summaryDetail"
  );
  assert(response.ok, "Should return 200");
  // Note: May return empty/error due to Yahoo's crumb requirements
  const hasData = data.quoteSummary?.result?.[0];
  const hasAuthError = data.finance?.error?.code === "Unauthorized" ||
                       data.quoteSummary?.error;
  if (hasData) {
    console.log(colors.dim("    Full summary data available"));
  } else if (hasAuthError) {
    console.log(colors.dim(
      `    ⚠ Yahoo requires auth - summary limited`
    ));
  }
  assert(hasData || hasAuthError, "Should return data or auth error");
});

// Search Tests
console.log("\nSearch Endpoint:");
await test("GET /search?q=AAPL returns results", async () => {
  const { response } = await fetchJson("/search?q=AAPL&newsCount=3");
  assert(response.ok, "Search should return OK");
});

await test("GET /search without q returns 400", async () => {
  const { response, data } = await fetchJson("/search");
  assert(response.status === 400, "Should return 400 for missing query");
  assert(data.error?.includes("query"), "Error should mention query");
});

// Error Handling
console.log("\nError Handling:");
await test("GET /unknown returns 404 with endpoints", async () => {
  const { response, data } = await fetchJson("/unknown/path");
  assert(response.status === 404, "Should return 404");
  assert(data.available_endpoints?.length > 0, "Should list endpoints");
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${colors.yellow("Results:")}`);
console.log(`  ${colors.green(`${passed} passed`)}`);
if (failed > 0) {
  console.log(`  ${colors.red(`${failed} failed`)}`);
  process.exit(1);
} else {
  console.log(colors.green("\n✓ All tests passed!\n"));
}

