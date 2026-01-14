/**
 * Shared Tool Handlers
 *
 * Tool execution logic that works in both CLI and Frontend.
 * These handlers fetch data and return formatted results.
 */

import { fetchTickerData } from '../data/yahoo';
import { log } from '../utils';
import {
  formatTickerDataForAI,
  formatSearchResultsForAI,
} from '../data/formatters';
import {
  encodeTickerToTOON,
  encodeSearchToTOON,
  encodeUnusualOptionsToTOON,
} from '../toon';
import {
  isProxyConfigured,
  fetchFinancialsViaProxy,
  fetchHoldingsViaProxy,
} from '../data/yahoo-proxy';
import type {
  ToolResult,
  TickerToolResult,
  SearchToolResult,
  SearchResult,
  FinancialsDeep,
  FinancialsToolResult,
  InstitutionalHoldings,
  HoldingsToolResult,
  UnusualOptionsActivity,
  UnusualOptionsToolResult,
  UnusualOptionsSignal,
} from '../data/types';
import {
  analyzeTradingRegime,
  getRegimeEmoji,
  type TradingRegimeAnalysis,
} from '../market';

// Re-export for external consumers
export { formatRegimeForAI as formatTradingRegimeForAI } from '../market';
import {
  quickScan,
  SCAN_LISTS,
  formatScanResultsForAI,
  encodeScanResultsToTOON,
  type ScanResult,
  type TradeGrade,
} from '../scanner';

// ============================================================================
// RATE LIMITING
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastYahooRequest = 0;
const MIN_YAHOO_DELAY_MS = 1500; // 1.5s between requests

async function rateLimitedYahooRequest<T>(
  fn: () => Promise<T>,
  retries = 4,
  baseDelay = 3000 // Start with 3s delay
): Promise<T> {
  const now = Date.now();
  const timeSince = now - lastYahooRequest;
  if (timeSince < MIN_YAHOO_DELAY_MS) {
    await sleep(MIN_YAHOO_DELAY_MS - timeSince);
  }
  lastYahooRequest = Date.now();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message.toLowerCase();
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('too many requests') ||
        msg.includes('crumb');

      if (isRateLimit && attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        log.debug(
          `[Handler] Rate limited, waiting ${Math.round(delay / 1000)}s...`
        );
        await sleep(delay);
        lastYahooRequest = Date.now();
      } else if (!isRateLimit) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Unknown error after retries');
}

// ============================================================================
// FORMAT OPTIONS
// ============================================================================

/**
 * Output format for tool results
 * - 'text': Human-readable plain text (default)
 * - 'toon': Token-optimized TOON format (~14% fewer tokens)
 */
export type OutputFormat = 'text' | 'toon';

// ============================================================================
// OLLAMA WEB SEARCH API
// ============================================================================

const OLLAMA_WEB_SEARCH_URL = 'https://ollama.com/api/web_search';

interface OllamaWebSearchResult {
  title: string;
  url: string;
  content: string;
}

interface OllamaWebSearchResponse {
  results: OllamaWebSearchResult[];
}

// ============================================================================
// WEB SEARCH CONFIG
// ============================================================================

/**
 * Web search configuration - limit results to save tokens
 */
const WEB_SEARCH_CONFIG = {
  maxResults: 3, // Only fetch 3 results (was 5)
  maxSnippetLength: 300, // Truncate snippets to 300 chars
  maxTotalChars: 2000, // Total content limit ~2KB
};

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Clean HTML entities and tags from text
 */
function cleanHtmlContent(text: string): string {
  if (!text) return '';

  return (
    text
      // Decode common HTML entities
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&times;/g, '×')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove image markdown
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Collapse multiple spaces/newlines
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Ollama native web search implementation
 * Uses Ollama's web search API (requires OLLAMA_API_KEY)
 *
 * IMPORTANT: Results are limited to save tokens:
 * - Max 3 results
 * - Snippets truncated to 300 chars
 * - Total content capped at ~2KB
 */
export async function ollamaWebSearch(
  query: string,
  apiKey?: string,
  maxResults: number = WEB_SEARCH_CONFIG.maxResults
): Promise<SearchResult[]> {
  const key = apiKey || process.env.OLLAMA_API_KEY;

  if (!key) {
    throw new Error('OLLAMA_API_KEY required for web search');
  }

  log.debug(`[WebSearch] Searching: "${query}" (max ${maxResults} results)`);

  const response = await fetch(OLLAMA_WEB_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama web search failed: ${response.status} - ${errorText}`
    );
  }

  const data = (await response.json()) as OllamaWebSearchResponse;

  log.debug(`[WebSearch] Got ${data.results?.length ?? 0} results`);

  // Convert and truncate results
  let totalChars = 0;
  const results: SearchResult[] = [];

  for (const r of (data.results || []).slice(0, maxResults)) {
    // Clean and truncate title and snippet
    const cleanTitle = cleanHtmlContent(r.title || 'Untitled');
    const cleanContent = cleanHtmlContent(r.content || '');
    const snippet = truncateText(
      cleanContent,
      WEB_SEARCH_CONFIG.maxSnippetLength
    );

    // Check total limit
    const resultSize =
      cleanTitle.length + snippet.length + (r.url?.length || 0);
    if (totalChars + resultSize > WEB_SEARCH_CONFIG.maxTotalChars) {
      log.debug(
        `[WebSearch] Hit char limit, stopping at ${results.length} results`
      );
      break;
    }

    results.push({
      title: truncateText(cleanTitle, 100),
      url: r.url || '',
      snippet,
    });

    totalChars += resultSize;
  }

  log.debug(
    `[WebSearch] Returning ${results.length} results (${totalChars} chars)`
  );

  return results;
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

/**
 * Handle get_ticker_data tool call
 *
 * @param args - Tool arguments with ticker symbol
 * @param options - Optional format selection (default: 'toon' for token efficiency)
 */
export async function handleGetTickerData(
  args: { ticker: string },
  options: { format?: OutputFormat } = {}
): Promise<TickerToolResult> {
  const ticker = args.ticker?.toUpperCase() || '';
  const format = options.format ?? 'toon'; // Default to TOON for efficiency

  if (!ticker || ticker.length < 1 || ticker.length > 5) {
    return {
      success: false,
      error: `Invalid ticker: ${args.ticker}`,
    };
  }

  log.debug(
    `[Handler] Fetching ticker data for: ${ticker} (format: ${format})`
  );

  try {
    const data = await fetchTickerData(ticker);

    if (!data) {
      log.debug(`[Handler] No data returned for ${ticker}`);
      return {
        success: false,
        error: `Could not fetch data for ${ticker} - no quote available`,
      };
    }

    // Log summary for debugging (full data sent to frontend)
    log.debug(`[Handler] Got data for ${ticker}:`, {
      price: data.price,
      rsi: data.rsi,
      hasSpread: !!data.spread,
      peRatio: data.peRatio,
      beta: data.beta,
      marketCap: data.marketCap,
      hasAnalysts: !!data.analystRatings,
      hasOptions: !!data.optionsFlow,
    });

    // Use TOON format by default for token efficiency
    const formatted =
      format === 'toon'
        ? encodeTickerToTOON(data)
        : formatTickerDataForAI(data);

    log.debug(`[Handler] Formatted output: ${formatted.length} chars`);

    return {
      success: true,
      data,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Error fetching ${ticker}:`, errorMsg);
    return {
      success: false,
      error: `Error fetching ${ticker}: ${errorMsg}`,
    };
  }
}

/**
 * Handle web_search tool call
 * Uses Ollama's native web search API by default, or custom searchFn if provided
 *
 * @param args - Tool arguments with search query
 * @param options - Search function, API key, and format selection
 */
export async function handleWebSearch(
  args: { query: string },
  options?: {
    searchFn?: (query: string) => Promise<SearchResult[]>;
    apiKey?: string;
    format?: OutputFormat;
  }
): Promise<SearchToolResult> {
  const format = options?.format ?? 'toon'; // Default to TOON for efficiency

  try {
    let results: SearchResult[];

    if (options?.searchFn) {
      // Use custom search function if provided
      results = await options.searchFn(args.query);
    } else {
      // Default to Ollama's native web search
      results = await ollamaWebSearch(args.query, options?.apiKey);
    }

    // Use TOON format by default for token efficiency
    const formatted =
      format === 'toon'
        ? encodeSearchToTOON(results)
        : formatSearchResultsForAI(results);

    log.debug(`[Handler] Search formatted output: ${formatted.length} chars`);

    return {
      success: true,
      data: results,
      formatted,
    };
  } catch (error) {
    return {
      success: false,
      error: `Search error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

// ============================================================================
// FINANCIALS HANDLER
// ============================================================================

/**
 * Format large numbers for readability
 */
function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

/**
 * Handle get_financials_deep tool call
 * Fetches detailed financial statements from Yahoo Finance
 */
export async function handleGetFinancialsDeep(args: {
  ticker: string;
}): Promise<FinancialsToolResult> {
  const ticker = args.ticker?.toUpperCase() || '';

  if (!ticker || ticker.length < 1 || ticker.length > 5) {
    return {
      success: false,
      error: `Invalid ticker: ${args.ticker}`,
    };
  }

  log.debug(`[Handler] Fetching financials for: ${ticker}`);

  // Try proxy first (no rate limiting issues)
  if (isProxyConfigured()) {
    try {
      const proxyData = await fetchFinancialsViaProxy(ticker);
      if (proxyData) {
        // Convert null to undefined for type compatibility
        const financials: FinancialsDeep = {
          ticker: proxyData.ticker,
          currency: proxyData.currency,
          fiscalYear: proxyData.fiscalYear,
          income: {
            ...proxyData.income,
            revenueGrowth: proxyData.income.revenueGrowth ?? undefined,
            epsGrowth: proxyData.income.epsGrowth ?? undefined,
          },
          balance: proxyData.balance,
          cashFlow: {
            ...proxyData.cashFlow,
            fcfYield: proxyData.cashFlow.fcfYield ?? undefined,
            dividendsPaid: proxyData.cashFlow.dividendsPaid ?? undefined,
          },
          valuationMetrics: {
            peRatio: proxyData.valuationMetrics.peRatio ?? undefined,
            forwardPE: proxyData.valuationMetrics.forwardPE ?? undefined,
            pegRatio: proxyData.valuationMetrics.pegRatio ?? undefined,
            priceToBook: proxyData.valuationMetrics.priceToBook ?? undefined,
            priceToSales: proxyData.valuationMetrics.priceToSales ?? undefined,
            evToEbitda: proxyData.valuationMetrics.evToEbitda ?? undefined,
          },
        };

        const formatted = `
=== FINANCIALS: ${ticker} (FY${financials.fiscalYear}) ===

📊 INCOME STATEMENT
Revenue: ${formatLargeNumber(proxyData.income.revenue)}${
          proxyData.income.revenueGrowth
            ? ` (${proxyData.income.revenueGrowth > 0 ? '+' : ''}${
                proxyData.income.revenueGrowth
              }% YoY)`
            : ''
        }
Gross Margin: ${proxyData.income.grossMargin}%
Operating Margin: ${proxyData.income.operatingMargin}%
Net Margin: ${proxyData.income.netMargin}%
EPS: $${proxyData.income.eps.toFixed(2)}${
          proxyData.income.epsGrowth
            ? ` (${proxyData.income.epsGrowth > 0 ? '+' : ''}${
                proxyData.income.epsGrowth
              }% growth)`
            : ''
        }

📋 BALANCE SHEET
Total Assets: ${formatLargeNumber(proxyData.balance.totalAssets)}
Cash: ${formatLargeNumber(proxyData.balance.cash)}
Total Debt: ${formatLargeNumber(proxyData.balance.totalDebt)}
Debt/Equity: ${proxyData.balance.debtToEquity}x
Current Ratio: ${proxyData.balance.currentRatio}x

💰 CASH FLOW
Operating CF: ${formatLargeNumber(proxyData.cashFlow.operatingCashFlow)}
CapEx: ${formatLargeNumber(proxyData.cashFlow.capitalExpenditure)}
Free Cash Flow: ${formatLargeNumber(proxyData.cashFlow.freeCashFlow)}${
          proxyData.cashFlow.fcfYield
            ? ` (${proxyData.cashFlow.fcfYield}% yield)`
            : ''
        }

📈 VALUATION
P/E: ${proxyData.valuationMetrics?.peRatio?.toFixed(1) ?? 'N/A'}
Forward P/E: ${proxyData.valuationMetrics?.forwardPE?.toFixed(1) ?? 'N/A'}
PEG: ${proxyData.valuationMetrics?.pegRatio?.toFixed(2) ?? 'N/A'}
P/B: ${proxyData.valuationMetrics?.priceToBook?.toFixed(2) ?? 'N/A'}
EV/EBITDA: ${proxyData.valuationMetrics?.evToEbitda?.toFixed(1) ?? 'N/A'}
`.trim();

        return {
          success: true,
          data: financials,
          formatted,
        };
      }
    } catch (proxyError) {
      log.debug(`[Handler] Proxy financials failed, falling back:`, proxyError);
    }
  }

  // Fallback to direct yahoo-finance2
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    // Sequential requests to avoid rate limits
    const quote = await rateLimitedYahooRequest(() =>
      yahooFinance.quote(ticker)
    );
    const summary = await rateLimitedYahooRequest(() =>
      yahooFinance.quoteSummary(ticker, {
        modules: [
          'incomeStatementHistory',
          'balanceSheetHistory',
          'cashflowStatementHistory',
          'financialData',
          'defaultKeyStatistics',
        ],
      })
    );

    if (!quote || !summary) {
      return {
        success: false,
        error: `Could not fetch financial data for ${ticker}`,
      };
    }

    const income = summary.incomeStatementHistory?.incomeStatementHistory?.[0];
    const balance = summary.balanceSheetHistory?.balanceSheetStatements?.[0];
    const cashflow = summary.cashflowStatementHistory?.cashflowStatements?.[0];
    const fd = summary.financialData;
    const ks = summary.defaultKeyStatistics;

    // Build income statement
    const totalRevenue = income?.totalRevenue ?? 0;
    const grossProfit = income?.grossProfit ?? 0;
    const operatingIncome = income?.operatingIncome ?? 0;
    const netIncome = income?.netIncome ?? 0;

    const incomeStatement = {
      revenue: totalRevenue,
      revenueGrowth: fd?.revenueGrowth
        ? Math.round(fd.revenueGrowth * 1000) / 10
        : undefined,
      grossProfit,
      grossMargin:
        totalRevenue > 0
          ? Math.round((grossProfit / totalRevenue) * 1000) / 10
          : 0,
      operatingIncome,
      operatingMargin:
        totalRevenue > 0
          ? Math.round((operatingIncome / totalRevenue) * 1000) / 10
          : 0,
      netIncome,
      netMargin:
        totalRevenue > 0
          ? Math.round((netIncome / totalRevenue) * 1000) / 10
          : 0,
      eps: quote.trailingEps ?? 0,
      epsGrowth: fd?.earningsGrowth
        ? Math.round(fd.earningsGrowth * 1000) / 10
        : undefined,
    };

    // Build balance sheet - use type assertion for yahoo-finance2 compatibility
    const balanceAny = balance as
      | Record<string, number | undefined>
      | undefined;
    const totalAssets = balanceAny?.totalAssets ?? 0;
    const totalLiabilities =
      balanceAny?.totalLiab ?? balanceAny?.totalLiabilities ?? 0;
    const totalEquity =
      balanceAny?.totalStockholderEquity ?? balanceAny?.stockholdersEquity ?? 0;
    const cash = balanceAny?.cash ?? balanceAny?.cashAndCashEquivalents ?? 0;
    const totalDebt = balanceAny?.longTermDebt ?? balanceAny?.totalDebt ?? 0;
    const currentAssets = balanceAny?.totalCurrentAssets ?? 0;
    const currentLiabilities = balanceAny?.totalCurrentLiabilities ?? 1;

    const balanceSheet = {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cash,
      totalDebt,
      debtToEquity:
        totalEquity > 0 ? Math.round((totalDebt / totalEquity) * 100) / 100 : 0,
      currentRatio:
        currentLiabilities > 0
          ? Math.round((currentAssets / currentLiabilities) * 100) / 100
          : 0,
    };

    // Build cash flow - use type assertion for yahoo-finance2 compatibility
    const cashflowAny = cashflow as
      | Record<string, number | undefined>
      | undefined;
    const operatingCashFlow =
      cashflowAny?.totalCashFromOperatingActivities ??
      cashflowAny?.operatingCashflow ??
      0;
    const capex = Math.abs(
      cashflowAny?.capitalExpenditures ?? cashflowAny?.capitalExpenditure ?? 0
    );
    const fcf = operatingCashFlow - capex;
    const marketCap = quote.marketCap ?? 1;

    const dividends =
      cashflowAny?.dividendsPaid ?? cashflowAny?.cashDividendsPaid;
    const cashFlowData = {
      operatingCashFlow,
      capitalExpenditure: capex,
      freeCashFlow: fcf,
      fcfYield:
        marketCap > 0 ? Math.round((fcf / marketCap) * 1000) / 10 : undefined,
      dividendsPaid: dividends ? Math.abs(dividends) : undefined,
    };

    const financials: FinancialsDeep = {
      ticker,
      currency: 'USD',
      fiscalYear: income?.endDate
        ? new Date(income.endDate).getFullYear().toString()
        : 'TTM',
      income: incomeStatement,
      balance: balanceSheet,
      cashFlow: cashFlowData,
      valuationMetrics: {
        peRatio: quote.trailingPE,
        forwardPE: quote.forwardPE,
        pegRatio: ks?.pegRatio as number | undefined,
        priceToBook: ks?.priceToBook as number | undefined,
        priceToSales: ks?.priceToSalesTrailing12Months as number | undefined,
        evToEbitda: ks?.enterpriseToEbitda as number | undefined,
      },
    };

    // Format for AI
    const formatted = `
=== FINANCIALS: ${ticker} (FY${financials.fiscalYear}) ===

📊 INCOME STATEMENT
Revenue: ${formatLargeNumber(incomeStatement.revenue)}${
      incomeStatement.revenueGrowth
        ? ` (${incomeStatement.revenueGrowth > 0 ? '+' : ''}${
            incomeStatement.revenueGrowth
          }% YoY)`
        : ''
    }
Gross Margin: ${incomeStatement.grossMargin}%
Operating Margin: ${incomeStatement.operatingMargin}%
Net Margin: ${incomeStatement.netMargin}%
EPS: $${incomeStatement.eps.toFixed(2)}${
      incomeStatement.epsGrowth
        ? ` (${incomeStatement.epsGrowth > 0 ? '+' : ''}${
            incomeStatement.epsGrowth
          }% growth)`
        : ''
    }

📋 BALANCE SHEET
Total Assets: ${formatLargeNumber(balanceSheet.totalAssets)}
Cash: ${formatLargeNumber(balanceSheet.cash)}
Total Debt: ${formatLargeNumber(balanceSheet.totalDebt)}
Debt/Equity: ${balanceSheet.debtToEquity}x
Current Ratio: ${balanceSheet.currentRatio}x

💰 CASH FLOW
Operating CF: ${formatLargeNumber(cashFlowData.operatingCashFlow)}
CapEx: ${formatLargeNumber(cashFlowData.capitalExpenditure)}
Free Cash Flow: ${formatLargeNumber(cashFlowData.freeCashFlow)}${
      cashFlowData.fcfYield ? ` (${cashFlowData.fcfYield}% yield)` : ''
    }

📈 VALUATION
P/E: ${financials.valuationMetrics?.peRatio?.toFixed(1) ?? 'N/A'}
Forward P/E: ${financials.valuationMetrics?.forwardPE?.toFixed(1) ?? 'N/A'}
PEG: ${financials.valuationMetrics?.pegRatio?.toFixed(2) ?? 'N/A'}
P/B: ${financials.valuationMetrics?.priceToBook?.toFixed(2) ?? 'N/A'}
EV/EBITDA: ${financials.valuationMetrics?.evToEbitda?.toFixed(1) ?? 'N/A'}
`.trim();

    return {
      success: true,
      data: financials,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Financials error for ${ticker}:`, errorMsg);
    return {
      success: false,
      error: `Error fetching financials for ${ticker}: ${errorMsg}`,
    };
  }
}

// ============================================================================
// INSTITUTIONAL HOLDINGS HANDLER
// ============================================================================

/**
 * Handle get_institutional_holdings tool call
 * Fetches institutional ownership from Yahoo Finance
 */
export async function handleGetInstitutionalHoldings(args: {
  ticker: string;
}): Promise<HoldingsToolResult> {
  const ticker = args.ticker?.toUpperCase() || '';

  if (!ticker || ticker.length < 1 || ticker.length > 5) {
    return {
      success: false,
      error: `Invalid ticker: ${args.ticker}`,
    };
  }

  log.debug(`[Handler] Fetching institutional holdings for: ${ticker}`);

  // Try proxy first (no rate limiting issues)
  if (isProxyConfigured()) {
    try {
      const proxyData = await fetchHoldingsViaProxy(ticker);
      if (proxyData) {
        const holdings: InstitutionalHoldings = {
          ticker: proxyData.ticker,
          institutionalOwnership: proxyData.institutionsPercent ?? 0,
          numberOfHolders: proxyData.institutionsCount ?? 0,
          topHolders: proxyData.topHolders.map((h) => ({
            holder: h.name,
            shares: 0, // Not available in proxy response
            value: h.value,
            percentOfPortfolio: h.pctHeld,
          })),
          insiderOwnership: proxyData.insidersPercent ?? undefined,
        };

        const formatted = `
=== INSTITUTIONAL HOLDINGS: ${ticker} ===

📊 OWNERSHIP BREAKDOWN
Institutional: ${holdings.institutionalOwnership}%
Insider: ${holdings.insiderOwnership ?? 'N/A'}%
Number of Institutions: ${holdings.numberOfHolders}

🏦 TOP HOLDERS
${proxyData.topHolders
  .slice(0, 5)
  .map(
    (h, i) =>
      `${i + 1}. ${h.name}: ${formatLargeNumber(h.value)} (${h.pctHeld}%)`
  )
  .join('\n')}
`.trim();

        return {
          success: true,
          data: holdings,
          formatted,
        };
      }
    } catch (proxyError) {
      log.debug(`[Handler] Proxy holdings failed, falling back:`, proxyError);
    }
  }

  // Fallback to direct yahoo-finance2
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    const summary = await rateLimitedYahooRequest(() =>
      yahooFinance.quoteSummary(ticker, {
        modules: [
          'institutionOwnership',
          'majorHoldersBreakdown',
          'insiderHolders',
        ],
      })
    );

    if (!summary) {
      return {
        success: false,
        error: `Could not fetch holdings data for ${ticker}`,
      };
    }

    const breakdown = summary.majorHoldersBreakdown;
    const institutions = summary.institutionOwnership?.ownershipList ?? [];

    // Map top holders
    const topHolders = institutions.slice(0, 10).map((inst) => ({
      holder: inst.organization || 'Unknown',
      shares: inst.position ?? 0,
      value: inst.value ?? 0,
      percentOfPortfolio: inst.pctHeld
        ? Math.round(inst.pctHeld * 10000) / 100
        : undefined,
      change: inst.pctChange
        ? Math.round(inst.pctChange * 100) / 100
        : undefined,
      changeType: inst.pctChange
        ? inst.pctChange > 0.05
          ? ('INCREASED' as const)
          : inst.pctChange < -0.05
            ? ('DECREASED' as const)
            : ('UNCHANGED' as const)
        : undefined,
    }));

    const holdings: InstitutionalHoldings = {
      ticker,
      institutionalOwnership: breakdown?.institutionsPercentHeld
        ? Math.round(breakdown.institutionsPercentHeld * 1000) / 10
        : 0,
      numberOfHolders: institutions.length,
      topHolders,
      insiderOwnership: breakdown?.insidersPercentHeld
        ? Math.round(breakdown.insidersPercentHeld * 1000) / 10
        : undefined,
    };

    // Format for AI
    const formatted = `
=== INSTITUTIONAL HOLDINGS: ${ticker} ===

📊 OWNERSHIP BREAKDOWN
Institutional: ${holdings.institutionalOwnership}%
Insider: ${holdings.insiderOwnership ?? 'N/A'}%
Number of Institutions: ${holdings.numberOfHolders}

🏦 TOP HOLDERS
${topHolders
  .slice(0, 5)
  .map(
    (h, i) =>
      `${i + 1}. ${h.holder}: ${formatLargeNumber(h.value)} (${h.shares.toLocaleString()} shares)${
        h.change ? ` ${h.change > 0 ? '↑' : '↓'}${Math.abs(h.change)}%` : ''
      }`
  )
  .join('\n')}
`.trim();

    return {
      success: true,
      data: holdings,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Holdings error for ${ticker}:`, errorMsg);
    return {
      success: false,
      error: `Error fetching holdings for ${ticker}: ${errorMsg}`,
    };
  }
}

// ============================================================================
// UNUSUAL OPTIONS ACTIVITY HANDLER
// ============================================================================

/**
 * Handle get_unusual_options_activity tool call
 * Fetches signals from Supabase database
 */
export async function handleGetUnusualOptionsActivity(
  args: { ticker?: string; minGrade?: string; limit?: number },
  options?: { supabaseUrl?: string; supabaseKey?: string }
): Promise<UnusualOptionsToolResult> {
  const ticker = args.ticker?.toUpperCase();
  const minGrade = args.minGrade ?? 'B';
  const limit = args.limit ?? 10;

  log.debug(`[Handler] Fetching unusual options activity`, {
    ticker: ticker ?? 'all',
    minGrade,
    limit,
  });

  try {
    // Get Supabase credentials from environment or options
    const supabaseUrl =
      options?.supabaseUrl ??
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL;
    const supabaseKey =
      options?.supabaseKey ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error: 'Supabase credentials not configured',
      };
    }

    // Build grade filter based on minGrade
    const gradeOrder = ['S', 'A', 'B', 'C', 'D', 'F'];
    const minGradeIndex = gradeOrder.indexOf(minGrade);
    const validGrades = gradeOrder.slice(0, minGradeIndex + 1);

    // Build query string manually (URLSearchParams may not have append in all TS configs)
    const queryParts = [
      'select=*',
      'is_active=eq.true',
      `grade=in.(${validGrades.join(',')})`,
      'order=overall_score.desc,detection_timestamp.desc',
      `limit=${limit}`,
    ];
    if (ticker) {
      queryParts.push(`ticker=eq.${ticker}`);
    }
    const params = queryParts.join('&');

    const response = await fetch(
      `${supabaseUrl}/rest/v1/unusual_options_signals?${params.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const rawSignals = (await response.json()) as Record<string, unknown>[];

    // Map to our type
    const signals: UnusualOptionsSignal[] = rawSignals.map(
      (s: Record<string, unknown>) => ({
        signalId: s.signal_id as string,
        ticker: s.ticker as string,
        optionSymbol: s.option_symbol as string,
        strike: Number(s.strike),
        expiry: s.expiry as string,
        optionType: s.option_type as 'call' | 'put',
        daysToExpiry: s.days_to_expiry as number,
        moneyness: s.moneyness as 'ITM' | 'ATM' | 'OTM',
        currentVolume: s.current_volume as number,
        averageVolume: Number(s.average_volume),
        volumeRatio: Number(s.volume_ratio),
        premiumFlow: Number(s.premium_flow),
        hasVolumeAnomaly: s.has_volume_anomaly as boolean,
        hasOISpike: s.has_oi_spike as boolean,
        hasSweep: s.has_sweep as boolean,
        hasBlockTrade: s.has_block_trade as boolean,
        overallScore: Number(s.overall_score),
        grade: s.grade as 'S' | 'A' | 'B' | 'C' | 'D' | 'F',
        sentiment: s.sentiment as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
        riskLevel: s.risk_level as 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
        underlyingPrice: Number(s.underlying_price),
        impliedVolatility: s.implied_volatility
          ? Number(s.implied_volatility)
          : undefined,
        detectionTimestamp: s.detection_timestamp as string,
        isNew: s.is_new_signal as boolean,
        detectionCount: s.detection_count as number,
      })
    );

    // Build summary
    const bullishCount = signals.filter(
      (s) => s.sentiment === 'BULLISH'
    ).length;
    const bearishCount = signals.filter(
      (s) => s.sentiment === 'BEARISH'
    ).length;
    const avgScore =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.overallScore, 0) / signals.length
        : 0;

    const activity: UnusualOptionsActivity = {
      signals,
      summary: {
        totalSignals: signals.length,
        bullishCount,
        bearishCount,
        avgScore: Math.round(avgScore * 1000) / 1000,
        topGrade: signals[0]?.grade ?? 'N/A',
      },
    };

    // Format for AI using TOON (token-efficient)
    const formatted = encodeUnusualOptionsToTOON(signals, activity.summary);

    return {
      success: true,
      data: activity,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Unusual options error:`, errorMsg);
    return {
      success: false,
      error: `Error fetching unusual options: ${errorMsg}`,
    };
  }
}

// ============================================================================
// TRADING REGIME HANDLER
// ============================================================================

/**
 * Tool result for trading regime analysis
 */
export interface TradingRegimeToolResult extends ToolResult {
  data?: TradingRegimeAnalysis;
}

/**
 * Handle get_trading_regime tool call
 * Analyzes market conditions to determine if trading is advisable
 */
export async function handleGetTradingRegime(
  args: { ticker?: string },
  _options?: { format?: OutputFormat }
): Promise<TradingRegimeToolResult> {
  log.debug(
    `[Handler] Analyzing trading regime${args.ticker ? ` for ${args.ticker}` : ''}`
  );

  try {
    // Analyze current market conditions
    // Note: Full price history analysis requires historical data
    // For now, we analyze based on VIX, SPY, and breadth indicators
    const analysis = await analyzeTradingRegime();

    if (!analysis) {
      return {
        success: false,
        error: 'Could not analyze trading regime',
      };
    }

    // Format for AI consumption
    const emoji = getRegimeEmoji(analysis.regime);
    const formatted = `
=== TRADING REGIME ANALYSIS ===
${emoji} REGIME: ${analysis.regime}
Confidence: ${analysis.confidence}%
Primary Reason: ${analysis.primaryReason.replace(/_/g, ' ')}

📊 METRICS
• Trend Strength: ${analysis.metrics.trendStrength}
• Conflict Score: ${analysis.metrics.conflictScore}%${
      analysis.metrics.vixLevel
        ? `\n• VIX: ${analysis.vix?.current} (${analysis.metrics.vixLevel})`
        : ''
    }${analysis.metrics.spyTrend ? `\n• SPY: ${analysis.metrics.spyTrend}` : ''}${
      analysis.metrics.adxValue !== undefined
        ? `\n• ADX: ${analysis.metrics.adxValue?.toFixed(1)} (${analysis.metrics.adxTrend})`
        : ''
    }${
      analysis.metrics.breadthScore !== undefined
        ? `\n• Breadth: ${analysis.metrics.breadthScore?.toFixed(0)}% (${analysis.metrics.breadthSignal})`
        : ''
    }

🎯 FACTORS
${analysis.reasons.map((r) => `• ${r}`).join('\n')}

💡 RECOMMENDATION
${analysis.recommendation}
`.trim();

    log.debug(`[Handler] Regime: ${analysis.regime} (${analysis.confidence}%)`);

    return {
      success: true,
      data: analysis,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Trading regime error:`, errorMsg);
    return {
      success: false,
      error: `Error analyzing trading regime: ${errorMsg}`,
    };
  }
}

// ============================================================================
// IV BY STRIKE HANDLER
// ============================================================================

export interface IVByStrikeResult {
  strike: number;
  callIV: number | null;
  putIV: number | null;
  dte: number;
  expirationDate: string;
}

export interface IVByStrikeToolResult extends ToolResult {
  data?: IVByStrikeResult;
}

/**
 * Get IV for a specific strike and target DTE
 */
export async function handleGetIVByStrike(
  args: { ticker: string; strike: number; targetDTE?: number },
  _options: { format?: OutputFormat } = {}
): Promise<IVByStrikeToolResult> {
  const { ticker, strike, targetDTE = 30 } = args;
  const symbol = ticker.toUpperCase();

  try {
    log.debug(`[Handler] Fetching IV for ${symbol} at $${strike} strike...`);

    // Use the yahoo-client from ai-analyst (we'll import dynamically)
    // For now, implement directly using shared options chain fetcher
    const { getOptionsChain } = await import('../options/chain');

    const chain = await rateLimitedYahooRequest(() =>
      getOptionsChain(symbol, targetDTE)
    );

    if (!chain || chain.calls.length === 0) {
      return {
        success: false,
        error: `No options data available for ${symbol}`,
      };
    }

    // Find call and put at the specified strike
    const call = chain.calls.find((c) => Math.abs(c.strike - strike) < 0.5);
    const put = chain.puts.find((p) => Math.abs(p.strike - strike) < 0.5);

    if (!call && !put) {
      return {
        success: false,
        error: `Strike $${strike} not found in options chain for ${symbol}`,
      };
    }

    const result: IVByStrikeResult = {
      strike,
      callIV: call?.impliedVolatility
        ? Math.round(call.impliedVolatility * 100 * 10) / 10
        : null,
      putIV: put?.impliedVolatility
        ? Math.round(put.impliedVolatility * 100 * 10) / 10
        : null,
      dte: chain.dte,
      expirationDate: chain.expiration.toISOString().split('T')[0],
    };

    const formatted = `
📊 IV FOR ${symbol} $${strike} STRIKE (${result.dte} DTE)
• Call IV: ${result.callIV !== null ? `${result.callIV}%` : 'N/A'}
• Put IV: ${result.putIV !== null ? `${result.putIV}%` : 'N/A'}
• Expiration: ${result.expirationDate}
`.trim();

    log.debug(
      `[Handler] IV at $${strike}: Call ${result.callIV}%, Put ${result.putIV}%`
    );

    return {
      success: true,
      data: result,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] IV by strike error:`, errorMsg);
    return {
      success: false,
      error: `Error fetching IV for ${symbol}: ${errorMsg}`,
    };
  }
}

// ============================================================================
// CALCULATE SPREAD HANDLER
// ============================================================================

export interface SpreadCalculationResult {
  longStrike: number;
  shortStrike: number;
  dte: number;
  expirationDate: string;
  underlyingPrice: number;
  longBid: number;
  longAsk: number;
  longMid: number;
  shortBid: number;
  shortAsk: number;
  shortMid: number;
  estimatedDebit: number;
  maxProfit: number;
  breakeven: number;
  cushion: number;
  longIV: number | null;
  shortIV: number | null;
  longOI: number;
  shortOI: number;
  returnOnRisk: number;
}

export interface SpreadCalculationToolResult extends ToolResult {
  data?: SpreadCalculationResult;
}

/**
 * Calculate exact pricing for user-specified spread
 */
export async function handleCalculateSpread(
  args: {
    ticker: string;
    longStrike: number;
    shortStrike: number;
    targetDTE?: number;
  },
  _options: { format?: OutputFormat } = {}
): Promise<SpreadCalculationToolResult> {
  const { ticker, longStrike, shortStrike, targetDTE = 30 } = args;
  const symbol = ticker.toUpperCase();

  try {
    log.debug(
      `[Handler] Calculating $${longStrike}/$${shortStrike} spread for ${symbol}...`
    );

    // Validate strikes
    if (longStrike >= shortStrike) {
      return {
        success: false,
        error: `Long strike ($${longStrike}) must be less than short strike ($${shortStrike})`,
      };
    }

    // Get options chain
    const { getOptionsChain } = await import('../options/chain');

    const chain = await rateLimitedYahooRequest(() =>
      getOptionsChain(symbol, targetDTE)
    );

    if (!chain || chain.calls.length === 0) {
      return {
        success: false,
        error: `No options data available for ${symbol}`,
      };
    }

    // Find calls at specified strikes
    const longCall = chain.calls.find(
      (c) => Math.abs(c.strike - longStrike) < 0.5
    );
    const shortCall = chain.calls.find(
      (c) => Math.abs(c.strike - shortStrike) < 0.5
    );

    if (!longCall) {
      return {
        success: false,
        error: `Long strike $${longStrike} not found in options chain`,
      };
    }

    if (!shortCall) {
      return {
        success: false,
        error: `Short strike $${shortStrike} not found in options chain`,
      };
    }

    const underlyingPrice = chain.underlyingPrice;

    // Calculate pricing
    const longMid = (longCall.bid + longCall.ask) / 2 || longCall.mid;
    const shortMid = (shortCall.bid + shortCall.ask) / 2 || shortCall.mid;

    // Use worst-case fills
    const longAsk = longCall.ask || longMid;
    const shortBid = shortCall.bid || shortMid;
    let estimatedDebit = longAsk - shortBid;

    const spreadWidth = shortStrike - longStrike;

    // Validate debit
    if (estimatedDebit <= 0 || estimatedDebit >= spreadWidth) {
      estimatedDebit = longMid - shortMid;
    }

    const maxProfit = spreadWidth - estimatedDebit;
    const breakeven = longStrike + estimatedDebit;
    const cushion = ((underlyingPrice - breakeven) / underlyingPrice) * 100;
    const returnOnRisk = (maxProfit / estimatedDebit) * 100;

    const result: SpreadCalculationResult = {
      longStrike,
      shortStrike,
      dte: chain.dte,
      expirationDate: chain.expiration.toISOString().split('T')[0],
      underlyingPrice: Math.round(underlyingPrice * 100) / 100,
      longBid: longCall.bid,
      longAsk: longCall.ask,
      longMid: Math.round(longMid * 100) / 100,
      shortBid: shortCall.bid,
      shortAsk: shortCall.ask,
      shortMid: Math.round(shortMid * 100) / 100,
      estimatedDebit: Math.round(estimatedDebit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      cushion: Math.round(cushion * 100) / 100,
      longIV: longCall.impliedVolatility
        ? Math.round(longCall.impliedVolatility * 100 * 10) / 10
        : null,
      shortIV: shortCall.impliedVolatility
        ? Math.round(shortCall.impliedVolatility * 100 * 10) / 10
        : null,
      longOI: longCall.openInterest,
      shortOI: shortCall.openInterest,
      returnOnRisk: Math.round(returnOnRisk * 10) / 10,
    };

    // Format output
    const itmPct = ((underlyingPrice - longStrike) / underlyingPrice) * 100;
    const itmLabel = itmPct > 0 ? `${itmPct.toFixed(1)}% ITM` : 'OTM';

    const formatted = `
📊 ${symbol} $${longStrike}/$${shortStrike} CDS (${result.dte} DTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stock: $${result.underlyingPrice}
Expiry: ${result.expirationDate}

PRICING (per contract)
• Long $${longStrike}: Bid $${result.longBid.toFixed(2)} / Ask $${result.longAsk.toFixed(2)}
• Short $${shortStrike}: Bid $${result.shortBid.toFixed(2)} / Ask $${result.shortAsk.toFixed(2)}
• Est. Debit: $${result.estimatedDebit.toFixed(2)} ($${(result.estimatedDebit * 100).toFixed(0)} per contract)

RISK/REWARD
• Max Profit: $${result.maxProfit.toFixed(2)} ($${(result.maxProfit * 100).toFixed(0)})
• Return on Risk: ${result.returnOnRisk.toFixed(1)}%
• Breakeven: $${result.breakeven.toFixed(2)}
• Cushion: ${result.cushion.toFixed(1)}% (${itmLabel})

LIQUIDITY
• Long OI: ${result.longOI.toLocaleString()} | IV: ${result.longIV ?? 'N/A'}%
• Short OI: ${result.shortOI.toLocaleString()} | IV: ${result.shortIV ?? 'N/A'}%
`.trim();

    log.debug(
      `[Handler] Spread: Debit $${result.estimatedDebit}, ` +
        `Max $${result.maxProfit}, Cushion ${result.cushion}%`
    );

    return {
      success: true,
      data: result,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Calculate spread error:`, errorMsg);
    return {
      success: false,
      error: `Error calculating spread for ${symbol}: ${errorMsg}`,
    };
  }
}

// ============================================================================
// SCAN OPPORTUNITIES HANDLER
// ============================================================================

export interface ScanOpportunitiesResult {
  scanList: string;
  tickersScanned: number;
  results: ScanResult[];
  summary: {
    total: number;
    gradeA: number;
    gradeB: number;
    lowRisk: number;
    avgCushion: number;
  };
}

export interface ScanOpportunitiesToolResult extends ToolResult {
  data?: ScanOpportunitiesResult;
}

/**
 * Handle scan_opportunities tool call
 * Scans multiple tickers for trade opportunities
 */
export async function handleScanOpportunities(
  args: {
    scanList?: string;
    tickers?: string;
    minGrade?: string;
    maxRisk?: number;
  },
  options: { format?: OutputFormat; onProgress?: (msg: string) => void } = {}
): Promise<ScanOpportunitiesToolResult> {
  const { scanList = 'TECH', tickers, minGrade = 'B', maxRisk = 6 } = args;
  const format = options.format ?? 'toon';

  log.debug(`[Handler] Scanning for opportunities`, {
    scanList,
    tickers,
    minGrade,
    maxRisk,
  });

  try {
    // Determine which tickers to scan
    let tickerList: readonly string[];

    if (tickers) {
      // User specified custom tickers
      tickerList = tickers
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0);
      log.debug(`[Handler] Using custom ticker list: ${tickerList.join(', ')}`);
    } else {
      // Use predefined scan list
      const listKey = scanList.toUpperCase() as keyof typeof SCAN_LISTS;
      tickerList = SCAN_LISTS[listKey] ?? SCAN_LISTS.TECH;
      log.debug(
        `[Handler] Using scan list: ${listKey} (${tickerList.length} tickers)`
      );
    }

    // Run the scan
    const results = await quickScan(tickerList, {
      minGrade: minGrade as TradeGrade,
      maxRisk,
      onProgress: (ticker, current, total) => {
        options.onProgress?.(`Scanning ${ticker} (${current}/${total})`);
      },
    });

    // Build summary statistics
    const gradeACount = results.filter((r) =>
      ['A+', 'A', 'A-'].includes(r.grade)
    ).length;
    const gradeBCount = results.filter((r) =>
      ['B+', 'B', 'B-'].includes(r.grade)
    ).length;
    const lowRiskCount = results.filter((r) => r.risk.score <= 4).length;
    const avgCushion =
      results.length > 0
        ? results.reduce((sum, r) => sum + (r.cushionPercent ?? 0), 0) /
          results.length
        : 0;

    const scanResult: ScanOpportunitiesResult = {
      scanList: tickers ? 'CUSTOM' : scanList.toUpperCase(),
      tickersScanned: tickerList.length,
      results,
      summary: {
        total: results.length,
        gradeA: gradeACount,
        gradeB: gradeBCount,
        lowRisk: lowRiskCount,
        avgCushion: Math.round(avgCushion * 10) / 10,
      },
    };

    // Format output
    const formatted =
      format === 'toon'
        ? encodeScanResultsToTOON(results)
        : formatScanResultsForAI(results);

    log.debug(
      `[Handler] Scan complete: ${results.length} opportunities found ` +
        `(${gradeACount} A-grade, ${gradeBCount} B-grade)`
    );

    return {
      success: true,
      data: scanResult,
      formatted,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Handler] Scan opportunities error:`, errorMsg);
    return {
      success: false,
      error: `Error scanning for opportunities: ${errorMsg}`,
    };
  }
}

// ============================================================================
// UNIFIED TOOL EXECUTOR
// ============================================================================

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutorOptions {
  searchFn?: (query: string) => Promise<SearchResult[]>;
  apiKey?: string; // Ollama API key for native web search
  format?: OutputFormat; // Output format (default: 'toon')
  supabaseUrl?: string; // Supabase URL for unusual options
  supabaseKey?: string; // Supabase key for unusual options
  onStatus?: (message: string) => void;
  onToolResult?: (tool: string, result: ToolResult) => void; // Callback for UI
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  options: ToolExecutorOptions = {}
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;
  const {
    searchFn,
    apiKey,
    format,
    supabaseUrl,
    supabaseKey,
    onStatus,
    onToolResult,
  } = options;

  let result: ToolResult;

  switch (name) {
    case 'get_ticker_data': {
      const ticker = (args.ticker as string).toUpperCase();
      onStatus?.(`📊 Fetching ${ticker} data...`);
      result = await handleGetTickerData({ ticker }, { format });
      onToolResult?.(name, result);
      return result;
    }

    case 'web_search': {
      const query = args.query as string;
      onStatus?.(`🌐 Searching: "${query}"`);
      result = await handleWebSearch({ query }, { searchFn, apiKey, format });
      onToolResult?.(name, result);
      return result;
    }

    case 'get_financials_deep': {
      const ticker = (args.ticker as string).toUpperCase();
      onStatus?.(`📈 Fetching ${ticker} financials...`);
      result = await handleGetFinancialsDeep({ ticker });
      onToolResult?.(name, result);
      return result;
    }

    case 'get_institutional_holdings': {
      const ticker = (args.ticker as string).toUpperCase();
      onStatus?.(`🏦 Fetching ${ticker} institutional holdings...`);
      result = await handleGetInstitutionalHoldings({ ticker });
      onToolResult?.(name, result);
      return result;
    }

    case 'get_unusual_options_activity': {
      const ticker = args.ticker as string | undefined;
      onStatus?.(
        ticker
          ? `🔥 Fetching unusual options for ${ticker}...`
          : `🔥 Fetching unusual options activity...`
      );
      result = await handleGetUnusualOptionsActivity(
        {
          ticker,
          minGrade: args.minGrade as string | undefined,
          limit: args.limit as number | undefined,
        },
        { supabaseUrl, supabaseKey }
      );
      onToolResult?.(name, result);
      return result;
    }

    case 'get_trading_regime': {
      const ticker = args.ticker as string | undefined;
      onStatus?.(
        ticker
          ? `🚦 Analyzing trading regime for ${ticker}...`
          : `🚦 Analyzing market trading regime...`
      );
      result = await handleGetTradingRegime({ ticker }, { format });
      onToolResult?.(name, result);
      return result;
    }

    case 'get_iv_by_strike': {
      const ticker = (args.ticker as string).toUpperCase();
      const strike = args.strike as number;
      const targetDTE = (args.targetDTE as number) ?? 30;
      onStatus?.(`📊 Fetching IV for ${ticker} $${strike} strike...`);
      result = await handleGetIVByStrike(
        { ticker, strike, targetDTE },
        { format }
      );
      onToolResult?.(name, result);
      return result;
    }

    case 'calculate_spread': {
      const ticker = (args.ticker as string).toUpperCase();
      const longStrike = args.longStrike as number;
      const shortStrike = args.shortStrike as number;
      const targetDTE = (args.targetDTE as number) ?? 30;
      onStatus?.(
        `📊 Calculating ${ticker} $${longStrike}/$${shortStrike} spread...`
      );
      result = await handleCalculateSpread(
        { ticker, longStrike, shortStrike, targetDTE },
        { format }
      );
      onToolResult?.(name, result);
      return result;
    }

    case 'scan_opportunities': {
      const scanList = (args.scanList as string) ?? 'TECH';
      const tickers = args.tickers as string | undefined;
      const minGrade = (args.minGrade as string) ?? 'B';
      const maxRisk = (args.maxRisk as number) ?? 6;
      onStatus?.(
        tickers
          ? `🔍 Scanning custom tickers...`
          : `🔍 Scanning ${scanList} for opportunities...`
      );
      result = await handleScanOpportunities(
        { scanList, tickers, minGrade, maxRisk },
        { format, onProgress: onStatus }
      );
      onToolResult?.(name, result);
      return result;
    }

    default:
      result = {
        success: false,
        error: `Unknown tool: ${name}`,
      };
      return result;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  ToolResult,
  TickerToolResult,
  SearchToolResult,
  SearchResult,
  FinancialsToolResult,
  HoldingsToolResult,
  UnusualOptionsToolResult,
};
// Note: TradingRegimeToolResult is exported at its interface definition
