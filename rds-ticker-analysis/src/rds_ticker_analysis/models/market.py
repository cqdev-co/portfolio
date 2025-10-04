"""Market data models."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator

from rds_ticker_analysis.models.base import BaseEntity, TimestampedModel


class MarketSector(str, Enum):
    """Market sectors."""
    TECHNOLOGY = "technology"
    HEALTHCARE = "healthcare"
    FINANCIALS = "financials"
    CONSUMER_DISCRETIONARY = "consumer_discretionary"
    CONSUMER_STAPLES = "consumer_staples"
    INDUSTRIALS = "industrials"
    ENERGY = "energy"
    UTILITIES = "utilities"
    MATERIALS = "materials"
    REAL_ESTATE = "real_estate"
    COMMUNICATION_SERVICES = "communication_services"


class Exchange(str, Enum):
    """Stock exchanges."""
    NYSE = "NYSE"
    NASDAQ = "NASDAQ"
    AMEX = "AMEX"
    OTC = "OTC"
    TSX = "TSX"
    LSE = "LSE"
    OTHER = "OTHER"


class SecurityType(str, Enum):
    """Security types."""
    STOCK = "stock"
    ETF = "etf"
    MUTUAL_FUND = "mutual_fund"
    CRYPTO = "crypto"
    FOREX = "forex"
    COMMODITY = "commodity"
    BOND = "bond"
    OPTION = "option"
    FUTURE = "future"


class TrendDirection(str, Enum):
    """Trend direction classifications."""
    STRONG_BULLISH = "strong_bullish"
    BULLISH = "bullish"
    SIDEWAYS = "sideways"
    BEARISH = "bearish"
    STRONG_BEARISH = "strong_bearish"


class TickerInfo(BaseEntity):
    """Comprehensive ticker information."""
    
    # Basic identification
    symbol: str = Field(description="Ticker symbol")
    name: str = Field(description="Company/security name")
    exchange: Exchange = Field(description="Primary exchange")
    currency: str = Field(default="USD", description="Trading currency")
    
    # Classification
    security_type: SecurityType = Field(description="Type of security")
    sector: Optional[MarketSector] = Field(None, description="Market sector")
    industry: Optional[str] = Field(None, description="Specific industry")
    
    # Market data
    market_cap: Optional[Decimal] = Field(None, description="Market capitalization")
    shares_outstanding: Optional[int] = Field(
        None,
        description="Shares outstanding"
    )
    float_shares: Optional[int] = Field(None, description="Floating shares")
    
    # Financial metrics
    pe_ratio: Optional[Decimal] = Field(None, description="Price-to-earnings ratio")
    pb_ratio: Optional[Decimal] = Field(None, description="Price-to-book ratio")
    dividend_yield: Optional[Decimal] = Field(
        None,
        description="Dividend yield percentage"
    )
    beta: Optional[Decimal] = Field(None, description="Beta coefficient")
    
    # Trading characteristics
    average_volume: Optional[int] = Field(
        None,
        description="Average daily volume"
    )
    average_dollar_volume: Optional[Decimal] = Field(
        None,
        description="Average daily dollar volume"
    )
    
    # Status flags
    is_active: bool = Field(default=True, description="Whether ticker is active")
    is_tradeable: bool = Field(default=True, description="Whether ticker is tradeable")
    
    # Metadata
    last_updated: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    data_source: str = Field(default="yfinance", description="Data source")


class OHLCV(BaseModel):
    """Open, High, Low, Close, Volume data point."""
    
    trading_date: date = Field(description="Trading date")
    open_price: Decimal = Field(gt=0, description="Opening price")
    high_price: Decimal = Field(gt=0, description="High price")
    low_price: Decimal = Field(gt=0, description="Low price")
    close_price: Decimal = Field(gt=0, description="Closing price")
    volume: int = Field(ge=0, description="Trading volume")
    
    # Derived metrics
    dollar_volume: Decimal = Field(description="Dollar volume (close * volume)")
    true_range: Decimal = Field(description="True range")
    price_change: Decimal = Field(description="Close - open")
    price_change_pct: Decimal = Field(description="Percentage change")
    
    @validator('high_price')
    def high_gte_low(cls, v: Decimal, values: Dict) -> Decimal:
        """Ensure high >= low."""
        if 'low_price' in values and v < values['low_price']:
            msg = "High price must be >= low price"
            raise ValueError(msg)
        return v
    
    @validator('close_price')
    def close_within_range(cls, v: Decimal, values: Dict) -> Decimal:
        """Ensure close is within high/low range."""
        if 'low_price' in values and 'high_price' in values:
            if v < values['low_price'] or v > values['high_price']:
                msg = "Close price must be within high/low range"
                raise ValueError(msg)
        return v


class TechnicalIndicators(BaseModel):
    """Technical analysis indicators."""
    
    # Moving averages
    sma_20: Optional[Decimal] = Field(None, description="20-day SMA")
    sma_50: Optional[Decimal] = Field(None, description="50-day SMA")
    sma_200: Optional[Decimal] = Field(None, description="200-day SMA")
    ema_12: Optional[Decimal] = Field(None, description="12-day EMA")
    ema_26: Optional[Decimal] = Field(None, description="26-day EMA")
    
    # Bollinger Bands
    bb_upper: Optional[Decimal] = Field(None, description="Bollinger upper band")
    bb_middle: Optional[Decimal] = Field(None, description="Bollinger middle band")
    bb_lower: Optional[Decimal] = Field(None, description="Bollinger lower band")
    bb_width: Optional[Decimal] = Field(None, description="Bollinger Band width")
    bb_percent: Optional[Decimal] = Field(
        None,
        description="Position within Bollinger Bands"
    )
    
    # Volatility
    atr_14: Optional[Decimal] = Field(None, description="14-day ATR")
    atr_20: Optional[Decimal] = Field(None, description="20-day ATR")
    volatility_20d: Optional[Decimal] = Field(
        None,
        description="20-day volatility"
    )
    
    # Momentum oscillators
    rsi_14: Optional[Decimal] = Field(None, description="14-day RSI")
    stoch_k: Optional[Decimal] = Field(None, description="Stochastic %K")
    stoch_d: Optional[Decimal] = Field(None, description="Stochastic %D")
    
    # MACD
    macd_line: Optional[Decimal] = Field(None, description="MACD line")
    macd_signal: Optional[Decimal] = Field(None, description="MACD signal line")
    macd_histogram: Optional[Decimal] = Field(None, description="MACD histogram")
    
    # Volume indicators
    volume_sma_20: Optional[int] = Field(None, description="20-day volume SMA")
    volume_ratio: Optional[Decimal] = Field(
        None,
        description="Current volume vs average"
    )
    
    # Trend indicators
    adx_14: Optional[Decimal] = Field(None, description="14-day ADX")
    di_plus: Optional[Decimal] = Field(None, description="Directional Indicator +")
    di_minus: Optional[Decimal] = Field(None, description="Directional Indicator -")
    
    # Support/Resistance
    support_level: Optional[Decimal] = Field(None, description="Key support level")
    resistance_level: Optional[Decimal] = Field(
        None,
        description="Key resistance level"
    )
    
    # Derived signals
    trend_direction: Optional[TrendDirection] = Field(
        None,
        description="Overall trend direction"
    )
    trend_strength: Optional[Decimal] = Field(
        None,
        description="Trend strength (0-1)"
    )


class PriceHistory(BaseEntity):
    """Historical price data for a ticker."""
    
    ticker_symbol: str = Field(description="Ticker symbol")
    timeframe: str = Field(description="Data timeframe (1d, 1h, etc.)")
    
    # OHLCV data
    ohlcv_data: List[OHLCV] = Field(description="OHLCV data points")
    
    # Period information
    start_date: date = Field(description="Start date of data")
    end_date: date = Field(description="End date of data")
    total_periods: int = Field(ge=0, description="Number of data points")
    
    # Data quality
    missing_periods: int = Field(ge=0, description="Number of missing periods")
    data_completeness: Decimal = Field(
        ge=0,
        le=1,
        description="Data completeness ratio"
    )
    
    # Summary statistics
    period_high: Decimal = Field(description="Highest price in period")
    period_low: Decimal = Field(description="Lowest price in period")
    period_volume_avg: int = Field(description="Average volume in period")
    period_volatility: Decimal = Field(description="Period volatility")
    
    @validator('ohlcv_data')
    def validate_chronological_order(cls, v: List[OHLCV]) -> List[OHLCV]:
        """Ensure OHLCV data is in chronological order."""
        if len(v) > 1:
            for i in range(1, len(v)):
                if v[i].trading_date <= v[i-1].trading_date:
                    msg = "OHLCV data must be in chronological order"
                    raise ValueError(msg)
        return v


class MarketData(BaseEntity):
    """Current market data for a ticker."""
    
    ticker_symbol: str = Field(description="Ticker symbol")
    
    # Current price data
    current_price: Decimal = Field(gt=0, description="Current/last price")
    previous_close: Decimal = Field(gt=0, description="Previous close price")
    open_price: Decimal = Field(gt=0, description="Today's open price")
    day_high: Decimal = Field(gt=0, description="Today's high")
    day_low: Decimal = Field(gt=0, description="Today's low")
    
    # Volume
    current_volume: int = Field(ge=0, description="Current day volume")
    average_volume: int = Field(ge=0, description="Average volume")
    
    # Changes
    price_change: Decimal = Field(description="Price change from previous close")
    price_change_pct: Decimal = Field(description="Percentage change")
    
    # Market metrics
    market_cap: Optional[Decimal] = Field(None, description="Current market cap")
    pe_ratio: Optional[Decimal] = Field(None, description="P/E ratio")
    
    # Technical indicators
    technical_indicators: Optional[TechnicalIndicators] = Field(
        None,
        description="Technical analysis indicators"
    )
    
    # Timestamps
    last_trade_time: datetime = Field(description="Last trade timestamp")
    market_hours: bool = Field(description="Whether market is open")
    
    # Data quality
    data_age_minutes: int = Field(ge=0, description="Age of data in minutes")
    is_real_time: bool = Field(description="Whether data is real-time")
    data_source: str = Field(default="yfinance", description="Data source")
    
    @validator('day_high')
    def high_gte_low_market_data(cls, v: Decimal, values: Dict) -> Decimal:
        """Ensure day high >= day low."""
        if 'day_low' in values and v < values['day_low']:
            msg = "Day high must be >= day low"
            raise ValueError(msg)
        return v
