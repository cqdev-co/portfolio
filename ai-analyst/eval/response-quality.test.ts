/**
 * Response Quality Evaluation Tests
 *
 * Tests the quality scoring framework against sample responses.
 */

import { expect, test, describe } from 'bun:test';
import {
  evaluateResponse,
  scoreStructure,
  scoreReasoning,
  scoreRiskManagement,
  scoreActionability,
  detectHallucinations,
  validatePositionResponse,
  type ResponseContext,
} from './lib/response-quality.ts';

// =============================================================================
// SAMPLE RESPONSES (Good, Medium, Poor)
// =============================================================================

const GOOD_ANALYSIS_RESPONSE = `
Looking at NVDA at $188.61, I see a solid setup for a bullish spread.

**Technical Picture:**
RSI at 57 indicates neutral momentum with room to run. The stock is trading 
above MA200 ($115), showing strong long-term trend. IV at 34.4% vs HV20 of 31.6% 
suggests options are fairly priced - not overheated.

**Recommendation:**
Consider the $185/190 call debit spread for $3.80 debit. This gives you:
- Breakeven at $188.80 (just 0.1% above current)
- 5.2% cushion to the short strike
- Max profit of $120 per contract (32% return)

**Risk Management:**
If NVDA drops below $185 support, consider cutting the position. The stock 
has earnings in 45 days, so factor that into your DTE selection. Don't allocate 
more than 2-3% of your account to this trade.

**Bottom Line:**
Moderately bullish. The technical setup is favorable, but we're in a choppy 
market regime. Wait for a pullback to $186 for a better entry if patient.
`;

const MEDIUM_ANALYSIS_RESPONSE = `
NVDA looks okay here. The stock is at $188 and has been going up lately.

I think you could buy some calls. The $185/190 spread might work. It would 
cost around $3.80 and you could make $1.20 if it works out.

The RSI is in a normal range so that's good. Be careful though because 
stocks can go down too. Maybe don't put too much money in this trade.

Overall I'd say it's a decent setup but nothing amazing.
`;

const POOR_ANALYSIS_RESPONSE = `
Buy NVDA calls. Stock going up.
`;

const GOOD_POSITION_RESPONSE = `
Based on your AVGO $320/325 position bought at $3.62, currently worth $4.00:

**Position Analysis:**
- Profit captured: 27.5% ($0.38 of $1.38 max profit)
- Remaining profit potential: $1.00 per contract
- Cushion to short strike: $8.42 (2.6%)
- 21 DTE remaining

**Recommendation: HOLD**

Since you've only captured 27.5% of the potential profit with 21 days remaining,
there's still significant upside. The position has healthy cushion with AVGO 
trading at $333.42.

**Key Levels to Watch:**
- Take profit if position reaches $4.50 (65% captured)
- Exit if AVGO drops below $325 (short strike breached)
- Consider rolling at 7 DTE if still holding

The theta decay will accelerate in the final 2 weeks, but you have time to 
let this play out. Risk/reward favors patience here.
`;

const POOR_POSITION_RESPONSE = `
Your AVGO spread is up 80% so you should close it now. You've made most of 
the money already so take your profits.
`;

// =============================================================================
// TESTS: Structure Scoring
// =============================================================================

describe('Response Quality - Structure', () => {
  const context: ResponseContext = {
    ticker: 'NVDA',
    currentPrice: 188.61,
    questionType: 'analysis',
  };

  test('Good response scores high on structure', () => {
    const result = scoreStructure(GOOD_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeGreaterThanOrEqual(80);
    expect(result.feedback.length).toBeLessThanOrEqual(1);
  });

  test('Medium response scores adequately on structure', () => {
    const result = scoreStructure(MEDIUM_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    // Medium responses can still have good structure - they lack depth not format
    expect(pct).toBeGreaterThanOrEqual(50);
  });

  test('Poor response scores low on structure', () => {
    const result = scoreStructure(POOR_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeLessThan(50);
    expect(result.feedback.length).toBeGreaterThan(2);
  });

  test('Detects missing ticker', () => {
    const response = 'This stock looks good. Buy some calls.';
    const result = scoreStructure(response, context);

    expect(result.feedback).toContain(
      `Missing ticker symbol (${context.ticker})`
    );
  });

  test('Detects missing price reference', () => {
    const response = 'NVDA looks bullish. Consider buying calls.';
    const result = scoreStructure(response, context);

    expect(result.feedback).toContain('No price levels mentioned');
  });
});

// =============================================================================
// TESTS: Reasoning Scoring
// =============================================================================

describe('Response Quality - Reasoning', () => {
  const context: ResponseContext = {
    ticker: 'NVDA',
    currentPrice: 188.61,
    questionType: 'analysis',
  };

  test('Good response has strong reasoning', () => {
    const result = scoreReasoning(GOOD_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    // Good responses should score at least 60% on reasoning
    expect(pct).toBeGreaterThanOrEqual(60);
  });

  test('Detects single-factor reasoning', () => {
    const response = 'NVDA is above MA200 so buy calls at $185.';
    const result = scoreReasoning(response, context);

    expect(result.feedback).toContain('Single-factor reasoning');
  });

  test('Rewards quantitative backing', () => {
    const quantResponse =
      'RSI at 57, IV 34.4%, cushion 5.2%, 32% potential return.';
    const qualResponse = "RSI is good, IV is normal, there's cushion.";

    const quantResult = scoreReasoning(quantResponse, context);
    const qualResult = scoreReasoning(qualResponse, context);

    expect(quantResult.score).toBeGreaterThan(qualResult.score);
  });

  test('Rewards scenario analysis', () => {
    const scenarioResponse =
      'If NVDA breaks $190, target $200. If it fails, support at $180. Best case 20% gain, worst case 10% loss.';
    const result = scoreReasoning(scenarioResponse, context);

    const hasScenarioFeedback = result.feedback.includes(
      'No scenario analysis'
    );
    expect(hasScenarioFeedback).toBe(false);
  });
});

// =============================================================================
// TESTS: Risk Management Scoring
// =============================================================================

describe('Response Quality - Risk Management', () => {
  const context: ResponseContext = {
    ticker: 'NVDA',
    currentPrice: 188.61,
    questionType: 'analysis',
  };

  test('Good response addresses risk properly', () => {
    const result = scoreRiskManagement(GOOD_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeGreaterThanOrEqual(60);
  });

  test('Poor response lacks risk discussion', () => {
    const result = scoreRiskManagement(POOR_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeLessThan(30);
    expect(result.feedback.length).toBeGreaterThan(3);
  });

  test('Detects missing exit strategy', () => {
    const response =
      'NVDA looks good at $188. RSI is neutral. Buy the $185/190 spread.';
    const result = scoreRiskManagement(response, context);

    expect(result.feedback).toContain('No exit strategy mentioned');
  });

  test('Rewards position sizing guidance', () => {
    const sized =
      "Don't allocate more than 2% of your account. This is a small position.";
    const unsized = 'Buy the spread for $3.80 debit.';

    const sizedResult = scoreRiskManagement(sized, context);
    const unsizedResult = scoreRiskManagement(unsized, context);

    expect(sizedResult.score).toBeGreaterThan(unsizedResult.score);
  });
});

// =============================================================================
// TESTS: Actionability Scoring
// =============================================================================

describe('Response Quality - Actionability', () => {
  const context: ResponseContext = {
    ticker: 'NVDA',
    currentPrice: 188.61,
    questionType: 'analysis',
  };

  test('Good response is actionable', () => {
    const result = scoreActionability(GOOD_ANALYSIS_RESPONSE, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeGreaterThanOrEqual(60);
  });

  test('Vague response lacks actionability', () => {
    const vague = 'NVDA might be good. Could go either way. Watch the charts.';
    const result = scoreActionability(vague, context);
    const pct = (result.score / result.maxScore) * 100;

    expect(pct).toBeLessThan(50);
  });

  test('Detects missing action verb', () => {
    const response = 'NVDA at $188.61. RSI 57. MA200 at $115. IV 34%.';
    const result = scoreActionability(response, context);

    expect(result.feedback).toContain(
      'No clear action verb (buy/sell/hold/close)'
    );
  });

  test('Rewards specific price levels', () => {
    const specific =
      'Buy the $185/$190 spread. Exit if below $180. Target $195.';
    const general = 'Buy a spread at support with a target at resistance.';

    const specificResult = scoreActionability(specific, context);
    const generalResult = scoreActionability(general, context);

    expect(specificResult.score).toBeGreaterThan(generalResult.score);
  });
});

// =============================================================================
// TESTS: Overall Evaluation
// =============================================================================

describe('Response Quality - Overall Evaluation', () => {
  const context: ResponseContext = {
    ticker: 'NVDA',
    currentPrice: 188.61,
    questionType: 'analysis',
  };

  test('Good response gets passing grade', () => {
    const report = evaluateResponse(GOOD_ANALYSIS_RESPONSE, context);

    // Good responses should at least pass (C or better)
    expect(['A', 'B', 'C']).toContain(report.grade);
    expect(report.overallScore).toBeGreaterThanOrEqual(65);
  });

  test('Medium response distinguishes from poor', () => {
    const mediumReport = evaluateResponse(MEDIUM_ANALYSIS_RESPONSE, context);
    const poorReport = evaluateResponse(POOR_ANALYSIS_RESPONSE, context);

    // Medium should score higher than poor
    expect(mediumReport.overallScore).toBeGreaterThan(poorReport.overallScore);
  });

  test('Poor response gets D or F grade', () => {
    const report = evaluateResponse(POOR_ANALYSIS_RESPONSE, context);

    expect(['D', 'F']).toContain(report.grade);
    expect(report.overallScore).toBeLessThan(65);
  });

  test('Report includes strengths for good responses', () => {
    const report = evaluateResponse(GOOD_ANALYSIS_RESPONSE, context);

    expect(report.strengths.length).toBeGreaterThan(0);
  });

  test('Report includes improvements for poor responses', () => {
    const report = evaluateResponse(POOR_ANALYSIS_RESPONSE, context);

    expect(report.improvements.length).toBeGreaterThan(3);
  });
});

// =============================================================================
// TESTS: Hallucination Detection
// =============================================================================

describe('Hallucination Detection', () => {
  test('Detects wrong ticker mention', () => {
    const response =
      'NVDA looks good. Also consider AAPL and MSFT for diversification.';
    const issues = detectHallucinations(response, { ticker: 'NVDA' });

    expect(issues.some((i) => i.includes('AAPL') || i.includes('MSFT'))).toBe(
      true
    );
  });

  test('Ignores common acronyms', () => {
    const response =
      'NVDA RSI at 57, IV 34%, above MA. Looking ITM for better delta.';
    const issues = detectHallucinations(response, { ticker: 'NVDA' });

    expect(issues.length).toBe(0);
  });

  test('Detects unrealistic price levels', () => {
    const response = 'NVDA at $188. Target $500 by next week.';
    const issues = detectHallucinations(response, {
      ticker: 'NVDA',
      price: 188,
    });

    expect(issues.some((i) => i.includes('unrealistic'))).toBe(true);
  });

  test('Allows reasonable price range', () => {
    const response =
      'NVDA at $188. Support at $180, resistance at $200, breakeven at $189.';
    const issues = detectHallucinations(response, {
      ticker: 'NVDA',
      price: 188,
    });

    expect(issues.length).toBe(0);
  });
});

// =============================================================================
// TESTS: Position Response Validation
// =============================================================================

describe('Position Response Validation', () => {
  test('Good position response passes validation', () => {
    const context: ResponseContext = {
      ticker: 'AVGO',
      currentPrice: 333.42,
      hasPosition: true,
      questionType: 'position',
    };

    const report = evaluateResponse(GOOD_POSITION_RESPONSE, context);
    expect(report.grade).not.toBe('F');
  });

  test('Detects manual calculation attempt', () => {
    const response =
      "Your position profit = $4.00 - $3.62 = $0.38. That's 0.38/5.00 = 80% captured.";
    const result = validatePositionResponse(response, false);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('manual'))).toBe(true);
  });

  test('Validates tool output usage', () => {
    const toolOutput = 'Profit Captured: 27.5%';
    const goodResponse = "You've captured 27.5% of the profit potential.";
    const badResponse = "You've captured 80% of the profit potential.";

    const goodResult = validatePositionResponse(goodResponse, true, toolOutput);
    const badResult = validatePositionResponse(badResponse, true, toolOutput);

    expect(goodResult.valid).toBe(true);
    expect(badResult.valid).toBe(false);
  });
});

// =============================================================================
// TESTS: Minimum Quality Thresholds
// =============================================================================

describe('Quality Thresholds', () => {
  test('Production responses should score at least 50', () => {
    const context: ResponseContext = {
      ticker: 'NVDA',
      currentPrice: 188.61,
      questionType: 'analysis',
    };

    // Any response going to production should meet minimum bar
    const productionResponse = `
      NVDA at $188.61 looks moderately bullish because it's above MA200.
      
      RSI at 57 is neutral, indicating room to run. The $185/$190 spread offers 
      5% cushion with $3.80 debit, giving a 32% potential return.
      
      Recommendation: Buy the spread with a stop if NVDA drops below $180.
      Position size: 1-2% of account. Risk is defined at max debit of $380.
      If the stock breaks above $190, consider taking partial profits.
    `;

    const report = evaluateResponse(productionResponse, context);
    expect(report.overallScore).toBeGreaterThanOrEqual(50);
  });
});
