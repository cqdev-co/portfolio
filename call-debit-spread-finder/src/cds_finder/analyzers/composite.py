"""Composite scoring engine."""

from typing import List
from loguru import logger

from ..models.analysis import (
    TechnicalAnalysis,
    FundamentalAnalysis,
    OptionsAnalysis,
    CallDebitSpreadOpportunity,
)
from ..models.signal import Signal
from .signal_correlation import SignalCorrelationAnalyzer


class CompositeScorer:
    """Composite scoring engine combining all factors."""
    
    def __init__(
        self,
        technical_weight: float = 0.30,
        options_weight: float = 0.30,
        signal_quality_weight: float = 0.25,
        fundamental_weight: float = 0.15,
    ):
        """
        Initialize composite scorer.
        
        Args:
            technical_weight: Weight for technical analysis (default: 0.30)
            options_weight: Weight for options metrics (default: 0.30)
            signal_quality_weight: Weight for signal quality (default: 0.25)
            fundamental_weight: Weight for fundamentals (default: 0.15)
        """
        self.technical_weight = technical_weight
        self.options_weight = options_weight
        self.signal_quality_weight = signal_quality_weight
        self.fundamental_weight = fundamental_weight
        
        # Validate weights sum to 1.0
        total = (
            technical_weight +
            options_weight +
            signal_quality_weight +
            fundamental_weight
        )
        if abs(total - 1.0) > 0.01:
            logger.warning(
                f"Weights sum to {total}, not 1.0. Normalizing..."
            )
            self.technical_weight /= total
            self.options_weight /= total
            self.signal_quality_weight /= total
            self.fundamental_weight /= total
    
    def calculate_composite_score(
        self,
        signal: Signal,
        technical: TechnicalAnalysis,
        fundamental: FundamentalAnalysis,
        options: OptionsAnalysis,
        correlation_bonus: float = 0.0,
    ) -> float:
        """
        Calculate composite score (0-100).
        
        Args:
            signal: Signal object
            technical: Technical analysis results
            fundamental: Fundamental analysis results
            options: Options analysis results
            correlation_bonus: Bonus from signal correlation (0-20)
            
        Returns:
            Composite score (0-100)
        """
        # Calculate signal quality score
        signal_quality_score = self._calculate_signal_quality_score(signal)
        
        # Weighted average
        composite_score = (
            technical.score * self.technical_weight +
            options.score * self.options_weight +
            signal_quality_score * self.signal_quality_weight +
            fundamental.score * self.fundamental_weight
        )
        
        # Add correlation bonus (up to 20 points)
        composite_score += min(20.0, correlation_bonus)
        
        return min(100.0, max(0.0, composite_score))
    
    def _calculate_signal_quality_score(self, signal: Signal) -> float:
        """
        Calculate signal quality score (0-100).
        
        Factors:
        - Grade: S=100, A=85, B=70, C=55
        - Premium Flow: Normalized 0-100
        - Volume Ratio: Normalized 0-100
        - Overall Score: Use signal's overall_score (0-1) -> 0-100
        - Confidence: Bonus if available
        - Detection Flags: Bonus for sweep, block trade, premium flow
        """
        score = 0.0
        
        # Grade (base score)
        grade_scores = {
            "S": 100,
            "A": 85,
            "B": 70,
            "C": 55,
            "D": 40,
            "F": 20,
        }
        base_score = grade_scores.get(signal.grade, 50)
        score = base_score
        
        # Premium Flow (normalize to 0-100, typical range: $0-$5M)
        if signal.premium_flow:
            premium_score = min(100, (signal.premium_flow / 5000000) * 100)
            # Weight: 30% of signal quality
            score = score * 0.7 + premium_score * 0.3
        
        # Volume Ratio (normalize to 0-100, typical range: 0-10x)
        if signal.volume_ratio:
            volume_score = min(100, signal.volume_ratio * 10)
            # Weight: 20% of signal quality
            score = score * 0.8 + volume_score * 0.2
        
        # Overall Score (from signal, 0-1 -> 0-100)
        overall_score_normalized = signal.overall_score * 100
        # Weight: 30% of signal quality
        score = score * 0.7 + overall_score_normalized * 0.3
        
        # Confidence bonus (if available)
        if signal.confidence:
            confidence_bonus = signal.confidence * 10  # 0-10 points
            score += confidence_bonus
        
        # Detection flags bonus
        bonus = 0
        if signal.has_sweep:
            bonus += 3
        if signal.has_block_trade:
            bonus += 3
        if signal.has_premium_flow:
            bonus += 2
        if signal.has_volume_anomaly:
            bonus += 2
        
        score += bonus
        
        # Risk level penalty
        if signal.risk_level == "EXTREME":
            score -= 10
        elif signal.risk_level == "HIGH":
            score -= 5
        
        return min(100.0, max(0.0, score))
    
    def get_confidence_level(self, composite_score: float) -> str:
        """
        Get confidence level from composite score.
        
        Args:
            composite_score: Composite score (0-100)
            
        Returns:
            Confidence level string
        """
        if composite_score >= 90:
            return "GOLDEN"
        elif composite_score >= 75:
            return "HIGH"
        elif composite_score >= 60:
            return "MODERATE"
        else:
            return "LOW"
    
    def get_recommendation(
        self,
        composite_score: float,
        confidence_level: str,
        options: OptionsAnalysis,
    ) -> str:
        """
        Get trading recommendation.
        
        Args:
            composite_score: Composite score
            confidence_level: Confidence level
            options: Options analysis
            
        Returns:
            Recommendation string
        """
        if confidence_level == "GOLDEN":
            return "STRONG BUY"
        elif confidence_level == "HIGH":
            if options.probability_of_profit >= 50 and options.risk_reward_ratio >= 2.0:
                return "BUY"
            else:
                return "CONSIDER"
        elif confidence_level == "MODERATE":
            return "CONSIDER"
        else:
            return "SKIP"
    
    def generate_warnings(
        self,
        signal: Signal,
        technical: TechnicalAnalysis,
        fundamental: FundamentalAnalysis,
        options: OptionsAnalysis,
    ) -> List[str]:
        """Generate warnings for the opportunity."""
        warnings = []
        
        # Technical warnings
        if technical.rsi > 70:
            warnings.append(f"RSI overbought ({technical.rsi:.1f})")
        elif technical.rsi < 30:
            warnings.append(f"RSI oversold ({technical.rsi:.1f})")
        
        if technical.trend == "BEARISH":
            warnings.append("Bearish trend detected")
        
        # Options warnings
        if options.probability_of_profit < 40:
            warnings.append(
                f"Low probability of profit ({options.probability_of_profit:.1f}%)"
            )
        
        if options.risk_reward_ratio < 1.5:
            warnings.append(
                f"Poor risk/reward ratio ({options.risk_reward_ratio:.2f}:1)"
            )
        
        if signal.days_to_expiry < 14:
            warnings.append(
                f"Short time to expiry ({signal.days_to_expiry} days)"
            )
        
        if options.iv_rank and options.iv_rank > 70:
            warnings.append(f"High IV rank ({options.iv_rank:.1f})")
        
        # Signal quality warnings
        if signal.risk_level in ["HIGH", "EXTREME"]:
            warnings.append(f"High risk level: {signal.risk_level}")
        
        return warnings
    
    def generate_reasons(
        self,
        signal: Signal,
        technical: TechnicalAnalysis,
        fundamental: FundamentalAnalysis,
        options: OptionsAnalysis,
        composite_score: float,
    ) -> List[str]:
        """Generate positive reasons for the opportunity."""
        reasons = []
        
        # Signal quality reasons
        if signal.grade in ["S", "A"]:
            reasons.append(f"High-grade signal ({signal.grade})")
        
        if signal.premium_flow > 500000:
            reasons.append(f"Strong premium flow (${signal.premium_flow/1000:.0f}K)")
        
        if signal.has_sweep:
            reasons.append("Sweep orders detected")
        
        if signal.has_block_trade:
            reasons.append("Block trades detected")
        
        # Technical reasons
        if technical.trend == "BULLISH":
            reasons.append("Bullish technical trend")
        
        if 40 <= technical.rsi <= 60:
            reasons.append(f"RSI in ideal range ({technical.rsi:.1f})")
        
        if technical.momentum_5d > 3:
            reasons.append(f"Strong momentum ({technical.momentum_5d:.1f}%)")
        
        # Options reasons
        if options.probability_of_profit >= 55:
            reasons.append(
                f"High probability of profit ({options.probability_of_profit:.1f}%)"
            )
        
        if options.risk_reward_ratio >= 2.5:
            reasons.append(
                f"Excellent risk/reward ({options.risk_reward_ratio:.2f}:1)"
            )
        
        if options.iv_rank and options.iv_rank < 40:
            reasons.append(f"Low IV rank ({options.iv_rank:.1f})")
        
        # Fundamental reasons
        if fundamental.has_upcoming_catalyst:
            reasons.append(
                f"Upcoming catalyst ({signal.days_to_earnings} days)"
            )
        
        if fundamental.pe_ratio and 10 <= fundamental.pe_ratio <= 25:
            reasons.append("Reasonable valuation")
        
        return reasons

