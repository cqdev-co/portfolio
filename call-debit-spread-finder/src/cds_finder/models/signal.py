"""Signal data models matching the database schema."""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional


@dataclass
class Signal:
    """Signal model matching unusual_options_signals table schema."""
    
    # Core identification
    signal_id: str
    ticker: str
    option_symbol: str
    strike: float
    expiry: date
    option_type: str
    days_to_expiry: int
    
    # Signal quality
    grade: str  # 'S', 'A', 'B', 'C', 'D', 'F'
    overall_score: float  # 0.0-1.0
    sentiment: str  # 'BULLISH', 'BEARISH', 'NEUTRAL'
    
    # Volume metrics
    current_volume: int
    average_volume: float
    
    # Premium metrics
    premium_flow: float
    
    # Market context
    underlying_price: float
    
    # Optional fields
    moneyness: Optional[str] = None  # 'ITM', 'ATM', 'OTM'
    confidence: Optional[float] = None  # 0.0-1.0
    
    volume_ratio: Optional[float] = None
    
    # Open Interest metrics
    current_oi: int = 0
    previous_oi: int = 0
    oi_change_pct: Optional[float] = None
    
    # Premium metrics
    aggressive_order_pct: Optional[float] = None
    
    # Market context
    implied_volatility: Optional[float] = None
    iv_rank: Optional[float] = None
    market_cap: Optional[int] = None
    avg_daily_volume: Optional[int] = None
    
    # Risk assessment
    risk_level: str = "MEDIUM"  # 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'
    risk_factors: List[str] = field(default_factory=list)  # Parsed from JSONB
    
    # Catalysts
    days_to_earnings: Optional[int] = None
    has_upcoming_catalyst: bool = False
    catalyst_description: Optional[str] = None
    
    # Detection flags
    has_volume_anomaly: bool = False
    has_oi_spike: bool = False
    has_premium_flow: bool = False
    has_sweep: bool = False
    has_block_trade: bool = False
    
    # Continuity
    is_active: bool = True
    last_detected_at: Optional[datetime] = None
    detection_count: int = 1
    
    # Metadata
    detection_timestamp: Optional[datetime] = None
    
    @classmethod
    def from_db_row(cls, row: dict) -> "Signal":
        """Create Signal from database row."""
        # Parse risk_factors JSONB
        risk_factors = []
        if row.get("risk_factors"):
            if isinstance(row["risk_factors"], list):
                risk_factors = row["risk_factors"]
            elif isinstance(row["risk_factors"], str):
                import json
                try:
                    risk_factors = json.loads(row["risk_factors"])
                except:
                    risk_factors = []
        
        # Parse dates
        expiry = row["expiry"]
        if isinstance(expiry, str):
            from datetime import datetime as dt
            expiry = dt.fromisoformat(expiry).date()
        
        detection_timestamp = row.get("detection_timestamp")
        if detection_timestamp and isinstance(detection_timestamp, str):
            from datetime import datetime as dt
            detection_timestamp = dt.fromisoformat(detection_timestamp.replace("Z", "+00:00"))
        
        last_detected_at = row.get("last_detected_at")
        if last_detected_at and isinstance(last_detected_at, str):
            from datetime import datetime as dt
            last_detected_at = dt.fromisoformat(last_detected_at.replace("Z", "+00:00"))
        
        return cls(
            signal_id=str(row["signal_id"]),
            ticker=row["ticker"],
            option_symbol=row["option_symbol"],
            strike=float(row["strike"]),
            expiry=expiry,
            option_type=row["option_type"],
            days_to_expiry=int(row["days_to_expiry"]),
            moneyness=row.get("moneyness"),
            grade=row["grade"],
            overall_score=float(row["overall_score"]),
            confidence=float(row["confidence"]) if row.get("confidence") else None,
            sentiment=row.get("sentiment", "NEUTRAL"),
            current_volume=int(row["current_volume"]),
            average_volume=float(row["average_volume"]),
            volume_ratio=float(row["volume_ratio"]) if row.get("volume_ratio") else None,
            current_oi=int(row.get("current_oi", 0)),
            previous_oi=int(row.get("previous_oi", 0)),
            oi_change_pct=float(row["oi_change_pct"]) if row.get("oi_change_pct") else None,
            premium_flow=float(row["premium_flow"]),
            aggressive_order_pct=float(row["aggressive_order_pct"]) if row.get("aggressive_order_pct") else None,
            underlying_price=float(row["underlying_price"]),
            implied_volatility=float(row["implied_volatility"]) if row.get("implied_volatility") else None,
            iv_rank=float(row["iv_rank"]) if row.get("iv_rank") else None,
            market_cap=int(row["market_cap"]) if row.get("market_cap") else None,
            avg_daily_volume=int(row["avg_daily_volume"]) if row.get("avg_daily_volume") else None,
            risk_level=row.get("risk_level", "MEDIUM"),
            risk_factors=risk_factors,
            days_to_earnings=int(row["days_to_earnings"]) if row.get("days_to_earnings") else None,
            has_upcoming_catalyst=bool(row.get("has_upcoming_catalyst", False)),
            catalyst_description=row.get("catalyst_description"),
            has_volume_anomaly=bool(row.get("has_volume_anomaly", False)),
            has_oi_spike=bool(row.get("has_oi_spike", False)),
            has_premium_flow=bool(row.get("has_premium_flow", False)),
            has_sweep=bool(row.get("has_sweep", False)),
            has_block_trade=bool(row.get("has_block_trade", False)),
            is_active=bool(row.get("is_active", True)),
            last_detected_at=last_detected_at,
            detection_count=int(row.get("detection_count", 1)),
            detection_timestamp=detection_timestamp,
        )

