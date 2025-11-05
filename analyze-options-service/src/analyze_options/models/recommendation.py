"""Trade recommendation model."""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional


@dataclass
class TradeRecommendation:
    """
    Final trade recommendation with all details needed to execute on Robinhood.
    """
    
    # Identity & Ranking
    rank: int  # 1-5
    score: float  # 0-100
    recommendation_type: str  # "STRONG_BUY" | "BUY" | "CONSIDER"
    
    # Signal Context
    ticker: str
    signal_id: str
    signal_grade: str  # S, A, B
    sentiment: str  # BULLISH, BEARISH
    
    # Strategy Details
    strategy: str  # "VERTICAL_SPREAD" | "NAKED_CALL" | "NAKED_PUT"
    long_strike: float
    short_strike: Optional[float]  # None for naked options
    expiry: date
    option_type: str  # "call" | "put"
    days_to_expiry: int
    
    # Cost & Payoff (per contract)
    net_cost: float
    max_profit: float  # Or "UNLIMITED"
    max_loss: float
    risk_reward_ratio: float
    break_even_price: float
    break_even_move_pct: float
    
    # Probability
    probability_of_profit: float
    expected_value: float
    
    # Position Sizing
    recommended_contracts: int
    total_cost: float  # For all contracts
    position_pct: float  # % of account
    max_risk_dollars: float
    max_profit_dollars: float
    
    # Greeks (aggregate for position)
    delta: float
    theta: float
    vega: float
    
    # Robinhood-Friendly Instructions
    robinhood_instructions: str  # Step-by-step
    simple_explanation: str  # Plain English
    
    # Technical Context (no defaults)
    current_price: float
    
    # Reasoning (with defaults)
    why_buy: List[str] = field(default_factory=list)
    considerations: List[str] = field(default_factory=list)
    alternative_strategy: Optional[str] = None
    
    # Technical Context (with defaults)
    rsi: Optional[float] = None
    price_vs_ma_50: Optional[str] = None  # "Above" | "Below"
    
    # Risk Management
    suggested_stop_loss: Optional[float] = None
    suggested_profit_target: Optional[float] = None
    
    # Execution Notes
    execution_notes: str = ""
    days_to_earnings: Optional[int] = None

