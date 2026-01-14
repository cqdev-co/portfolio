"""Analysis service for penny stock explosion signal detection."""

import uuid
from datetime import UTC, datetime

import yfinance as yf
from loguru import logger

from penny_scanner.config.settings import Settings
from penny_scanner.core.exceptions import AnalysisError
from penny_scanner.models.analysis import (
    AnalysisResult,
    ExplosionSignal,
    OpportunityRank,
    RiskLevel,
    TrendDirection,
)
from penny_scanner.models.market_data import MarketData
from penny_scanner.services.market_comparison_service import (
    get_market_comparison_service,
)
from penny_scanner.utils.helpers import clamp, normalize_score, safe_divide
from penny_scanner.utils.technical_indicators import TechnicalIndicatorCalculator

# Country info cache to avoid repeated API calls
_country_cache: dict[str, str | None] = {}


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
        self.market_comparison = get_market_comparison_service(settings)

    def _get_country(self, symbol: str) -> str | None:
        """
        Get country of origin for a stock symbol.
        Uses cache to avoid repeated yfinance API calls.
        """
        global _country_cache

        if symbol in _country_cache:
            return _country_cache[symbol]

        try:
            info = yf.Ticker(symbol).info
            country = info.get("country")
            _country_cache[symbol] = country
            return country
        except Exception as e:
            logger.debug(f"Could not fetch country for {symbol}: {e}")
            _country_cache[symbol] = None
            return None

    def _check_pump_dump_warning(
        self, signal: ExplosionSignal, score: float, country: str | None
    ) -> bool:
        """
        Check if signal shows pump-and-dump warning signs.

        Triggers on:
        - Extreme volume (10x+) AND
        - High score (0.75+) AND
        - (High-risk country OR price < $0.50)
        """
        extreme_volume = signal.volume_spike_factor >= self.settings.volume_ceiling
        high_score = score >= 0.75
        low_price = signal.close_price < 0.50
        high_risk_country = (
            country in self.settings.high_risk_countries if country else False
        )

        return extreme_volume and high_score and (high_risk_country or low_price)

    async def analyze_symbol(
        self, market_data: MarketData, include_ai_analysis: bool = False
    ) -> AnalysisResult | None:
        """
        Analyze a symbol for penny stock explosion signals.

        Args:
            market_data: Market data with OHLCV
            include_ai_analysis: Whether to include AI analysis

        Returns:
            AnalysisResult if signal detected, None otherwise
        """
        try:
            start_time = datetime.now(UTC)

            # Calculate indicators if not present
            if not market_data.indicators:
                market_data = self.indicator_calculator.calculate_all_indicators(
                    market_data
                )

            # Pre-filter: Check price range
            latest_price = market_data.get_latest_price()
            if not latest_price:
                return None

            if not (
                self.settings.penny_min_price
                <= latest_price
                <= self.settings.penny_max_price
            ):
                logger.debug(
                    f"{market_data.symbol}: Price ${latest_price:.2f} "
                    f"outside penny range"
                )
                return None

            # Pre-filter: Check minimum volume
            latest_volume = market_data.get_latest_volume()
            if not latest_volume or latest_volume < self.settings.penny_min_volume:
                logger.debug(
                    f"{market_data.symbol}: Volume {latest_volume} below minimum"
                )
                return None

            # Detect explosion signal
            explosion_signal = self._detect_explosion_signal(market_data)

            if not explosion_signal:
                return None

            # Pre-filter: Check dollar volume
            if explosion_signal.dollar_volume < self.settings.penny_min_dollar_volume:
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

            # Get country info for risk assessment
            country = self._get_country(market_data.symbol)
            is_high_risk = (
                country in self.settings.high_risk_countries if country else False
            )

            # Update explosion signal with country info
            explosion_signal.country = country
            explosion_signal.is_high_risk_country = is_high_risk

            # Check for pump-and-dump warning
            explosion_signal.pump_dump_warning = self._check_pump_dump_warning(
                explosion_signal, overall_score, country
            )

            # Calculate opportunity rank
            opportunity_rank = self._calculate_opportunity_rank(overall_score)

            # RANK ADJUSTMENTS based on data insights
            # 1. Demote rank for high-risk countries (0-18% WR)
            if is_high_risk and opportunity_rank != OpportunityRank.D_TIER:
                logger.debug(
                    f"{market_data.symbol}: Demoting from {opportunity_rank.value} due to high-risk country ({country})"
                )
                opportunity_rank = self._demote_rank(opportunity_rank)

            # 2. Require breakout for B/C tier (non-breakout = 20.4% WR)
            if not explosion_signal.is_breakout and opportunity_rank in (
                OpportunityRank.B_TIER,
                OpportunityRank.C_TIER,
            ):
                logger.debug(
                    f"{market_data.symbol}: Demoting from {opportunity_rank.value} - no breakout detected"
                )
                opportunity_rank = self._demote_rank(opportunity_rank)

            # Generate recommendation
            recommendation = self._generate_recommendation(
                explosion_signal, overall_score
            )

            # Calculate risk management parameters
            stop_loss = self._calculate_stop_loss(explosion_signal)
            position_size = self._calculate_position_size(overall_score)

            # Create analysis result
            analysis_id = str(uuid.uuid4())
            end_time = datetime.now(UTC)
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
                data_quality_score=self._assess_data_quality(market_data),
            )

            return analysis_result

        except Exception as e:
            logger.error(f"Analysis error for {market_data.symbol}: {e}")
            raise AnalysisError(f"Failed to analyze {market_data.symbol}: {e}") from e

    def _detect_explosion_signal(
        self, market_data: MarketData
    ) -> ExplosionSignal | None:
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
            market_data, latest_ohlcv, latest_indicators
        )

        # Price Momentum & Consolidation (30% weight)
        momentum_metrics = self._calculate_momentum_metrics(
            market_data, latest_ohlcv, latest_indicators
        )

        # Relative Strength (15% weight)
        strength_metrics = self._calculate_relative_strength(
            market_data, latest_ohlcv, latest_indicators
        )

        # Risk & Liquidity (5% weight)
        risk_metrics = self._calculate_risk_metrics(
            market_data, latest_ohlcv, latest_indicators
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
            volume_ratio=volume_metrics["volume_ratio"],
            volume_spike_factor=volume_metrics["spike_factor"],
            volume_acceleration_2d=volume_metrics["acceleration_2d"],
            volume_acceleration_5d=volume_metrics["acceleration_5d"],
            volume_consistency_score=volume_metrics["consistency"],
            dollar_volume=volume_metrics["dollar_volume"],
            # Momentum metrics
            is_consolidating=momentum_metrics["is_consolidating"],
            consolidation_days=momentum_metrics["consolidation_days"],
            consolidation_range_pct=momentum_metrics["consolidation_range"],
            is_breakout=momentum_metrics["is_breakout"],
            price_change_5d=momentum_metrics["price_change_5d"],
            price_change_10d=momentum_metrics["price_change_10d"],
            price_change_20d=momentum_metrics["price_change_20d"],
            higher_lows_detected=momentum_metrics["higher_lows"],
            consecutive_green_days=momentum_metrics["green_days"],
            # Moving averages
            ema_20=latest_indicators.ema_20 or 0,
            ema_50=latest_indicators.ema_50 or 0,
            price_vs_ema20=momentum_metrics["price_vs_ema20"],
            price_vs_ema50=momentum_metrics["price_vs_ema50"],
            ema_crossover_signal=momentum_metrics["ema_crossover"],
            # Relative strength
            market_outperformance=strength_metrics.get("market_outperformance"),
            sector_outperformance=strength_metrics.get("sector_outperformance"),
            distance_from_52w_low=strength_metrics["dist_from_52w_low"],
            distance_from_52w_high=strength_metrics["dist_from_52w_high"],
            breaking_resistance=strength_metrics["breaking_resistance"],
            # Risk metrics
            bid_ask_spread_pct=risk_metrics.get("spread_pct"),
            avg_spread_5d=risk_metrics.get("avg_spread_5d"),
            float_shares=market_data.float_shares,
            is_low_float=risk_metrics["is_low_float"],
            daily_volatility=risk_metrics["volatility"],
            atr_20=latest_indicators.atr_20 or 0,
            pump_dump_risk=risk_metrics["pump_risk"],
            # Country risk (will be populated in analyze_symbol)
            country=None,
            is_high_risk_country=False,
            pump_dump_warning=False,
            # Trend
            trend_direction=trend,
            # Component scores
            volume_score=volume_score,
            momentum_score=momentum_score,
            relative_strength_score=strength_score,
            risk_score=risk_score,
        )

        return explosion_signal

    def _calculate_volume_metrics(
        self, market_data: MarketData, latest_ohlcv, latest_indicators
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
            market_data.ohlcv_data, periods=[2, 5]
        )

        # Volume consistency
        consistency = self.indicator_calculator.calculate_volume_consistency(
            market_data.ohlcv_data, lookback_days=5
        )

        # Dollar volume
        dollar_volume = latest_ohlcv.close * latest_ohlcv.volume

        return {
            "volume_ratio": volume_ratio,
            "spike_factor": spike_factor,
            "acceleration_2d": acceleration.get("2d", 0.0),
            "acceleration_5d": acceleration.get("5d", 0.0),
            "consistency": consistency,
            "dollar_volume": dollar_volume,
        }

    def _calculate_momentum_metrics(
        self, market_data: MarketData, latest_ohlcv, latest_indicators
    ) -> dict:
        """Calculate price momentum & consolidation metrics (30% weight)."""
        # Consolidation detection
        is_consolidating, consol_days, consol_range = (
            self.indicator_calculator.detect_consolidation(market_data.ohlcv_data)
        )

        # Breakout detection - IMPROVED
        # Previous logic was too strict (required consolidation + up day + volume)
        # Only 5.2% of signals were marked as breakouts
        # New logic: Multiple ways to qualify as a breakout

        prev_close = (
            market_data.ohlcv_data[-2].close
            if len(market_data.ohlcv_data) > 1
            else latest_ohlcv.close
        )
        price_up_today = latest_ohlcv.close > prev_close
        volume_surge = (
            latest_ohlcv.volume > (latest_indicators.volume_sma_20 or 0) * 2.0
        )  # 2x volume
        strong_volume_surge = (
            latest_ohlcv.volume > (latest_indicators.volume_sma_20 or 0) * 3.0
        )  # 3x volume

        # Calculate price move percentage
        price_move_pct = (
            ((latest_ohlcv.close - prev_close) / prev_close * 100)
            if prev_close > 0
            else 0
        )
        significant_move = price_move_pct >= 5.0  # 5%+ move

        # Multiple breakout scenarios:
        # 1. Classic: Consolidation + price up + volume surge
        classic_breakout = is_consolidating and price_up_today and volume_surge

        # 2. Volume explosion: 3x+ volume with price up (even without consolidation)
        volume_explosion_breakout = strong_volume_surge and price_up_today

        # 3. Significant move: 5%+ price move with 2x+ volume
        momentum_breakout = significant_move and volume_surge

        is_breakout = classic_breakout or volume_explosion_breakout or momentum_breakout

        # Price changes
        prices = [d.close for d in market_data.ohlcv_data]
        price_change_5d = (
            safe_divide(
                prices[-1] - prices[-6] if len(prices) > 5 else 0,
                prices[-6] if len(prices) > 5 else 1,
                0,
            )
            * 100
        )

        price_change_10d = (
            safe_divide(
                prices[-1] - prices[-11] if len(prices) > 10 else 0,
                prices[-11] if len(prices) > 10 else 1,
                0,
            )
            * 100
        )

        price_change_20d = (
            safe_divide(
                prices[-1] - prices[-21] if len(prices) > 20 else 0,
                prices[-21] if len(prices) > 20 else 1,
                0,
            )
            * 100
        )

        # Higher lows
        higher_lows = self.indicator_calculator.detect_higher_lows(
            market_data.ohlcv_data
        )

        # Green days
        green_days = self.indicator_calculator.count_consecutive_green_days(
            market_data.ohlcv_data
        )

        # EMA positioning
        price_vs_ema20 = (
            safe_divide(
                latest_ohlcv.close - (latest_indicators.ema_20 or 0),
                latest_indicators.ema_20 or 1,
                0,
            )
            * 100
        )

        price_vs_ema50 = (
            safe_divide(
                latest_ohlcv.close - (latest_indicators.ema_50 or 0),
                latest_indicators.ema_50 or 1,
                0,
            )
            * 100
        )

        # EMA crossover
        ema_crossover = (
            (latest_indicators.ema_20 or 0) > (latest_indicators.ema_50 or 0)
            and len(market_data.indicators) > 1
            and (market_data.indicators[-2].ema_20 or 0)
            <= (market_data.indicators[-2].ema_50 or 0)
        )

        return {
            "is_consolidating": is_consolidating,
            "consolidation_days": consol_days,
            "consolidation_range": consol_range,
            "is_breakout": is_breakout,
            "price_change_5d": price_change_5d,
            "price_change_10d": price_change_10d,
            "price_change_20d": price_change_20d,
            "higher_lows": higher_lows,
            "green_days": green_days,
            "price_vs_ema20": price_vs_ema20,
            "price_vs_ema50": price_vs_ema50,
            "ema_crossover": ema_crossover,
        }

    def _calculate_relative_strength(
        self, market_data: MarketData, latest_ohlcv, latest_indicators
    ) -> dict:
        """Calculate relative strength metrics (15% weight)."""
        # 52-week position
        dist_from_52w_low = latest_indicators.distance_from_52w_low or 0
        dist_from_52w_high = latest_indicators.distance_from_52w_high or 0

        # Breaking resistance (near 52w high)
        breaking_resistance = dist_from_52w_high > -10  # Within 10% of high

        # Calculate market outperformance using SPY comparison
        # This is now properly implemented via MarketComparisonService
        rs_metrics = self.market_comparison.calculate_relative_strength(market_data)

        # Use 20-day outperformance as the primary metric
        market_outperformance = rs_metrics.get("market_outperformance_20d")

        # Sector outperformance still not implemented - would need sector ETF data
        sector_outperformance = None

        return {
            "market_outperformance": market_outperformance,
            "sector_outperformance": sector_outperformance,
            "dist_from_52w_low": dist_from_52w_low,
            "dist_from_52w_high": dist_from_52w_high,
            "breaking_resistance": breaking_resistance,
        }

    def _calculate_risk_metrics(
        self, market_data: MarketData, latest_ohlcv, latest_indicators
    ) -> dict:
        """Calculate risk & liquidity metrics (5% weight)."""
        # Low float detection
        is_low_float = (
            market_data.float_shares is not None
            and market_data.float_shares < 50_000_000
        )

        # Volatility (ATR-based)
        atr = latest_indicators.atr_20 or 0
        volatility = safe_divide(atr, latest_ohlcv.close, 0) * 100

        # Pump-and-dump risk assessment
        pump_risk = self._assess_pump_dump_risk(market_data, latest_ohlcv, volatility)

        return {
            "spread_pct": None,  # TODO: Requires bid/ask data
            "avg_spread_5d": None,
            "is_low_float": is_low_float,
            "volatility": volatility,
            "pump_risk": pump_risk,
        }

    def _assess_pump_dump_risk(
        self, market_data: MarketData, latest_ohlcv, volatility: float
    ) -> RiskLevel:
        """Assess pump-and-dump risk."""
        # Check for extreme single-day moves
        if len(market_data.ohlcv_data) < 2:
            return RiskLevel.MEDIUM

        prev_close = market_data.ohlcv_data[-2].close
        day_change = safe_divide(latest_ohlcv.close - prev_close, prev_close, 0) * 100

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

        UPDATED Jan 2026: Narrowed sweet spot based on performance data.
        Data shows: 2-3x = 69% WR, +3.53% (BEST)
                    3-5x = 47.5% WR, +2.74%
                    5-10x = 49.1% WR, +1.61%
                    10x+ = likely pump-and-dump
        """
        score = 0.0

        # Volume surge (20%) - with ceiling for pump-and-dump protection
        volume_ratio = metrics["volume_ratio"]

        # UPDATED Jan 2026: Sweet spot narrowed to 2-3x (was 2-5x)
        if volume_ratio >= self.settings.volume_ceiling:
            # 10x+ volume is a WARNING sign - likely pump-and-dump
            surge_score = 0.50  # Penalize extreme volume
        elif volume_ratio >= 5.0:
            # 5-10x: Elevated risk, below optimal
            surge_score = 0.70
        elif volume_ratio > self.settings.volume_sweet_spot_max:
            # 3-5x: Good but not optimal (was part of sweet spot)
            surge_score = 0.85
        elif volume_ratio >= self.settings.volume_sweet_spot_min:
            # 2-3x: OPTIMAL zone (narrowed from 2-5x)
            surge_score = 1.0
        elif volume_ratio >= 1.5:
            surge_score = 0.50
        else:
            surge_score = normalize_score(volume_ratio, 1.0, 1.5)
        score += surge_score * self.settings.weight_volume_surge

        # Volume acceleration (15%)
        accel_5d = metrics["acceleration_5d"]
        accel_score = normalize_score(accel_5d, 0, 200)  # 0-200% growth
        score += accel_score * self.settings.weight_volume_acceleration

        # Volume consistency (10%)
        consistency = metrics["consistency"]
        score += consistency * self.settings.weight_volume_consistency

        # Liquidity depth (5%)
        dollar_vol = metrics["dollar_volume"]
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
        if metrics["is_breakout"]:
            consol_score = 1.0
        elif metrics["is_consolidating"]:
            consol_score = 0.7
        else:
            consol_score = 0.3
        score += consol_score * self.settings.weight_consolidation

        # Price acceleration (10%)
        price_20d = metrics["price_change_20d"]
        if price_20d > 0:
            accel_score = normalize_score(price_20d, 0, 50)  # 0-50% gain
        else:
            accel_score = 0.2
        score += accel_score * self.settings.weight_price_acceleration

        # Higher lows (5%)
        higher_lows_score = 1.0 if metrics["higher_lows"] else 0.3
        score += higher_lows_score * self.settings.weight_higher_lows

        # MA position (3%)
        price_vs_ema20 = metrics["price_vs_ema20"]
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

        NOTE: Market/sector comparison not yet implemented.
        Previous approach gave 50% partial credit which inflated scores.
        Now using 0 until properly implemented to avoid false confidence.
        """
        score = 0.0

        # Market outperformance (8%) - NOT IMPLEMENTED
        # Previously gave 50% partial credit which inflated scores
        # Set to 0 until SPY comparison is implemented
        market_outperf = metrics.get("market_outperformance")
        if market_outperf is not None:
            # When implemented, score based on actual outperformance
            if market_outperf > 10:
                score += 1.0 * self.settings.weight_market_outperformance
            elif market_outperf > 5:
                score += 0.7 * self.settings.weight_market_outperformance
            elif market_outperf > 0:
                score += 0.5 * self.settings.weight_market_outperformance
            # else: underperforming, no credit
        # else: no credit until implemented

        # Sector leadership (4%) - NOT IMPLEMENTED
        # Set to 0 until sector comparison is implemented
        sector_outperf = metrics.get("sector_outperformance")
        if sector_outperf is not None:
            if sector_outperf > 10:
                score += 1.0 * self.settings.weight_sector_leadership
            elif sector_outperf > 5:
                score += 0.7 * self.settings.weight_sector_leadership
            elif sector_outperf > 0:
                score += 0.5 * self.settings.weight_sector_leadership
        # else: no credit until implemented

        # 52-week position (3%) - This IS implemented
        dist_from_low = metrics["dist_from_52w_low"]
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

        NOTE: Bid-ask spread not available from yfinance.
        Previous approach gave 50% partial credit which inflated scores.
        """
        score = 0.0

        # Bid-ask spread (2%) - NOT AVAILABLE from yfinance
        # Previously gave 50% partial credit - now set to 0
        spread_pct = metrics.get("spread_pct")
        if spread_pct is not None:
            # When available, score based on actual spread
            if spread_pct < 1.0:
                score += 1.0 * self.settings.weight_bid_ask_spread
            elif spread_pct < 2.0:
                score += 0.8 * self.settings.weight_bid_ask_spread
            elif spread_pct < 5.0:
                score += 0.5 * self.settings.weight_bid_ask_spread
            # else: wide spread, no credit
        # else: no credit until we have spread data

        # Float analysis (2%) - This IS available
        float_score = 0.8 if metrics["is_low_float"] else 0.5
        score += float_score * self.settings.weight_float_analysis

        # Price stability (1%) - inverse of pump risk
        pump_risk = metrics["pump_risk"]
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

    def _calculate_overall_score(self, explosion_signal: ExplosionSignal) -> float:
        """
        Calculate overall signal score (0-1.0).

        UPDATED Jan 13, 2026: Added extreme volume penalty.
        Data showed: 2-3x volume = 72.5% WR vs 5x+ = 46.1% WR
        Extreme volume often signals end of move, not beginning.
        """
        total_score = (
            explosion_signal.volume_score
            + explosion_signal.momentum_score
            + explosion_signal.relative_strength_score
            + explosion_signal.risk_score
        )

        # Apply late entry penalty (fixes score inversion problem)
        total_score = self._apply_late_entry_adjustment(total_score, explosion_signal)

        # Apply green day adjustment (Jan 2026)
        # 1 green day = 64.8% WR (best), 0 or 4+ = ~42% WR
        total_score = self._apply_green_day_adjustment(total_score, explosion_signal)

        # Apply 52-week position adjustment (Jan 2026, updated Jan 13)
        # 25-50% from low = 55.1% WR, >75% = overextended (NEW)
        total_score = self._apply_52w_position_adjustment(total_score, explosion_signal)

        # Apply day of week adjustment (Jan 2026)
        # Friday = 57.4% WR (best), Wednesday = 44.7% WR (worst)
        total_score = self._apply_day_of_week_adjustment(total_score, explosion_signal)

        # Apply extreme volume penalty (NEW Jan 13, 2026)
        # 5x+ volume = 46.1% WR vs 2-3x = 72.5% WR
        total_score = self._apply_extreme_volume_penalty(total_score, explosion_signal)

        return clamp(total_score, 0.0, 1.0)

    def _apply_late_entry_adjustment(
        self, score: float, signal: ExplosionSignal
    ) -> float:
        """
        Apply late entry penalty or early entry bonus based on recent price action.

        ADDED Jan 2026: Data shows higher scores were "chasing" - buying after
        the move already happened. This adjustment penalizes late entries
        and rewards catching moves early.

        - Already up 30%+ in 10d: 30% penalty (chasing hard)
        - Already up 15%+ in 5d: 15% penalty (late entry)
        - Flat to +10% in 5d: 10% bonus (early entry, catching the start)
        """
        price_5d = signal.price_change_5d or 0
        price_10d = signal.price_change_10d or 0

        # Severe late entry: Already up 30%+ in 10 days
        if price_10d > self.settings.late_entry_threshold_10d:
            logger.debug(
                f"{signal.symbol}: Late entry penalty (severe) - "
                f"+{price_10d:.1f}% in 10d"
            )
            return score * self.settings.late_entry_penalty_severe

        # Moderate late entry: Already up 15%+ in 5 days
        if price_5d > self.settings.late_entry_threshold_5d:
            logger.debug(
                f"{signal.symbol}: Late entry penalty (moderate) - "
                f"+{price_5d:.1f}% in 5d"
            )
            return score * self.settings.late_entry_penalty_moderate

        # Early entry bonus: Flat to slightly up (-5% to +10%)
        # This is the ideal entry point - catching the move early
        if -5 < price_5d < 10:
            logger.debug(f"{signal.symbol}: Early entry bonus - {price_5d:+.1f}% in 5d")
            return score * self.settings.early_entry_bonus

        return score

    def _apply_green_day_adjustment(
        self, score: float, signal: ExplosionSignal
    ) -> float:
        """
        Apply consecutive green days adjustment.

        ADDED Jan 2026: Data shows optimal entry is after exactly 1 green day.
        - 1 green day: 64.8% WR, +3.64% (BEST - momentum starting)
        - 0 green days: 42.2% WR (no momentum yet)
        - 2-3 green days: 43.0% WR (okay)
        - 4+ green days: 41.9% WR, -2.54% (late entry, move exhausted)
        """
        green_days = signal.consecutive_green_days or 0

        # Optimal: exactly 1 green day (momentum just starting)
        if green_days == self.settings.green_day_optimal:
            logger.debug(
                f"{signal.symbol}: Green day bonus - {green_days} consecutive green day(s)"
            )
            return score * self.settings.green_day_optimal_bonus

        # Penalty: 0 green days (no momentum yet)
        if green_days == 0:
            logger.debug(
                f"{signal.symbol}: Green day penalty - no momentum (0 green days)"
            )
            return score * self.settings.green_day_zero_penalty

        # Penalty: 4+ green days (late entry, move may be exhausted)
        if green_days >= 4:
            logger.debug(
                f"{signal.symbol}: Green day penalty - late entry ({green_days} green days)"
            )
            return score * self.settings.green_day_excessive_penalty

        # 2-3 green days: neutral (no adjustment)
        return score

    def _apply_52w_position_adjustment(
        self, score: float, signal: ExplosionSignal
    ) -> float:
        """
        Apply 52-week position adjustment.

        UPDATED Jan 13, 2026: Added penalty for stocks near 52-week highs.
        Data analysis showed S-Tier signals averaged 98% from 52w low (near highs!)
        which is a major cause of their poor performance (11.8% WR).

        - 25-50% from low: 55.1% WR, +5.90% (BEST - recovering, not overextended)
        - <25% from low: 45.3% WR, -3.78% (catching falling knife)
        - >75% from low: Overextended, sellers waiting (NEW PENALTY)
        """
        dist_from_low = signal.distance_from_52w_low or 0

        # Optimal: 25-50% above 52-week low
        if (
            self.settings.position_52w_optimal_min
            <= dist_from_low
            <= self.settings.position_52w_optimal_max
        ):
            logger.debug(
                f"{signal.symbol}: 52w position bonus - "
                f"{dist_from_low:.1f}% from low (optimal zone)"
            )
            return score * self.settings.position_52w_optimal_bonus

        # Penalty: <25% from low (catching falling knife)
        if dist_from_low < self.settings.position_52w_optimal_min:
            logger.debug(
                f"{signal.symbol}: 52w position penalty - "
                f"{dist_from_low:.1f}% from low (falling knife risk)"
            )
            return score * self.settings.position_52w_near_low_penalty

        # NEW: Penalty for >75% from low (near 52-week highs, overextended)
        # S-Tier signals avg 98% from low - this is why they underperform!
        if dist_from_low > self.settings.position_52w_near_high_threshold:
            logger.debug(
                f"{signal.symbol}: 52w position penalty - "
                f"{dist_from_low:.1f}% from low (near highs, overextended)"
            )
            return score * self.settings.position_52w_near_high_penalty

        # 50-75% from low: neutral (no adjustment)
        return score

    def _apply_day_of_week_adjustment(
        self, score: float, signal: ExplosionSignal
    ) -> float:
        """
        Apply day of week adjustment based on entry timing.

        ADDED Jan 2026: Data shows significant day-of-week performance variance.
        - Friday: 57.4% WR (BEST - weekend catalyst potential)
        - Thursday: 52.7% WR (good)
        - Monday: 51.8% WR (good)
        - Tuesday: 41.1% WR (poor but high return variance)
        - Wednesday: 44.7% WR (WORST - mid-week weakness)
        """
        # Get day of week from signal timestamp (0=Monday, 4=Friday)
        day_of_week = signal.timestamp.weekday()

        # Friday bonus (day 4)
        if day_of_week == 4:
            logger.debug(f"{signal.symbol}: Friday entry bonus")
            return score * self.settings.day_of_week_friday_bonus

        # Wednesday penalty (day 2)
        if day_of_week == 2:
            logger.debug(f"{signal.symbol}: Wednesday entry penalty")
            return score * self.settings.day_of_week_wednesday_penalty

        # Other days: neutral
        return score

    def _apply_extreme_volume_penalty(
        self, score: float, signal: ExplosionSignal
    ) -> float:
        """
        Apply penalty for extreme volume (5x+).

        ADDED Jan 13, 2026: Data analysis showed:
        - Volume 2-3x: 72.5% WR, +5.40% avg return (BEST)
        - Volume 5x+: 46.1% WR, +0.65% avg return

        Extreme volume often signals:
        - End of a move, not the beginning
        - Retail FOMO chasing (late entry)
        - Potential pump-and-dump activity

        The volume scoring already penalizes 5x+ to some degree, but
        this additional adjustment ensures the final score reflects
        the poor performance of extreme volume signals.
        """
        volume_ratio = signal.volume_spike_factor or signal.volume_ratio or 1.0

        # Apply penalty for extreme volume (>5x)
        if volume_ratio > self.settings.extreme_volume_threshold:
            logger.debug(
                f"{signal.symbol}: Extreme volume penalty - "
                f"{volume_ratio:.1f}x (often signals end of move)"
            )
            return score * self.settings.extreme_volume_penalty

        # Normal volume: no adjustment
        return score

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

    def _demote_rank(self, rank: OpportunityRank) -> OpportunityRank:
        """Demote a rank by one tier."""
        demotion_map = {
            OpportunityRank.S_TIER: OpportunityRank.A_TIER,
            OpportunityRank.A_TIER: OpportunityRank.B_TIER,
            OpportunityRank.B_TIER: OpportunityRank.C_TIER,
            OpportunityRank.C_TIER: OpportunityRank.D_TIER,
            OpportunityRank.D_TIER: OpportunityRank.D_TIER,
        }
        return demotion_map.get(rank, rank)

    def _generate_recommendation(self, signal: ExplosionSignal, score: float) -> str:
        """
        Generate trading recommendation based on score and signal characteristics.

        UPDATED Jan 2026: Fixed BUY criteria - was 27.7% WR, worst of all!
        Data shows:
        - STRONG_BUY: 62.5% WR, +3.10% (good)
        - WATCH: 57.7% WR, +2.21% (good)
        - HOLD: 49.3% WR, +2.67% (decent)
        - BUY: 27.7% WR, -4.65% (TERRIBLE - too loose!)

        New criteria requires BUY to also:
        - Have volume in 2-3x sweet spot (69% WR vs 47.5% for 3-5x)
        - NOT be a late entry (already up 15%+ in 5d)

        STRONG_BUY: High score + breakout + outperforming + good volume
        BUY: Good score + breakout + outperforming + 2-3x volume + NOT late
        WATCH: Breakout OR outperforming (one of the key signals)
        HOLD: Neither breakout nor outperforming, or late entry
        """
        # Check for concerning risk factors
        high_risk = signal.pump_dump_risk in (RiskLevel.HIGH, RiskLevel.EXTREME)
        extreme_volume = signal.volume_spike_factor >= self.settings.volume_ceiling

        # Check if outperforming market (strongest predictor!)
        outperforming_market = (
            signal.market_outperformance is not None
            and signal.market_outperformance > 0
        )

        # Check volume is in sweet spot (2-3x is optimal per Jan 2026 data)
        volume_in_sweet_spot = (
            self.settings.volume_sweet_spot_min
            <= signal.volume_spike_factor
            <= self.settings.volume_sweet_spot_max
        )

        # Check for late entry (already moved significantly)
        price_5d = signal.price_change_5d or 0
        is_late_entry = price_5d > self.settings.late_entry_threshold_5d

        # Strong buy requires ALL key confirmations
        if (
            score >= 0.80
            and signal.is_breakout
            and outperforming_market
            and signal.volume_spike_factor >= 3.0
            and not extreme_volume
            and not high_risk
            and not is_late_entry
        ):
            return "STRONG_BUY"

        # BUY: MUCH STRICTER - requires sweet spot volume + not late entry
        # This fixes the 27.7% WR issue from Jan 2026 analysis
        elif (
            score >= 0.70
            and signal.is_breakout
            and outperforming_market
            and volume_in_sweet_spot  # 2-3x only (was 2x+)
            and not is_late_entry  # NEW: Not chasing
            and not extreme_volume
            and not high_risk
        ):
            return "BUY"

        # Watch: Has at least one strong predictor and not late
        elif (
            score >= 0.62
            and (signal.is_breakout or outperforming_market)
            and not high_risk
            and not is_late_entry
        ):
            return "WATCH"

        # Hold: Missing key predictors, high risk, or late entry
        else:
            return "HOLD"

    def _calculate_stop_loss(self, signal: ExplosionSignal) -> float:
        """
        Calculate recommended stop loss level.

        Penny stocks are highly volatile - the previous 15% max stop was too tight
        and resulted in 60% of trades hitting stop loss. Now using:
        - ATR-based calculation with 2.5x multiplier (up from 2.0x)
        - Minimum stop at 10% below entry (always have some protection)
        - Maximum stop at 25% below entry (allow room for volatility)
        """
        # ATR-based stop loss with wider multiplier for penny volatility
        atr_multiplier = 2.5
        stop_distance = signal.atr_20 * atr_multiplier
        atr_stop = signal.close_price - stop_distance

        # Define boundaries
        min_stop_price = signal.close_price * 0.90  # 10% max loss minimum
        max_stop_price = signal.close_price * 0.75  # 25% max loss maximum

        # Clamp the ATR-based stop within reasonable bounds
        # Stop should be between 75% and 90% of entry price
        stop_loss = max(max_stop_price, min(atr_stop, min_stop_price))

        return stop_loss

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
            current_time = datetime.now(UTC)
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
