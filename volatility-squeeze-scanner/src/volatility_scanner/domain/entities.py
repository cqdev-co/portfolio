"""
Domain entities representing core business objects.
These are rich domain models with behavior, not just data containers.
"""

from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator


class TrendDirection(str, Enum):
    """Enumeration for trend directions."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class SignalStrength(str, Enum):
    """Enumeration for signal strength levels."""
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


class MarketRegime(str, Enum):
    """Enumeration for market regime types."""
    LOW_VOLATILITY = "low_volatility"
    HIGH_VOLATILITY = "high_volatility"
    TRENDING = "trending"
    RANGING = "ranging"


@dataclass(frozen=True)
class Symbol:
    """Value object representing a trading symbol."""
    ticker: str
    exchange: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[str] = None
    
    def __post_init__(self):
        if not self.ticker or not self.ticker.strip():
            raise ValueError("Symbol ticker cannot be empty")
        
        # Normalize ticker to uppercase
        object.__setattr__(self, 'ticker', self.ticker.upper().strip())
    
    def __str__(self) -> str:
        return self.ticker


@dataclass(frozen=True)
class Price:
    """Value object representing a price with validation."""
    value: Decimal
    currency: str = "USD"
    
    def __post_init__(self):
        if self.value <= 0:
            raise ValueError("Price must be positive")
        if not self.currency:
            raise ValueError("Currency cannot be empty")
    
    def __str__(self) -> str:
        return f"{self.value:.2f} {self.currency}"
    
    def __float__(self) -> float:
        return float(self.value)


@dataclass(frozen=True)
class Volume:
    """Value object representing trading volume."""
    value: int
    
    def __post_init__(self):
        if self.value < 0:
            raise ValueError("Volume cannot be negative")
    
    def __str__(self) -> str:
        return f"{self.value:,}"
    
    def __int__(self) -> int:
        return self.value


class OHLCV:
    """
    Entity representing a single OHLCV (Open, High, Low, Close, Volume) data point.
    Contains business logic for price validation and calculations.
    """
    
    def __init__(
        self,
        timestamp: datetime,
        open_price: Price,
        high_price: Price,
        low_price: Price,
        close_price: Price,
        volume: Volume,
        symbol: Symbol
    ):
        self.timestamp = timestamp
        self.open_price = open_price
        self.high_price = high_price
        self.low_price = low_price
        self.close_price = close_price
        self.volume = volume
        self.symbol = symbol
        
        # Validate OHLC relationships
        self._validate_ohlc_relationships()
    
    def _validate_ohlc_relationships(self) -> None:
        """Validate that OHLC prices follow logical relationships."""
        if self.high_price.value < max(
            self.open_price.value, 
            self.close_price.value, 
            self.low_price.value
        ):
            raise ValueError("High price must be >= open, close, and low prices")
        
        if self.low_price.value > min(
            self.open_price.value, 
            self.close_price.value, 
            self.high_price.value
        ):
            raise ValueError("Low price must be <= open, close, and high prices")
    
    @property
    def true_range(self) -> Decimal:
        """Calculate True Range for this period."""
        # For first period, use high - low
        return self.high_price.value - self.low_price.value
    
    @property
    def typical_price(self) -> Price:
        """Calculate typical price (HLC/3)."""
        value = (
            self.high_price.value + 
            self.low_price.value + 
            self.close_price.value
        ) / 3
        return Price(value, self.close_price.currency)
    
    @property
    def price_change(self) -> Decimal:
        """Calculate price change (close - open)."""
        return self.close_price.value - self.open_price.value
    
    @property
    def price_change_percent(self) -> Decimal:
        """Calculate percentage price change."""
        if self.open_price.value == 0:
            return Decimal('0')
        return (self.price_change / self.open_price.value) * 100
    
    def is_bullish_candle(self) -> bool:
        """Check if this is a bullish candle (close > open)."""
        return self.close_price.value > self.open_price.value
    
    def is_bearish_candle(self) -> bool:
        """Check if this is a bearish candle (close < open)."""
        return self.close_price.value < self.open_price.value
    
    def is_doji(self, threshold_percent: Decimal = Decimal('0.1')) -> bool:
        """Check if this is a doji candle (open ≈ close)."""
        if self.open_price.value == 0:
            return False
        
        change_percent = abs(self.price_change_percent)
        return change_percent <= threshold_percent


class TechnicalIndicators:
    """
    Entity containing technical indicator values with business logic.
    Encapsulates indicator calculations and interpretations.
    """
    
    def __init__(
        self,
        timestamp: datetime,
        symbol: Symbol,
        atr: Decimal,
        ema_short: Decimal,
        ema_long: Decimal,
        bb_upper: Decimal,
        bb_middle: Decimal,
        bb_lower: Decimal,
        bb_width: Decimal,
        kc_upper: Decimal,
        kc_middle: Decimal,
        kc_lower: Decimal,
        volume_sma: Decimal
    ):
        self.timestamp = timestamp
        self.symbol = symbol
        self.atr = atr
        self.ema_short = ema_short
        self.ema_long = ema_long
        self.bb_upper = bb_upper
        self.bb_middle = bb_middle
        self.bb_lower = bb_lower
        self.bb_width = bb_width
        self.kc_upper = kc_upper
        self.kc_middle = kc_middle
        self.kc_lower = kc_lower
        self.volume_sma = volume_sma
    
    @property
    def trend_direction(self) -> TrendDirection:
        """Determine trend direction based on EMA relationship."""
        if self.ema_short > self.ema_long:
            return TrendDirection.BULLISH
        elif self.ema_short < self.ema_long:
            return TrendDirection.BEARISH
        else:
            return TrendDirection.NEUTRAL
    
    @property
    def bb_squeeze_intensity(self) -> Decimal:
        """Calculate Bollinger Band squeeze intensity (0-1 scale)."""
        if self.bb_middle == 0:
            return Decimal('0')
        return self.bb_width / self.bb_middle
    
    def is_bollinger_squeeze(self, percentile_threshold: Decimal) -> bool:
        """Check if current BB width indicates a squeeze."""
        # This would typically compare against historical percentiles
        # For now, using a simple threshold
        return self.bb_squeeze_intensity < (percentile_threshold / 100)
    
    def is_keltner_squeeze(self) -> bool:
        """Check if Bollinger Bands are inside Keltner Channels."""
        return (
            self.bb_upper <= self.kc_upper and 
            self.bb_lower >= self.kc_lower
        )


class VolatilitySqueezeSignal:
    """
    Entity representing a volatility squeeze signal with business logic.
    Contains the core domain logic for squeeze detection and validation.
    """
    
    def __init__(
        self,
        symbol: Symbol,
        timestamp: datetime,
        indicators: TechnicalIndicators,
        squeeze_percentile: Decimal,
        volume_ratio: Decimal,
        is_expansion: bool = False,
        expansion_magnitude: Optional[Decimal] = None
    ):
        self.id = uuid4()
        self.symbol = symbol
        self.timestamp = timestamp
        self.indicators = indicators
        self.squeeze_percentile = squeeze_percentile
        self.volume_ratio = volume_ratio
        self.is_expansion = is_expansion
        self.expansion_magnitude = expansion_magnitude or Decimal('0')
        
        # Calculate derived properties
        self._calculate_signal_strength()
    
    def _calculate_signal_strength(self) -> None:
        """Calculate signal strength based on multiple factors."""
        strength_score = Decimal('0')
        
        # Squeeze tightness (lower percentile = stronger)
        if self.squeeze_percentile <= 5:
            strength_score += Decimal('0.4')
        elif self.squeeze_percentile <= 10:
            strength_score += Decimal('0.3')
        elif self.squeeze_percentile <= 15:
            strength_score += Decimal('0.2')
        else:
            strength_score += Decimal('0.1')
        
        # Volume confirmation
        if self.volume_ratio >= 2.0:
            strength_score += Decimal('0.3')
        elif self.volume_ratio >= 1.5:
            strength_score += Decimal('0.2')
        elif self.volume_ratio >= 1.2:
            strength_score += Decimal('0.1')
        
        # Expansion magnitude
        if self.is_expansion and self.expansion_magnitude >= Decimal('0.25'):
            strength_score += Decimal('0.3')
        elif self.is_expansion and self.expansion_magnitude >= Decimal('0.15'):
            strength_score += Decimal('0.2')
        
        # Determine strength category
        if strength_score >= Decimal('0.8'):
            self.strength = SignalStrength.VERY_STRONG
        elif strength_score >= Decimal('0.6'):
            self.strength = SignalStrength.STRONG
        elif strength_score >= Decimal('0.4'):
            self.strength = SignalStrength.MODERATE
        else:
            self.strength = SignalStrength.WEAK
        
        self.strength_score = strength_score
    
    @property
    def trend_direction(self) -> TrendDirection:
        """Get trend direction from indicators."""
        return self.indicators.trend_direction
    
    def is_valid_signal(self) -> bool:
        """Validate if this is a legitimate squeeze signal."""
        return (
            self.squeeze_percentile <= 20 and  # Must be in lower 20th percentile
            self.volume_ratio >= 1.0 and      # Must have normal or above volume
            self.strength_score >= Decimal('0.3')  # Minimum strength threshold
        )
    
    def calculate_stop_loss_level(
        self, 
        current_price: Price, 
        atr_multiplier: Decimal = Decimal('1.5')
    ) -> Price:
        """Calculate appropriate stop loss level based on ATR and trend."""
        stop_distance = self.indicators.atr * atr_multiplier
        
        if self.trend_direction == TrendDirection.BULLISH:
            # For bullish signals, stop below current price
            stop_level = current_price.value - stop_distance
        else:
            # For bearish signals, stop above current price
            stop_level = current_price.value + stop_distance
        
        return Price(max(stop_level, Decimal('0.01')), current_price.currency)
    
    def calculate_profit_target(
        self, 
        current_price: Price, 
        risk_reward_ratio: Decimal = Decimal('2.0')
    ) -> Price:
        """Calculate profit target based on risk-reward ratio."""
        stop_loss = self.calculate_stop_loss_level(current_price)
        risk_amount = abs(current_price.value - stop_loss.value)
        
        if self.trend_direction == TrendDirection.BULLISH:
            target_level = current_price.value + (risk_amount * risk_reward_ratio)
        else:
            target_level = current_price.value - (risk_amount * risk_reward_ratio)
        
        return Price(max(target_level, Decimal('0.01')), current_price.currency)


class MarketData:
    """
    Aggregate root for market data containing OHLCV data and indicators.
    Manages the lifecycle and consistency of market data.
    """
    
    def __init__(self, symbol: Symbol):
        self.symbol = symbol
        self.ohlcv_data: List[OHLCV] = []
        self.indicators: List[TechnicalIndicators] = []
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def add_ohlcv(self, ohlcv: OHLCV) -> None:
        """Add OHLCV data point with validation."""
        if ohlcv.symbol != self.symbol:
            raise ValueError(f"OHLCV symbol {ohlcv.symbol} doesn't match {self.symbol}")
        
        # Ensure chronological order
        if self.ohlcv_data and ohlcv.timestamp <= self.ohlcv_data[-1].timestamp:
            raise ValueError("OHLCV data must be added in chronological order")
        
        self.ohlcv_data.append(ohlcv)
        self.updated_at = datetime.utcnow()
    
    def add_indicators(self, indicators: TechnicalIndicators) -> None:
        """Add technical indicators with validation."""
        if indicators.symbol != self.symbol:
            raise ValueError(f"Indicators symbol {indicators.symbol} doesn't match {self.symbol}")
        
        self.indicators.append(indicators)
        self.updated_at = datetime.utcnow()
    
    def get_latest_price(self) -> Optional[Price]:
        """Get the most recent closing price."""
        if not self.ohlcv_data:
            return None
        return self.ohlcv_data[-1].close_price
    
    def get_latest_indicators(self) -> Optional[TechnicalIndicators]:
        """Get the most recent technical indicators."""
        if not self.indicators:
            return None
        return self.indicators[-1]
    
    def get_price_history(self, periods: int) -> List[OHLCV]:
        """Get the last N periods of OHLCV data."""
        if periods <= 0:
            return []
        return self.ohlcv_data[-periods:]
    
    def calculate_returns(self, periods: int = 1) -> Optional[Decimal]:
        """Calculate returns over specified periods."""
        if len(self.ohlcv_data) < periods + 1:
            return None
        
        start_price = self.ohlcv_data[-(periods + 1)].close_price.value
        end_price = self.ohlcv_data[-1].close_price.value
        
        if start_price == 0:
            return None
        
        return ((end_price - start_price) / start_price) * 100
    
    @property
    def data_quality_score(self) -> Decimal:
        """Calculate data quality score based on completeness and consistency."""
        if not self.ohlcv_data:
            return Decimal('0')
        
        score = Decimal('1.0')
        
        # Check for gaps in data
        if len(self.ohlcv_data) > 1:
            expected_periods = (
                self.ohlcv_data[-1].timestamp - self.ohlcv_data[0].timestamp
            ).days
            actual_periods = len(self.ohlcv_data)
            
            if expected_periods > 0:
                completeness = min(Decimal(str(actual_periods / expected_periods)), Decimal('1.0'))
                score *= completeness
        
        # Check for zero volume periods (data quality issue)
        zero_volume_count = sum(1 for ohlcv in self.ohlcv_data if ohlcv.volume.value == 0)
        if self.ohlcv_data:
            volume_quality = Decimal('1.0') - (Decimal(str(zero_volume_count)) / len(self.ohlcv_data))
            score *= volume_quality
        
        return score
    
    def is_data_sufficient_for_analysis(self, min_periods: int = 50) -> bool:
        """Check if there's sufficient data for technical analysis."""
        return (
            len(self.ohlcv_data) >= min_periods and
            len(self.indicators) >= min_periods and
            self.data_quality_score >= Decimal('0.8')
        )
