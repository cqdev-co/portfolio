"""Analysis service for penny stock explosion signal detection."""

import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from loguru import logger
import numpy as np

from penny_scanner.models.market_data import MarketData
from penny_scanner.models.analysis import (
    ExplosionSignal,
    AnalysisResult,
    TrendDirection,
    OpportunityRank,
    RiskLevel,
    SignalStatus
)
from penny_scanner.utils.technical_indicators import (
    TechnicalIndicatorCalculator
)
from penny_scanner.utils.helpers import safe_divide, normalize_score, clamp
from penny_scanner.core.exceptions import AnalysisError
from penny_scanner.config.settings import Settings


class AnalysisService:
    """
    Service for analyzing penny stocks and detecting explosion setups.
    Implements penny-optimized strategy: Volume (50%), Momentum (30%),
    Relative Strength (15%), Risk (5%).
    """
    
    def __init__(self, settings: Settings):
        """Initialize analysis service."""
        self.settings = settings
        self.indicator_calculator = TechnicalIndicatorCalculator(settings)
    
    async def analyze_symbol(
        self,
        market_data: MarketData,
        include_ai_analysis: bool = False
    ) -> Optional[AnalysisResult]:
        """
        Analyze a symbol for penny stock explosion signals.
        
        Args:
            market_data: Market data with OHLCV
            include_ai_analysis: Whether to include AI analysis
            
        Returns:
            AnalysisResult if signal detected, None otherwise
        """
        try:
            start_time = datetime.now(timezone.utc)
            
            # Calculate indicators if not present
            if not market_data.indicators:
                market_data = self.indicator_calculator.calculate_all_indicators(
                    market_data
                )
            
            # Pre-filter: Check price range
            latest_price = market_data.get_latest_price()
            if not latest_price:
                return None
            
            if not (self.settings.penny_min_price <= 
                   latest_price <= 
                   self.settings.penny_max_price):
                logger.debug(
                    f"{market_data.symbol}: Price ${latest_price:.2f} "
                    f"outside penny range"
                )
                return None
            
            # Pre-filter: Check minimum volume
            latest_volume = market_data.get_latest_volume()
            if not latest_volume or latest_volume < self.settings.penny_min_volume:
                logger.debug(
                    f"{market_data.symbol}: Volume {latest_volume} "
                    f"below minimum"
                )
                return None
            
            # Detect explosion signal
            explosion_signal = self._detect_explosion_signal(market_data)
            
            if not explosion_signal:
                return None
            
            # Pre-filter: Check dollar volume
            if (explosion_signal.dollar_volume < 
                self.settings.penny_min_dollar_volume):
                logger.debug(
                    f"{market_data.symbol}: Dollar volume "
                    f"${explosion_signal.dollar_volume:,.0f} below minimum"
                )
                return None
            
            # Calculate overall score
            overall_score = self._calculate_overall_score(explosion_signal)
            
            # Pre-filter: Check minimum score
            if overall_score < self.settings.min_score_threshold:
                return None
            
            # Calculate opportunity rank
            opportunity_rank = self._calculate_opportunity_rank(overall_score)
            
            # Generate recommendation
            recommendation = self._generate_recommendation(
                explosion_signal,
                overall_score
            )
            
            # Calculate risk management parameters
            stop_loss = self._calculate_stop_loss(explosion_signal)
            position_size = self._calculate_position_size(overall_score)
            
            # Create analysis result
            analysis_id = str(uuid.uuid4())
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            analysis_result = AnalysisResult(
                analysis_id=analysis_id,
                symbol=market_data.symbol,
                timestamp=explosion_signal.timestamp,
                explosion_signal=explosion_signal,
                ai_analysis=None,  # TODO: AI service integration
                overall_score=overall_score,
                opportunity_rank=opportunity_rank,
                recommendation=recommendation,
                stop_loss_level=stop_loss,
                position_size_pct=position_size,
                analysis_duration_ms=duration_ms,
                data_quality_score=self._assess_data_quality(market_data)
            )
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Analysis error for {market_data.symbol}: {e}")
            raise AnalysisError(f"Failed to analyze {market_data.symbol}: {e}")
    
    def _detect_explosion_signal(
        self,
        market_data: MarketData
    ) -> Optional[ExplosionSignal]:
        """
        Detect penny stock explosion setup signal.
        Focus on volume-driven breakouts from consolidation.
        """
        if len(market_data.ohlcv_data) < 50:
            return None
        
        latest_ohlcv = market_data.ohlcv_data[-1]
        latest_indicators = market_data.indicators[-1]
        
        # Volume Analysis (50% weight) - THE DOMINANT SIGNAL
        volume_metrics = self._calculate_volume_metrics(
            market_data,
            latest_ohlcv,
            latest_indicators
        )
        
        # Price Momentum & Consolidation (30% weight)
        momentum_metrics = self._calculate_momentum_metrics(
            market_data,
            latest_ohlcv,
            latest_indicators
        )
        
        # Relative Strength (15% weight)
        strength_metrics = self._calculate_relative_strength(
            market_data,
            latest_ohlcv,
            latest_indicators
        )
        
        # Risk & Liquidity (5% weight)
        risk_metrics = self._calculate_risk_metrics(
            market_data,
            latest_ohlcv,
            latest_indicators
        )
        
        # Calculate component scores
        volume_score = self._score_volume_analysis(volume_metrics)
        momentum_score = self._score_momentum(momentum_metrics)
        strength_score = self._score_relative_strength(strength_metrics)
        risk_score = self._score_risk_liquidity(risk_metrics)
        
        # Determine trend direction
        trend = self._determine_trend(latest_indicators)
        
        # Create explosion signal
        explosion_signal = ExplosionSignal(
            timestamp=latest_ohlcv.timestamp,
            symbol=market_data.symbol,
            close_price=latest_ohlcv.close,
            
            # Volume metrics
            volume=latest_ohlcv.volume,
            avg_volume_20d=latest_indicators.volume_sma_20 or 0,
            volume_ratio=volume_metrics['volume_ratio'],
            volume_spike_factor=volume_metrics['spike_factor'],
            volume_acceleration_2d=volume_metrics['acceleration_2d'],
            volume_acceleration_5d=volume_metrics['acceleration_5d'],
            volume_consistency_score=volume_metrics['consistency'],
            dollar_volume=volume_metrics['dollar_volume'],
            
            # Momentum metrics
            is_consolidating=momentum_metrics['is_consolidating'],
            consolidation_days=momentum_metrics['consolidation_days'],
            consolidation_range_pct=momentum_metrics['consolidation_range'],
            is_breakout=momentum_metrics['is_breakout'],
            price_change_5d=momentum_metrics['price_change_5d'],
            price_change_10d=momentum_metrics['price_change_10d'],
            price_change_20d=momentum_metrics['price_change_20d'],
            higher_lows_detected=momentum_metrics['higher_lows'],
            consecutive_green_days=momentum_metrics['green_days'],
            
            # Moving averages
            ema_20=latest_indicators.ema_20 or 0,
            ema_50=latest_indicators.ema_50 or 0,
            price_vs_ema20=momentum_metrics['price_vs_ema20'],
            price_vs_ema50=momentum_metrics['price_vs_ema50'],
            ema_crossover_signal=momentum_metrics['ema_crossover'],
            
            # Relative strength
            market_outperformance=strength_metrics.get('market_outperformance'),
            sector_outperformance=strength_metrics.get('sector_outperformance'),
            distance_from_52w_low=strength_metrics['dist_from_52w_low'],
            distance_from_52w_high=strength_metrics['dist_from_52w_high'],
            breaking_resistance=strength_metrics['breaking_resistance'],
            
            # Risk metrics
            bid_ask_spread_pct=risk_metrics.get('spread_pct'),
            avg_spread_5d=risk_metrics.get('avg_spread_5d'),
            float_shares=market_data.float_shares,
            is_low_float=risk_metrics['is_low_float'],
            daily_volatility=risk_metrics['volatility'],
            atr_20=latest_indicators.atr_20 or 0,
            pump_dump_risk=risk_metrics['pump_risk'],
            
            # Trend
            trend_direction=trend,
            
            # Component scores
            volume_score=volume_score,
            momentum_score=momentum_score,
            relative_strength_score=strength_score,
            risk_score=risk_score
        )
        
        return explosion_signal
    
    def _calculate_volume_metrics(
        self,
        market_data: MarketData,
        latest_ohlcv,
        latest_indicators
    ) -> dict:
        """Calculate volume analysis metrics (50% weight)."""
        volume_ratio = latest_indicators.volume_ratio or 1.0
        
        # Determine spike factor
        spike_factor = volume_ratio
        if volume_ratio >= self.settings.volume_spike_5x:
            spike_factor = 5.0
        elif volume_ratio >= self.settings.volume_spike_3x:
            spike_factor = 3.0
        elif volume_ratio >= self.settings.volume_spike_2x:
            spike_factor = 2.0
        
        # Volume acceleration
        acceleration = self.indicator_calculator.calculate_volume_acceleration(
            market_data.ohlcv_data,
            periods=[2, 5]
        )
        
        # Volume consistency
        consistency = self.indicator_calculator.calculate_volume_consistency(
            market_data.ohlcv_data,
            lookback_days=5
        )
        
        # Dollar volume
        dollar_volume = latest_ohlcv.close * latest_ohlcv.volume
        
        return {
            'volume_ratio': volume_ratio,
            'spike_factor': spike_factor,
            'acceleration_2d': acceleration.get('2d', 0.0),
            'acceleration_5d': acceleration.get('5d', 0.0),
            'consistency': consistency,
            'dollar_volume': dollar_volume
        }
    
    def _calculate_momentum_metrics(
        self,
        market_data: MarketData,
        latest_ohlcv,
        latest_indicators
    ) -> dict:
        """Calculate price momentum & consolidation metrics (30% weight)."""
        # Consolidation detection
        is_consolidating, consol_days, consol_range = (
            self.indicator_calculator.detect_consolidation(
                market_data.ohlcv_data
            )
        )
        
        # Breakout detection
        is_breakout = (
            is_consolidating and
            latest_ohlcv.close > market_data.ohlcv_data[-2].close and
            latest_ohlcv.volume > (latest_indicators.volume_sma_20 or 0) * 1.5
        )
        
        # Price changes
        prices = [d.close for d in market_data.ohlcv_data]
        price_change_5d = safe_divide(
            prices[-1] - prices[-6] if len(prices) > 5 else 0,
            prices[-6] if len(prices) > 5 else 1,
            0
        ) * 100
        
        price_change_10d = safe_divide(
            prices[-1] - prices[-11] if len(prices) > 10 else 0,
            prices[-11] if len(prices) > 10 else 1,
            0
        ) * 100
        
        price_change_20d = safe_divide(
            prices[-1] - prices[-21] if len(prices) > 20 else 0,
            prices[-21] if len(prices) > 20 else 1,
            0
        ) * 100
        
        # Higher lows
        higher_lows = self.indicator_calculator.detect_higher_lows(
            market_data.ohlcv_data
        )
        
        # Green days
        green_days = self.indicator_calculator.count_consecutive_green_days(
            market_data.ohlcv_data
        )
        
        # EMA positioning
        price_vs_ema20 = safe_divide(
            latest_ohlcv.close - (latest_indicators.ema_20 or 0),
            latest_indicators.ema_20 or 1,
            0
        ) * 100
        
        price_vs_ema50 = safe_divide(
            latest_ohlcv.close - (latest_indicators.ema_50 or 0),
            latest_indicators.ema_50 or 1,
            0
        ) * 100
        
        # EMA crossover
        ema_crossover = (
            (latest_indicators.ema_20 or 0) > (latest_indicators.ema_50 or 0) and
            len(market_data.indicators) > 1 and
            (market_data.indicators[-2].ema_20 or 0) <= 
            (market_data.indicators[-2].ema_50 or 0)
        )
        
        return {
            'is_consolidating': is_consolidating,
            'consolidation_days': consol_days,
            'consolidation_range': consol_range,
            'is_breakout': is_breakout,
            'price_change_5d': price_change_5d,
            'price_change_10d': price_change_10d,
            'price_change_20d': price_change_20d,
            'higher_lows': higher_lows,
            'green_days': green_days,
            'price_vs_ema20': price_vs_ema20,
            'price_vs_ema50': price_vs_ema50,
            'ema_crossover': ema_crossover
        }
    
    def _calculate_relative_strength(
        self,
        market_data: MarketData,
        latest_ohlcv,
        latest_indicators
    ) -> dict:
        """Calculate relative strength metrics (15% weight)."""
        # 52-week position
        dist_from_52w_low = latest_indicators.distance_from_52w_low or 0
        dist_from_52w_high = latest_indicators.distance_from_52w_high or 0
        
        # Breaking resistance (near 52w high)
        breaking_resistance = dist_from_52w_high > -10  # Within 10% of high
        
        # TODO: Market and sector outperformance would require SPY/sector data
        # For now, use None and calculate when available
        
        return {
            'market_outperformance': None,
            'sector_outperformance': None,
            'dist_from_52w_low': dist_from_52w_low,
            'dist_from_52w_high': dist_from_52w_high,
            'breaking_resistance': breaking_resistance
        }
    
    def _calculate_risk_metrics(
        self,
        market_data: MarketData,
        latest_ohlcv,
        latest_indicators
    ) -> dict:
        """Calculate risk & liquidity metrics (5% weight)."""
        # Low float detection
        is_low_float = (
            market_data.float_shares is not None and
            market_data.float_shares < 50_000_000
        )
        
        # Volatility (ATR-based)
        atr = latest_indicators.atr_20 or 0
        volatility = safe_divide(atr, latest_ohlcv.close, 0) * 100
        
        # Pump-and-dump risk assessment
        pump_risk = self._assess_pump_dump_risk(
            market_data,
            latest_ohlcv,
            volatility
        )
        
        return {
            'spread_pct': None,  # TODO: Requires bid/ask data
            'avg_spread_5d': None,
            'is_low_float': is_low_float,
            'volatility': volatility,
            'pump_risk': pump_risk
        }
    
    def _assess_pump_dump_risk(
        self,
        market_data: MarketData,
        latest_ohlcv,
        volatility: float
    ) -> RiskLevel:
        """Assess pump-and-dump risk."""
        # Check for extreme single-day moves
        if len(market_data.ohlcv_data) < 2:
            return RiskLevel.MEDIUM
        
        prev_close = market_data.ohlcv_data[-2].close
        day_change = safe_divide(
            latest_ohlcv.close - prev_close,
            prev_close,
            0
        ) * 100
        
        # High risk signals
        if abs(day_change) > 50:  # 50%+ move in one day
            return RiskLevel.EXTREME
        elif abs(day_change) > 30:  # 30-50% move
            return RiskLevel.HIGH
        elif volatility > 15:  # Very high volatility
            return RiskLevel.HIGH
        elif volatility > 8:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    def _score_volume_analysis(self, metrics: dict) -> float:
        """
        Score volume analysis (50% of total score).
        
        Breakdown:
        - Volume surge: 20%
        - Volume acceleration: 15%
        - Volume consistency: 10%
        - Liquidity depth: 5%
        """
        score = 0.0
        
        # Volume surge (20%)
        volume_ratio = metrics['volume_ratio']
        if volume_ratio >= 5.0:
            surge_score = 1.0
        elif volume_ratio >= 3.0:
            surge_score = 0.85
        elif volume_ratio >= 2.0:
            surge_score = 0.65
        elif volume_ratio >= 1.5:
            surge_score = 0.40
        else:
            surge_score = normalize_score(volume_ratio, 1.0, 1.5)
        score += surge_score * self.settings.weight_volume_surge
        
        # Volume acceleration (15%)
        accel_5d = metrics['acceleration_5d']
        accel_score = normalize_score(accel_5d, 0, 200)  # 0-200% growth
        score += accel_score * self.settings.weight_volume_acceleration
        
        # Volume consistency (10%)
        consistency = metrics['consistency']
        score += consistency * self.settings.weight_volume_consistency
        
        # Liquidity depth (5%)
        dollar_vol = metrics['dollar_volume']
        if dollar_vol >= 1_000_000:
            liquidity_score = 1.0
        elif dollar_vol >= 500_000:
            liquidity_score = 0.8
        elif dollar_vol >= 200_000:
            liquidity_score = 0.6
        else:
            liquidity_score = normalize_score(dollar_vol, 100_000, 200_000)
        score += liquidity_score * self.settings.weight_liquidity_depth
        
        return score
    
    def _score_momentum(self, metrics: dict) -> float:
        """
        Score price momentum & consolidation (30% of total score).
        
        Breakdown:
        - Consolidation detection: 12%
        - Price acceleration: 10%
        - Higher lows pattern: 5%
        - MA position: 3%
        """
        score = 0.0
        
        # Consolidation + breakout (12%)
        if metrics['is_breakout']:
            consol_score = 1.0
        elif metrics['is_consolidating']:
            consol_score = 0.7
        else:
            consol_score = 0.3
        score += consol_score * self.settings.weight_consolidation
        
        # Price acceleration (10%)
        price_20d = metrics['price_change_20d']
        if price_20d > 0:
            accel_score = normalize_score(price_20d, 0, 50)  # 0-50% gain
        else:
            accel_score = 0.2
        score += accel_score * self.settings.weight_price_acceleration
        
        # Higher lows (5%)
        higher_lows_score = 1.0 if metrics['higher_lows'] else 0.3
        score += higher_lows_score * self.settings.weight_higher_lows
        
        # MA position (3%)
        price_vs_ema20 = metrics['price_vs_ema20']
        if price_vs_ema20 > 5:  # Above EMA20
            ma_score = 1.0
        elif price_vs_ema20 > 0:
            ma_score = 0.7
        else:
            ma_score = 0.3
        score += ma_score * self.settings.weight_ma_position
        
        return score
    
    def _score_relative_strength(self, metrics: dict) -> float:
        """
        Score relative strength (15% of total score).
        
        Breakdown:
        - Market outperformance: 8%
        - Sector leadership: 4%
        - 52-week position: 3%
        """
        score = 0.0
        
        # Market outperformance (8%) - TODO when SPY data available
        # For now, use partial credit
        score += 0.5 * self.settings.weight_market_outperformance
        
        # Sector leadership (4%) - TODO when sector data available
        # For now, use partial credit
        score += 0.5 * self.settings.weight_sector_leadership
        
        # 52-week position (3%)
        dist_from_low = metrics['dist_from_52w_low']
        if dist_from_low > 100:  # 2x from lows
            pos_score = 1.0
        elif dist_from_low > 50:
            pos_score = 0.8
        elif dist_from_low > 20:
            pos_score = 0.6
        else:
            pos_score = normalize_score(dist_from_low, 0, 20)
        score += pos_score * self.settings.weight_52w_position
        
        return score
    
    def _score_risk_liquidity(self, metrics: dict) -> float:
        """
        Score risk & liquidity (5% of total score).
        
        Breakdown:
        - Bid-ask spread: 2%
        - Float analysis: 2%
        - Price stability: 1%
        """
        score = 0.0
        
        # Bid-ask spread (2%) - TODO when spread data available
        # For now, use partial credit
        score += 0.5 * self.settings.weight_bid_ask_spread
        
        # Float analysis (2%)
        float_score = 0.8 if metrics['is_low_float'] else 0.5
        score += float_score * self.settings.weight_float_analysis
        
        # Price stability (1%) - inverse of pump risk
        pump_risk = metrics['pump_risk']
        if pump_risk == RiskLevel.LOW:
            stability_score = 1.0
        elif pump_risk == RiskLevel.MEDIUM:
            stability_score = 0.6
        elif pump_risk == RiskLevel.HIGH:
            stability_score = 0.3
        else:  # EXTREME
            stability_score = 0.0
        score += stability_score * self.settings.weight_price_stability
        
        return score
    
    def _calculate_overall_score(
        self,
        explosion_signal: ExplosionSignal
    ) -> float:
        """Calculate overall signal score (0-1.0)."""
        total_score = (
            explosion_signal.volume_score +
            explosion_signal.momentum_score +
            explosion_signal.relative_strength_score +
            explosion_signal.risk_score
        )
        
        return clamp(total_score, 0.0, 1.0)
    
    def _calculate_opportunity_rank(self, score: float) -> OpportunityRank:
        """Calculate opportunity tier ranking."""
        if score >= self.settings.s_tier_threshold:
            return OpportunityRank.S_TIER
        elif score >= self.settings.a_tier_threshold:
            return OpportunityRank.A_TIER
        elif score >= self.settings.b_tier_threshold:
            return OpportunityRank.B_TIER
        elif score >= self.settings.c_tier_threshold:
            return OpportunityRank.C_TIER
        else:
            return OpportunityRank.D_TIER
    
    def _generate_recommendation(
        self,
        signal: ExplosionSignal,
        score: float
    ) -> str:
        """Generate trading recommendation."""
        if score >= 0.85 and signal.is_breakout:
            return "STRONG_BUY"
        elif score >= 0.70:
            return "BUY"
        elif score >= 0.60:
            return "WATCH"
        else:
            return "HOLD"
    
    def _calculate_stop_loss(self, signal: ExplosionSignal) -> float:
        """Calculate recommended stop loss level."""
        # Use ATR-based stop loss
        atr_multiplier = 2.0
        stop_distance = signal.atr_20 * atr_multiplier
        stop_loss = signal.close_price - stop_distance
        
        # Ensure stop loss is reasonable (max 15% down)
        max_stop = signal.close_price * 0.85
        return max(stop_loss, max_stop)
    
    def _calculate_position_size(self, score: float) -> float:
        """Calculate recommended position size (% of capital)."""
        # Scale position size with score
        base_size = self.settings.max_position_size_pct
        
        if score >= 0.90:
            return base_size
        elif score >= 0.80:
            return base_size * 0.85
        elif score >= 0.70:
            return base_size * 0.70
        else:
            return base_size * 0.50
    
    def _determine_trend(self, indicators) -> TrendDirection:
        """Determine current trend direction."""
        ema_20 = indicators.ema_20 or 0
        ema_50 = indicators.ema_50 or 0
        
        if ema_20 > ema_50 * 1.02:  # 2% above
            return TrendDirection.BULLISH
        elif ema_20 < ema_50 * 0.98:  # 2% below
            return TrendDirection.BEARISH
        else:
            return TrendDirection.NEUTRAL
    
    def _assess_data_quality(self, market_data: MarketData) -> float:
        """Assess quality of input data (0-1)."""
        score = 0.0
        
        # Data completeness
        if len(market_data.ohlcv_data) >= 100:
            score += 0.4
        elif len(market_data.ohlcv_data) >= 50:
            score += 0.3
        else:
            score += 0.2
        
        # Indicator availability
        if market_data.indicators:
            score += 0.3
        
        # Recent data
        if market_data.ohlcv_data:
            latest = market_data.ohlcv_data[-1].timestamp
            # Handle timezone-aware/naive datetime comparison
            current_time = datetime.now(timezone.utc)
            if latest.tzinfo is None:
                # If latest is naive, make current_time naive too
                current_time = datetime.now()
            age_days = (current_time - latest).days
            if age_days <= 1:
                score += 0.3
            elif age_days <= 3:
                score += 0.2
            else:
                score += 0.1
        
        return clamp(score, 0.0, 1.0)

