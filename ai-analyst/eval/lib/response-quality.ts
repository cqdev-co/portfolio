/**
 * Response Quality Evaluation Framework
 *
 * Provides tools for scoring AI response quality across multiple dimensions:
 * - Structure (required sections present)
 * - Reasoning (logical flow, data usage)
 * - Risk Management (warnings, position sizing)
 * - Actionability (clear recommendations)
 */

export interface QualityDimension {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  feedback: string[];
}

export interface QualityReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: QualityDimension[];
  strengths: string[];
  improvements: string[];
}

export interface ResponseContext {
  ticker: string;
  currentPrice: number;
  hasPosition?: boolean;
  positionDetails?: string;
  questionType: 'analysis' | 'position' | 'spread' | 'general';
}

// =============================================================================
// QUALITY RUBRICS
// =============================================================================

/**
 * Structure Quality - Does the response have required components?
 */
export function scoreStructure(
  response: string,
  context: ResponseContext
): QualityDimension {
  const feedback: string[] = [];
  let score = 0;
  const maxScore = 25;

  // Check for ticker mention
  if (response.includes(context.ticker)) {
    score += 3;
  } else {
    feedback.push(`Missing ticker symbol (${context.ticker})`);
  }

  // Check for price reference
  const pricePattern = /\$\d+(\.\d{2})?/;
  if (pricePattern.test(response)) {
    score += 3;
  } else {
    feedback.push('No price levels mentioned');
  }

  // Check for recommendation/action
  const actionPatterns = [
    /recommend/i,
    /suggest/i,
    /consider/i,
    /would/i,
    /buy/i,
    /sell/i,
    /hold/i,
    /close/i,
    /roll/i,
  ];
  if (actionPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No clear recommendation or action');
  }

  // Check for reasoning markers
  const reasoningPatterns = [
    /because/i,
    /since/i,
    /given/i,
    /considering/i,
    /due to/i,
    /based on/i,
    /therefore/i,
  ];
  if (reasoningPatterns.some((p) => p.test(response))) {
    score += 4;
  } else {
    feedback.push('No reasoning connectors (because, since, given)');
  }

  // Check for data references
  const dataPatterns = [
    /RSI/i,
    /MA/i,
    /IV/i,
    /support/i,
    /resistance/i,
    /volume/i,
    /earnings/i,
    /P\/E/i,
    /cushion/i,
  ];
  const dataMatches = dataPatterns.filter((p) => p.test(response));
  if (dataMatches.length >= 2) {
    score += 5;
  } else if (dataMatches.length >= 1) {
    score += 2;
    feedback.push('Limited data references');
  } else {
    feedback.push('No technical/fundamental data referenced');
  }

  // Check for appropriate length (not too short, not rambling)
  const wordCount = response.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 500) {
    score += 5;
  } else if (wordCount < 50) {
    score += 2;
    feedback.push('Response too brief');
  } else {
    score += 3;
    feedback.push('Response may be too verbose');
  }

  return {
    name: 'Structure',
    weight: 0.25,
    score,
    maxScore,
    feedback,
  };
}

/**
 * Reasoning Quality - Is the logic sound?
 */
export function scoreReasoning(
  response: string,
  context: ResponseContext
): QualityDimension {
  const feedback: string[] = [];
  let score = 0;
  const maxScore = 30;

  // Check for cause-effect relationships (broader patterns)
  const causalPatterns = [
    /if .* then/i,
    /when .* will/i,
    /because/i,
    /therefore/i,
    /this means/i,
    /which indicates/i,
    /suggests that/i,
    /since/i,
    /given that/i,
    /so /i,
    /thus/i,
  ];
  if (causalPatterns.some((p) => p.test(response))) {
    score += 6;
  } else {
    feedback.push('No clear cause-effect reasoning');
  }

  // Check for multiple factors considered (broader patterns)
  const factorPatterns = [
    /first/i,
    /second/i,
    /additionally/i,
    /also/i,
    /moreover/i,
    /furthermore/i,
    /another/i,
    /on the other hand/i,
    /\*\*/i,
    /\n-/i,
    /\n\d\./i, // Markdown list indicators
  ];
  const factorMatches = factorPatterns.filter((p) => p.test(response));
  if (factorMatches.length >= 2) {
    score += 6;
  } else if (factorMatches.length >= 1) {
    score += 3;
    feedback.push('Limited multi-factor analysis');
  } else {
    feedback.push('Single-factor reasoning');
  }

  // Check for quantitative support (broader patterns)
  const quantPatterns = [
    /\d+%/,
    /\d+\.\d+/,
    /\$\d+/,
    /\d+ days/i,
    /ratio/i,
    /level/i,
    /target/i,
    /at \d/i,
  ];
  const quantMatches = quantPatterns.filter((p) => p.test(response));
  if (quantMatches.length >= 3) {
    score += 6;
  } else if (quantMatches.length >= 1) {
    score += 3;
    feedback.push('Limited quantitative support');
  } else {
    feedback.push('No quantitative backing');
  }

  // Check for scenario consideration (broader patterns)
  const scenarioPatterns = [
    /if .* breaks/i,
    /should .* hold/i,
    /worst case/i,
    /best case/i,
    /scenario/i,
    /alternative/i,
    /otherwise/i,
    /if .* drops/i,
    /if .* fails/i,
    /wait for/i,
  ];
  if (scenarioPatterns.some((p) => p.test(response))) {
    score += 6;
  } else {
    feedback.push('No scenario analysis');
  }

  // Check for time frame consideration (broader patterns)
  const timePatterns = [
    /short.?term/i,
    /long.?term/i,
    /near.?term/i,
    /days/i,
    /weeks/i,
    /expir/i,
    /DTE/i,
    /by .* date/i,
    /next week/i,
    /earnings/i,
    /patience/i,
  ];
  if (timePatterns.some((p) => p.test(response))) {
    score += 6;
  } else {
    feedback.push('No time frame mentioned');
  }

  return {
    name: 'Reasoning',
    weight: 0.3,
    score,
    maxScore,
    feedback,
  };
}

/**
 * Risk Management - Does the response address risk?
 */
export function scoreRiskManagement(
  response: string,
  context: ResponseContext
): QualityDimension {
  const feedback: string[] = [];
  let score = 0;
  const maxScore = 25;

  // Check for risk acknowledgment
  const riskPatterns = [
    /risk/i,
    /downside/i,
    /caution/i,
    /careful/i,
    /warning/i,
    /danger/i,
    /concern/i,
    /watch out/i,
  ];
  if (riskPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No risk acknowledgment');
  }

  // Check for stop loss / exit strategy
  const exitPatterns = [
    /stop/i,
    /exit/i,
    /close.*if/i,
    /cut/i,
    /protect/i,
    /limit.*loss/i,
    /max.*loss/i,
  ];
  if (exitPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No exit strategy mentioned');
  }

  // Check for position sizing consideration
  const sizingPatterns = [
    /position size/i,
    /allocation/i,
    /% of/i,
    /contract/i,
    /not too (much|large)/i,
    /small/i,
  ];
  if (sizingPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No position sizing guidance');
  }

  // Check for cushion/buffer mention
  const bufferPatterns = [
    /cushion/i,
    /buffer/i,
    /margin/i,
    /room/i,
    /above/i,
    /below/i,
    /distance/i,
  ];
  if (bufferPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No cushion/buffer analysis');
  }

  // Check for breakeven awareness
  const breakevenPatterns = [
    /breakeven/i,
    /break.?even/i,
    /B\/E/i,
    /profitable above/i,
    /profitable below/i,
  ];
  if (breakevenPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No breakeven mentioned');
  }

  return {
    name: 'Risk Management',
    weight: 0.25,
    score,
    maxScore,
    feedback,
  };
}

/**
 * Actionability - Can the user act on this advice?
 */
export function scoreActionability(
  response: string,
  context: ResponseContext
): QualityDimension {
  const feedback: string[] = [];
  let score = 0;
  const maxScore = 20;

  // Check for clear action verb
  const actionVerbs = [/\b(buy|sell|hold|close|roll|wait|enter|exit)\b/i];
  if (actionVerbs.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No clear action verb (buy/sell/hold/close)');
  }

  // Check for specific strikes/levels
  const strikePattern = /\$\d{2,4}/;
  const strikeMatches = response.match(new RegExp(strikePattern, 'g'));
  if (strikeMatches && strikeMatches.length >= 2) {
    score += 5;
  } else if (strikeMatches && strikeMatches.length >= 1) {
    score += 2;
    feedback.push('Limited price level specificity');
  } else {
    feedback.push('No specific price levels');
  }

  // Check for timing guidance
  const timingPatterns = [
    /now/i,
    /wait/i,
    /before/i,
    /after/i,
    /today/i,
    /this week/i,
    /expiration/i,
  ];
  if (timingPatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No timing guidance');
  }

  // Check for confidence/conviction indication
  const confidencePatterns = [
    /confident/i,
    /likely/i,
    /probably/i,
    /strong/i,
    /weak/i,
    /uncertain/i,
    /50\/50/i,
    /high probability/i,
  ];
  if (confidencePatterns.some((p) => p.test(response))) {
    score += 5;
  } else {
    feedback.push('No confidence indication');
  }

  return {
    name: 'Actionability',
    weight: 0.2,
    score,
    maxScore,
    feedback,
  };
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate a response against all quality dimensions
 */
export function evaluateResponse(
  response: string,
  context: ResponseContext
): QualityReport {
  const dimensions = [
    scoreStructure(response, context),
    scoreReasoning(response, context),
    scoreRiskManagement(response, context),
    scoreActionability(response, context),
  ];

  // Calculate weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const normalizedScore = (dim.score / dim.maxScore) * 100;
    weightedSum += normalizedScore * dim.weight;
    totalWeight += dim.weight;
  }

  const overallScore = Math.round(weightedSum / totalWeight);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  else grade = 'F';

  // Collect strengths and improvements
  const strengths: string[] = [];
  const improvements: string[] = [];

  for (const dim of dimensions) {
    const pct = (dim.score / dim.maxScore) * 100;
    if (pct >= 80) {
      strengths.push(`Strong ${dim.name.toLowerCase()}`);
    } else if (pct < 50) {
      improvements.push(...dim.feedback);
    }
  }

  return {
    overallScore,
    grade,
    dimensions,
    strengths,
    improvements,
  };
}

/**
 * Format quality report for display
 */
export function formatQualityReport(report: QualityReport): string {
  let output = `\n📊 RESPONSE QUALITY REPORT\n`;
  output += `${'─'.repeat(40)}\n`;
  output += `Overall: ${report.overallScore}/100 (${report.grade})\n\n`;

  output += `Dimensions:\n`;
  for (const dim of report.dimensions) {
    const pct = Math.round((dim.score / dim.maxScore) * 100);
    const bar =
      '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    output += `  ${dim.name.padEnd(15)} ${bar} ${pct}%\n`;
  }

  if (report.strengths.length > 0) {
    output += `\n✅ Strengths:\n`;
    for (const s of report.strengths) {
      output += `   • ${s}\n`;
    }
  }

  if (report.improvements.length > 0) {
    output += `\n⚠️ Improvements:\n`;
    for (const i of report.improvements) {
      output += `   • ${i}\n`;
    }
  }

  return output;
}

// =============================================================================
// RESPONSE VALIDATORS
// =============================================================================

/**
 * Check if response contains hallucinated data
 */
export function detectHallucinations(
  response: string,
  providedData: {
    ticker: string;
    price?: number;
    strikes?: number[];
    dates?: string[];
  }
): string[] {
  const issues: string[] = [];

  // Check for wrong ticker
  const tickerPattern = /\b([A-Z]{2,5})\b/g;
  const mentionedTickers = response.match(tickerPattern) || [];
  const wrongTickers = mentionedTickers.filter(
    (t) =>
      t !== providedData.ticker &&
      ![
        'RSI',
        'MA',
        'IV',
        'HV',
        'DTE',
        'ITM',
        'OTM',
        'ATM',
        'P/E',
        'EPS',
      ].includes(t)
  );
  if (wrongTickers.length > 0) {
    issues.push(`Mentioned unknown tickers: ${wrongTickers.join(', ')}`);
  }

  // Check for unrealistic prices (if price provided)
  if (providedData.price) {
    const pricePattern = /\$(\d+(?:\.\d{2})?)/g;
    const mentionedPrices = [...response.matchAll(pricePattern)].map((m) =>
      parseFloat(m[1])
    );
    const unrealistic = mentionedPrices.filter(
      (p) => p > providedData.price * 2 || p < providedData.price * 0.5
    );
    if (unrealistic.length > 0) {
      issues.push(
        `Potentially unrealistic prices: $${unrealistic.join(', $')}`
      );
    }
  }

  return issues;
}

/**
 * Check if response uses the analyze_position tool correctly
 */
export function validatePositionResponse(
  response: string,
  toolWasUsed: boolean,
  toolOutput?: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!toolWasUsed) {
    // Check if AI tried to calculate manually (bad)
    const manualCalcPatterns = [
      /(\d+)\s*[-/]\s*(\d+)\s*[=÷]\s*(\d+)/,
      /profit.*=.*\$/i,
      /captured.*=.*%/i,
    ];

    if (manualCalcPatterns.some((p) => p.test(response))) {
      issues.push('AI attempted manual P&L calculation instead of using tool');
    }
  }

  if (toolWasUsed && toolOutput) {
    // Verify AI used tool output correctly
    const profitCapturedMatch = toolOutput.match(
      /Profit Captured:\s*([\d.]+)%/
    );
    if (profitCapturedMatch) {
      const toolValue = parseFloat(profitCapturedMatch[1]);
      // Check if response mentions a very different number
      const responseNumbers = response.match(
        /(\d{1,3}(?:\.\d)?)\s*%.*(?:captured|profit)/gi
      );
      if (responseNumbers) {
        for (const match of responseNumbers) {
          const num = parseFloat(match);
          if (Math.abs(num - toolValue) > 10) {
            issues.push(
              `Response profit % (${num}%) differs from tool output (${toolValue}%)`
            );
          }
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
