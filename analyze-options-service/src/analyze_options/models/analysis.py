"""Analysis result models."""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TechnicalIndicators:
    """Technical analysis indicators from yfinance."""
    
    ticker: str
    price: float
    
    # RSI
    rsi: float  # 14-day RSI
    
    # Moving Averages
    ma_20: float  # 20-day MA
    ma_50: float  # 50-day MA
    ma_200: float  # 200-day MA
    
    # Momentum
    momentum_5d: float  # 5-day momentum (% change)
    momentum_10d: float  # 10-day momentum
    
    # Volume
    current_volume: int
    avg_volume_20d: float
    volume_ratio: float  # current / average
    
    # Trend signals
    is_above_ma_50: bool
    is_above_ma_200: bool
    is_golden_cross: bool  # MA50 > MA200
    is_death_cross: bool  # MA50 < MA200


@dataclass
class VerticalSpreadAnalysis:
    """Analysis of a vertical spread strategy."""
    
    strategy_type: str  # "BULL_CALL_SPREAD" | "BEAR_PUT_SPREAD"
    
    # Strikes
    long_strike: float
    short_strike: float
    strike_width: float
    
    # Cost Analysis
    net_debit: float  # Cost per spread
    max_profit: float  # Per spread
    max_loss: float  # Per spread
    risk_reward_ratio: float  # max_profit / max_loss
    
    # Break Even
    breakeven_price: float
    breakeven_move_pct: float  # % from current price
    
    # Probability
    probability_of_profit: float  # 0-1
    expected_value: float  # Weighted profit/loss
    
    # Greeks (net of spread)
    delta: float
    theta: float  # Daily time decay
    vega: float  # IV sensitivity
    
    # Scoring
    quality_score: float  # 0-100
    
    # Robinhood-friendly details
    long_option_description: str = ""  # "Buy $180 Call"
    short_option_description: str = ""  # "Sell $185 Call"
    simple_explanation: str = ""  # Plain English


@dataclass
class NakedOptionsAnalysis:
    """Analysis of naked option strategy."""
    
    strategy_type: str  # "NAKED_CALL" | "NAKED_PUT"
    
    # Strike
    strike: float
    option_type: str  # 'call' | 'put'
    
    # Cost Analysis
    premium_cost: float  # Per contract
    max_profit: float  # Unlimited for calls, capped for puts
    max_loss: float  # = premium_cost
    
    # Break Even
    breakeven_price: float
    breakeven_move_pct: float
    
    # Probability Analysis
    probability_of_profit: float  # Based on delta
    probability_of_50pct_gain: float  # 50% return
    probability_of_100pct_gain: float  # 100% return
    expected_value: float
    
    # Greeks
    delta: float
    theta: float
    vega: float
    implied_volatility: float
    
    # Scoring & Risk
    quality_score: float  # 0-100
    risk_warnings: List[str] = field(default_factory=list)
    
    # Robinhood-friendly details
    option_description: str = ""  # "Buy $5 Call @ $0.65"
    simple_explanation: str = ""
    potential_gains_table: str = ""  # "If stock → $6: +$35 (54%)"


@dataclass
class StrategyComparison:
    """Comparison of vertical spread vs naked option."""
    
    signal_id: str
    ticker: str
    sentiment: str
    
    # Vertical Spread
    spread_analysis: VerticalSpreadAnalysis
    spread_recommended: bool
    
    # Naked Options
    naked_analysis: NakedOptionsAnalysis
    naked_recommended: bool
    
    # Winner
    recommended_strategy: str  # "VERTICAL_SPREAD" | "NAKED_CALL" | "NAKED_PUT"
    reason: str  # Why this strategy won
    
    # Cost Comparison
    cost_savings_pct: float  # How much cheaper is spread
    leverage_comparison: str  # "Can buy 3 spreads vs 1 naked call"

