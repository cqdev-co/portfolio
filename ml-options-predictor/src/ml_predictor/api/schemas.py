"""API request and response schemas."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class SignalPredictionRequest(BaseModel):
    """Request schema for signal prediction."""

    # Core signal info
    ticker: str = Field(..., description="Stock ticker symbol")
    strike: float = Field(..., description="Strike price")
    expiry: date = Field(..., description="Expiry date")
    option_type: str = Field(..., description="Option type: call or put")
    days_to_expiry: int = Field(..., description="Days until expiry")

    # Signal quality
    grade: str = Field(..., description="Signal grade: S, A, B, C, D, F")
    overall_score: float = Field(..., description="Overall signal score (0-1)")
    confidence: float = Field(default=0.0, description="Confidence score (0-1)")

    # Volume metrics
    volume_ratio: Optional[float] = Field(
        default=None, description="Volume ratio vs average"
    )
    current_volume: Optional[int] = Field(
        default=None, description="Current volume"
    )
    average_volume: Optional[float] = Field(
        default=None, description="Average volume"
    )

    # Premium metrics
    premium_flow: float = Field(..., description="Premium flow in dollars")
    aggressive_order_pct: Optional[float] = Field(
        default=None, description="% of aggressive orders"
    )

    # Detection flags
    has_volume_anomaly: bool = Field(default=False)
    has_oi_spike: bool = Field(default=False)
    has_premium_flow: bool = Field(default=False)
    has_sweep: bool = Field(default=False)
    has_block_trade: bool = Field(default=False)

    # Greeks/Volatility
    implied_volatility: Optional[float] = Field(default=None, description="IV")
    iv_rank: Optional[float] = Field(default=None, description="IV rank")

    # Moneyness
    moneyness: Optional[str] = Field(
        default=None, description="ITM, ATM, or OTM"
    )
    underlying_price: float = Field(..., description="Current stock price")

    # Time factors
    days_to_earnings: Optional[int] = Field(
        default=None, description="Days until earnings"
    )

    # Market context
    sentiment: Optional[str] = Field(
        default=None, description="BULLISH, NEUTRAL, or BEARISH"
    )
    put_call_ratio: Optional[float] = Field(default=None)
    market_cap: Optional[int] = Field(default=None)

    # OI metrics
    current_oi: Optional[int] = Field(default=None, description="Current OI")
    oi_change_pct: Optional[float] = Field(default=None, description="OI change %")


class PredictionResponse(BaseModel):
    """Response schema for predictions."""

    win_probability: float = Field(
        ..., description="Probability of profit (0-1)"
    )
    expected_return_pct: float = Field(
        ..., description="Expected return percentage"
    )
    expected_value: float = Field(
        ..., description="Expected value (prob * return)"
    )
    confidence: str = Field(
        ..., description="Confidence level: low, medium, high"
    )


class SignalPrediction(BaseModel):
    """Full signal prediction with recommendation."""

    signal_id: Optional[str] = Field(default=None, description="Signal ID if available")
    ticker: str
    predictions: PredictionResponse
    recommendation: str = Field(
        ..., description="TRADE or SKIP"
    )
    model_version: str = Field(..., description="Model version used")
    reasoning: List[str] = Field(
        default_factory=list, description="Reasoning for recommendation"
    )


class BatchPredictionRequest(BaseModel):
    """Request schema for batch predictions."""

    signals: List[SignalPredictionRequest]


class BatchPredictionResponse(BaseModel):
    """Response schema for batch predictions."""

    predictions: List[SignalPrediction]
    total_signals: int
    trade_signals: int
    skip_signals: int


class ModelInfo(BaseModel):
    """Model information response."""

    version: str
    classification_auc: Optional[float] = None
    regression_r2: Optional[float] = None
    training_samples: Optional[int] = None
    features: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="ok or error")
    model_loaded: bool = Field(..., description="Whether model is loaded")
    model_version: Optional[str] = None

