/**
 * Tool Usage Evaluation Tests
 * 
 * Tests that the AI selects the correct tools for various scenarios.
 * Uses pattern matching in mock mode for fast, deterministic testing.
 */

import { expect, test, describe } from "bun:test";
import {
  evaluateToolCalls,
  parseToolCallIntent,
  type TestScenario,
  type ToolCallResult,
} from "./lib/test-harness.ts";

// =============================================================================
// TEST SCENARIOS
// =============================================================================

const POSITION_ANALYSIS_SCENARIOS: TestScenario[] = [
  {
    id: "pos-001",
    description: "User mentions holding a spread position with dollar strikes",
    userMessage: "I hold AVGO $320/$325 bought at $3.62, worth $4.00, 21 DTE",
    expectedToolCalls: [
      { toolName: "analyze_position", expectedParams: { ticker: "AVGO" } },
    ],
    tags: ["position", "critical"],
  },
  {
    id: "pos-002",
    description: "User asks about existing NVDA position",
    userMessage: "My NVDA $185/$190 spread is currently worth $3.50. Should I hold?",
    expectedToolCalls: [
      { toolName: "analyze_position", expectedParams: { ticker: "NVDA" } },
    ],
    tags: ["position", "critical"],
  },
  {
    id: "pos-003",
    description: "User describes position with cost basis",
    userMessage: "I have an AAPL $230/$235 call spread that I paid $2.80 for",
    expectedToolCalls: [
      { toolName: "analyze_position", expectedParams: { ticker: "AAPL" } },
    ],
    tags: ["position"],
  },
  {
    id: "pos-004",
    description: "User bought a position and wants analysis",
    userMessage: "Bought TSLA $420/$425 spread for $3.10 yesterday. What do you think?",
    expectedToolCalls: [
      { toolName: "analyze_position", expectedParams: { ticker: "TSLA" } },
    ],
    tags: ["position"],
  },
  {
    id: "pos-005",
    description: "User opened a position with debit info",
    userMessage: "I opened MSFT $450/$455 at $2.90 debit, now at $3.40",
    expectedToolCalls: [
      { toolName: "analyze_position", expectedParams: { ticker: "MSFT" } },
    ],
    tags: ["position"],
  },
];

const TICKER_DATA_SCENARIOS: TestScenario[] = [
  {
    id: "data-001",
    description: "User asks about a new ticker",
    userMessage: "What do you think about AMD?",
    existingContext: undefined, // No context yet
    expectedToolCalls: [
      { toolName: "get_ticker_data", expectedParams: { ticker: "AMD" } },
    ],
    tags: ["data-fetch"],
  },
  {
    id: "data-002",
    description: "User requests analysis of ticker",
    userMessage: "Analyze GOOGL for me",
    existingContext: undefined,
    expectedToolCalls: [
      { toolName: "get_ticker_data", expectedParams: { ticker: "GOOGL" } },
    ],
    tags: ["data-fetch"],
  },
  {
    id: "data-003",
    description: "User asks about ticker outlook",
    userMessage: "How is META looking?",
    existingContext: undefined,
    expectedToolCalls: [
      { toolName: "get_ticker_data", expectedParams: { ticker: "META" } },
    ],
    tags: ["data-fetch"],
  },
];

const TOOL_AVOIDANCE_SCENARIOS: TestScenario[] = [
  {
    id: "avoid-001",
    description: "Don't fetch ticker data when context already exists",
    userMessage: "What's your take on the current NVDA setup?",
    existingContext: "NVDA: $188.61, RSI 57, MA200 $115.32...",
    expectedToolCalls: [
      { toolName: "get_ticker_data", shouldNotCall: true },
    ],
    tags: ["efficiency"],
  },
  {
    id: "avoid-002",
    description: "Simple question doesn't need tools",
    userMessage: "What is a call debit spread?",
    existingContext: "NVDA: $188.61...",
    expectedToolCalls: [
      { toolName: "get_ticker_data", shouldNotCall: true },
      { toolName: "analyze_position", shouldNotCall: true },
    ],
    tags: ["efficiency"],
  },
  {
    id: "avoid-003",
    description: "Conversational follow-up doesn't need new data",
    userMessage: "Thanks, that makes sense. What about the IV?",
    existingContext: "NVDA: $188.61, IV: 34.4%, HV20: 31.6%...",
    expectedToolCalls: [
      { toolName: "get_ticker_data", shouldNotCall: true },
    ],
    tags: ["efficiency"],
  },
];

const SPREAD_SCENARIOS: TestScenario[] = [
  {
    id: "spread-001",
    description: "User asks for spread recommendation",
    userMessage: "Find me a good spread on NVDA",
    expectedToolCalls: [
      { toolName: "find_spread", expectedParams: { ticker: "NVDA" } },
    ],
    tags: ["spread"],
  },
  {
    id: "spread-002",
    description: "User wants trade suggestion",
    userMessage: "What trade should I take on AAPL?",
    expectedToolCalls: [
      { toolName: "find_spread", expectedParams: { ticker: "AAPL" } },
    ],
    tags: ["spread"],
  },
  {
    id: "spread-003",
    description: "User requests entry point",
    userMessage: "Best entry for a TSLA play?",
    expectedToolCalls: [
      { toolName: "find_spread", expectedParams: { ticker: "TSLA" } },
    ],
    tags: ["spread"],
  },
];

const NEWS_SCENARIOS: TestScenario[] = [
  {
    id: "news-001",
    description: "User asks for news",
    userMessage: "What's the news on NVDA?",
    expectedToolCalls: [
      { toolName: "get_news", expectedParams: { ticker: "NVDA" } },
    ],
    tags: ["news"],
  },
  {
    id: "news-002",
    description: "User asks about recent headlines",
    userMessage: "Any recent news for AMD?",
    expectedToolCalls: [
      { toolName: "get_news", expectedParams: { ticker: "AMD" } },
    ],
    tags: ["news"],
  },
];

// =============================================================================
// TESTS
// =============================================================================

describe("Tool Usage - Position Analysis", () => {
  for (const scenario of POSITION_ANALYSIS_SCENARIOS) {
    test(scenario.description, () => {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.log("Errors:", result.errors);
      }
    });
  }
});

describe("Tool Usage - Ticker Data Fetch", () => {
  for (const scenario of TICKER_DATA_SCENARIOS) {
    test(scenario.description, () => {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.log("Errors:", result.errors);
      }
    });
  }
});

describe("Tool Usage - Appropriate Avoidance", () => {
  for (const scenario of TOOL_AVOIDANCE_SCENARIOS) {
    test(scenario.description, () => {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.log("Errors:", result.errors);
        console.log("Actual calls:", predictedCalls);
      }
    });
  }
});

describe("Tool Usage - Spread Recommendations", () => {
  for (const scenario of SPREAD_SCENARIOS) {
    test(scenario.description, () => {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.log("Errors:", result.errors);
      }
    });
  }
});

describe("Tool Usage - News Requests", () => {
  for (const scenario of NEWS_SCENARIOS) {
    test(scenario.description, () => {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.log("Errors:", result.errors);
      }
    });
  }
});

// =============================================================================
// INTEGRATION: Scoring Summary
// =============================================================================

describe("Tool Usage - Aggregate Metrics", () => {
  test("All scenarios achieve minimum passing score", () => {
    const allScenarios = [
      ...POSITION_ANALYSIS_SCENARIOS,
      ...TICKER_DATA_SCENARIOS,
      ...TOOL_AVOIDANCE_SCENARIOS,
      ...SPREAD_SCENARIOS,
      ...NEWS_SCENARIOS,
    ];
    
    let totalScore = 0;
    let passCount = 0;
    
    for (const scenario of allScenarios) {
      const predictedCalls = parseToolCallIntent(
        scenario.userMessage,
        scenario.existingContext
      );
      const result = evaluateToolCalls(scenario, predictedCalls);
      totalScore += result.score;
      if (result.passed) passCount++;
    }
    
    const avgScore = totalScore / allScenarios.length;
    const passRate = (passCount / allScenarios.length) * 100;
    
    console.log(`\n📊 Tool Usage Evaluation Summary`);
    console.log(`   Pass Rate: ${passCount}/${allScenarios.length} (${passRate.toFixed(0)}%)`);
    console.log(`   Avg Score: ${avgScore.toFixed(0)}/100`);
    
    // Minimum acceptable thresholds
    expect(passRate).toBeGreaterThanOrEqual(80);
    expect(avgScore).toBeGreaterThanOrEqual(85);
  });
});

