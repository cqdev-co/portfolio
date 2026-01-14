/**
 * Position Analysis Prompts
 *
 * System prompts for analyzing user positions and portfolio.
 * Extends Victor Chen persona with position-specific context.
 */

import { VICTOR_PERSONA, RESPONSE_STYLE } from './victor';
import type {
  PositionAIContext,
  SpreadAIContext,
  PortfolioAIContext,
  SpreadType,
} from '../../types/positions';

// ============================================================================
// TYPES
// ============================================================================

export interface PositionPromptConfig {
  position: PositionAIContext;
  accountSize?: number;
}

export interface SpreadPromptConfig {
  spread: SpreadAIContext;
  accountSize?: number;
}

export interface PortfolioPromptConfig {
  portfolio: PortfolioAIContext;
  accountSize?: number;
}

// ============================================================================
// POSITION ANALYSIS PROMPT
// ============================================================================

/**
 * Build system prompt for analyzing a single position
 */
export function buildPositionAnalysisPrompt(
  config: PositionPromptConfig
): string {
  const { position, accountSize = 1750 } = config;
  const maxPosition = Math.round(accountSize * 0.2);

  // Calculate days held
  const daysHeld = position.days_held;
  const holdingPeriod =
    daysHeld < 7 ? 'short-term' : daysHeld < 30 ? 'swing' : 'longer-term';

  // Build position details section
  const positionDetails = position.option_type
    ? `
## POSITION DETAILS
Symbol: ${position.symbol}
Type: ${position.option_type.toUpperCase()} Option
Strike: $${position.strike_price}
Days to Expiry: ${position.days_to_expiry ?? 'Unknown'}
Entry: $${position.entry_price.toFixed(2)} (${daysHeld} days ago)
Current: $${position.current_price.toFixed(2)}
P&L: ${position.pnl_percent >= 0 ? '+' : ''}${position.pnl_percent.toFixed(1)}%
Quantity: ${position.quantity} contracts
Holding Period: ${holdingPeriod}`
    : `
## POSITION DETAILS
Symbol: ${position.symbol}
Type: Stock
Entry: $${position.entry_price.toFixed(2)} (${daysHeld} days ago)
Current: $${position.current_price.toFixed(2)}
P&L: ${position.pnl_percent >= 0 ? '+' : ''}${position.pnl_percent.toFixed(1)}%
Quantity: ${position.quantity} shares
Holding Period: ${holdingPeriod}`;

  // Build technicals section
  const technicals = `
## CURRENT TECHNICALS
RSI: ${position.rsi?.toFixed(0) ?? 'N/A'}
Support: $${position.support ?? 'N/A'}
Resistance: $${position.resistance ?? 'N/A'}
IV: ${position.iv?.toFixed(0) ?? 'N/A'}% (${position.iv_level ?? 'N/A'})`;

  return `${VICTOR_PERSONA}

## ACCOUNT CONTEXT
Account Size: $${accountSize}
Max Position: $${maxPosition} (20% rule)
${positionDetails}
${technicals}

## YOUR TASK
Analyze this ${holdingPeriod} position and provide:

1. **Situation Assessment** - Where is the position now vs entry? 
   What's the technical picture?

2. **Key Levels** - What support/resistance levels should I watch? 
   Where would you add or trim?

3. **Recommendation** - Give me a clear call:
   - **HOLD** - Position is working, let it run
   - **TRIM** - Take partial profits (specify how much)
   - **ADD** - Good spot to increase (if within position limits)
   - **EXIT** - Close the position (explain why)

Be direct. Tell me what YOU would do in this situation.

${RESPONSE_STYLE}`;
}

// ============================================================================
// SPREAD ANALYSIS PROMPT
// ============================================================================

/**
 * Get spread-specific analysis instructions
 */
function getSpreadTypeGuidance(spreadType: SpreadType): string {
  const guidance: Record<SpreadType, string> = {
    call_debit_spread: `
This is my bread and butter - Call Debit Spreads (CDS).
Key metrics to evaluate:
- Profit captured vs max profit (how much is left?)
- Distance to short strike (cushion)
- Theta decay acceleration (watch under 14 DTE)
- Consider rolling if >60% profit captured`,

    put_credit_spread: `
Put Credit Spread - we're selling premium here.
Key considerations:
- Distance to short strike (need cushion for safety)
- If price approaches short strike, consider rolling down/out
- Theta working in our favor
- Watch for volatility expansion`,

    call_credit_spread: `
Call Credit Spread - bearish/neutral play.
Watch for:
- Stock rallying toward short strike
- May need to roll up and out if challenged
- Theta decay working in our favor`,

    put_debit_spread: `
Put Debit Spread - directional bearish play.
Consider:
- Profit capture percentage
- Time decay working against us
- Exit if thesis changes`,

    iron_condor: `
Iron Condor - range-bound strategy.
Critical checks:
- Which wing is being tested?
- Distance to each short strike
- May need to roll the tested side
- Don't let one side go ITM`,

    iron_butterfly: `
Iron Butterfly - max profit at center strike.
Watch:
- Price deviation from center
- High gamma risk near expiration
- Consider early exit at 50% profit`,

    straddle: `
Straddle - betting on big move either direction.
Evaluate:
- Has the expected move happened?
- Time decay is brutal - exit if thesis broken`,

    strangle: `
Strangle - wide straddle for big moves.
Consider:
- Premium paid vs expected move
- Time decay impact`,

    calendar_spread: `
Calendar Spread - volatility and time play.
Watch:
- Front month theta decay
- IV term structure changes`,

    diagonal_spread: `
Diagonal Spread - directional with time edge.
Monitor:
- Delta exposure
- Theta capture`,

    custom: `
Custom multi-leg strategy.
Evaluate based on:
- Overall P&L
- Risk exposure
- Time decay impact`,
  };

  return guidance[spreadType] || guidance.custom;
}

/**
 * Build system prompt for analyzing a spread position
 */
export function buildSpreadAnalysisPrompt(config: SpreadPromptConfig): string {
  const { spread, accountSize: _accountSize = 1750 } = config; // Reserved for position sizing

  // Calculate key metrics
  const profitCaptured =
    spread.max_profit > 0
      ? ((spread.pnl / spread.max_profit) * 100).toFixed(0)
      : '0';
  const riskRemaining =
    spread.max_loss > 0
      ? (
          ((spread.max_loss - Math.abs(spread.pnl)) / spread.max_loss) *
          100
        ).toFixed(0)
      : '100';

  // Format legs
  const legsDisplay = spread.legs
    .map(
      (leg) =>
        `  ${leg.leg_label}: $${leg.strike} @ $${leg.current_price.toFixed(2)}`
    )
    .join('\n');

  return `${VICTOR_PERSONA}

## SPREAD POSITION
Symbol: ${spread.symbol}
Type: ${spread.spread_type.replace(/_/g, ' ').toUpperCase()}
${getSpreadTypeGuidance(spread.spread_type)}

## POSITION DETAILS
Entry: ${spread.net_debit_credit >= 0 ? 'Debit' : 'Credit'} \
$${Math.abs(spread.net_debit_credit).toFixed(2)}
Quantity: ${spread.quantity} spread(s)
Entry Date: ${spread.entry_date}
Days to Expiry: ${spread.days_to_expiry}

## CURRENT STATUS
Current Value: $${spread.current_value.toFixed(2)}
P&L: ${spread.pnl >= 0 ? '+' : ''}$${spread.pnl.toFixed(2)} \
(${spread.pnl_percent >= 0 ? '+' : ''}${spread.pnl_percent.toFixed(1)}%)
Profit Captured: ${profitCaptured}% of max
Risk Remaining: ${riskRemaining}%

## RISK METRICS
Max Profit: $${spread.max_profit.toFixed(2)}
Max Loss: $${spread.max_loss.toFixed(2)}
Breakeven: $${spread.breakeven_lower?.toFixed(2) ?? 'N/A'}${
    spread.breakeven_upper ? ` - $${spread.breakeven_upper.toFixed(2)}` : ''
  }

## UNDERLYING
Current Price: $${spread.underlying_price.toFixed(2)}
${
  spread.distance_to_short_strike !== undefined
    ? `Distance to Short Strike: ${spread.distance_to_short_strike.toFixed(1)}%`
    : ''
}

## LEGS
${legsDisplay}

## YOUR TASK
Analyze this spread and tell me:

1. **Position Health** - How is the spread performing? 
   Are we in profit territory or under pressure?

2. **Risk Assessment** - What's our cushion? 
   How close is the underlying to our danger zone?

3. **Time Factor** - With ${spread.days_to_expiry} DTE, 
   is theta helping or hurting us?

4. **Recommendation**:
   - **HOLD TO EXPIRY** - Let theta work, ride it out
   - **CLOSE NOW** - Take profit/loss and move on (explain why)
   - **ROLL** - Adjust strikes or expiration (specify how)
   - **HEDGE** - Add protection (what would you do?)

${RESPONSE_STYLE}`;
}

// ============================================================================
// PORTFOLIO ADVISOR PROMPT
// ============================================================================

/**
 * Build system prompt for overall portfolio analysis
 */
export function buildPortfolioAdvisorPrompt(
  config: PortfolioPromptConfig
): string {
  const { portfolio, accountSize = 1750 } = config;
  const { positions, spreads, summary, concentration } = portfolio;

  // Build positions summary
  const positionsList = positions
    .map(
      (p) =>
        `• ${p.symbol}: ${p.pnl_percent >= 0 ? '+' : ''}${p.pnl_percent.toFixed(1)}% \
($${(p.current_price * Math.abs(p.quantity)).toFixed(0)})`
    )
    .join('\n');

  // Build spreads summary
  const spreadsList = spreads
    .map(
      (s) =>
        `• ${s.symbol} ${s.spread_type.replace(/_/g, ' ')}: \
${s.pnl_percent >= 0 ? '+' : ''}${s.pnl_percent.toFixed(1)}% \
(${s.days_to_expiry} DTE)`
    )
    .join('\n');

  return `${VICTOR_PERSONA}

## PORTFOLIO OVERVIEW
Account Size: $${accountSize}
Total Value: $${summary.total_value.toLocaleString()}
Overall P&L: ${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toFixed(0)} \
(${summary.total_pnl_percent >= 0 ? '+' : ''}${summary.total_pnl_percent.toFixed(1)}%)

## STATISTICS
Positions: ${summary.positions_count}
Spreads: ${summary.spreads_count}
Winners: ${summary.winners} | Losers: ${summary.losers}
${
  summary.best_performer
    ? `Best: ${summary.best_performer.symbol} (+${summary.best_performer.pnl_percent.toFixed(1)}%)`
    : ''
}
${
  summary.worst_performer
    ? `Worst: ${summary.worst_performer.symbol} (${summary.worst_performer.pnl_percent.toFixed(1)}%)`
    : ''
}

${
  concentration
    ? `## CONCENTRATION RISK
Largest Position: ${concentration.largest_position_percent.toFixed(0)}% of portfolio
Top 3 Positions: ${concentration.top_3_percent.toFixed(0)}% of portfolio`
    : ''
}

## STOCK POSITIONS
${positionsList || 'None'}

## OPTION SPREADS
${spreadsList || 'None'}

## YOUR TASK AS PORTFOLIO ADVISOR

Review my entire portfolio and provide:

1. **Overall Assessment** - How is the portfolio performing? 
   Am I on track or in trouble?

2. **Risk Check**:
   - Any position too large? (>20% rule violation)
   - Sector concentration issues?
   - Too many correlated positions?

3. **Action Items** - Prioritized list:
   - Which positions need immediate attention?
   - Any stops I should set?
   - Opportunities to add or trim?

4. **Portfolio Grade** - Give me an overall letter grade (A-F) 
   with brief justification.

Be direct. I want your honest assessment, not sugarcoating.

${RESPONSE_STYLE}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getSpreadTypeGuidance };
