"""Analysis models for penny stock scanner - explosion setup detection."""

from datetime import datetime, date
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TrendDirection(str, Enum):
    """Trend direction enumeration."""

    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class SignalStatus(str, Enum):
    """Signal continuity status."""

    NEW = "NEW"
    CONTINUING = "CONTINUING"
    ENDED = "ENDED"


class OpportunityRank(str, Enum):
    """Opportunity ranking classification for penny stocks."""

    S_TIER = "S"  # Exceptional (≥0.90) - strong volume, clean breakout
    A_TIER = "A"  # Excellent (≥0.80) - high volume surge, good momentum
    B_TIER = "B"  # Solid (≥0.70) - decent volume, positive momentum
    C_TIER = "C"  # Fair (≥0.60) - minimal requirements met
    D_TIER = "D"  # Poor (<0.60) - weak conditions


class RiskLevel(str, Enum):
    """Risk level assessment."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    EXTREME = "EXTREME"


class ExplosionSignal(BaseModel):
    """
    Penny stock explosion signal detection result.
    Focuses on volume-driven breakouts from consolidation.
    """

    timestamp: datetime = Field(description="Signal timestamp")
    symbol: str = Field(description="Stock symbol")

    # Price data
    close_price: float = Field(description="Current closing price")

    # Volume Analysis (50% weight) - THE DOMINANT SIGNAL
    volume: int = Field(description="Current volume")
    avg_volume_20d: float = Field(description="20-day average volume")
    volume_ratio: float = Field(
        description="Current volume vs 20-day average (e.g., 2.5 = 2.5x)"
    )
    volume_spike_factor: float = Field(
        description="Maximum volume spike detected (2x, 3x, 5x, etc.)"
    )
    volume_acceleration_2d: float = Field(description="2-day volume growth rate")
    volume_acceleration_5d: float = Field(description="5-day volume growth rate")
    volume_consistency_score: float = Field(
        description="Score for multiple high-volume days (0-1)"
    )
    dollar_volume: float = Field(description="Daily dollar volume")

    # Price Momentum & Consolidation (30% weight)
    is_consolidating: bool = Field(description="Stock in consolidation phase")
    consolidation_days: Optional[int] = Field(
        None, description="Days spent consolidating"
    )
    consolidation_range_pct: Optional[float] = Field(
        None, description="Price range % during consolidation"
    )
    is_breakout: bool = Field(description="Breaking out of consolidation")
    price_change_5d: float = Field(description="5-day price change %")
    price_change_10d: float = Field(description="10-day price change %")
    price_change_20d: float = Field(description="20-day price change %")
    higher_lows_detected: bool = Field(
        description="Series of higher lows (accumulation)"
    )
    consecutive_green_days: int = Field(description="Number of consecutive up days")

    # Moving averages
    ema_20: float = Field(description="20-period EMA")
    ema_50: float = Field(description="50-period EMA")
    price_vs_ema20: float = Field(description="Price position vs EMA20 (%)")
    price_vs_ema50: float = Field(description="Price position vs EMA50 (%)")
    ema_crossover_signal: bool = Field(description="EMA 20 crossed above EMA 50")

    # Relative Strength (15% weight)
    market_outperformance: Optional[float] = Field(
        None, description="Performance vs SPY (%)"
    )
    sector_outperformance: Optional[float] = Field(
        None, description="Performance vs sector (%)"
    )
    distance_from_52w_low: float = Field(description="% distance from 52-week low")
    distance_from_52w_high: float = Field(description="% distance from 52-week high")
    breaking_resistance: bool = Field(description="Breaking above key resistance level")

    # Risk & Liquidity (5% weight)
    bid_ask_spread_pct: Optional[float] = Field(
        None, description="Bid-ask spread as % of price"
    )
    avg_spread_5d: Optional[float] = Field(None, description="5-day average spread %")
    float_shares: Optional[int] = Field(None, description="Float shares")
    is_low_float: bool = Field(default=False, description="Float < 50M shares")
    daily_volatility: float = Field(description="Daily price volatility (ATR-based)")
    atr_20: float = Field(description="20-period ATR")
    pump_dump_risk: RiskLevel = Field(description="Pump-and-dump risk level")

    # Country risk (added Dec 2024)
    country: Optional[str] = Field(None, description="Company country of origin")
    is_high_risk_country: bool = Field(
        default=False,
        description="Company from high-risk country (Israel, Malaysia, etc.)",
    )

    # Pump-and-dump warning (added Dec 2024)
    # Triggered by: extreme volume (10x+) + high score + (high-risk country OR sub-$0.50)
    pump_dump_warning: bool = Field(
        default=False, description="Warning flag for potential pump-and-dump"
    )

    # Trend context
    trend_direction: TrendDirection = Field(description="Current trend direction")

    # Signal metadata
    signal_status: SignalStatus = Field(
        default=SignalStatus.NEW, description="Signal status"
    )
    days_active: int = Field(default=0, description="Days signal has been active")

    # Component scores (for transparency)
    volume_score: float = Field(description="Volume analysis score (0-0.50)")
    momentum_score: float = Field(description="Price momentum score (0-0.30)")
    relative_strength_score: float = Field(
        description="Relative strength score (0-0.15)"
    )
    risk_score: float = Field(description="Risk & liquidity score (0-0.05)")

    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "AEMD",
                "close_price": 1.25,
                "volume": 2500000,
                "volume_ratio": 3.5,
                "volume_spike_factor": 3.5,
                "is_consolidating": True,
                "is_breakout": True,
                "opportunity_rank": "A",
            }
        }


class AIAnalysis(BaseModel):
    """Optional AI-powered analysis of the explosion signal."""

    signal_type: str = Field(description="AI classification of signal type")
    confidence: float = Field(description="AI confidence score (0-1)")
    rationale: str = Field(description="AI reasoning for classification")
    key_factors: list[str] = Field(description="Key factors identified")
    risk_assessment: str = Field(description="AI risk assessment")
    suggested_action: str = Field(description="Suggested trading action")
    invalidation_level: Optional[float] = Field(
        None, description="Price level that invalidates signal"
    )
    target_levels: Optional[list[float]] = Field(
        None, description="Potential price targets"
    )


class AnalysisResult(BaseModel):
    """Complete analysis result for a penny stock."""

    analysis_id: str = Field(description="Unique analysis identifier")
    symbol: str = Field(description="Stock symbol")
    timestamp: datetime = Field(description="Analysis timestamp")

    # Main signal
    explosion_signal: ExplosionSignal = Field(description="Explosion setup signal")

    # Optional AI analysis
    ai_analysis: Optional[AIAnalysis] = Field(None, description="AI-powered analysis")

    # Overall assessment
    overall_score: float = Field(description="Overall signal score (0-1.0)")
    opportunity_rank: OpportunityRank = Field(description="Opportunity tier ranking")
    recommendation: str = Field(description="Trading recommendation")

    # Risk management
    stop_loss_level: Optional[float] = Field(
        None, description="Recommended stop loss price"
    )
    position_size_pct: float = Field(description="Recommended position size (%)")
    risk_reward_ratio: Optional[float] = Field(
        None, description="Estimated risk/reward ratio"
    )

    # Metadata
    analysis_duration_ms: int = Field(description="Analysis execution time (ms)")
    data_quality_score: float = Field(description="Input data quality score (0-1)")

    def is_actionable(self) -> bool:
        """Check if signal meets criteria for action."""
        return (
            self.overall_score >= 0.60
            and self.explosion_signal.dollar_volume >= 100000
            and self.explosion_signal.volume_ratio >= 1.5
            and self.data_quality_score >= 0.7
        )

    class Config:
        json_schema_extra = {
            "example": {
                "analysis_id": "abc-123",
                "symbol": "AEMD",
                "overall_score": 0.85,
                "opportunity_rank": "A",
                "recommendation": "BUY",
            }
        }
