"""Market data models for penny stock scanner."""

from datetime import datetime

from pydantic import BaseModel, Field


class OHLCVData(BaseModel):
    """OHLCV (Open, High, Low, Close, Volume) data point."""

    timestamp: datetime = Field(description="Data point timestamp")
    open: float = Field(description="Opening price")
    high: float = Field(description="High price")
    low: float = Field(description="Low price")
    close: float = Field(description="Closing price")
    volume: int = Field(description="Trading volume")

    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2024-01-01T09:30:00Z",
                "open": 1.25,
                "high": 1.35,
                "low": 1.20,
                "close": 1.30,
                "volume": 500000,
            }
        }


class TechnicalIndicators(BaseModel):
    """Technical indicators for a given data point."""

    timestamp: datetime = Field(description="Indicator timestamp")

    # Moving averages
    ema_20: float | None = Field(None, description="20-period EMA")
    ema_50: float | None = Field(None, description="50-period EMA")
    sma_20: float | None = Field(None, description="20-period SMA")

    # Volume metrics
    volume_sma_20: float | None = Field(None, description="20-day average volume")
    volume_ratio: float | None = Field(
        None, description="Current volume vs 20-day average"
    )
    dollar_volume: float | None = Field(
        None, description="Dollar volume (price * volume)"
    )

    # Volatility
    atr_20: float | None = Field(None, description="20-period ATR")
    true_range: float | None = Field(None, description="True range")

    # Momentum indicators (lighter weight for pennies)
    rsi_14: float | None = Field(None, description="14-period RSI")
    macd: float | None = Field(None, description="MACD line")
    macd_signal: float | None = Field(None, description="MACD signal line")
    macd_histogram: float | None = Field(None, description="MACD histogram")

    # Price metrics
    distance_from_52w_high: float | None = Field(
        None, description="% distance from 52-week high"
    )
    distance_from_52w_low: float | None = Field(
        None, description="% distance from 52-week low"
    )


class MarketData(BaseModel):
    """Complete market data for a symbol."""

    symbol: str = Field(description="Stock symbol")
    timeframe: str = Field(default="1d", description="Data timeframe (1d, 1h, etc.)")
    ohlcv_data: list[OHLCVData] = Field(description="OHLCV data points")
    indicators: list[TechnicalIndicators] = Field(
        default_factory=list, description="Technical indicators"
    )

    # Additional metadata
    sector: str | None = Field(None, description="Stock sector")
    industry: str | None = Field(None, description="Stock industry")
    market_cap: int | None = Field(None, description="Market capitalization")
    float_shares: int | None = Field(None, description="Float shares")

    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "AEMD",
                "timeframe": "1d",
                "ohlcv_data": [],
                "indicators": [],
                "sector": "Healthcare",
                "industry": "Biotechnology",
            }
        }

    def get_latest_price(self) -> float | None:
        """Get the most recent closing price."""
        if self.ohlcv_data:
            return self.ohlcv_data[-1].close
        return None

    def get_latest_volume(self) -> int | None:
        """Get the most recent volume."""
        if self.ohlcv_data:
            return self.ohlcv_data[-1].volume
        return None
