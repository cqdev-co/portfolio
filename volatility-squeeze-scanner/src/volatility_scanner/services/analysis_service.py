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
    OpportunityRank,
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
            
            # Apply enhanced expansion confirmation rules
            if squeeze_signal.is_expansion:
                # Enhanced expansion confirmation: require volume above average and price positioning
                expansion_confirmed = (
                    squeeze_signal.volume_ratio >= 1.0 and  # Above average volume
                    squeeze_signal.bb_width_change > 0 and   # BB widening (already checked in expansion detection)
                    self._check_bb_price_positioning(squeeze_signal, latest_indicators)  # Price outside BB middle
                )
                
                # If expansion not confirmed, mark as non-expansion
                if not expansion_confirmed:
                    squeeze_signal.is_expansion = False
            
            # Only proceed if we have a valid signal
            if not self._is_signal_valid(squeeze_signal):
                return None
            
            # Calculate overall technical score
            technical_score = self._calculate_technical_score(squeeze_signal, latest_indicators)
            
            # Calculate opportunity ranking
            opportunity_rank = self._calculate_opportunity_rank(squeeze_signal, technical_score)
            
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
                opportunity_rank=opportunity_rank,
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
        
        # Calculate BB width percentile with detailed analytics
        bb_widths = [
            ind.bb_width for ind in market_data.indicators 
            if ind.bb_width is not None
        ]
        
        # Log raw BB width data analytics
        self._log_bb_width_analytics(market_data.symbol, bb_widths, latest_indicators.bb_width)
        
        bb_width_percentile = self.indicator_calculator.calculate_bb_width_percentile(
            bb_widths,
            latest_indicators.bb_width or 0.0
        )
        
        # Log percentile calculation details
        self._log_percentile_calculation_details(
            market_data.symbol, bb_widths, latest_indicators.bb_width, bb_width_percentile
        )
        
        # Detect squeeze condition
        is_squeeze = self.indicator_calculator.detect_squeeze_condition(
            latest_indicators.bb_width or 0.0,
            bb_width_percentile
        )
        
        # Log detailed squeeze threshold analysis
        self._log_squeeze_threshold_analysis(
            market_data.symbol, latest_indicators.bb_width, bb_width_percentile, is_squeeze
        )
        
        # Professional false positive detection and logging
        false_positive_flags = self._detect_false_positive_patterns(
            market_data, latest_indicators, bb_width_percentile, is_squeeze
        )
        
        # Log squeeze detection with detailed data analytics
        if is_squeeze:
            confidence_level = self._calculate_squeeze_confidence(
                bb_width_percentile, latest_indicators, market_data
            )
            
            logger.info(
                f"🎯 {market_data.symbol}: SQUEEZE DETECTED | "
                f"BB Width: {latest_indicators.bb_width:.6f} ({bb_width_percentile:.2f}%ile) | "
                f"Threshold: ≤{self.settings.squeeze_percentile:.1f}% | "
                f"Margin: {self.settings.squeeze_percentile - bb_width_percentile:.2f}% | "
                f"Confidence: {confidence_level:.1f}%"
            )
            
            # Log false positive warnings with data context
            if false_positive_flags:
                warning_msg = ", ".join(false_positive_flags)
                logger.warning(
                    f"⚠️  {market_data.symbol}: DATA QUALITY CONCERNS - {warning_msg}"
                )
        else:
            margin_to_threshold = bb_width_percentile - self.settings.squeeze_percentile
            logger.debug(
                f"❌ {market_data.symbol}: No squeeze - "
                f"BB width: {latest_indicators.bb_width:.6f} ({bb_width_percentile:.2f}%ile) | "
                f"Threshold: ≤{self.settings.squeeze_percentile:.1f}% | "
                f"Miss by: +{margin_to_threshold:.2f}%"
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
        
        # Log detailed expansion calculation analytics
        self._log_expansion_calculation_details(
            market_data.symbol, latest_indicators.bb_width, previous_indicators.bb_width,
            bb_width_change, true_range, latest_indicators.atr, range_vs_atr, is_expansion
        )
        
        # Professional expansion analysis with volatility context
        expansion_quality = self._assess_expansion_quality(
            bb_width_change, range_vs_atr, latest_indicators, market_data
        )
        
        if is_expansion:
            logger.info(
                f"📈 {market_data.symbol}: EXPANSION DETECTED | "
                f"Current BB: {latest_indicators.bb_width:.6f} | Previous BB: {previous_indicators.bb_width:.6f} | "
                f"Change: {bb_width_change:+.2f}% (≥{self.settings.expansion_threshold:.1f}%) | "
                f"True Range: {true_range:.4f} | ATR: {latest_indicators.atr:.4f} | "
                f"Range/ATR: {range_vs_atr:.3f}x"
            )
            
            # Log expansion quality assessment
            logger.info(
                f"📊 {market_data.symbol}: EXPANSION QUALITY | "
                f"Grade: {expansion_quality['grade']} | Score: {expansion_quality['score']:.3f} | "
                f"Volume: {expansion_quality['volume_context']} ({latest_indicators.volume_ratio:.2f}x)"
            )
            
            # Log expansion quality concerns with data
            if expansion_quality['warnings']:
                warnings_msg = ", ".join(expansion_quality['warnings'])
                logger.warning(
                    f"⚠️  {market_data.symbol}: EXPANSION DATA CONCERNS - {warnings_msg}"
                )
        elif bb_width_change > 5:  # Log any notable width changes
            expansion_margin = self.settings.expansion_threshold - bb_width_change
            logger.debug(
                f"📊 {market_data.symbol}: BB Width Change Analysis | "
                f"Change: {bb_width_change:+.2f}% | Threshold: ≥{self.settings.expansion_threshold:.1f}% | "
                f"Miss by: {expansion_margin:.2f}% | Range/ATR: {range_vs_atr:.3f}x"
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
        
        # Log detailed volume and trend analytics
        self._log_volume_and_trend_analytics(
            market_data.symbol, latest_ohlcv, latest_indicators, trend_direction
        )
        
        # Professional signal quality assessment with detailed metrics
        if is_squeeze or is_expansion:
            # Log signal strength calculation breakdown
            self._log_signal_strength_breakdown(
                market_data.symbol, is_squeeze, is_expansion, bb_width_percentile, 
                range_vs_atr, latest_indicators.volume_ratio, signal_strength
            )
            
            risk_assessment = self._calculate_comprehensive_risk_assessment(
                market_data, latest_indicators, signal_strength, trend_direction
            )
            
            logger.info(
                f"⚡ {market_data.symbol}: COMPREHENSIVE SIGNAL METRICS | "
                f"Strength: {signal_strength:.4f} | Risk Score: {risk_assessment['risk_score']:.3f} | "
                f"Trend: {trend_direction.value} | ADX: {latest_indicators.adx:.1f} | "
                f"RSI: {latest_indicators.rsi:.1f} | Liquidity: {risk_assessment['liquidity_grade']}"
            )
            
            # Log detailed risk factors with data
            if risk_assessment['risk_factors']:
                risk_msg = ", ".join(risk_assessment['risk_factors'])
                logger.warning(
                    f"🚨 {market_data.symbol}: QUANTIFIED RISK FACTORS - {risk_msg}"
                )
                
            # Log positive confluence factors with data
            if risk_assessment['confluence_factors']:
                confluence_msg = ", ".join(risk_assessment['confluence_factors'])
                logger.info(
                    f"✨ {market_data.symbol}: QUANTIFIED CONFLUENCE - {confluence_msg}"
                )
        
        # Calculate liquidity metrics
        dollar_volume = latest_ohlcv.close * latest_ohlcv.volume
        
        # Calculate average dollar volume over last 20 days
        recent_ohlcv = market_data.ohlcv_data[-20:] if len(market_data.ohlcv_data) >= 20 else market_data.ohlcv_data
        daily_dollar_volumes = [ohlcv.close * ohlcv.volume for ohlcv in recent_ohlcv]
        avg_dollar_volume = sum(daily_dollar_volumes) / len(daily_dollar_volumes) if daily_dollar_volumes else None
        
        volume_anomaly = self._calculate_volume_anomaly(market_data)
        
        signal = SqueezeSignal(
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
            
            # Liquidity metrics
            dollar_volume=dollar_volume,
            avg_dollar_volume=avg_dollar_volume,
            
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
            di_minus=latest_indicators.di_minus,
            volume_anomaly=volume_anomaly
        )
        
        # Professional signal validation and final assessment
        validation_result = self._validate_signal_comprehensively(
            signal, market_data, false_positive_flags
        )
        
        if is_squeeze or is_expansion or signal_strength > 0.6:
            logger.info(
                f"✅ {market_data.symbol}: SIGNAL CREATED | "
                f"Score: {signal_strength:.3f} | Price: ${latest_ohlcv.close:.2f} | "
                f"Volume: ${dollar_volume/1e6:.1f}M | "
                f"Validation: {validation_result['grade']} ({validation_result['confidence']:.1f}%)"
            )
            
            # Log signal actionability assessment
            if validation_result['actionable']:
                logger.info(
                    f"🎯 {market_data.symbol}: ACTIONABLE SIGNAL - "
                    f"Expected R/R: {validation_result['risk_reward']:.1f}:1 | "
                    f"Stop: ${validation_result['stop_loss']:.2f} | "
                    f"Target: ${validation_result['profit_target']:.2f}"
                )
            else:
                logger.warning(
                    f"⚠️  {market_data.symbol}: NON-ACTIONABLE - {validation_result['reason']}"
                )
        
        # Log historical context for pattern recognition
        self._log_historical_performance_context(market_data.symbol, signal)
        
        # Log final signal data analytics summary
        self._log_final_signal_analytics(market_data.symbol, signal, dollar_volume, avg_dollar_volume)
        
        return signal
    
    def _detect_false_positive_patterns(
        self, 
        market_data: MarketData, 
        indicators, 
        bb_percentile: float, 
        is_squeeze: bool
    ) -> List[str]:
        """Detect common false positive patterns in squeeze signals."""
        flags = []
        
        # Data quality issues
        if market_data.data_quality_score < 0.8:
            flags.append(f"Low data quality ({market_data.data_quality_score:.2f})")
            
        # Insufficient historical data
        if len(market_data.ohlcv_data) < 120:  # Less than ~6 months
            flags.append(f"Limited history ({len(market_data.ohlcv_data)} days)")
            
        # Extreme low volume (potential manipulation)
        if (indicators.volume_ratio or 1.0) < 0.3:
            flags.append(f"Extremely low volume ({indicators.volume_ratio:.2f}x)")
            
        # Penny stock risks
        latest_price = market_data.ohlcv_data[-1].close
        if latest_price < 5.0:
            flags.append(f"Low price stock (${latest_price:.2f})")
            
        # Excessive volatility (potential data errors)
        if (indicators.atr or 0) / latest_price > 0.15:  # ATR > 15% of price
            atr_pct = ((indicators.atr or 0) / latest_price) * 100
            flags.append(f"Excessive volatility ({atr_pct:.1f}% ATR)")
            
        # Artificial squeeze from lack of trading
        recent_volumes = [ohlcv.volume for ohlcv in market_data.ohlcv_data[-10:]]
        avg_recent_volume = sum(recent_volumes) / len(recent_volumes)
        if avg_recent_volume < 10000:  # Very low absolute volume
            flags.append(f"Minimal trading activity ({avg_recent_volume:.0f} avg volume)")
            
        # Potential delisting candidate
        if latest_price < 1.0 and avg_recent_volume < 50000:
            flags.append("Potential delisting risk")
            
        # Squeeze too tight (potential data error)
        if is_squeeze and bb_percentile < 1.0:
            flags.append(f"Unusually tight squeeze ({bb_percentile:.1f}%ile)")
            
        # Missing key indicators
        if not indicators.adx or indicators.adx < 10:
            flags.append("Weak trend strength (ADX < 10)")
            
        return flags
    
    def _calculate_squeeze_confidence(
        self, 
        bb_percentile: float, 
        indicators, 
        market_data: MarketData
    ) -> float:
        """Calculate confidence level for squeeze detection."""
        confidence = 100.0
        
        # Reduce confidence for edge cases
        if bb_percentile > 8:
            confidence -= (bb_percentile - 8) * 5  # -5% per percentile above 8
            
        if market_data.data_quality_score < 0.9:
            confidence -= (0.9 - market_data.data_quality_score) * 100
            
        if (indicators.volume_ratio or 1.0) < 0.8:
            confidence -= (0.8 - (indicators.volume_ratio or 1.0)) * 50
            
        if len(market_data.ohlcv_data) < 180:
            confidence -= (180 - len(market_data.ohlcv_data)) / 180 * 20
            
        return max(0, min(100, confidence))
    
    def _assess_expansion_quality(
        self, 
        bb_change: float, 
        range_vs_atr: float, 
        indicators, 
        market_data: MarketData
    ) -> Dict[str, Any]:
        """Assess the quality of an expansion signal."""
        score = 0.0
        warnings = []
        
        # BB width change scoring
        if bb_change > 30:
            score += 0.4
        elif bb_change > 20:
            score += 0.3
        elif bb_change > 15:
            score += 0.2
        else:
            warnings.append(f"Modest expansion ({bb_change:.1f}%)")
            
        # Range vs ATR scoring
        if range_vs_atr > 2.0:
            score += 0.3
        elif range_vs_atr > 1.5:
            score += 0.2
        elif range_vs_atr < 1.2:
            warnings.append(f"Low range/ATR ({range_vs_atr:.2f}x)")
            
        # Volume confirmation
        volume_ratio = indicators.volume_ratio or 1.0
        volume_context = "exceptional" if volume_ratio > 3.0 else "high" if volume_ratio > 2.0 else "elevated" if volume_ratio > 1.5 else "normal" if volume_ratio > 0.8 else "low"
        
        if volume_ratio > 2.0:
            score += 0.3
        elif volume_ratio > 1.5:
            score += 0.2
        elif volume_ratio < 0.8:
            warnings.append(f"Low volume confirmation ({volume_ratio:.2f}x)")
            score -= 0.1
            
        # Grade the expansion
        if score >= 0.8:
            grade = "A+"
        elif score >= 0.6:
            grade = "A"
        elif score >= 0.4:
            grade = "B"
        elif score >= 0.2:
            grade = "C"
        else:
            grade = "D"
            
        return {
            'score': score,
            'grade': grade,
            'warnings': warnings,
            'volume_context': volume_context
        }
    
    def _calculate_comprehensive_risk_assessment(
        self, 
        market_data: MarketData, 
        indicators, 
        signal_strength: float, 
        trend_direction
    ) -> Dict[str, Any]:
        """Calculate comprehensive risk assessment for the signal."""
        risk_factors = []
        confluence_factors = []
        risk_score = 0.0
        
        latest_price = market_data.ohlcv_data[-1].close
        dollar_volume = latest_price * market_data.ohlcv_data[-1].volume
        
        # Price risk assessment
        if latest_price < 3.0:
            risk_factors.append(f"Low price (${latest_price:.2f})")
            risk_score += 0.3
        elif latest_price < 10.0:
            risk_score += 0.1
            
        # Liquidity assessment
        if dollar_volume < 500000:  # < $500K daily volume
            liquidity_grade = "F"
            risk_factors.append(f"Poor liquidity (${dollar_volume/1e3:.0f}K)")
            risk_score += 0.4
        elif dollar_volume < 2000000:  # < $2M daily volume
            liquidity_grade = "D"
            risk_factors.append("Low liquidity")
            risk_score += 0.2
        elif dollar_volume < 10000000:  # < $10M daily volume
            liquidity_grade = "C"
        elif dollar_volume < 50000000:  # < $50M daily volume
            liquidity_grade = "B"
        else:
            liquidity_grade = "A"
            confluence_factors.append("High liquidity")
            
        # Market cap estimation and tier
        estimated_market_cap = latest_price * 100000000  # Rough estimate
        if estimated_market_cap < 300000000:  # < $300M
            market_cap_tier = "Small Cap"
            risk_score += 0.2
        elif estimated_market_cap < 2000000000:  # < $2B
            market_cap_tier = "Mid Cap"
            risk_score += 0.1
        else:
            market_cap_tier = "Large Cap"
            confluence_factors.append("Large cap stability")
            
        # Volume trend analysis
        volume_ratio = indicators.volume_ratio or 1.0
        if volume_ratio > 3.0:
            confluence_factors.append(f"Exceptional volume ({volume_ratio:.1f}x)")
        elif volume_ratio < 0.5:
            risk_factors.append(f"Weak volume ({volume_ratio:.1f}x)")
            risk_score += 0.2
            
        # Volatility risk
        if indicators.atr and latest_price > 0:
            atr_pct = (indicators.atr / latest_price) * 100
            if atr_pct > 10:
                risk_factors.append(f"High volatility ({atr_pct:.1f}%)")
                risk_score += 0.2
            elif atr_pct < 2:
                risk_factors.append(f"Unusually low volatility ({atr_pct:.1f}%)")
                risk_score += 0.1
                
        # Trend strength assessment
        if indicators.adx:
            if indicators.adx > 25:
                confluence_factors.append(f"Strong trend (ADX {indicators.adx:.0f})")
            elif indicators.adx < 15:
                risk_factors.append(f"Weak trend (ADX {indicators.adx:.0f})")
                risk_score += 0.1
                
        return {
            'risk_score': min(1.0, risk_score),
            'risk_factors': risk_factors,
            'confluence_factors': confluence_factors,
            'liquidity_grade': liquidity_grade,
            'market_cap_tier': market_cap_tier
        }
    
    def _validate_signal_comprehensively(
        self, 
        signal, 
        market_data: MarketData, 
        false_positive_flags: List[str]
    ) -> Dict[str, Any]:
        """Comprehensive signal validation with actionability assessment."""
        latest_price = market_data.ohlcv_data[-1].close
        
        # Calculate confidence based on multiple factors
        base_confidence = 70.0
        
        # Adjust for false positive flags
        base_confidence -= len(false_positive_flags) * 10
        
        # Adjust for signal strength
        base_confidence += (signal.signal_strength - 0.5) * 40
        
        # Adjust for data quality
        base_confidence += (market_data.data_quality_score - 0.8) * 50
        
        confidence = max(0, min(100, base_confidence))
        
        # Grade the signal
        if confidence >= 85:
            grade = "EXCELLENT"
        elif confidence >= 70:
            grade = "GOOD"
        elif confidence >= 55:
            grade = "FAIR"
        elif confidence >= 40:
            grade = "POOR"
        else:
            grade = "REJECT"
            
        # Actionability assessment
        actionable = (
            confidence >= 60 and
            signal.signal_strength >= 0.4 and
            latest_price >= 3.0 and
            len(false_positive_flags) <= 2
        )
        
        reason = "Signal meets actionability criteria"
        if not actionable:
            if confidence < 60:
                reason = f"Low confidence ({confidence:.1f}%)"
            elif signal.signal_strength < 0.4:
                reason = f"Weak signal strength ({signal.signal_strength:.2f})"
            elif latest_price < 3.0:
                reason = f"Price too low (${latest_price:.2f})"
            elif len(false_positive_flags) > 2:
                reason = f"Too many risk flags ({len(false_positive_flags)})"
                
        # Risk/reward calculation
        risk_reward = 2.0  # Default
        stop_loss = latest_price * 0.95  # 5% stop
        profit_target = latest_price * 1.10  # 10% target
        
        return {
            'confidence': confidence,
            'grade': grade,
            'actionable': actionable,
            'reason': reason,
            'risk_reward': risk_reward,
            'stop_loss': stop_loss,
            'profit_target': profit_target
        }
    
    def _log_historical_performance_context(
        self, 
        symbol: str, 
        signal
    ) -> None:
        """Log historical performance context for pattern recognition."""
        # This would ideally query historical performance data
        # For now, log the signal characteristics for future analysis
        logger.debug(
            f"📊 {symbol}: PATTERN CONTEXT | "
            f"BB %ile: {signal.bb_width_percentile:.1f} | "
            f"Volume Ratio: {signal.volume_ratio:.2f} | "
            f"Trend: {signal.trend_direction.value} | "
            f"Strength: {signal.signal_strength:.3f}"
        )
    
    def _log_bb_width_analytics(self, symbol: str, bb_widths: List[float], current_bb_width: float) -> None:
        """Log detailed Bollinger Band width analytics for transparency."""
        if not bb_widths:
            logger.warning(f"📊 {symbol}: BB WIDTH DATA MISSING - No historical BB width data available")
            return
            
        # Statistical analysis of BB widths
        bb_array = np.array(bb_widths)
        stats = {
            'count': len(bb_widths),
            'min': float(np.min(bb_array)),
            'max': float(np.max(bb_array)),
            'mean': float(np.mean(bb_array)),
            'median': float(np.median(bb_array)),
            'std': float(np.std(bb_array)),
            'q25': float(np.percentile(bb_array, 25)),
            'q75': float(np.percentile(bb_array, 75))
        }
        
        logger.debug(
            f"📊 {symbol}: BB WIDTH ANALYTICS | "
            f"Current: {current_bb_width:.6f} | "
            f"Historical: N={stats['count']} | "
            f"Range: [{stats['min']:.6f}, {stats['max']:.6f}] | "
            f"Mean: {stats['mean']:.6f} | Median: {stats['median']:.6f} | "
            f"Std: {stats['std']:.6f} | IQR: [{stats['q25']:.6f}, {stats['q75']:.6f}]"
        )
        
        # Flag potential data anomalies
        if current_bb_width < stats['min'] * 0.5:
            logger.warning(f"⚠️  {symbol}: BB WIDTH ANOMALY - Current width {current_bb_width:.6f} is extremely low vs historical min {stats['min']:.6f}")
        elif current_bb_width > stats['max'] * 2.0:
            logger.warning(f"⚠️  {symbol}: BB WIDTH ANOMALY - Current width {current_bb_width:.6f} is extremely high vs historical max {stats['max']:.6f}")
    
    def _log_percentile_calculation_details(self, symbol: str, bb_widths: List[float], current_bb_width: float, percentile: float) -> None:
        """Log exact percentile calculation for audit purposes."""
        if not bb_widths:
            return
            
        # Manual percentile calculation for transparency
        bb_array = np.array(bb_widths)
        values_below = np.sum(bb_array <= current_bb_width)
        total_values = len(bb_array)
        calculated_percentile = (values_below / total_values) * 100
        
        # Find nearest values for context
        sorted_widths = np.sort(bb_array)
        current_rank = np.searchsorted(sorted_widths, current_bb_width)
        
        logger.debug(
            f"📊 {symbol}: PERCENTILE CALCULATION | "
            f"Current BB: {current_bb_width:.6f} | "
            f"Values ≤ Current: {values_below}/{total_values} | "
            f"Calculated %ile: {calculated_percentile:.2f}% | "
            f"Returned %ile: {percentile:.2f}% | "
            f"Rank: {current_rank}/{total_values}"
        )
        
        # Show surrounding values for context
        if len(sorted_widths) >= 3:
            context_start = max(0, current_rank - 2)
            context_end = min(len(sorted_widths), current_rank + 3)
            context_values = sorted_widths[context_start:context_end]
            logger.debug(
                f"📊 {symbol}: BB WIDTH CONTEXT | "
                f"Surrounding values: {[f'{v:.6f}' for v in context_values]} | "
                f"Position: {current_rank - context_start}"
            )
    
    def _log_squeeze_threshold_analysis(self, symbol: str, bb_width: float, percentile: float, is_squeeze: bool) -> None:
        """Log detailed squeeze threshold analysis."""
        threshold = self.settings.squeeze_percentile
        margin = threshold - percentile if is_squeeze else percentile - threshold
        
        logger.debug(
            f"🎯 {symbol}: SQUEEZE THRESHOLD ANALYSIS | "
            f"BB Width: {bb_width:.6f} | Percentile: {percentile:.3f}% | "
            f"Threshold: ≤{threshold:.1f}% | "
            f"{'PASS' if is_squeeze else 'FAIL'} | "
            f"Margin: {'−' if is_squeeze else '+'}{margin:.3f}%"
        )
        
        # Log squeeze strength classification
        if is_squeeze:
            if percentile <= 2.0:
                strength = "EXTREME"
            elif percentile <= 5.0:
                strength = "VERY_STRONG"
            elif percentile <= 8.0:
                strength = "STRONG"
            else:
                strength = "MODERATE"
            
            logger.debug(f"🎯 {symbol}: SQUEEZE STRENGTH - {strength} ({percentile:.2f}%ile)")
    
    def _log_expansion_calculation_details(
        self, symbol: str, current_bb: float, previous_bb: float, 
        bb_change: float, true_range: float, atr: float, range_vs_atr: float, is_expansion: bool
    ) -> None:
        """Log detailed expansion calculation analytics."""
        threshold = self.settings.expansion_threshold
        
        logger.debug(
            f"📈 {symbol}: EXPANSION CALCULATION DETAILS | "
            f"Previous BB: {previous_bb:.6f} | Current BB: {current_bb:.6f} | "
            f"Raw Change: {current_bb - previous_bb:+.6f} | "
            f"Percentage Change: {bb_change:+.3f}% | "
            f"Threshold: ≥{threshold:.1f}% | "
            f"{'PASS' if is_expansion else 'FAIL'}"
        )
        
        logger.debug(
            f"📈 {symbol}: VOLATILITY CONTEXT | "
            f"True Range: {true_range:.4f} | "
            f"ATR(20): {atr:.4f} | "
            f"Range/ATR Ratio: {range_vs_atr:.3f}x | "
            f"Volatility: {'HIGH' if range_vs_atr > 2.0 else 'ELEVATED' if range_vs_atr > 1.5 else 'NORMAL'}"
        )
    
    def _log_volume_and_trend_analytics(
        self, symbol: str, latest_ohlcv, latest_indicators, trend_direction
    ) -> None:
        """Log detailed volume and trend analytics."""
        volume_ratio = latest_indicators.volume_ratio or 1.0
        
        logger.debug(
            f"📊 {symbol}: VOLUME ANALYTICS | "
            f"Current Volume: {latest_ohlcv.volume:,} | "
            f"Average Volume: {latest_indicators.volume_sma:,.0f} | "
            f"Volume Ratio: {volume_ratio:.3f}x | "
            f"Dollar Volume: ${(latest_ohlcv.close * latest_ohlcv.volume):,.0f}"
        )
        
        # Trend strength analytics
        logger.debug(
            f"📊 {symbol}: TREND ANALYTICS | "
            f"Direction: {trend_direction.value} | "
            f"EMA Short: {latest_indicators.ema_short:.4f} | "
            f"EMA Long: {latest_indicators.ema_long:.4f} | "
            f"EMA Spread: {(latest_indicators.ema_short - latest_indicators.ema_long):+.4f} | "
            f"ADX: {latest_indicators.adx:.1f} | "
            f"RSI: {latest_indicators.rsi:.1f}"
        )
        
        # MACD analytics
        if latest_indicators.macd is not None and latest_indicators.macd_signal is not None:
            macd_histogram = latest_indicators.macd - latest_indicators.macd_signal
            logger.debug(
                f"📊 {symbol}: MACD ANALYTICS | "
                f"MACD: {latest_indicators.macd:.4f} | "
                f"Signal: {latest_indicators.macd_signal:.4f} | "
                f"Histogram: {macd_histogram:+.4f} | "
                f"Momentum: {'BULLISH' if macd_histogram > 0 else 'BEARISH'}"
            )
    
    def _log_signal_strength_breakdown(
        self, symbol: str, is_squeeze: bool, is_expansion: bool, 
        bb_percentile: float, range_vs_atr: float, volume_ratio: float, final_strength: float
    ) -> None:
        """Log detailed signal strength calculation breakdown."""
        
        # Calculate individual components (matching the actual calculation)
        squeeze_component = 0.0
        if is_squeeze:
            squeeze_strength = max(0, (10 - bb_percentile) / 10)
            squeeze_component = 0.3 * squeeze_strength
        
        expansion_component = 0.0
        if is_expansion:
            expansion_strength = min(1.0, range_vs_atr / 2.0)
            expansion_component = 0.25 * expansion_strength
        
        # Volume component
        volume_component = 0.0
        if volume_ratio > 2.0:
            volume_component = 0.2
        elif volume_ratio > 1.5:
            volume_component = 0.15
        elif volume_ratio > 1.2:
            volume_component = 0.1
        elif volume_ratio < 0.8:
            volume_component = -0.1
        
        # Volatility component
        volatility_component = 0.0
        if range_vs_atr > 1.5:
            volatility_component = 0.15
        elif range_vs_atr > 1.2:
            volatility_component = 0.1
        
        logger.debug(
            f"⚡ {symbol}: SIGNAL STRENGTH BREAKDOWN | "
            f"Squeeze: {squeeze_component:.3f} ({squeeze_component/final_strength*100 if final_strength > 0 else 0:.1f}%) | "
            f"Expansion: {expansion_component:.3f} ({expansion_component/final_strength*100 if final_strength > 0 else 0:.1f}%) | "
            f"Volume: {volume_component:.3f} ({volume_component/final_strength*100 if final_strength > 0 else 0:.1f}%) | "
            f"Volatility: {volatility_component:.3f} ({volatility_component/final_strength*100 if final_strength > 0 else 0:.1f}%) | "
            f"Total: {final_strength:.3f}"
        )
    
    def _log_final_signal_analytics(
        self, symbol: str, signal, dollar_volume: float, avg_dollar_volume: float
    ) -> None:
        """Log comprehensive final signal analytics."""
        
        logger.debug(
            f"✅ {symbol}: FINAL SIGNAL ANALYTICS | "
            f"Timestamp: {signal.timestamp} | "
            f"Price: ${signal.close_price:.4f} | "
            f"Signal Strength: {signal.signal_strength:.4f} | "
            f"BB Width: {signal.bb_width:.6f} ({signal.bb_width_percentile:.2f}%ile)"
        )
        
        logger.debug(
            f"✅ {symbol}: LIQUIDITY ANALYTICS | "
            f"Current Volume: {signal.volume:,} | "
            f"Dollar Volume: ${dollar_volume:,.0f} | "
            f"Avg Dollar Volume: ${avg_dollar_volume:,.0f} | "
            f"Liquidity Ratio: {dollar_volume/avg_dollar_volume if avg_dollar_volume > 0 else 0:.2f}x"
        )
        
        # Technical indicator summary
        logger.debug(
            f"✅ {symbol}: TECHNICAL SUMMARY | "
            f"BB Bands: [{signal.bb_lower:.4f}, {signal.bb_middle:.4f}, {signal.bb_upper:.4f}] | "
            f"KC Bands: [{signal.kc_lower:.4f}, {signal.kc_middle:.4f}, {signal.kc_upper:.4f}] | "
            f"ATR: {signal.atr_20:.4f} | True Range: {signal.true_range:.4f}"
        )
    
    def _log_comprehensive_signal_strength_analytics(
        self, is_squeeze: bool, is_expansion: bool, bb_percentile: float, 
        range_vs_atr: float, volume_ratio: float, final_score: float
    ) -> None:
        """Log comprehensive signal strength calculation analytics."""
        
        # This provides the detailed breakdown that was mentioned in the original logging
        components = []
        
        if is_squeeze:
            squeeze_strength = max(0, (10 - bb_percentile) / 10)
            squeeze_contrib = 0.3 * squeeze_strength
            components.append(f"Squeeze: {squeeze_contrib:.3f} (BB %ile: {bb_percentile:.1f})")
        
        if is_expansion:
            expansion_strength = min(1.0, range_vs_atr / 2.0)
            expansion_contrib = 0.25 * expansion_strength
            components.append(f"Expansion: {expansion_contrib:.3f} (Range/ATR: {range_vs_atr:.2f}x)")
        
        # Volume analysis
        if volume_ratio > 2.0:
            volume_contrib = 0.2
        elif volume_ratio > 1.5:
            volume_contrib = 0.15
        elif volume_ratio > 1.2:
            volume_contrib = 0.1
        elif volume_ratio < 0.8:
            volume_contrib = -0.1
        else:
            volume_contrib = 0.0
        
        if volume_contrib != 0:
            components.append(f"Volume: {volume_contrib:+.3f} (Ratio: {volume_ratio:.2f}x)")
        
        # Volatility bonus
        if range_vs_atr > 1.5:
            vol_contrib = 0.15
            components.append(f"Volatility: +{vol_contrib:.3f} (High range)")
        elif range_vs_atr > 1.2:
            vol_contrib = 0.1
            components.append(f"Volatility: +{vol_contrib:.3f} (Elevated range)")
        
        component_summary = " | ".join(components) if components else "No components"
        
        logger.debug(
            f"⚡ SIGNAL STRENGTH CALCULATION AUDIT | "
            f"{component_summary} | Final Score: {final_score:.3f}"
        )
    
    def _calculate_signal_strength(
        self,
        is_squeeze: bool,
        is_expansion: bool,
        bb_width_percentile: float,
        range_vs_atr: float,
        volume_ratio: float
    ) -> float:
        """Calculate overall signal strength score (0-1) with enhanced weighting."""
        
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
        
        final_score = min(1.0, score)
        
        # Log detailed scoring breakdown for transparency
        logger.debug(
            f"SIGNAL STRENGTH CALCULATION | "
            f"Squeeze: {0.3 * squeeze_strength if is_squeeze else 0:.3f} | "
            f"Expansion: {0.25 if is_expansion else 0:.3f} | "
            f"Volume: {0.15 * volume_strength:.3f} | "
            f"Range: {0.2 * range_strength:.3f} | "
            f"Final: {final_score:.3f}"
        )
        
        # Log comprehensive signal strength analytics
        self._log_comprehensive_signal_strength_analytics(
            is_squeeze, is_expansion, bb_width_percentile, range_vs_atr, 
            volume_ratio, final_score
        )
        
        return final_score
    
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
        """
        Calculate overall technical analysis score with balanced factors.
        
        Score Components:
        - Signal Strength (60% base): Core squeeze detection quality
        - Trend Alignment (5-8%): Bullish/bearish trend confirmation
        - Volume (3-8%): Volume confirmation levels
        - RSI (2-5%): Momentum confirmation
        - MACD (3-4%): Trend momentum confirmation  
        - ADX (2-4%): Trend strength confirmation
        - Position (2-5%): Price relative to recent highs/lows
        - Squeeze Depth (2-6%): Tighter squeezes get bonus
        - Expansion (4%): Range expansion confirmation
        
        Maximum theoretical score: ~1.0 (balanced to avoid score inflation)
        """
        
        # Start with signal strength as the foundation (60% weight)
        base_score = squeeze_signal.signal_strength * 0.6
        
        # Trend alignment scoring (reduced bonuses for better distribution)
        if squeeze_signal.trend_direction == TrendDirection.BULLISH:
            base_score += 0.08  # Reduced from 0.15
        elif squeeze_signal.trend_direction == TrendDirection.BEARISH:
            base_score += 0.05  # Reduced from 0.08
        
        # Volume confirmation (reduced bonuses)
        if squeeze_signal.volume_ratio > 2.0:
            base_score += 0.08  # High volume confirmation (reduced from 0.15)
        elif squeeze_signal.volume_ratio > 1.5:
            base_score += 0.06  # Medium volume confirmation (reduced from 0.10)
        elif squeeze_signal.volume_ratio > 1.2:
            base_score += 0.03  # Low volume confirmation (reduced from 0.05)
        
        # RSI momentum confirmation (reduced bonuses)
        if hasattr(latest_indicators, 'rsi') and latest_indicators.rsi is not None:
            rsi = latest_indicators.rsi
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                if 30 <= rsi <= 70:  # Not overbought, good for bullish signals
                    base_score += 0.03  # Reduced from 0.06
                elif rsi < 30:  # Oversold, potential bounce
                    base_score += 0.05  # Reduced from 0.10
            else:  # Bearish
                if 30 <= rsi <= 70:  # Not oversold, good for bearish signals
                    base_score += 0.02  # Reduced from 0.04
                elif rsi > 70:  # Overbought, potential decline
                    base_score += 0.04  # Reduced from 0.08
        
        # MACD confirmation (reduced bonuses)
        if (hasattr(latest_indicators, 'macd') and latest_indicators.macd is not None and
            hasattr(latest_indicators, 'macd_signal') and latest_indicators.macd_signal is not None):
            macd_bullish = latest_indicators.macd > latest_indicators.macd_signal
            if squeeze_signal.trend_direction == TrendDirection.BULLISH and macd_bullish:
                base_score += 0.04  # MACD confirms bullish trend (reduced from 0.08)
            elif squeeze_signal.trend_direction == TrendDirection.BEARISH and not macd_bullish:
                base_score += 0.03  # MACD confirms bearish trend (reduced from 0.06)
        
        # Enhanced DI/ADX confluence: promote signals with DI+ ≥ DI− and ADX rising; demote otherwise
        if (hasattr(latest_indicators, 'adx') and latest_indicators.adx is not None and
            hasattr(latest_indicators, 'di_plus') and latest_indicators.di_plus is not None and
            hasattr(latest_indicators, 'di_minus') and latest_indicators.di_minus is not None):
            
            adx = latest_indicators.adx
            di_plus = latest_indicators.di_plus
            di_minus = latest_indicators.di_minus
            
            # DI confluence check
            di_bullish = di_plus > di_minus
            di_bearish = di_minus > di_plus
            
            # Promote signals with proper DI/trend alignment
            if squeeze_signal.trend_direction == TrendDirection.BULLISH and di_bullish:
                if adx > 25:  # Strong trending environment
                    base_score += 0.06  # Enhanced bonus for aligned signals
                elif adx > 20:  # Moderate trending
                    base_score += 0.04
            elif squeeze_signal.trend_direction == TrendDirection.BEARISH and di_bearish:
                if adx > 25:  # Strong trending environment
                    base_score += 0.05  # Slightly lower bonus for bearish
                elif adx > 20:  # Moderate trending
                    base_score += 0.03
            else:
                # Demote signals with conflicting DI/trend direction
                if adx > 20:  # Only penalize if there's actual trend strength
                    base_score -= 0.03  # Penalty for misaligned signals
            
            # Additional ADX strength bonus (reduced from original)
            if adx > 25:  # Strong trend
                base_score += 0.02  # Base strength bonus
            elif adx > 20:  # Moderate trend
                base_score += 0.01  # Small strength bonus
        
        # Position scoring (reduced bonuses/penalties)
        if squeeze_signal.price_vs_20d_high > -3:  # Very near highs
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                base_score += 0.05  # Breakout potential (reduced from 0.10)
            else:
                base_score -= 0.02  # Resistance concern (reduced from 0.05)
        elif squeeze_signal.price_vs_20d_low < 3:  # Very near lows
            if squeeze_signal.trend_direction == TrendDirection.BEARISH:
                base_score -= 0.05  # Breakdown risk (reduced from 0.10)
            else:
                base_score += 0.03  # Bounce potential (reduced from 0.05)
        
        # Squeeze depth bonus (reduced bonuses for better distribution)
        if squeeze_signal.bb_width_percentile <= 2:
            base_score += 0.06  # Very tight squeeze (reduced from 0.12)
        elif squeeze_signal.bb_width_percentile <= 5:
            base_score += 0.04  # Tight squeeze (reduced from 0.08)
        elif squeeze_signal.bb_width_percentile <= 10:
            base_score += 0.02  # Moderate squeeze (reduced from 0.04)
        
        # Range expansion quality (reduced bonus)
        if squeeze_signal.is_expansion and squeeze_signal.range_vs_atr > 1.5:
            base_score += 0.04  # Strong expansion confirmation (reduced from 0.08)
        
        return min(1.0, max(0.0, base_score))
    
    def _calculate_opportunity_rank(
        self,
        squeeze_signal: SqueezeSignal,
        technical_score: float
    ) -> OpportunityRank:
        """
        Calculate opportunity ranking based on multiple factors.
        
        Ranking Criteria:
        S-Tier: Score ≥0.90 + Premium conditions (tight squeeze, strong volume, etc.)
        A-Tier: Score ≥0.80 + Strong conditions
        B-Tier: Score ≥0.70 + Good conditions  
        C-Tier: Score ≥0.60 + Acceptable conditions
        D-Tier: Score <0.60 or poor conditions
        """
        
        # Base tier from technical score
        if technical_score >= 0.90:
            base_tier = OpportunityRank.S_TIER
        elif technical_score >= 0.80:
            base_tier = OpportunityRank.A_TIER
        elif technical_score >= 0.70:
            base_tier = OpportunityRank.B_TIER
        elif technical_score >= 0.60:
            base_tier = OpportunityRank.C_TIER
        else:
            base_tier = OpportunityRank.D_TIER
        
        # Premium condition checks for tier upgrades
        premium_conditions = 0
        strong_conditions = 0
        
        # Ultra-tight squeeze (most important factor)
        if squeeze_signal.bb_width_percentile <= 2:
            premium_conditions += 2  # Extra weight for ultra-tight
        elif squeeze_signal.bb_width_percentile <= 5:
            premium_conditions += 1
        elif squeeze_signal.bb_width_percentile <= 10:
            strong_conditions += 1
        
        # Exceptional volume confirmation
        if squeeze_signal.volume_ratio >= 3.0:
            premium_conditions += 1
        elif squeeze_signal.volume_ratio >= 2.0:
            strong_conditions += 1
        elif squeeze_signal.volume_ratio >= 1.5:
            strong_conditions += 1
        
        # Strong trend alignment
        if squeeze_signal.trend_direction == TrendDirection.BULLISH:
            strong_conditions += 1
        elif squeeze_signal.trend_direction == TrendDirection.BEARISH:
            strong_conditions += 1  # Bearish signals also valuable
        
        # High signal strength
        if squeeze_signal.signal_strength >= 0.8:
            premium_conditions += 1
        elif squeeze_signal.signal_strength >= 0.7:
            strong_conditions += 1
        
        # Expansion confirmation
        if squeeze_signal.is_expansion and squeeze_signal.range_vs_atr > 1.5:
            strong_conditions += 1
        
        # Apply tier adjustments based on conditions
        final_tier = base_tier
        
        # Upgrade logic
        if premium_conditions >= 3:  # Exceptional conditions
            if base_tier == OpportunityRank.A_TIER:
                final_tier = OpportunityRank.S_TIER
            elif base_tier == OpportunityRank.B_TIER:
                final_tier = OpportunityRank.A_TIER
        elif premium_conditions >= 2 or strong_conditions >= 4:  # Strong conditions
            if base_tier == OpportunityRank.B_TIER:
                final_tier = OpportunityRank.A_TIER
            elif base_tier == OpportunityRank.C_TIER:
                final_tier = OpportunityRank.B_TIER
        elif strong_conditions >= 2:  # Good conditions
            if base_tier == OpportunityRank.C_TIER:
                final_tier = OpportunityRank.B_TIER
            elif base_tier == OpportunityRank.D_TIER:
                final_tier = OpportunityRank.C_TIER
        
        # Downgrade for poor conditions
        poor_conditions = 0
        
        # Very wide squeeze (low priority)
        if squeeze_signal.bb_width_percentile >= 80:
            poor_conditions += 1
        
        # Low volume
        if squeeze_signal.volume_ratio < 0.8:
            poor_conditions += 2
        
        # Very weak signal strength
        if squeeze_signal.signal_strength < 0.3:
            poor_conditions += 1
        
        # Apply downgrades
        if poor_conditions >= 2:
            tier_values = list(OpportunityRank)
            current_index = tier_values.index(final_tier)
            if current_index < len(tier_values) - 1:
                final_tier = tier_values[current_index + 1]
        
        return final_tier
    
    def _generate_recommendation(
        self,
        squeeze_signal: SqueezeSignal,
        technical_score: float
    ) -> str:
        """Generate trading recommendation with enhanced logic including RSI regime filters."""
        
        # Gap/high volatility day handling: downgrade if range_vs_atr > 3 (noisy/impulsive days)
        if squeeze_signal.range_vs_atr > 3.0:
            # High volatility day - downgrade to WATCH or require next-day confirmation
            if technical_score >= 0.75:
                return "WATCH"  # Downgrade from potential BUY/STRONG_BUY to avoid false breaks
        
        # RSI regime filter: auto-downgrade oversold/overbought conditions
        if squeeze_signal.rsi is not None:
            # Oversold condition (RSI < 30): downgrade to WATCH unless exceptional confluence
            if squeeze_signal.rsi < 30:
                # Only allow BUY/STRONG_BUY if we have exceptional volume and DI+ confirmation
                exceptional_confluence = (
                    squeeze_signal.volume_ratio > 2.0 and
                    squeeze_signal.di_plus is not None and
                    squeeze_signal.di_minus is not None and
                    squeeze_signal.di_plus > squeeze_signal.di_minus and
                    squeeze_signal.bb_width_percentile <= 5
                )
                if not exceptional_confluence and technical_score >= 0.75:
                    return "WATCH"  # Downgrade from potential BUY/STRONG_BUY
            
            # Overbought condition (RSI > 80): prevent STRONG_BUY, prefer WATCH
            elif squeeze_signal.rsi > 80:
                if technical_score >= 0.75:
                    return "WATCH"  # Avoid buying blow-offs
        
        # Standard recommendation logic with RSI filters applied
        if technical_score >= 0.75:
            if squeeze_signal.trend_direction == TrendDirection.BULLISH:
                # Extra confirmation for bullish signals
                if squeeze_signal.volume_ratio > 1.3 and squeeze_signal.bb_width_percentile <= 5:
                    # Check RSI isn't too overbought for STRONG_BUY
                    if squeeze_signal.rsi is None or squeeze_signal.rsi <= 75:
                        return "STRONG_BUY"
                    else:
                        return "BUY"
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
    
    def _check_bb_price_positioning(self, squeeze_signal: SqueezeSignal, indicators) -> bool:
        """Check if price is positioned outside BB middle for expansion confirmation."""
        if not indicators.bb_middle:
            return True  # Default to true if BB middle not available
        
        # Price should be outside BB middle band for valid expansion
        price_distance_from_middle = abs(squeeze_signal.close_price - indicators.bb_middle)
        bb_middle_threshold = indicators.bb_middle * 0.005  # 0.5% threshold
        
        return price_distance_from_middle > bb_middle_threshold
    
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

    def _calculate_volume_anomaly(self, market_data: MarketData, periods: int = 20) -> float:
        volumes = [ohlcv.volume for ohlcv in market_data.ohlcv_data[-periods:]]
        if len(volumes) < 2:
            return 0.0
        mean_vol = np.mean(volumes)
        std_vol = np.std(volumes)
        current_vol = market_data.ohlcv_data[-1].volume
        z_score = (current_vol - mean_vol) / std_vol if std_vol > 0 else 0.0
        return z_score
