/**
 * Shared Tool Handlers
 * 
 * Tool execution logic that works in both CLI and Frontend.
 * These handlers fetch data and return formatted results.
 */

import { fetchTickerData } from '../data/yahoo';
import { 
  formatTickerDataForAI, 
  formatSearchResultsForAI 
} from '../data/formatters';
import { 
  encodeTickerToTOON, 
  encodeSearchToTOON 
} from '../toon';
import type { 
  TickerData, 
  ToolResult,
  TickerToolResult,
  SearchToolResult,
  SearchResult,
} from '../data/types';

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
  maxResults: 3,           // Only fetch 3 results (was 5)
  maxSnippetLength: 300,   // Truncate snippets to 300 chars
  maxTotalChars: 2000,     // Total content limit ~2KB
};

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
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
  
  console.log(`[WebSearch] Searching: "${query}" (max ${maxResults} results)`);
  
  const response = await fetch(OLLAMA_WEB_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
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
  
  const data: OllamaWebSearchResponse = await response.json();
  
  console.log(`[WebSearch] Got ${data.results?.length ?? 0} results`);
  
  // Convert and truncate results
  let totalChars = 0;
  const results: SearchResult[] = [];
  
  for (const r of (data.results || []).slice(0, maxResults)) {
    // Truncate snippet
    const snippet = truncateText(
      r.content || '', 
      WEB_SEARCH_CONFIG.maxSnippetLength
    );
    
    // Check total limit
    const resultSize = (r.title?.length || 0) + snippet.length + (r.url?.length || 0);
    if (totalChars + resultSize > WEB_SEARCH_CONFIG.maxTotalChars) {
      console.log(`[WebSearch] Hit char limit, stopping at ${results.length} results`);
      break;
    }
    
    results.push({
      title: truncateText(r.title || 'Untitled', 100),
      url: r.url || '',
      snippet,
    });
    
    totalChars += resultSize;
  }
  
  console.log(`[WebSearch] Returning ${results.length} results (${totalChars} chars)`);
  
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
  
  console.log(`[Handler] Fetching ticker data for: ${ticker} (format: ${format})`);
  
  try {
    const data = await fetchTickerData(ticker);
    
    if (!data) {
      console.log(`[Handler] No data returned for ${ticker}`);
      return {
        success: false,
        error: `Could not fetch data for ${ticker} - no quote available`,
      };
    }
    
    console.log(`[Handler] Got data for ${ticker}:`, {
      price: data.price,
      rsi: data.rsi,
      hasSpread: !!data.spread,
    });
    
    // Use TOON format by default for token efficiency
    const formatted = format === 'toon' 
      ? encodeTickerToTOON(data)
      : formatTickerDataForAI(data);
    
    console.log(`[Handler] Formatted output: ${formatted.length} chars`);
    
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
    const formatted = format === 'toon'
      ? encodeSearchToTOON(results)
      : formatSearchResultsForAI(results);
    
    console.log(`[Handler] Search formatted output: ${formatted.length} chars`);
    
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

/**
 * Handle analyze_position tool call
 * Note: This is a simplified version - full implementation in CLI
 */
export async function handleAnalyzePosition(
  args: {
    ticker: string;
    longStrike: number;
    shortStrike: number;
    costBasis: number;
    currentValue?: number;
    dte: number;
  }
): Promise<ToolResult> {
  try {
    const data = await fetchTickerData(args.ticker);
    
    if (!data) {
      return {
        success: false,
        error: `Could not fetch data for ${args.ticker}`,
      };
    }
    
    // Calculate basic position metrics
    const spreadWidth = args.shortStrike - args.longStrike;
    const maxProfit = spreadWidth - args.costBasis;
    const breakeven = args.longStrike + args.costBasis;
    const currentPrice = data.price;
    
    // Calculate cushion
    const cushion = ((currentPrice - breakeven) / currentPrice) * 100;
    
    // Estimate current value if not provided
    const estimatedValue = args.currentValue ?? Math.min(
      spreadWidth,
      Math.max(0, currentPrice - args.longStrike)
    );
    
    // Calculate profit metrics
    const currentProfit = estimatedValue - args.costBasis;
    const profitCaptured = maxProfit > 0 
      ? (currentProfit / maxProfit) * 100 
      : 0;
    const remainingProfit = maxProfit - currentProfit;
    
    // Generate recommendation
    let recommendation: string;
    if (args.dte <= 5 && profitCaptured >= 50) {
      recommendation = 'CLOSE - Low DTE with good profit captured';
    } else if (profitCaptured >= 80) {
      recommendation = 'CLOSE - Captured most of max profit';
    } else if (cushion < 2) {
      recommendation = 'CLOSE - Minimal cushion, protect gains';
    } else if (cushion > 8 && args.dte > 10) {
      recommendation = 'HOLD - Good cushion and time remaining';
    } else {
      recommendation = 'MONITOR - Evaluate based on market conditions';
    }
    
    const formatted = `
=== POSITION ANALYSIS: ${args.ticker} ===
Spread: $${args.longStrike}/$${args.shortStrike}
Current Price: $${currentPrice.toFixed(2)}
DTE: ${args.dte} days

Entry: $${args.costBasis.toFixed(2)}
Current Value: ~$${estimatedValue.toFixed(2)}
Breakeven: $${breakeven.toFixed(2)}

Max Profit: $${(maxProfit * 100).toFixed(0)} (per contract)
Current Profit: $${(currentProfit * 100).toFixed(0)} (${profitCaptured.toFixed(1)}%)
Remaining: $${(remainingProfit * 100).toFixed(0)}

Cushion: ${cushion.toFixed(1)}%

RECOMMENDATION: ${recommendation}
`.trim();
    
    return {
      success: true,
      data: {
        ticker: args.ticker,
        currentPrice,
        spread: { longStrike: args.longStrike, shortStrike: args.shortStrike },
        entry: args.costBasis,
        currentValue: estimatedValue,
        breakeven,
        maxProfit,
        currentProfit,
        profitCaptured,
        remainingProfit,
        cushion,
        dte: args.dte,
        recommendation,
      },
      formatted,
    };
  } catch (error) {
    return {
      success: false,
      error: `Position analysis error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Handle scan_for_opportunities tool call
 * Note: This is a placeholder - full scanning requires more infrastructure
 */
export async function handleScanOpportunities(): Promise<ToolResult> {
  return {
    success: false,
    error: 'Market scanning not available in this environment. ' +
      'Use the CLI for full scanning capabilities.',
  };
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
  apiKey?: string;  // Ollama API key for native web search
  format?: OutputFormat;  // Output format (default: 'toon')
  onStatus?: (message: string) => void;
  onToolResult?: (tool: string, result: ToolResult) => void;  // Callback for UI
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  options: ToolExecutorOptions = {}
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;
  const { searchFn, apiKey, format, onStatus, onToolResult } = options;
  
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
    
    case 'analyze_position': {
      const ticker = (args.ticker as string).toUpperCase();
      onStatus?.(
        `📊 Analyzing ${ticker} $${args.longStrike}/$${args.shortStrike}...`
      );
      result = await handleAnalyzePosition({
        ticker,
        longStrike: args.longStrike as number,
        shortStrike: args.shortStrike as number,
        costBasis: args.costBasis as number,
        currentValue: args.currentValue as number | undefined,
        dte: args.dte as number,
      });
      onToolResult?.(name, result);
      return result;
    }
    
    case 'scan_for_opportunities': {
      onStatus?.(`🔍 Scanning market...`);
      result = await handleScanOpportunities();
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

export type { ToolResult, TickerToolResult, SearchToolResult, SearchResult };

