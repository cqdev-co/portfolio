"""
Domain services containing business logic that doesn't naturally fit in entities.
These services coordinate between entities and implement complex business rules.
"""

from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal
import statistics
from dataclasses import dataclass

from .entities import (
    Symbol, MarketData, VolatilitySqueezeSignal, TechnicalIndicators, 
    OHLCV, Price, TrendDirection, SignalStrength, MarketRegime
)
from .repositories import IMarketDataRepository, IIndicatorRepository


@dataclass
class SqueezeDetectionConfig:
    """Configuration for squeeze detection parameters."""
    lookback_periods: int = 180
    percentile_threshold: Decimal = Decimal('10.0')
    expansion_threshold: Decimal = Decimal('0.20')
    volume_threshold: Decimal = Decimal('1.2')
    min_data_quality: Decimal = Decimal('0.8')


@dataclass
class RiskManagementConfig:
    """Configuration for risk management parameters."""
    atr_multiplier: Decimal = Decimal('1.5')
    max_position_size: Decimal = Decimal('0.10')  # 10%
    risk_reward_ratio: Decimal = Decimal('2.0')
    max_correlation: Decimal = Decimal('0.7')


class IVolatilitySqueezeDetector(ABC):
    """Interface for volatility squeeze detection algorithms."""
    
    @abstractmethod
    async def detect_squeeze(
        self, 
        market_data: MarketData, 
        config: SqueezeDetectionConfig
    ) -> Optional[VolatilitySqueezeSignal]:
        """Detect volatility squeeze in market data."""
        pass
    
    @abstractmethod
    async def calculate_squeeze_percentile(
        self, 
        current_bb_width: Decimal, 
        historical_bb_widths: List[Decimal]
    ) -> Decimal:
        """Calculate percentile ranking of current BB width."""
        pass


class ITechnicalAnalysisService(ABC):
    """Interface for technical analysis calculations."""
    
    @abstractmethod
    async def calculate_indicators(
        self, 
        ohlcv_data: List[OHLCV]
    ) -> List[TechnicalIndicators]:
        """Calculate all technical indicators for OHLCV data."""
        pass
    
    @abstractmethod
    async def calculate_bollinger_bands(
        self, 
        prices: List[Price], 
        period: int = 20, 
        std_dev: Decimal = Decimal('2.0')
    ) -> Tuple[List[Decimal], List[Decimal], List[Decimal]]:
        """Calculate Bollinger Bands (upper, middle, lower)."""
        pass
    
    @abstractmethod
    async def calculate_keltner_channels(
        self, 
        ohlcv_data: List[OHLCV], 
        period: int = 20, 
        atr_multiplier: Decimal = Decimal('2.0')
    ) -> Tuple[List[Decimal], List[Decimal], List[Decimal]]:
        """Calculate Keltner Channels (upper, middle, lower)."""
        pass


class IMarketRegimeDetector(ABC):
    """Interface for market regime detection."""
    
    @abstractmethod
    async def detect_regime(self, market_data: MarketData) -> MarketRegime:
        """Detect current market regime."""
        pass
    
    @abstractmethod
    async def get_volatility_level(self, market_data: MarketData) -> Decimal:
        """Calculate current volatility level."""
        pass


class VolatilitySqueezeDetectorService(IVolatilitySqueezeDetector):
    """
    Domain service for detecting volatility squeezes.
    Implements the core business logic for squeeze identification.
    """
    
    def __init__(
        self, 
        indicator_repository: IIndicatorRepository,
        technical_analysis_service: ITechnicalAnalysisService
    ):
        self.indicator_repository = indicator_repository
        self.technical_analysis_service = technical_analysis_service
    
    async def detect_squeeze(
        self, 
        market_data: MarketData, 
        config: SqueezeDetectionConfig
    ) -> Optional[VolatilitySqueezeSignal]:
        """
        Detect volatility squeeze using Bollinger Band Width percentile method.
        """
        # Validate data quality
        if not market_data.is_data_sufficient_for_analysis(config.lookback_periods):
            return None
        
        if market_data.data_quality_score < config.min_data_quality:
            return None
        
        # Get latest indicators
        latest_indicators = market_data.get_latest_indicators()
        if not latest_indicators:
            return None
        
        # Calculate historical BB width percentiles
        historical_indicators = await self.indicator_repository.get_indicators_history(
            market_data.symbol, 
            config.lookback_periods
        )
        
        if len(historical_indicators) < config.lookback_periods:
            return None
        
        # Calculate squeeze percentile
        historical_bb_widths = [ind.bb_width for ind in historical_indicators]
        squeeze_percentile = await self.calculate_squeeze_percentile(
            latest_indicators.bb_width, 
            historical_bb_widths
        )
        
        # Check if squeeze conditions are met
        if squeeze_percentile > config.percentile_threshold:
            return None
        
        # Calculate volume ratio
        latest_ohlcv = market_data.get_latest_price()
        if not latest_ohlcv:
            return None
        
        volume_ratio = self._calculate_volume_ratio(market_data, periods=20)
        
        # Check for expansion
        is_expansion, expansion_magnitude = await self._detect_expansion(
            historical_indicators, 
            config.expansion_threshold
        )
        
        # Create squeeze signal
        signal = VolatilitySqueezeSignal(
            symbol=market_data.symbol,
            timestamp=latest_indicators.timestamp,
            indicators=latest_indicators,
            squeeze_percentile=squeeze_percentile,
            volume_ratio=volume_ratio,
            is_expansion=is_expansion,
            expansion_magnitude=expansion_magnitude
        )
        
        # Validate signal quality
        if not signal.is_valid_signal():
            return None
        
        return signal
    
    async def calculate_squeeze_percentile(
        self, 
        current_bb_width: Decimal, 
        historical_bb_widths: List[Decimal]
    ) -> Decimal:
        """Calculate percentile ranking of current BB width."""
        if not historical_bb_widths:
            return Decimal('50.0')  # Default to median
        
        # Count values less than or equal to current
        count_below = sum(1 for width in historical_bb_widths if width <= current_bb_width)
        
        # Calculate percentile
        percentile = (count_below / len(historical_bb_widths)) * 100
        return Decimal(str(percentile))
    
    def _calculate_volume_ratio(self, market_data: MarketData, periods: int = 20) -> Decimal:
        """Calculate current volume vs average volume ratio."""
        recent_data = market_data.get_price_history(periods + 1)
        if len(recent_data) < periods + 1:
            return Decimal('1.0')
        
        current_volume = recent_data[-1].volume.value
        historical_volumes = [ohlcv.volume.value for ohlcv in recent_data[:-1]]
        
        if not historical_volumes:
            return Decimal('1.0')
        
        avg_volume = statistics.mean(historical_volumes)
        if avg_volume == 0:
            return Decimal('1.0')
        
        return Decimal(str(current_volume / avg_volume))
    
    async def _detect_expansion(
        self, 
        historical_indicators: List[TechnicalIndicators], 
        threshold: Decimal
    ) -> Tuple[bool, Decimal]:
        """Detect if BB width is expanding."""
        if len(historical_indicators) < 2:
            return False, Decimal('0')
        
        current_width = historical_indicators[-1].bb_width
        previous_width = historical_indicators[-2].bb_width
        
        if previous_width == 0:
            return False, Decimal('0')
        
        expansion_rate = (current_width - previous_width) / previous_width
        is_expansion = expansion_rate >= threshold
        
        return is_expansion, expansion_rate


class RiskManagementService:
    """
    Domain service for risk management calculations and validations.
    Ensures trades comply with risk management rules.
    """
    
    def __init__(self, config: RiskManagementConfig):
        self.config = config
    
    def calculate_position_size(
        self, 
        account_balance: Decimal, 
        entry_price: Price, 
        stop_loss_price: Price,
        risk_per_trade: Decimal = Decimal('0.02')  # 2% risk per trade
    ) -> int:
        """
        Calculate appropriate position size based on risk management rules.
        """
        # Calculate risk per share
        risk_per_share = abs(entry_price.value - stop_loss_price.value)
        
        if risk_per_share == 0:
            return 0
        
        # Calculate maximum risk amount
        max_risk_amount = account_balance * risk_per_trade
        
        # Calculate position size
        position_size = max_risk_amount / risk_per_share
        
        # Apply maximum position size limit
        max_position_value = account_balance * self.config.max_position_size
        max_shares_by_position_limit = max_position_value / entry_price.value
        
        # Return the smaller of the two limits
        return int(min(position_size, max_shares_by_position_limit))
    
    def validate_signal_risk(
        self, 
        signal: VolatilitySqueezeSignal, 
        current_price: Price,
        existing_positions: List[Dict[str, Any]]
    ) -> Tuple[bool, List[str]]:
        """
        Validate if a signal meets risk management criteria.
        Returns (is_valid, list_of_violations).
        """
        violations = []
        
        # Check signal strength
        if signal.strength_score < Decimal('0.4'):
            violations.append("Signal strength below minimum threshold")
        
        # Check stop loss distance
        stop_loss = signal.calculate_stop_loss_level(current_price, self.config.atr_multiplier)
        risk_percent = abs(current_price.value - stop_loss.value) / current_price.value
        
        if risk_percent > Decimal('0.10'):  # 10% max risk per trade
            violations.append(f"Stop loss too far: {risk_percent:.1%} risk")
        
        # Check correlation with existing positions
        correlation_violation = self._check_correlation_limits(
            signal.symbol, 
            existing_positions
        )
        if correlation_violation:
            violations.append(correlation_violation)
        
        # Check market regime suitability
        if not self._is_suitable_market_regime(signal):
            violations.append("Unfavorable market regime for squeeze strategy")
        
        return len(violations) == 0, violations
    
    def _check_correlation_limits(
        self, 
        symbol: Symbol, 
        existing_positions: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Check if adding this position would violate correlation limits."""
        # This would typically involve correlation calculations
        # For now, implement basic sector/symbol checks
        
        same_sector_count = sum(
            1 for pos in existing_positions 
            if pos.get('sector') == symbol.sector
        )
        
        if same_sector_count >= 3:  # Max 3 positions per sector
            return f"Too many positions in {symbol.sector} sector"
        
        # Check for duplicate symbol
        if any(pos.get('symbol') == symbol.ticker for pos in existing_positions):
            return f"Already have position in {symbol.ticker}"
        
        return None
    
    def _is_suitable_market_regime(self, signal: VolatilitySqueezeSignal) -> bool:
        """Check if current market regime is suitable for squeeze trading."""
        # Squeeze strategies work best in transitional periods
        # This would typically check VIX levels, market volatility, etc.
        
        # For now, implement basic checks
        if signal.volume_ratio < Decimal('0.5'):  # Very low volume
            return False
        
        if signal.strength_score < Decimal('0.3'):  # Very weak signal
            return False
        
        return True


class MarketRegimeDetectorService(IMarketRegimeDetector):
    """
    Domain service for detecting market regimes.
    Helps determine optimal strategy parameters based on market conditions.
    """
    
    async def detect_regime(self, market_data: MarketData) -> MarketRegime:
        """Detect current market regime based on volatility and trend."""
        volatility = await self.get_volatility_level(market_data)
        
        # Simple regime classification based on volatility
        if volatility < Decimal('15'):
            return MarketRegime.LOW_VOLATILITY
        elif volatility > Decimal('25'):
            return MarketRegime.HIGH_VOLATILITY
        else:
            # Check if trending or ranging
            trend_strength = self._calculate_trend_strength(market_data)
            if trend_strength > Decimal('0.6'):
                return MarketRegime.TRENDING
            else:
                return MarketRegime.RANGING
    
    async def get_volatility_level(self, market_data: MarketData) -> Decimal:
        """Calculate current volatility level (annualized)."""
        recent_data = market_data.get_price_history(20)  # 20-day volatility
        
        if len(recent_data) < 2:
            return Decimal('20')  # Default moderate volatility
        
        # Calculate daily returns
        returns = []
        for i in range(1, len(recent_data)):
            prev_close = recent_data[i-1].close_price.value
            curr_close = recent_data[i].close_price.value
            
            if prev_close > 0:
                daily_return = (curr_close - prev_close) / prev_close
                returns.append(float(daily_return))
        
        if not returns:
            return Decimal('20')
        
        # Calculate standard deviation and annualize
        std_dev = statistics.stdev(returns) if len(returns) > 1 else 0
        annualized_vol = std_dev * (252 ** 0.5) * 100  # 252 trading days
        
        return Decimal(str(annualized_vol))
    
    def _calculate_trend_strength(self, market_data: MarketData) -> Decimal:
        """Calculate trend strength using EMA relationships."""
        latest_indicators = market_data.get_latest_indicators()
        if not latest_indicators:
            return Decimal('0')
        
        # Simple trend strength based on EMA separation
        ema_diff = abs(latest_indicators.ema_short - latest_indicators.ema_long)
        ema_avg = (latest_indicators.ema_short + latest_indicators.ema_long) / 2
        
        if ema_avg == 0:
            return Decimal('0')
        
        trend_strength = ema_diff / ema_avg
        return min(trend_strength, Decimal('1.0'))  # Cap at 1.0
