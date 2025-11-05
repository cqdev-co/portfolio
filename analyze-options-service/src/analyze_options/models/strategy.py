"""Data models for strategy analysis results."""

from dataclasses import dataclass, field
from typing import Optional, List
from enum import Enum


class StrategyType(Enum):
    """Strategy types."""
    BULL_CALL_SPREAD = "Bull Call Spread"
    BEAR_PUT_SPREAD = "Bear Put Spread"
    NAKED_CALL = "Naked Call"
    NAKED_PUT = "Naked Put"


class StrategyRecommendation(Enum):
    """Which strategy to use."""
    VERTICAL_SPREAD = "Vertical Spread (Defined Risk)"
    NAKED_OPTION = "Naked Option (Higher Reward)"
    SKIP = "Skip (Risk Too High)"


@dataclass
class VerticalSpreadAnalysis:
    """Analysis results for a vertical spread strategy."""
    
    # Strategy details
    strategy_type: StrategyType
    buy_strike: float
    sell_strike: float
    expiry: str
    days_to_expiry: int
    
    # Pricing
    buy_premium: Optional[float] = None  # Cost of long leg
    sell_premium: Optional[float] = None  # Credit from short leg
    net_debit: Optional[float] = None  # Total cost per spread
    
    # Risk/Reward
    max_profit: Optional[float] = None  # Strike width - net debit
    max_loss: Optional[float] = None  # Net debit paid
    risk_reward_ratio: Optional[float] = None  # Max profit / max loss
    
    # Probability
    breakeven_price: Optional[float] = None
    breakeven_pct: Optional[float] = None  # % move needed
    probability_profit: Optional[float] = None  # Estimated probability
    
    # Greeks
    delta: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    
    # Score
    score: float = 0.0  # 0-100 composite score
    score_breakdown: dict = field(default_factory=dict)
    
    # Warnings
    warnings: List[str] = field(default_factory=list)
    
    @property
    def cost_per_contract(self) -> Optional[float]:
        """Cost per contract in dollars."""
        if self.net_debit:
            return self.net_debit * 100  # Options are per 100 shares
        return None
    
    @property
    def profit_per_contract(self) -> Optional[float]:
        """Max profit per contract in dollars."""
        if self.max_profit:
            return self.max_profit * 100
        return None
    
    @property
    def strike_width(self) -> float:
        """Width between strikes."""
        return abs(self.sell_strike - self.buy_strike)


@dataclass
class NakedOptionAnalysis:
    """Analysis results for a naked option strategy."""
    
    # Strategy details
    strategy_type: StrategyType
    strike: float
    expiry: str
    days_to_expiry: int
    
    # Pricing
    premium: Optional[float] = None  # Cost per option
    current_price: float = 0.0  # Underlying price
    
    # Risk/Reward
    max_loss: Optional[float] = None  # 100% of premium
    potential_profit: Optional[float] = None  # Unlimited for calls
    risk_reward_ratio: Optional[float] = None  # Conservative estimate
    
    # Probability
    breakeven_price: Optional[float] = None
    breakeven_pct: Optional[float] = None  # % move needed
    probability_profit: Optional[float] = None  # Estimated probability
    
    # Greeks
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    
    # Moneyness
    moneyness: str = ""  # ITM, ATM, OTM
    intrinsic_value: float = 0.0
    extrinsic_value: float = 0.0
    
    # Score
    score: float = 0.0  # 0-100 composite score
    score_breakdown: dict = field(default_factory=dict)
    
    # Warnings
    warnings: List[str] = field(default_factory=list)
    
    @property
    def cost_per_contract(self) -> Optional[float]:
        """Cost per contract in dollars."""
        if self.premium:
            return self.premium * 100
        return None
    
    @property
    def distance_to_strike_pct(self) -> Optional[float]:
        """Percentage distance from current price to strike."""
        if self.current_price > 0:
            return ((self.strike - self.current_price) / self.current_price) * 100
        return None


@dataclass
class StrategyComparison:
    """Comparison between vertical spread and naked option."""
    
    # Input signal
    ticker: str
    signal_grade: str
    sentiment: str
    premium_flow: float
    
    # Strategies analyzed
    spread: Optional[VerticalSpreadAnalysis] = None
    naked: Optional[NakedOptionAnalysis] = None
    
    # Recommendation
    recommended_strategy: StrategyRecommendation = StrategyRecommendation.SKIP
    recommendation_reason: str = ""
    
    # Position sizing
    suggested_contracts: int = 0
    suggested_capital: float = 0.0
    risk_per_trade: float = 0.0  # Dollar amount at risk
    
    # Overall score
    composite_score: float = 0.0
    rank: int = 0  # Ranking among all signals
    
    def get_better_strategy(self) -> Optional[str]:
        """Returns which strategy has higher score."""
        if not self.spread or not self.naked:
            return None
        
        if self.spread.score > self.naked.score:
            return "spread"
        elif self.naked.score > self.spread.score:
            return "naked"
        return "equal"

