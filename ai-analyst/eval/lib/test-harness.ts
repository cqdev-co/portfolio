/**
 * Test Harness for Tool Usage Evaluation
 * 
 * Provides infrastructure for testing AI tool selection behavior
 * without making actual LLM calls (mock mode) or with live calls.
 */

export interface ToolCallExpectation {
  /** Tool name that should be called */
  toolName: string;
  /** Expected parameters (partial match) */
  expectedParams?: Record<string, unknown>;
  /** If true, this tool should NOT be called */
  shouldNotCall?: boolean;
}

export interface TestScenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Description of what this scenario tests */
  description: string;
  /** The user message that triggers the scenario */
  userMessage: string;
  /** Context already provided to the AI (e.g., ticker data) */
  existingContext?: string;
  /** Expected tool calls in order */
  expectedToolCalls: ToolCallExpectation[];
  /** Tags for categorization */
  tags?: string[];
}

export interface ToolCallResult {
  toolName: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface ScenarioResult {
  scenario: TestScenario;
  actualToolCalls: ToolCallResult[];
  passed: boolean;
  errors: string[];
  score: number; // 0-100
}

/**
 * Evaluate tool calls against expectations
 */
export function evaluateToolCalls(
  scenario: TestScenario,
  actualCalls: ToolCallResult[]
): ScenarioResult {
  const errors: string[] = [];
  let score = 100;
  
  // Check for expected tool calls
  for (const expected of scenario.expectedToolCalls) {
    if (expected.shouldNotCall) {
      // Check tool was NOT called
      const called = actualCalls.find(c => c.toolName === expected.toolName);
      if (called) {
        errors.push(`Tool '${expected.toolName}' was called but should NOT have been`);
        score -= 25;
      }
    } else {
      // Check tool WAS called
      const called = actualCalls.find(c => c.toolName === expected.toolName);
      if (!called) {
        errors.push(`Expected tool '${expected.toolName}' was NOT called`);
        score -= 30;
      } else if (expected.expectedParams) {
        // Check params match
        for (const [key, value] of Object.entries(expected.expectedParams)) {
          if (called.params[key] !== value) {
            errors.push(
              `Tool '${expected.toolName}' param '${key}' expected '${value}' but got '${called.params[key]}'`
            );
            score -= 10;
          }
        }
      }
    }
  }
  
  // Penalize extra tool calls (unnecessary API usage)
  const expectedNames = scenario.expectedToolCalls
    .filter(e => !e.shouldNotCall)
    .map(e => e.toolName);
  const unexpectedCalls = actualCalls.filter(c => !expectedNames.includes(c.toolName));
  if (unexpectedCalls.length > 0) {
    for (const call of unexpectedCalls) {
      errors.push(`Unexpected tool call: '${call.toolName}'`);
      score -= 15;
    }
  }
  
  return {
    scenario,
    actualToolCalls: actualCalls,
    passed: errors.length === 0,
    errors,
    score: Math.max(0, score),
  };
}

/**
 * Parse tool call decisions from text
 * 
 * For mock testing, we can analyze the prompt structure and system instructions
 * to predict what tool calls should be made based on patterns.
 */
export function parseToolCallIntent(
  userMessage: string,
  existingContext?: string
): ToolCallResult[] {
  const calls: ToolCallResult[] = [];
  
  // Extract ticker from message (look for uppercase 2-5 letter words, excluding common words)
  const commonWords = new Set(["I", "A", "OK", "AM", "PM", "THE", "AND", "FOR", "ON", "AT", "TO", "IN", "IT", "IF", "OR", "DTE"]);
  const tickerMatches = userMessage.match(/\b[A-Z]{2,5}\b/g) || [];
  const ticker = tickerMatches.find(t => !commonWords.has(t));
  
  // Pattern: User mentions existing position (many variations)
  const positionIndicators = [
    /i\s+(have|hold|own|bought|purchased|opened)/i,
    /my\s+[A-Z]{1,5}/i,
    /\$?\d+[\s\/]+\$?\d+.*(?:spread|position|call|put)/i,
    /\d+\/\d+/i,  // Simple strike pattern like 320/325
    /(?:bought|paid|cost).*\$?\d+/i,
    /(?:worth|value|at)\s+\$?\d+/i,
    /debit/i,
    /DTE/i,
  ];
  
  // Check for position mentions - needs both ticker AND position context
  const hasPositionIndicator = positionIndicators.some(p => p.test(userMessage));
  // Match strike prices like $320/$325, 320/325, $320 / $325
  const hasStrikePrices = /\$?\d{2,3}[\s\/]+\$?\d{2,3}/i.test(userMessage);
  
  if (ticker && hasPositionIndicator && hasStrikePrices) {
    calls.push({
      toolName: "analyze_position",
      params: { ticker },
      timestamp: Date.now(),
    });
  }
  
  // Pattern: User asks for spread recommendation (check BEFORE ticker data)
  const spreadPatterns = [
    /find.*(spread|trade|play)/i,
    /what.*(spread|trade)/i,
    /best.*(spread|trade|entry)/i,
    /what\s+trade/i,
    /(should|recommend|suggest).*(trade|spread)/i,
  ];
  
  const isSpreadRequest = spreadPatterns.some(p => p.test(userMessage));
  if (isSpreadRequest && ticker && !calls.some(c => c.toolName === "find_spread")) {
    calls.push({
      toolName: "find_spread",
      params: { ticker },
      timestamp: Date.now(),
    });
  }
  
  // Pattern: User asks about a specific ticker they don't have context for
  if (ticker && !existingContext?.includes(ticker)) {
    // Don't add get_ticker_data if we already identified a position or spread request
    const alreadyHandled = calls.some(c => 
      c.toolName === "analyze_position" || c.toolName === "find_spread"
    );
    
    if (!alreadyHandled) {
      // Check if this seems like a new ticker inquiry
      const inquiryPatterns = [
        /what.*(do you think|about|of)/i,
        /what's your (take|opinion|view)/i,
        /analyze/i,
        /how('s| is)\s+[A-Z]{1,5}/i,
        /(outlook|analysis|price|target)/i,
        /looking/i,
        /think.*about/i,
      ];
      
      const isInquiry = inquiryPatterns.some(p => p.test(userMessage));
      if (isInquiry) {
        calls.push({
          toolName: "get_ticker_data",
          params: { ticker },
          timestamp: Date.now(),
        });
      }
    }
  }
  
  // Pattern: User asks about news
  const newsPatterns = [
    /what('s|'re| is| are).*news/i,
    /any.*news/i,
    /recent.*news|headlines/i,
  ];
  
  const isNewsRequest = newsPatterns.some(p => p.test(userMessage));
  if (isNewsRequest && ticker) {
    calls.push({
      toolName: "get_news",
      params: { ticker },
      timestamp: Date.now(),
    });
  }
  
  return calls;
}

/**
 * Generate expected tool calls from scenario patterns
 * This is the deterministic "should call" logic for evaluation
 */
export function getExpectedToolCalls(scenario: TestScenario): ToolCallExpectation[] {
  return scenario.expectedToolCalls;
}

/**
 * Format scenario result for display
 */
export function formatScenarioResult(result: ScenarioResult): string {
  const status = result.passed ? "✅ PASS" : "❌ FAIL";
  let output = `${status} - ${result.scenario.description}\n`;
  output += `  Score: ${result.score}/100\n`;
  
  if (result.actualToolCalls.length > 0) {
    output += `  Tool Calls:\n`;
    for (const call of result.actualToolCalls) {
      output += `    - ${call.toolName}(${JSON.stringify(call.params)})\n`;
    }
  } else {
    output += `  Tool Calls: (none)\n`;
  }
  
  if (result.errors.length > 0) {
    output += `  Errors:\n`;
    for (const err of result.errors) {
      output += `    ⚠️ ${err}\n`;
    }
  }
  
  return output;
}

/**
 * Run a batch of scenarios and aggregate results
 */
export function runScenarioBatch(
  scenarios: TestScenario[],
  mockMode: boolean = true
): ScenarioResult[] {
  const results: ScenarioResult[] = [];
  
  for (const scenario of scenarios) {
    if (mockMode) {
      // Use pattern matching to predict tool calls
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      results.push(result);
    } else {
      // TODO: Live mode - actually call the LLM
      throw new Error("Live mode not yet implemented");
    }
  }
  
  return results;
}

/**
 * Calculate aggregate metrics from batch results
 */
export function calculateMetrics(results: ScenarioResult[]): {
  total: number;
  passed: number;
  failed: number;
  avgScore: number;
  byTag: Record<string, { passed: number; total: number; avgScore: number }>;
} {
  const byTag: Record<string, { passed: number; total: number; scores: number[] }> = {};
  
  let totalScore = 0;
  let passed = 0;
  
  for (const result of results) {
    totalScore += result.score;
    if (result.passed) passed++;
    
    for (const tag of result.scenario.tags ?? ["untagged"]) {
      if (!byTag[tag]) {
        byTag[tag] = { passed: 0, total: 0, scores: [] };
      }
      byTag[tag].total++;
      byTag[tag].scores.push(result.score);
      if (result.passed) byTag[tag].passed++;
    }
  }
  
  const tagMetrics: Record<string, { passed: number; total: number; avgScore: number }> = {};
  for (const [tag, data] of Object.entries(byTag)) {
    tagMetrics[tag] = {
      passed: data.passed,
      total: data.total,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    };
  }
  
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    avgScore: Math.round(totalScore / results.length),
    byTag: tagMetrics,
  };
}

