/**
 * Web Search Service
 * Provides internet access for the AI Agent
 * Uses Ollama's official Web Search API via SDK (requires OLLAMA_API_KEY)
 * Fallback to DuckDuckGo if Ollama API unavailable
 */

import { Ollama } from "ollama";

// ============================================================================
// TYPES
// ============================================================================

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  instantAnswer?: string;
  relatedTopics?: string[];
}

// ============================================================================
// OLLAMA WEB SEARCH (SDK)
// ============================================================================

/**
 * Search using Ollama's official web search SDK method
 * Per docs: client.webSearch({ query: "..." })
 */
async function ollamaWebSearch(
  query: string, 
  maxResults: number = 5
): Promise<WebSearchResponse | null> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return null;  // Fallback to DuckDuckGo
  }

  try {
    // Create Ollama client with cloud credentials
    const client = new Ollama({
      host: "https://ollama.com",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Use SDK's built-in webSearch method
    const response = await client.webSearch({ 
      query,
      max_results: maxResults,
    });
    
    // Filter out irrelevant results (social media, forums, unrelated)
    const irrelevantDomains = ['facebook.com', 'reddit.com', 'twitter.com', 'x.com', 'tiktok.com', 'instagram.com'];
    const irrelevantTerms = ['buy a tesla', 'should i buy', 'my tesla', 'tesla owner'];
    
    const results: SearchResult[] = (response.results ?? [])
      .filter((r: { title: string; url: string; content: string }) => {
        const urlLower = r.url.toLowerCase();
        const titleLower = r.title.toLowerCase();
        // Filter out social media
        if (irrelevantDomains.some(d => urlLower.includes(d))) return false;
        // Filter out consumer questions
        if (irrelevantTerms.some(t => titleLower.includes(t))) return false;
        return true;
      })
      .map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        snippet: r.content,
        url: r.url,
        source: 'Ollama',
      }));

    return {
      query,
      results,
    };
  } catch (error) {
    console.error('Ollama web search error:', error);
    return null;
  }
}

// ============================================================================
// DUCKDUCKGO FALLBACK
// ============================================================================

/**
 * Fallback search using DuckDuckGo Instant Answer API
 */
async function duckDuckGoSearch(
  query: string, 
  limit: number = 5
): Promise<WebSearchResponse> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AI-Analyst/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    
    const results: SearchResult[] = [];
    
    // Extract instant answer if available
    let instantAnswer: string | undefined;
    if (data.AbstractText) {
      instantAnswer = data.AbstractText;
    }
    
    // Extract related topics as results
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, limit)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] ?? topic.Text,
            snippet: topic.Text,
            url: topic.FirstURL,
            source: 'DuckDuckGo',
          });
        }
        // Handle nested topics
        if (topic.Topics) {
          for (const subTopic of topic.Topics.slice(0, 2)) {
            if (subTopic.Text && subTopic.FirstURL) {
              results.push({
                title: subTopic.Text.split(' - ')[0] ?? subTopic.Text,
                snippet: subTopic.Text,
                url: subTopic.FirstURL,
                source: 'DuckDuckGo',
              });
            }
          }
        }
      }
    }

    return {
      query,
      results: results.slice(0, limit),
      instantAnswer,
    };
  } catch (error) {
    console.error('DuckDuckGo search failed:', error);
    return {
      query,
      results: [],
    };
  }
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Search the web - uses Ollama API if available, falls back to DuckDuckGo
 */
export async function searchWeb(
  query: string, 
  limit: number = 5
): Promise<WebSearchResponse> {
  // Try Ollama first (better results)
  const ollamaResult = await ollamaWebSearch(query, limit);
  if (ollamaResult && ollamaResult.results.length > 0) {
    return ollamaResult;
  }
  
  // Fallback to DuckDuckGo
  return duckDuckGoSearch(query, limit);
}

/**
 * Search for stock/market news using a simple approach
 */
export async function searchStockNews(ticker: string): Promise<WebSearchResponse> {
  const query = `${ticker} stock news today`;
  return searchWeb(query, 5);
}

/**
 * Search for market analysis
 */
export async function searchMarketAnalysis(topic: string): Promise<WebSearchResponse> {
  const query = `${topic} market analysis 2024`;
  return searchWeb(query, 5);
}

/**
 * Format search results for AI context
 */
export function formatSearchForAI(response: WebSearchResponse): string {
  if (response.results.length === 0 && !response.instantAnswer) {
    return '';
  }

  let output = `\n=== WEB SEARCH: "${response.query}" ===\n`;
  
  if (response.instantAnswer) {
    output += `\nSummary: ${response.instantAnswer}\n`;
  }
  
  if (response.results.length > 0) {
    output += `\nResults:\n`;
    for (const r of response.results.slice(0, 3)) {
      output += `• ${r.title}\n  ${r.snippet.substring(0, 150)}...\n`;
    }
  }
  
  output += `=== END SEARCH ===\n`;
  
  return output;
}

/**
 * Detect if user message needs web search
 */
export function needsWebSearch(message: string): { needed: boolean; query?: string } {
  const lowerMessage = message.toLowerCase();
  
  // Keywords that suggest web search is needed
  const searchTriggers = [
    'what is happening',
    'why is',
    'news about',
    'latest on',
    'search for',
    'look up',
    'find out',
    'what\'s going on',
    'recent news',
    'current events',
    'market news',
    'why did',
    'what caused',
  ];
  
  for (const trigger of searchTriggers) {
    if (lowerMessage.includes(trigger)) {
      // Extract a search query from the message
      const query = message
        .replace(/\?/g, '')
        .replace(/can you |please |could you /gi, '')
        .trim();
      
      return { needed: true, query };
    }
  }
  
  return { needed: false };
}

