/**
 * Risk gate types
 *
 * Phase 2: structured shapes for the runtime trade-call validator.
 * `validateRecommendation` consumes these and produces the verdict
 * persisted to `agent_decisions.risk_violations`.
 */

/**
 * Structured trade-call extracted from Xylo's natural-language
 * response. Fields are intentionally optional — partial parses still
 * flow through the gate (e.g. an "AVOID" call with no spread strikes
 * still validates against position limits).
 */
export interface ParsedRecommendation {
  ticker: string;
  action: TradeAction;
  /** Present when action implies opening a new position. */
  spread?: ParsedSpread;
  /** Optional supporting fields the parser was able to extract. */
  expectedValue?: number;
  /** Self-reported confidence label, if Xylo stated one. */
  confidence_self?: 'HIGH' | 'MEDIUM' | 'LOW';
  /**
   * Where the recommendation was extracted from — useful when the
   * downstream UI wants to show the operator the source line.
   */
  source_text?: string;
  /** Provenance: did the regex match or did we fall back to the model? */
  parsed_via: 'regex' | 'model' | 'unknown';
}

export type TradeAction =
  | 'BUY'
  | 'WAIT'
  | 'AVOID'
  | 'HOLD'
  | 'TRIM'
  | 'EXIT'
  | 'ROLL'
  | 'ADD';

export interface ParsedSpread {
  type: 'cds' | 'pcs';
  longStrike: number;
  shortStrike: number;
  /** Net debit (CDS) or net credit (PCS) per contract, if Xylo cited one. */
  debit?: number;
  /** Days to expiration. */
  dte?: number;
  /** Quantity of contracts, if specified. */
  contracts?: number;
}

/**
 * One violated rule. `BLOCK` violations downgrade the verdict to
 * unapproved; `WARN` ones are surfaced but don't block.
 */
export interface RiskViolation {
  rule: RiskRule;
  severity: 'BLOCK' | 'WARN';
  detail: string;
  /**
   * The constraint we measured against, when applicable. Lets the UI
   * render "RSI 71 > max 55" without re-deriving from yaml.
   */
  observed?: number | string | null;
  threshold?: number | string | null;
}

export type RiskRule =
  | 'position_sizing'
  | 'rsi_band'
  | 'trend_above_ma200'
  | 'iv_ceiling'
  | 'earnings_window'
  | 'dte_band'
  | 'concentration'
  | 'total_exposure'
  | 'blacklist'
  | 'parser';

/**
 * Verdict from the gate. `approved = true` means no `BLOCK`-severity
 * violations. `risk_violations` may still be non-empty (warnings).
 *
 * `gate_skipped: true` means the recommendation didn't have enough
 * structure to validate (e.g. parser returned null, or AVOID call
 * with no spread to size). The gate doesn't fail-closed in that case
 * because chat-style answers shouldn't be gated.
 */
export interface RiskVerdict {
  approved: boolean;
  gate_skipped: boolean;
  violations: RiskViolation[];
  /**
   * Echo of the parsed recommendation so the caller doesn't need to
   * thread two values through.
   */
  recommendation: ParsedRecommendation | null;
  /** ms spent in the gate, captured for observability. */
  latency_ms: number;
}

/**
 * Inputs to `validateRecommendation`. Designed so the gate is a pure
 * function over already-fetched data — no I/O inside.
 */
export interface ValidateInput {
  recommendation: ParsedRecommendation;
  account: { sizeUSD: number };
  /**
   * Existing positions: minimal shape so we don't depend on the
   * full PositionsResponse type. Each entry is the per-position
   * dollar risk (debit × 100 × contracts for spreads, market value
   * for stocks).
   */
  positions: Array<{
    ticker: string;
    riskUSD: number;
    sector?: string | null;
  }>;
  /** Ticker context for RSI / trend / IV checks. Optional — */
  /** when missing, the corresponding rules WARN instead of BLOCK. */
  tickerContext?: {
    rsi?: number;
    iv_pct?: number;
    aboveMA200?: boolean;
    daysUntilEarnings?: number | null;
  };
}
