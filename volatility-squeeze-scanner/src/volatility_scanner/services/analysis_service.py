"""Analysis service for volatility squeeze detection and signal generation."""

import uuid
import asyncio
import numpy as np
import multiprocessing as mp
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from loguru import logger

from volatility_scanner.models.market_data import MarketData
from volatility_scanner.models.analysis import (
    SqueezeSignal,
    AnalysisResult,
    TrendDirection,
    SignalType,
)
from volatility_scanner.utils.technical_indicators import TechnicalIndicatorCalculator
from volatility_scanner.utils.helpers import safe_divide, calculate_true_range
from volatility_scanner.core.exceptions import AnalysisError
from volatility_scanner.config.settings import Settings


class AnalysisService:
    """Service for analyzing market data and detecting volatility squeezes."""
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the analysis service."""
        self.settings = settings
        self.indicator_calculator = TechnicalIndicatorCalculator(settings)
        
        # Initialize parallel processing capabilities
        cpu_count = mp.cpu_count()
        self.max_workers = min(cpu_count * 2, self.settings.analysis_concurrency)
        
        logger.info(f"Initialized analysis service with {self.max_workers} workers for parallel processing")
    
    async def analyze_symbol(
        self,
        market_data: MarketData,
        include_ai_analysis: bool = True
    ) -> Optional[AnalysisResult]:
        """
        Analyze a symbol for volatility squeeze signals.
        
        Args:
            market_data: MarketData with OHLCV and indicators
            include_ai_analysis: Whether to include AI analysis
            
        Returns:
            AnalysisResult if signal detected, None otherwise
            
        Raises:
            AnalysisError: If analysis fails
        """
        try:
            start_time = datetime.now()
            
            # Ensure indicators are calculated
            if not market_data.indicators:
                market_data = self.indicator_calculator.calculate_all_indicators(
                    market_data
                )
            
            # Get the latest data point for analysis
            if len(market_data.ohlcv_data) < 2:
                logger.warning(f"Insufficient data for {market_data.symbol}")
                return None
            
            latest_ohlcv = market_data.ohlcv_data[-1]
            previous_ohlcv = market_data.ohlcv_data[-2]
            
            # Find corresponding indicators
            latest_indicators = None
            previous_indicators = None
            
            for indicator in reversed(market_data.indicators):
                if indicator.timestamp <= latest_ohlcv.timestamp:
                    if latest_indicators is None:
                        latest_indicators = indicator
                    elif previous_indicators is None:
                        previous_indicators = indicator
                        break
            
            if not latest_indicators or not previous_indicators:
                logger.warning(
                    f"Missing indicators for {market_data.symbol}"
                )
                return None
            
            # Detect squeeze signal
            squeeze_signal = self._detect_squeeze_signal(
                market_data,
                latest_ohlcv,
                previous_ohlcv,
                latest_indicators,
                previous_indicators
            )
            
            # Only proceed if we have a valid signal
            if not self._is_signal_valid(squeeze_signal):
                return None
            
            # Calculate overall technical score
            technical_score = self._calculate_technical_score(squeeze_signal, latest_indicators)
            
            # Generate analysis result
            analysis_id = str(uuid.uuid4())
            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            analysis_result = AnalysisResult(
                analysis_id=analysis_id,
                symbol=market_data.symbol,
                timestamp=latest_ohlcv.timestamp,
                squeeze_signal=squeeze_signal,
                ai_analysis=None,  # Will be populated by AI service if requested
                overall_score=technical_score,
                recommendation=self._generate_recommendation(
                    squeeze_signal, 
                    technical_score
                ),
                stop_loss_level=self._calculate_stop_loss(
                    squeeze_signal,
                    latest_indicators
                ),
                position_size_pct=self._calculate_position_size(technical_score),
                analysis_duration_ms=duration_ms,
                data_quality_score=self._assess_data_quality(market_data),
                market_conditions=self._gather_market_conditions(
                    market_data,
                    squeeze_signal
                )
            )
            
            logger.info(
                f"Analysis completed for {market_data.symbol}: "
                f"Score={technical_score:.2f}, "
                f"Recommendation={analysis_result.recommendation}"
            )
            
            return analysis_result
            
        except Exception as e:
            error_msg = f"Analysis failed for {market_data.symbol}: {str(e)}"
            logger.error(error_msg)
            raise AnalysisError(error_msg) from e
    
    def _detect_squeeze_signal(
        self,
        market_data: MarketData,
        latest_ohlcv,
        previous_ohlcv,
        latest_indicators,
        previous_indicators
    ) -> SqueezeSignal:
        """Detect and create a squeeze signal."""
        
        # Calculate BB width percentile
        bb_widths = [
            ind.bb_width for ind in market_data.indicators 
            if ind.bb_width is not None
        ]
        
        bb_width_percentile = self.indicator_calculator.calculate_bb_width_percentile(
            bb_widths,
            latest_indicators.bb_width or 0.0
        )
        
        # Detect squeeze condition
        is_squeeze = self.indicator_calculator.detect_squeeze_condition(
            latest_indicators.bb_width or 0.0,
            bb_width_percentile
        )
        
        # Calculate true range
        true_range = calculate_true_range(
            latest_ohlcv.high,
            latest_ohlcv.low,
            previous_ohlcv.close
        )
        
        # Detect expansion condition
        is_expansion, bb_width_change, range_vs_atr = (
            self.indicator_calculator.detect_expansion_condition(
                latest_indicators.bb_width or 0.0,
                previous_indicators.bb_width or 0.0,
                true_range,
                latest_indicators.atr or 1.0
            )
        )
        
        # Determine trend direction
        trend_direction = TrendDirection(
            self.indicator_calculator.calculate_trend_direction(
                latest_indicators.ema_short or 0.0,
                latest_indicators.ema_long or 0.0
            )
        )
        
        # Calculate price context
        price_range_20d = market_data.get_price_range(20)
        price_vs_20d_high = safe_divide(
            latest_ohlcv.close - price_range_20d[1],
            price_range_20d[1]
        ) * 100
        
        price_vs_20d_low = safe_divide(
            latest_ohlcv.close - price_range_20d[0],
            price_range_20d[0]
        ) * 100
        
        # Calculate signal strength
        signal_strength = self._calculate_signal_strength(
            is_squeeze,
            is_expansion,
            bb_width_percentile,
            range_vs_atr,
            latest_indicators.volume_ratio or 1.0
        )
        
        return SqueezeSignal(
            timestamp=latest_ohlcv.timestamp,
            symbol=market_data.symbol,
            bb_width=latest_indicators.bb_width or 0.0,
            bb_width_percentile=bb_width_percentile,
            is_squeeze=is_squeeze,
            
            # Bollinger Bands
            bb_upper=latest_indicators.bb_upper,
            bb_middle=latest_indicators.bb_middle,
            bb_lower=latest_indicators.bb_lower,
            
            # Keltner Channels
            kc_upper=latest_indicators.kc_upper,
            kc_middle=latest_indicators.kc_middle,
            kc_lower=latest_indicators.kc_lower,
            
            bb_width_change=bb_width_change,
            is_expansion=is_expansion,
            true_range=true_range,
            atr_20=latest_indicators.atr or 0.0,
            range_vs_atr=range_vs_atr,
            trend_direction=trend_direction,
            ema_short=latest_indicators.ema_short or 0.0,
            ema_long=latest_indicators.ema_long or 0.0,
            volume=latest_ohlcv.volume,
            volume_ratio=latest_indicators.volume_ratio or 1.0,
            avg_volume=latest_indicators.volume_sma,
            
            # OHLC Price data
            open_price=latest_ohlcv.open,
            high_price=latest_ohlcv.high,
            low_price=latest_ohlcv.low,
            close_price=latest_ohlcv.close,
            price_vs_20d_high=price_vs_20d_high,
            price_vs_20d_low=price_vs_20d_low,
            signal_strength=signal_strength,
            
            # Technical indicators
            rsi=latest_indicators.rsi,
            macd=latest_indicators.macd,
            macd_signal=latest_indicators.macd_signal,
            adx=latest_indicators.adx,
            di_plus=latest_indicators.di_plus,
            di_minus=latest_indicators.di_minus
        )
    
    def _calculate_signal_strength(
        self,
        is_squeeze: bool,
        is_expansion: bool,
        bb_width_percentile: float,
        range_vs_atr: float,
        volume_ratio: float
    ) -> float:
        """Calculate overall signal strength score (0-1)."""
        
        score = 0.0
        
        # Squeeze condition (30% weight)
        if is_squeeze:
            squeeze_strength = max(0, (10 - bb_width_percentile) / 10)
            score += 0.3 * squeeze_strength
        
        # Expansion condition (25% weight)
        if is_expansion:
            score += 0.25
        
        # Range expansion strength (20% weight)
        range_strength = min(1.0, range_vs_atr / 2.0)  # Cap at 2x ATR
        score += 0.2 * range_strength
        
        # Volume confirmation (15% weight)
        volume_strength = min(1.0, volume_ratio / 2.0)  # Cap at 2x average
        score += 0.15 * volume_strength
        
        # Squeeze depth bonus (10% weight)
        if bb_width_percentile <= 5:
            score += 0.1  # Extra points for very tight squeeze
        
        return min(1.0, score)
    
    def _is_signal_valid(self, squeeze_signal: SqueezeSignal) -> bool:
        """Check if the signal meets minimum criteria."""
        
        # Must have either squeeze or expansion (relaxed criteria)
        if not (squeeze_signal.is_squeeze or squeeze_signal.is_expansion):
            return False
        
        # Lowered signal strength threshold for more signals
        if squeeze_signal.signal_strength < 0.2:
            return False
        
        # Volume should be reasonable (not zero)
        if squeeze_signal.volume <= 0:
            return False
            
        # Additional quality filters
        # Reject signals in extremely low volume conditions
        if squeeze_signal.volume_ratio < 0.1:
            return False
            
        # Reject signals with excessive volatility (potential data errors)
        if squeeze_signal.range_vs_atr > 5.0:
            return False
        
        return True
    
    def _calculate_technical_score(self, squeeze_signal: SqueezeSignal, latest_indicators) -> float:
        """Calculate overall technical analysis score with enhanced factors."""
        
        base_score = squeeze_signal.signal_strength
        
        # Enhanced trend alignment scoring
        if squeeze_signal.trend_direction == TrendDirection.BULLISH:
            base_score += 0.15  # Increased bullish bonus
        elif squeeze_signal.trend_direction == TrendDirection.BEARISH:
            base_score += 0.08  # Slightly increased bearish bonus
        
        # Enhanced volume confirmation
        if squeeze_signal.volume_ratio > 2.0:
            base_score += 0.15  # High volume confirmation
        elif squeeze_signal.volume_ratio > 1.5:
            base_score += 0.10  # Medium volume confirmation
        elif squeeze_signal.volume_ratio > 1.2:
            base_score += 0.05  # Low volume confirmation
        
        # Additional momentum confirmation using RSI and MACD
        if hasattr(latest_indicators, 'rsi') and latest_indicators.rsi is not None:
            rsi = latest_indicators.rsi
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                if 30 <= rsi <= 70:  # Not overbought, good for bullish signals
                    base_score += 0.06
                elif rsi < 30:  # Oversold, potential bounce
                    base_score += 0.10
            else:  # Bearish
                if 30 <= rsi <= 70:  # Not oversold, good for bearish signals
                    base_score += 0.04
                elif rsi > 70:  # Overbought, potential decline
                    base_score += 0.08
        
        # MACD confirmation
        if (hasattr(latest_indicators, 'macd') and latest_indicators.macd is not None and
            hasattr(latest_indicators, 'macd_signal') and latest_indicators.macd_signal is not None):
            macd_bullish = latest_indicators.macd > latest_indicators.macd_signal
            if squeeze_signal.trend_direction == TrendDirection.BULLISH and macd_bullish:
                base_score += 0.08  # MACD confirms bullish trend
            elif squeeze_signal.trend_direction == TrendDirection.BEARISH and not macd_bullish:
                base_score += 0.06  # MACD confirms bearish trend
        
        # Trend strength confirmation using ADX
        if hasattr(latest_indicators, 'adx') and latest_indicators.adx is not None:
            adx = latest_indicators.adx
            if adx > 25:  # Strong trend
                base_score += 0.08
            elif adx > 20:  # Moderate trend
                base_score += 0.04
        
        # Improved position scoring with momentum consideration
        if squeeze_signal.price_vs_20d_high > -3:  # Very near highs
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                base_score += 0.10  # Breakout potential
            else:
                base_score -= 0.05  # Resistance concern
        elif squeeze_signal.price_vs_20d_low < 3:  # Very near lows
            if squeeze_signal.trend_direction == TrendDirection.BEARISH:
                base_score -= 0.10  # Breakdown risk
            else:
                base_score += 0.05  # Bounce potential
        
        # Squeeze depth bonus (tighter squeeze = higher potential)
        if squeeze_signal.bb_width_percentile <= 2:
            base_score += 0.12  # Very tight squeeze
        elif squeeze_signal.bb_width_percentile <= 5:
            base_score += 0.08  # Tight squeeze
        elif squeeze_signal.bb_width_percentile <= 10:
            base_score += 0.04  # Moderate squeeze
        
        # Range expansion quality
        if squeeze_signal.is_expansion and squeeze_signal.range_vs_atr > 1.5:
            base_score += 0.08  # Strong expansion confirmation
        
        return min(1.0, max(0.0, base_score))
    
    def _generate_recommendation(
        self,
        squeeze_signal: SqueezeSignal,
        technical_score: float
    ) -> str:
        """Generate trading recommendation with enhanced logic."""
        
        # More aggressive thresholds for better signal generation
        if technical_score >= 0.75:
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                # Extra confirmation for bullish signals
                if squeeze_signal.volume_ratio > 1.3 and squeeze_signal.bb_width_percentile <= 5:
                    return "STRONG_BUY"
                return "BUY"
            elif squeeze_signal.trend_direction == TrendDirection.BEARISH:
                # More cautious with bearish signals
                if squeeze_signal.volume_ratio > 1.5 and squeeze_signal.price_vs_20d_low > 5:
                    return "SELL"
                return "WATCH"
            else:
                return "WATCH"
        elif technical_score >= 0.55:  # Lowered from 0.6
            if squeeze_signal.is_expansion and squeeze_signal.volume_ratio > 1.2:
                return "WATCH"
            return "WATCH"
        elif technical_score >= 0.35:  # New tier for marginal signals
            return "HOLD"
        else:
            return "PASS"
    
    def _calculate_stop_loss(
        self,
        squeeze_signal: SqueezeSignal,
        indicators
    ) -> Optional[float]:
        """Calculate adaptive stop loss level based on volatility and signal strength."""
        
        atr = indicators.atr or 0.0
        if atr <= 0:
            return None
        
        # Adaptive stop loss based on signal quality and market conditions
        base_multiplier = 1.5
        
        # Tighter stops for higher quality signals
        if squeeze_signal.signal_strength > 0.7:
            base_multiplier = 1.2  # Tighter stop for strong signals
        elif squeeze_signal.signal_strength < 0.4:
            base_multiplier = 2.0   # Wider stop for weak signals
        
        # Adjust for volatility environment
        if squeeze_signal.bb_width_percentile <= 5:
            base_multiplier *= 0.8  # Tighter in low vol
        elif squeeze_signal.bb_width_percentile >= 80:
            base_multiplier *= 1.3  # Wider in high vol
        
        # Volume-based adjustment
        if squeeze_signal.volume_ratio > 2.0:
            base_multiplier *= 0.9  # Tighter with high volume confirmation
        
        stop_distance = atr * base_multiplier
        
        if squeeze_signal.trend_direction == TrendDirection.BULLISH:
            return squeeze_signal.close_price - stop_distance
        else:
            return squeeze_signal.close_price + stop_distance
    
    def _calculate_position_size(self, technical_score: float) -> float:
        """Calculate dynamic position size based on signal strength and risk."""
        
        # More aggressive position sizing for better returns
        if technical_score >= 0.85:
            return 0.08  # 8% for exceptional signals
        elif technical_score >= 0.75:
            return 0.06  # 6% for strong signals
        elif technical_score >= 0.65:
            return 0.04  # 4% for good signals
        elif technical_score >= 0.50:
            return 0.03  # 3% for moderate signals
        elif technical_score >= 0.35:
            return 0.02  # 2% for weak signals
        else:
            return 0.01  # 1% for very weak signals
    
    def _assess_data_quality(self, market_data: MarketData) -> float:
        """Assess the quality of the underlying data."""
        
        score = 1.0
        
        # Check data completeness
        if len(market_data.ohlcv_data) < 100:
            score -= 0.2
        
        # Check for missing indicators
        indicators_with_data = [
            ind for ind in market_data.indicators 
            if ind.bb_width is not None
        ]
        
        if len(indicators_with_data) < len(market_data.indicators) * 0.8:
            score -= 0.3
        
        # Check for recent data
        latest_timestamp = market_data.ohlcv_data[-1].timestamp
        if latest_timestamp.tzinfo is not None:
            # Convert to naive datetime for comparison
            latest_timestamp = latest_timestamp.replace(tzinfo=None)
        
        latest_data_age = (
            datetime.now() - latest_timestamp
        ).days
        
        if latest_data_age > 1:
            score -= 0.2
        
        return max(0.0, score)
    
    def _detect_market_regime(self, market_data: MarketData) -> Dict[str, Any]:
        """Detect current market regime to adapt strategy accordingly."""
        
        # Get recent price data for regime analysis
        recent_prices = [ohlcv.close for ohlcv in market_data.ohlcv_data[-60:]]  # Last 60 days
        
        if len(recent_prices) < 20:
            return {"regime": "unknown", "confidence": 0.0}
        
        # Calculate trend strength over different periods
        short_trend = (recent_prices[-1] - recent_prices[-10]) / recent_prices[-10] if len(recent_prices) >= 10 else 0
        medium_trend = (recent_prices[-1] - recent_prices[-20]) / recent_prices[-20] if len(recent_prices) >= 20 else 0
        long_trend = (recent_prices[-1] - recent_prices[-40]) / recent_prices[-40] if len(recent_prices) >= 40 else 0
        
        # Calculate volatility regime
        recent_returns = [(recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1] 
                         for i in range(1, len(recent_prices))]
        volatility = np.std(recent_returns) * np.sqrt(252)  # Annualized volatility
        
        # Determine regime
        regime_score = (short_trend * 0.5 + medium_trend * 0.3 + long_trend * 0.2)
        
        if regime_score > 0.05 and volatility < 0.25:
            regime = "bull_low_vol"
            confidence = min(0.9, abs(regime_score) * 10)
        elif regime_score > 0.02 and volatility >= 0.25:
            regime = "bull_high_vol"
            confidence = min(0.8, abs(regime_score) * 8)
        elif regime_score < -0.05 and volatility < 0.25:
            regime = "bear_low_vol"
            confidence = min(0.9, abs(regime_score) * 10)
        elif regime_score < -0.02 and volatility >= 0.25:
            regime = "bear_high_vol"
            confidence = min(0.8, abs(regime_score) * 8)
        elif volatility > 0.35:
            regime = "high_volatility"
            confidence = min(0.7, volatility * 2)
        else:
            regime = "sideways"
            confidence = 0.6
        
        return {
            "regime": regime,
            "confidence": confidence,
            "trend_score": regime_score,
            "volatility": volatility,
            "short_trend": short_trend,
            "medium_trend": medium_trend,
            "long_trend": long_trend
        }
    
    def _gather_market_conditions(
        self,
        market_data: MarketData,
        squeeze_signal: SqueezeSignal
    ) -> Dict[str, Any]:
        """Gather additional market context with regime detection."""
        
        market_regime = self._detect_market_regime(market_data)
        
        return {
            'symbol_info': {
                'name': market_data.name,
                'sector': market_data.sector,
                'market_cap': market_data.market_cap,
            },
            'price_context': {
                'current_price': squeeze_signal.close_price,
                '20d_high_distance_pct': squeeze_signal.price_vs_20d_high,
                '20d_low_distance_pct': squeeze_signal.price_vs_20d_low,
            },
            'volatility_context': {
                'bb_width_percentile': squeeze_signal.bb_width_percentile,
                'atr_20': squeeze_signal.atr_20,
                'range_vs_atr': squeeze_signal.range_vs_atr,
            },
            'trend_context': {
                'trend_direction': squeeze_signal.trend_direction.value,
                'ema_short': squeeze_signal.ema_short,
                'ema_long': squeeze_signal.ema_long,
            },
            'volume_context': {
                'current_volume': squeeze_signal.volume,
                'volume_ratio': squeeze_signal.volume_ratio,
            },
            'market_regime': market_regime
        }
    
    # Parallel Processing Methods
    
    async def analyze_symbols_parallel(
        self,
        symbol_data: Dict[str, MarketData],
        min_score: float = 0.5,
        include_ai_analysis: bool = False,
        use_process_pool: bool = False
    ) -> List[AnalysisResult]:
        """
        Analyze multiple symbols in parallel using thread/process pools.
        
        Args:
            symbol_data: Dictionary of symbol -> MarketData
            min_score: Minimum score threshold for results
            include_ai_analysis: Whether to include AI analysis
            use_process_pool: Use process pool instead of thread pool
            
        Returns:
            List of analysis results above threshold
        """
        if not symbol_data:
            return []
        
        logger.info(f"Analyzing {len(symbol_data)} symbols in parallel (workers: {self.max_workers})")
        
        # Prepare analysis tasks
        analysis_tasks = [
            (symbol, market_data, min_score, include_ai_analysis)
            for symbol, market_data in symbol_data.items()
        ]
        
        results = []
        
        if use_process_pool and len(symbol_data) > 100:
            # Use process pool for CPU-intensive work on large datasets
            results = await self._analyze_with_process_pool(analysis_tasks)
        else:
            # Use thread pool for I/O bound work or smaller datasets
            results = await self._analyze_with_thread_pool(analysis_tasks)
        
        # Filter results by score
        filtered_results = [
            result for result in results 
            if result is not None and result.overall_score >= min_score
        ]
        
        logger.info(f"Analysis complete: {len(filtered_results)}/{len(symbol_data)} symbols above threshold {min_score}")
        return filtered_results
    
    async def _analyze_with_thread_pool(
        self, 
        analysis_tasks: List[Tuple]
    ) -> List[Optional[AnalysisResult]]:
        """Analyze symbols using thread pool executor."""
        
        def analyze_single(task_data):
            """Single symbol analysis function for thread pool."""
            symbol, market_data, min_score, include_ai_analysis = task_data
            
            try:
                # Create a new analysis service instance for thread safety
                analysis_service = AnalysisService(self.settings)
                
                # Run the analysis (this is async, but we'll handle it)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    result = loop.run_until_complete(
                        analysis_service.analyze_symbol(
                            market_data,
                            include_ai_analysis=include_ai_analysis
                        )
                    )
                    return result
                finally:
                    loop.close()
                    
            except Exception as e:
                logger.debug(f"Analysis failed for {symbol}: {e}")
                return None
        
        # Execute in thread pool
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            tasks = [
                loop.run_in_executor(executor, analyze_single, task_data)
                for task_data in analysis_tasks
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions
            clean_results = []
            for result in results:
                if isinstance(result, Exception):
                    logger.debug(f"Thread pool task failed: {result}")
                    clean_results.append(None)
                else:
                    clean_results.append(result)
            
            return clean_results
    
    async def _analyze_with_process_pool(
        self, 
        analysis_tasks: List[Tuple]
    ) -> List[Optional[AnalysisResult]]:
        """Analyze symbols using process pool executor."""
        
        logger.info("Using process pool for large dataset analysis")
        
        def analyze_single_process(task_data):
            """Single symbol analysis function for process pool."""
            try:
                symbol, market_data, min_score, include_ai_analysis = task_data
                
                # Import here to avoid issues with multiprocessing
                import asyncio
                from volatility_scanner.services.analysis_service import AnalysisService
                from volatility_scanner.config.settings import get_settings
                
                settings = get_settings()
                analysis_service = AnalysisService(settings)
                
                # Run analysis
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    result = loop.run_until_complete(
                        analysis_service.analyze_symbol(
                            market_data,
                            include_ai_analysis=False  # Disable AI for process pool
                        )
                    )
                    return result
                finally:
                    loop.close()
                    
            except Exception as e:
                return None
        
        # Execute in process pool
        loop = asyncio.get_event_loop()
        with ProcessPoolExecutor(max_workers=min(self.max_workers, 4)) as executor:
            tasks = [
                loop.run_in_executor(executor, analyze_single_process, task_data)
                for task_data in analysis_tasks
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions
            clean_results = []
            for result in results:
                if isinstance(result, Exception):
                    logger.debug(f"Process pool task failed: {result}")
                    clean_results.append(None)
                else:
                    clean_results.append(result)
            
            return clean_results
    
    async def analyze_symbols_streaming(
        self,
        symbol_data: Dict[str, MarketData],
        min_score: float = 0.5,
        batch_size: int = 50,
        callback: Optional[callable] = None
    ) -> List[AnalysisResult]:
        """
        Analyze symbols in streaming batches for real-time progress updates.
        
        Args:
            symbol_data: Dictionary of symbol -> MarketData
            min_score: Minimum score threshold
            batch_size: Size of each processing batch
            callback: Optional callback for progress updates
            
        Returns:
            List of analysis results above threshold
        """
        if not symbol_data:
            return []
        
        all_results = []
        symbols = list(symbol_data.keys())
        total_batches = (len(symbols) + batch_size - 1) // batch_size
        
        logger.info(f"Streaming analysis: {len(symbols)} symbols in {total_batches} batches")
        
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i:i + batch_size]
            batch_data = {symbol: symbol_data[symbol] for symbol in batch_symbols}
            batch_num = i // batch_size + 1
            
            logger.debug(f"Processing batch {batch_num}/{total_batches}")
            
            # Analyze batch
            batch_results = await self.analyze_symbols_parallel(
                batch_data,
                min_score=min_score,
                include_ai_analysis=False
            )
            
            all_results.extend(batch_results)
            
            # Call progress callback if provided
            if callback:
                try:
                    callback(batch_num, total_batches, len(batch_results), len(all_results))
                except Exception as e:
                    logger.warning(f"Callback error: {e}")
        
        return all_results
    
    def get_performance_stats(self) -> Dict[str, any]:
        """Get performance statistics."""
        return {
            "max_workers": self.max_workers,
            "cpu_count": mp.cpu_count(),
            "analysis_concurrency": self.settings.analysis_concurrency,
            "bulk_scan_batch_size": self.settings.bulk_scan_batch_size,
            "bulk_scan_concurrency": self.settings.bulk_scan_concurrency
        }
