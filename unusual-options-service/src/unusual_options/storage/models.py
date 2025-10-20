"""Database models for signals and performance tracking."""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional, Dict
from uuid import uuid4


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
    risk_factors: List[RiskFactor]
    
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
    detection_timestamp: datetime = field(default_factory=datetime.now)
    
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
    risk_factors: List[str] = field(default_factory=list)
    
    # Market Context
    underlying_price: float = 0.0
    implied_volatility: Optional[float] = None
    iv_rank: Optional[float] = None
    market_cap: Optional[int] = None
    avg_daily_volume: Optional[int] = None
    
    # Directional Bias
    sentiment: str = "NEUTRAL"  # BULLISH, BEARISH, NEUTRAL
    put_call_ratio: Optional[float] = None
    
    # Additional Context
    days_to_earnings: Optional[int] = None
    has_upcoming_catalyst: bool = False
    catalyst_description: Optional[str] = None
    
    # Performance Tracking (filled later)
    forward_return_1d: Optional[float] = None
    forward_return_5d: Optional[float] = None
    forward_return_30d: Optional[float] = None
    win: Optional[bool] = None
    
    # Metadata
    data_provider: str = ""
    detection_version: str = "0.1.0"
    raw_detection_data: Dict = field(default_factory=dict)


@dataclass
class SignalPerformance:
    """Performance tracking for a signal."""
    
    performance_id: str = field(default_factory=lambda: str(uuid4()))
    signal_id: str = ""
    ticker: str = ""
    
    # Entry
    entry_timestamp: datetime = field(default_factory=datetime.now)
    entry_price: float = 0.0
    option_symbol: str = ""
    signal_grade: str = ""
    signal_sentiment: str = ""
    
    # Price tracking
    price_1d_later: Optional[float] = None
    price_5d_later: Optional[float] = None
    price_30d_later: Optional[float] = None
    current_price: Optional[float] = None
    
    # Forward returns
    forward_return_1d: Optional[float] = None
    forward_return_5d: Optional[float] = None
    forward_return_30d: Optional[float] = None
    
    # Win/loss
    win_1d: Optional[bool] = None
    win_5d: Optional[bool] = None
    win_30d: Optional[bool] = None
    overall_win: Optional[bool] = None
    
    # Performance metrics
    max_favorable_move: Optional[float] = None
    max_adverse_move: Optional[float] = None
    
    # Notes
    trade_notes: str = ""
    exit_reason: str = ""
    
    # Metadata
    last_updated: datetime = field(default_factory=datetime.now)

