"""
Analysis Result Models - Extended to support new strategic features.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime


# Technical Analysis Models (needed by market_data.py)
@dataclass
class TechnicalIndicators:
    """Technical indicators for a ticker."""
    ticker: str
    rsi: Optional[float] = None
    rsi_signal: Optional[str] = None  # "OVERSOLD", "OVERBOUGHT", "NEUTRAL"
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    volume_avg: Optional[float] = None
    volume_ratio: Optional[float] = None  # Current vs average
    price_vs_sma20: Optional[float] = None  # % above/below SMA20
    price_vs_sma50: Optional[float] = None
    trend: Optional[str] = None  # "BULLISH", "BEARISH", "NEUTRAL"
    momentum: Optional[str] = None  # "STRONG", "WEAK", "NEUTRAL"
    support_level: Optional[float] = None
    resistance_level: Optional[float] = None


# Existing models (preserved)
@dataclass
class VerticalSpreadAnalysis:
    """Analysis of vertical spread strategy."""
    strategy_type: str
    long_strike: float
    short_strike: float
    strike_width: float
    net_debit: float
    max_profit: float
    max_loss: float
    risk_reward_ratio: float
    breakeven_price: float
    breakeven_move_pct: float
    probability_of_profit: float
    expected_value: float
    delta: float
    theta: float
    vega: float
    quality_score: float
    recommendation: str


@dataclass
class NakedOptionsAnalysis:
    """Analysis of naked options strategy."""
    strategy_type: str
    strike: float
    option_type: str
    premium_cost: float
    max_profit: str
    max_loss: float
    breakeven_price: float
    breakeven_move_pct: float
    probability_of_profit: float
    probability_of_50pct_gain: float
    probability_of_100pct_gain: float
    expected_value: float
    delta: float
    theta: float
    vega: float
    implied_volatility: float
    capital_requirement: float
    max_contracts_for_1pct_risk: int
    quality_score: float
    recommendation: str
    risk_warning: str


# NEW: Filter System Models
@dataclass
class FilterResult:
    """Result of filtering operation."""
    passed: bool
    reason: str
    score: float = 1.0


@dataclass
class FilterStats:
    """Statistics tracking for 5-Filter System."""
    total_input: int = 0
    after_quality: int = 0
    after_time_decay: int = 0
    after_premium: int = 0
    after_moneyness: int = 0
    after_consistency: int = 0
    final_output: int = 0
    
    def reset(self):
        """Reset all counters."""
        self.total_input = 0
        self.after_quality = 0
        self.after_time_decay = 0
        self.after_premium = 0
        self.after_moneyness = 0
        self.after_consistency = 0
        self.final_output = 0
    
    def get_reduction_summary(self) -> str:
        """Get human-readable summary."""
        reduction = self.total_input - self.final_output
        reduction_pct = (
            (reduction / self.total_input * 100) 
            if self.total_input > 0 else 0
        )
        return (
            f"Filtered {self.total_input} → {self.final_output} signals "
            f"({reduction_pct:.1f}% reduction)"
        )


# NEW: Validation Models
@dataclass
class ValidationCheck:
    """Individual validation check (used by validation_checklist.py)."""
    name: str
    category: str  # "technical", "signal_quality", "macro"
    passed: bool
    score: float
    reason: str
    weight: float = 1.0
    critical: bool = False


@dataclass
class CheckResult:
    """Single validation check result."""
    check_name: str
    passed: bool
    score: float
    reason: str
    category: str
    critical: bool = False


@dataclass
class ValidationResult:
    """Complete validation result."""
    signal_id: str
    ticker: str
    passed: bool
    checks_passed: int
    checks_total: int
    score: float
    checks: List[ValidationCheck]  # Changed from CheckResult to ValidationCheck
    critical_failures: List[ValidationCheck]  # Changed from CheckResult
    recommendation: str
    summary: str
    
    def get_display_summary(self) -> str:
        """Format for display."""
        status = "✅ PASS" if self.passed else "❌ FAIL"
        return (
            f"{status} | {self.checks_passed}/{self.checks_total} checks | "
            f"Score: {self.score:.1%}\n{self.recommendation}"
        )


# NEW: Entry Strategy Models
@dataclass
class EntryStrategy:
    """Specific entry strategy recommendation."""
    type: str  # EntryStrategyType enum value
    name: str
    description: str
    timing: str
    position_allocation: float
    execution_steps: List[str]
    pros: List[str]
    cons: List[str]
    best_for: str
    risk_level: str
    target_entry_price_vs_current: Optional[str] = None
    scale_allocation: Optional[List[float]] = None


@dataclass
class EntryRecommendation:
    """Entry timing recommendation."""
    signal_id: str
    ticker: str
    primary_strategy: EntryStrategy
    alternative_strategies: List[EntryStrategy]
    recommendation_reason: str


# NEW: Exit Strategy Models
@dataclass
class ExitRule:
    """Individual exit rule."""
    trigger: str
    action: str
    position_pct: float
    reason: str


@dataclass
class ExitStrategy:
    """Complete exit strategy for a position."""
    profit_targets: List[ExitRule]
    stop_loss: ExitRule
    time_based_exits: List[ExitRule]
    signal_based_exits: List[ExitRule]
    trailing_stop: Optional[ExitRule] = None


@dataclass
class ExitRecommendation:
    """Exit recommendation for active position."""
    signal_id: str
    ticker: str
    current_pl_pct: float
    days_held: int
    days_to_expiry: int
    exit_strategy: ExitStrategy
    immediate_action: Optional[str] = None
    reason: Optional[str] = None


# NEW: Portfolio Models
class PortfolioTier(Enum):
    """Portfolio tiers for 3-tier system."""
    TIER_1_CORE = "tier_1_core"
    TIER_2_OPPORTUNISTIC = "tier_2_opportunistic"
    TIER_3_SPECULATIVE = "tier_3_speculative"


@dataclass
class PositionAllocation:
    """Position sizing recommendation."""
    tier: PortfolioTier
    position_size_pct: float
    position_size_dollars: float
    contracts: int
    max_risk_dollars: float
    expected_return_pct: float
    win_probability: float
    reason: str


@dataclass
class PortfolioRecommendation:
    """Overall portfolio recommendation."""
    total_capital: float
    options_allocation_pct: float
    options_capital: float
    tier_1_positions: List[Dict]
    tier_2_positions: List[Dict]
    tier_3_positions: List[Dict]
    total_delta: float
    total_theta: float
    diversification_score: float
    warnings: List[str]
    recommendations: List[str]


# NEW: Monitoring Models
@dataclass
class PositionHealth:
    """Health check for active position."""
    signal_id: str
    ticker: str
    status: str  # "GREEN", "YELLOW", "RED"
    pl_pct: float
    days_to_expiry: int
    theta_decay_per_day_pct: float
    distance_to_strike_pct: float
    new_signals_same_direction: int
    new_signals_opposite_direction: int
    action_required: Optional[str] = None
    priority: str = "NORMAL"  # "LOW", "NORMAL", "HIGH", "CRITICAL"


@dataclass
class DailyMonitoringReport:
    """Daily monitoring summary."""
    date: datetime
    positions_green: int
    positions_yellow: int
    positions_red: int
    total_pl_pct: float
    actions_required: List[str]
    opportunities: List[str]
    position_details: List[PositionHealth]


# NEW: Correlation Analysis
@dataclass
class CorrelationScore:
    """Multi-signal correlation scoring."""
    ticker: str
    base_score: int
    same_strike_bonus: int
    adjacent_strike_bonus: int
    time_spread_bonus: int
    sector_bonus: int
    premium_bonus: int
    multi_day_bonus: int
    total_score: int
    confidence_level: str  # "LOW", "MEDIUM", "HIGH", "VERY_HIGH"


@dataclass
class SignalGroup:
    """Group of related signals."""
    ticker: str
    direction: str  # "BULLISH", "BEARISH", "MIXED"
    signal_count: int
    total_premium: float
    correlation_score: CorrelationScore
    signals: List[str]  # Signal IDs
    recommendation: str


# Enhanced Trade Recommendation
@dataclass
class EnhancedTradeRecommendation:
    """
    Complete trade recommendation with all strategic components.
    
    Combines:
    - Original strategy analysis (spread vs naked)
    - Filter results
    - Validation results
    - Entry timing
    - Exit strategy
    - Position sizing
    - Portfolio tier
    """
    # Core identification
    signal_id: str
    ticker: str
    grade: str
    overall_score: float
    
    # Strategy analysis (existing)
    vertical_spread: Optional[VerticalSpreadAnalysis]
    naked_option: Optional[NakedOptionsAnalysis]
    recommended_strategy: str
    
    # NEW: Strategic components
    filter_passed: bool
    filter_reasons: List[str]
    validation_result: Optional[ValidationResult]
    entry_recommendation: Optional[EntryRecommendation]
    exit_strategy: Optional[ExitStrategy]
    position_allocation: Optional[PositionAllocation]
    correlation_score: Optional[CorrelationScore]
    
    # Recommendation
    tier: PortfolioTier
    action: str  # "BUY", "WATCH", "SKIP"
    confidence: str  # "VERY_HIGH", "HIGH", "MEDIUM", "LOW"
    summary: str
    warnings: List[str] = field(default_factory=list)
    
    def get_quick_summary(self) -> str:
        """One-line summary."""
        return (
            f"{self.ticker} {self.grade} | "
            f"{self.recommended_strategy} | "
            f"{self.tier.value.upper()} | "
            f"{self.action}"
        )
    
    def should_trade(self) -> bool:
        """Quick check if this is tradeable."""
        return (
            self.action == "BUY" and
            self.filter_passed and
            (self.validation_result is None or 
             self.validation_result.passed)
        )
