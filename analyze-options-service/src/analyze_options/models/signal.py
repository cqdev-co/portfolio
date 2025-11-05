"""Signal data models."""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
from enum import Enum


class Sentiment(str, Enum):
    """Trade sentiment direction."""
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


@dataclass
class EnrichedSignal:
    """
    Unusual options signal enriched with current market data.
    Source: unusual_options_signals table + fresh yfinance data
    """
    
    # From database
    signal_id: str
    ticker: str
    option_symbol: str
    strike: float
    expiry: date
    option_type: str  # 'call' or 'put'
    days_to_expiry: int
    grade: str  # S, A, B, C, D, F
    sentiment: Sentiment
    overall_score: float
    premium_flow: float
    underlying_price: float  # Price at detection
    
    # Fresh market data (from yfinance)
    current_price: float
    current_iv: float  # Implied volatility
    time_to_expiry: float  # Years
    
    # Calculated
    moneyness: str  # ITM, ATM, OTM
    days_to_earnings: Optional[int] = None
    
    # Additional context
    current_volume: Optional[int] = None
    average_volume: Optional[float] = None
    market_cap: Optional[int] = None
    
    def __post_init__(self):
        """Convert sentiment to enum if string."""
        if isinstance(self.sentiment, str):
            self.sentiment = Sentiment(self.sentiment)

