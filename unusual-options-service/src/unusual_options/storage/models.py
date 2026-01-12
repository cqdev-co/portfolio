"""Database models for signals and performance tracking."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from enum import Enum
from uuid import uuid4


class SignalClassification(str, Enum):
    """
    Signal classification based on historical win rate analysis.

    Jan 2026 Analysis Results:
    - PUT signals: 60% win rate
    - CALL signals: 8.6% win rate
    - PUT ATM 8-14 DTE: 61.5% win rate (sweet spot)
    """

    # Follow directionally - high historical win rate
    HIGH_CONVICTION = "high_conviction"

    # Consider with caution - moderate win rate
    MODERATE = "moderate"

    # Market intel only - unclear direction
    INFORMATIONAL = "informational"

    # Institutional hedging activity - not directional
    LIKELY_HEDGE = "likely_hedge"

    # Consider fading - historically fails as directional play
    CONTRARIAN = "contrarian"

    # Not yet classified
    UNCLASSIFIED = "unclassified"


# Historical win rates by classification (updated from analysis)
CLASSIFICATION_WIN_RATES = {
    SignalClassification.HIGH_CONVICTION: 0.60,
    SignalClassification.MODERATE: 0.40,
    SignalClassification.INFORMATIONAL: 0.25,
    SignalClassification.LIKELY_HEDGE: None,  # Not applicable
    SignalClassification.CONTRARIAN: 0.09,
    SignalClassification.UNCLASSIFIED: None,
}


@dataclass
class RiskFactor:
    """Single risk factor for a signal."""

    factor: str
    severity: str  # LOW, MEDIUM, HIGH
    description: str


@dataclass
class RiskAssessment:
    """Risk assessment for a signal."""

    risk_level: str  # LOW, MEDIUM, HIGH, EXTREME
    risk_factors: list[RiskFactor]

    @property
    def risk_count(self) -> int:
        """Count of risk factors."""
        return len(self.risk_factors)


@dataclass
class UnusualOptionsSignal:
    """Complete unusual options activity signal."""

    # Identity
    signal_id: str = field(default_factory=lambda: str(uuid4()))
    ticker: str = ""
    option_symbol: str = ""
    detection_timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    # Option Details
    strike: float = 0.0
    expiry: date = field(default_factory=date.today)
    option_type: str = ""  # 'call' or 'put'
    days_to_expiry: int = 0
    moneyness: str = ""  # ITM, ATM, OTM

    # Volume Metrics
    current_volume: int = 0
    average_volume: float = 0.0
    volume_ratio: float = 0.0

    # Open Interest Metrics
    current_oi: int = 0
    previous_oi: int = 0
    oi_change_pct: float = 0.0

    # Premium Metrics
    premium_flow: float = 0.0
    aggressive_order_pct: float = 0.0

    # Detection Flags
    has_volume_anomaly: bool = False
    has_oi_spike: bool = False
    has_premium_flow: bool = False
    has_sweep: bool = False
    has_block_trade: bool = False

    # Scoring
    overall_score: float = 0.0
    grade: str = "F"  # S, A, B, C, D, F
    confidence: float = 0.0

    # Risk Assessment
    risk_level: str = "MEDIUM"
    risk_factors: list[str] = field(default_factory=list)

    # Market Context
    underlying_price: float = 0.0
    implied_volatility: float | None = None
    iv_rank: float | None = None
    market_cap: int | None = None
    avg_daily_volume: int | None = None

    # Directional Bias
    sentiment: str = "NEUTRAL"  # BULLISH, BEARISH, NEUTRAL
    put_call_ratio: float | None = None

    # Additional Context
    days_to_earnings: int | None = None
    has_upcoming_catalyst: bool = False
    catalyst_description: str | None = None

    # Performance Tracking (filled later)
    forward_return_1d: float | None = None
    forward_return_5d: float | None = None
    forward_return_30d: float | None = None
    win: bool | None = None

    # Spread Detection (Phase 1)
    is_likely_spread: bool = False
    spread_confidence: float | None = None
    spread_type: str | None = None
    matched_leg_symbols: list[str] = field(default_factory=list)
    spread_strike_width: float | None = None
    spread_detection_reason: str | None = None
    spread_net_premium: float | None = None

    # Hedge Detection (Phase 2)
    likely_hedge: bool = False
    hedge_confidence: float = 0.0
    hedge_type: str | None = None  # PROTECTIVE_PUT, COLLAR,
    # COVERED_CALL, INDEX_HEDGE, etc.
    hedge_indicators: list[str] = field(default_factory=list)

    # Cross-Signal Correlation
    correlated_signal_ids: list[str] = field(default_factory=list)
    time_window_group_id: str | None = None

    # Order Side Inference
    inferred_side: str | None = None  # BUY, SELL, MIXED
    side_confidence: float = 0.0

    # Signal Classification (Jan 2026 - data-driven approach)
    # Replaces grade as primary actionability indicator
    signal_classification: str = "unclassified"  # SignalClassification value
    classification_reason: str = ""  # Human-readable explanation
    predicted_win_rate: float | None = None  # Based on historical combos
    classification_factors: list[str] = field(default_factory=list)

    # Metadata
    data_provider: str = ""
    detection_version: str = "0.3.0"  # Bumped for classification system
    raw_detection_data: dict = field(default_factory=dict)


@dataclass
class SignalPerformance:
    """Performance tracking for a signal."""

    performance_id: str = field(default_factory=lambda: str(uuid4()))
    signal_id: str = ""
    ticker: str = ""

    # Entry
    entry_timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    entry_price: float = 0.0
    option_symbol: str = ""
    signal_grade: str = ""
    signal_sentiment: str = ""

    # Price tracking
    price_1d_later: float | None = None
    price_5d_later: float | None = None
    price_30d_later: float | None = None
    current_price: float | None = None

    # Forward returns
    forward_return_1d: float | None = None
    forward_return_5d: float | None = None
    forward_return_30d: float | None = None

    # Win/loss
    win_1d: bool | None = None
    win_5d: bool | None = None
    win_30d: bool | None = None
    overall_win: bool | None = None

    # Performance metrics
    max_favorable_move: float | None = None
    max_adverse_move: float | None = None

    # Notes
    trade_notes: str = ""
    exit_reason: str = ""

    # Metadata
    last_updated: datetime = field(default_factory=lambda: datetime.now(UTC))
