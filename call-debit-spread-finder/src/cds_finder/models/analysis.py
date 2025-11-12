"""Analysis result models."""

from dataclasses import dataclass
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .signal import Signal


@dataclass
class TechnicalAnalysis:
    """Technical analysis results."""
    
    rsi: float
    rsi_signal: str  # "OVERSOLD", "OVERBOUGHT", "NEUTRAL"
    sma_20: float
    sma_50: float
    price_vs_sma20: float
    price_vs_sma50: float
    momentum_5d: float
    momentum_10d: float
    volume_ratio: float
    trend: str  # "BULLISH", "BEARISH", "NEUTRAL"
    score: float  # 0-100
    sma_200: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    momentum_20d: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    support_level: Optional[float] = None
    resistance_level: Optional[float] = None


@dataclass
class FundamentalAnalysis:
    """Fundamental analysis results."""
    
    pe_ratio: Optional[float] = None
    earnings_growth_yoy: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    market_cap: Optional[float] = None
    profit_margin: Optional[float] = None
    debt_to_equity: Optional[float] = None
    days_to_earnings: Optional[int] = None
    has_upcoming_catalyst: bool = False
    score: float = 0.0  # 0-100


@dataclass
class OptionsAnalysis:
    """Options-specific analysis results."""
    
    long_strike: float
    short_strike: float
    strike_width: float
    net_debit: float
    max_profit: float
    max_loss: float
    risk_reward_ratio: float
    probability_of_profit: float
    breakeven_price: float
    breakeven_pct: float
    score: float = 0.0  # 0-100
    iv_rank: Optional[float] = None
    delta: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None


@dataclass
class CallDebitSpreadOpportunity:
    """Complete Call Debit Spread opportunity."""
    
    signal_id: str
    ticker: str
    signal: "Signal"  # Forward reference (imported via TYPE_CHECKING)
    technical: TechnicalAnalysis
    fundamental: FundamentalAnalysis
    options: OptionsAnalysis
    composite_score: float
    confidence_level: str  # "GOLDEN", "HIGH", "MODERATE", "LOW"
    recommendation: str
    warnings: List[str]
    reasons: List[str]

