"""Market data models and schemas."""

from datetime import datetime
from typing import List, Optional

import pandas as pd
from pydantic import BaseModel, Field, validator
from loguru import logger


class OHLCV(BaseModel):
    """Open, High, Low, Close, Volume data point."""
    
    timestamp: datetime = Field(description="Timestamp of the data point")
    open: float = Field(gt=0, description="Opening price")
    high: float = Field(gt=0, description="High price")
    low: float = Field(gt=0, description="Low price") 
    close: float = Field(gt=0, description="Closing price")
    volume: int = Field(ge=0, description="Trading volume")
    
    @validator("high")
    def validate_high(cls, v: float, values: dict) -> float:
        """Validate that high >= max(open, close, low)."""
        if "open" in values and "close" in values and "low" in values:
            min_high = max(values["open"], values["close"], values["low"])
            if v < min_high:
                # Auto-correct instead of raising error
                logger.warning(f"Auto-correcting High from {v} to {min_high}")
                return min_high
        return v
    
    @validator("low")
    def validate_low(cls, v: float, values: dict) -> float:
        """Validate that low <= min(open, close, high)."""
        if "open" in values and "close" in values and "high" in values:
            max_low = min(values["open"], values["close"], values["high"])
            if v > max_low:
                # Auto-correct instead of raising error
                logger.warning(f"Auto-correcting Low from {v} to {max_low}")
                return max_low
        return v


class TechnicalIndicators(BaseModel):
    """Technical indicators for a given timestamp."""
    
    timestamp: datetime = Field(description="Timestamp of the indicators")
    
    # Bollinger Bands
    bb_upper: Optional[float] = Field(
        None, 
        description="Bollinger Bands upper band"
    )
    bb_middle: Optional[float] = Field(
        None,
        description="Bollinger Bands middle band (SMA)"
    )
    bb_lower: Optional[float] = Field(
        None,
        description="Bollinger Bands lower band"
    )
    bb_width: Optional[float] = Field(
        None,
        description="Bollinger Bands width normalized by middle band"
    )
    
    # Keltner Channels
    kc_upper: Optional[float] = Field(
        None,
        description="Keltner Channel upper band"
    )
    kc_middle: Optional[float] = Field(
        None,
        description="Keltner Channel middle band (EMA)"
    )
    kc_lower: Optional[float] = Field(
        None,
        description="Keltner Channel lower band"
    )
    
    # ATR and EMAs
    atr: Optional[float] = Field(
        None,
        description="Average True Range"
    )
    ema_short: Optional[float] = Field(
        None,
        description="Short-period EMA (e.g., 20-day)"
    )
    ema_long: Optional[float] = Field(
        None,
        description="Long-period EMA (e.g., 50-day)"
    )
    
    # Volume indicators
    volume_sma: Optional[float] = Field(
        None,
        description="Volume simple moving average"
    )
    volume_ratio: Optional[float] = Field(
        None,
        description="Current volume / average volume"
    )
    
    # Momentum indicators
    rsi: Optional[float] = Field(
        None,
        description="Relative Strength Index (14-period)"
    )
    macd: Optional[float] = Field(
        None,
        description="MACD line (12-period EMA - 26-period EMA)"
    )
    macd_signal: Optional[float] = Field(
        None,
        description="MACD signal line (9-period EMA of MACD)"
    )
    
    # Trend indicators
    adx: Optional[float] = Field(
        None,
        description="Average Directional Index (trend strength)"
    )
    di_plus: Optional[float] = Field(
        None,
        description="Positive Directional Indicator"
    )
    di_minus: Optional[float] = Field(
        None,
        description="Negative Directional Indicator"
    )


class MarketData(BaseModel):
    """Complete market data for a symbol."""
    
    symbol: str = Field(description="Stock/ETF symbol")
    name: Optional[str] = Field(None, description="Company/ETF name")
    sector: Optional[str] = Field(None, description="Sector classification")
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    
    # Price data
    ohlcv_data: List[OHLCV] = Field(
        description="Historical OHLCV data"
    )
    
    # Technical indicators
    indicators: List[TechnicalIndicators] = Field(
        description="Technical indicators data"
    )
    
    # Metadata
    data_start: datetime = Field(description="Start date of data")
    data_end: datetime = Field(description="End date of data")
    last_updated: datetime = Field(description="Last update timestamp")
    
    @validator("symbol")
    def validate_symbol(cls, v: str) -> str:
        """Validate and normalize symbol."""
        return v.upper().strip()
    
    @validator("ohlcv_data")
    def validate_ohlcv_data(cls, v: List[OHLCV]) -> List[OHLCV]:
        """Validate OHLCV data is not empty and sorted."""
        if not v:
            raise ValueError("OHLCV data cannot be empty")
        
        # Check if data is sorted by timestamp
        timestamps = [item.timestamp for item in v]
        if timestamps != sorted(timestamps):
            raise ValueError("OHLCV data must be sorted by timestamp")
        
        return v
    
    def to_dataframe(self) -> pd.DataFrame:
        """Convert OHLCV data to pandas DataFrame."""
        data = []
        for ohlcv in self.ohlcv_data:
            data.append({
                "timestamp": ohlcv.timestamp,
                "open": ohlcv.open,
                "high": ohlcv.high,
                "low": ohlcv.low,
                "close": ohlcv.close,
                "volume": ohlcv.volume,
            })
        
        df = pd.DataFrame(data)
        df.set_index("timestamp", inplace=True)
        return df
    
    def get_latest_price(self) -> float:
        """Get the most recent closing price."""
        if not self.ohlcv_data:
            raise ValueError("No OHLCV data available")
        return self.ohlcv_data[-1].close
    
    def get_price_range(self, days: int = 20) -> tuple[float, float]:
        """Get price range (min, max) for the last N days."""
        if len(self.ohlcv_data) < days:
            recent_data = self.ohlcv_data
        else:
            recent_data = self.ohlcv_data[-days:]
        
        highs = [item.high for item in recent_data]
        lows = [item.low for item in recent_data]
        
        return min(lows), max(highs)
