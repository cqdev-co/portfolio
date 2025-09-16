"""Analysis models and schemas for volatility squeeze detection."""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class TrendDirection(str, Enum):
    """Trend direction enumeration."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class SignalType(str, Enum):
    """Signal type classification."""
    CONTINUATION = "continuation"
    REVERSAL = "reversal" 
    CHOP = "chop"


class SqueezeSignal(BaseModel):
    """Volatility squeeze signal detection result."""
    
    timestamp: datetime = Field(description="Signal timestamp")
    symbol: str = Field(description="Stock/ETF symbol")
    
    # Squeeze metrics
    bb_width: float = Field(description="Bollinger Bands width")
    bb_width_percentile: float = Field(
        description="BB width percentile vs historical"
    )
    is_squeeze: bool = Field(
        description="Whether squeeze condition is met"
    )
    
    # Bollinger Bands
    bb_upper: Optional[float] = Field(None, description="Bollinger Bands upper band")
    bb_middle: Optional[float] = Field(None, description="Bollinger Bands middle band")
    bb_lower: Optional[float] = Field(None, description="Bollinger Bands lower band")
    
    # Keltner Channels
    kc_upper: Optional[float] = Field(None, description="Keltner Channel upper band")
    kc_middle: Optional[float] = Field(None, description="Keltner Channel middle band")
    kc_lower: Optional[float] = Field(None, description="Keltner Channel lower band")
    
    # Expansion metrics
    bb_width_change: float = Field(
        description="Day-over-day BB width change (%)"
    )
    is_expansion: bool = Field(
        description="Whether expansion condition is met"
    )
    
    # Range and volatility
    true_range: float = Field(description="Current day's true range")
    atr_20: float = Field(description="20-day ATR")
    range_vs_atr: float = Field(
        description="True range vs ATR multiplier"
    )
    
    # Trend context
    trend_direction: TrendDirection = Field(
        description="Current trend direction"
    )
    ema_short: float = Field(description="Short EMA value")
    ema_long: float = Field(description="Long EMA value")
    
    # Volume context
    volume: int = Field(description="Current volume")
    volume_ratio: float = Field(
        description="Volume vs 20-day average"
    )
    avg_volume: Optional[float] = Field(
        None, description="20-day average volume"
    )
    
    # Price context (OHLC)
    open_price: float = Field(description="Opening price")
    high_price: float = Field(description="High price")
    low_price: float = Field(description="Low price")
    close_price: float = Field(description="Closing price")
    price_vs_20d_high: float = Field(
        description="Price vs 20-day high (%)"
    )
    price_vs_20d_low: float = Field(
        description="Price vs 20-day low (%)"
    )
    
    # Signal strength
    signal_strength: float = Field(
        ge=0.0,
        le=1.0,
        description="Signal strength score (0-1)"
    )
    
    # Technical indicators
    rsi: Optional[float] = Field(None, description="RSI (14-period)")
    macd: Optional[float] = Field(None, description="MACD line")
    macd_signal: Optional[float] = Field(None, description="MACD signal line")
    adx: Optional[float] = Field(None, description="ADX (trend strength)")
    di_plus: Optional[float] = Field(None, description="DI+ indicator")
    di_minus: Optional[float] = Field(None, description="DI- indicator")


class AIAnalysis(BaseModel):
    """AI-powered analysis of the squeeze signal."""
    
    signal_type: SignalType = Field(
        description="AI classification of signal type"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="AI confidence in classification (0-1)"
    )
    rationale: str = Field(
        max_length=500,
        description="2-sentence AI rationale for classification"
    )
    invalidation_level: Optional[float] = Field(
        None,
        description="Price level that would invalidate the signal"
    )
    target_level: Optional[float] = Field(
        None,
        description="Potential target price level"
    )
    risk_reward_ratio: Optional[float] = Field(
        None,
        description="Estimated risk/reward ratio"
    )
    
    # AI model metadata
    model_used: str = Field(description="AI model used for analysis")
    analysis_timestamp: datetime = Field(
        description="When AI analysis was performed"
    )
    prompt_version: str = Field(
        default="v1.0",
        description="Version of the prompt used"
    )


class AnalysisResult(BaseModel):
    """Complete analysis result combining technical and AI analysis."""
    
    # Core identification
    analysis_id: str = Field(description="Unique analysis identifier")
    symbol: str = Field(description="Stock/ETF symbol")
    timestamp: datetime = Field(description="Analysis timestamp")
    
    # Technical analysis
    squeeze_signal: SqueezeSignal = Field(
        description="Technical squeeze signal data"
    )
    
    # AI analysis
    ai_analysis: Optional[AIAnalysis] = Field(
        None,
        description="AI-powered analysis (if available)"
    )
    
    # Overall assessment
    overall_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Combined technical + AI score (0-1)"
    )
    recommendation: str = Field(
        description="Overall recommendation (BUY/SELL/HOLD/WAIT)"
    )
    
    # Risk management
    stop_loss_level: Optional[float] = Field(
        None,
        description="Suggested stop loss level"
    )
    position_size_pct: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Suggested position size as % of portfolio"
    )
    
    # Metadata
    analysis_duration_ms: int = Field(
        description="Time taken for analysis in milliseconds"
    )
    data_quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Quality score of underlying data (0-1)"
    )
    
    # Additional context
    market_conditions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional market context data"
    )
    
    def is_actionable(self) -> bool:
        """Check if the signal is actionable based on enhanced thresholds."""
        # More aggressive thresholds for better signal generation
        base_actionable = (
            self.overall_score >= 0.6 and  # Lowered from 0.7
            self.squeeze_signal.signal_strength >= 0.4  # Lowered from 0.6
        )
        
        # Additional quality filters
        if not base_actionable:
            return False
        
        # Strong signals are always actionable
        if self.overall_score >= 0.8:
            return True
        
        # Medium signals need additional confirmation
        if self.overall_score >= 0.65:
            # Require volume confirmation or tight squeeze
            return (
                self.squeeze_signal.volume_ratio >= 1.2 or
                self.squeeze_signal.bb_width_percentile <= 10 or
                (self.recommendation in ["BUY", "STRONG_BUY", "SELL"])
            )
        
        # Lower quality signals need strong confirmation
        return (
            self.squeeze_signal.volume_ratio >= 1.5 and
            self.squeeze_signal.bb_width_percentile <= 5 and
            self.recommendation in ["BUY", "STRONG_BUY"]
        )
    
    def get_risk_level(self) -> str:
        """Get risk level classification."""
        if self.overall_score >= 0.8:
            return "LOW"
        elif self.overall_score >= 0.6:
            return "MEDIUM"
        else:
            return "HIGH"
