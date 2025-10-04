"""Mathematical scoring algorithms for ticker opportunity ranking."""

import statistics
from decimal import Decimal
from typing import Dict, List, Optional

from loguru import logger

from rds_ticker_analysis.models.analysis import (
    OpportunityGrade,
    OpportunityScore,
    RiskAssessment,
    RiskLevel,
    SignalStrength,
)
from rds_ticker_analysis.models.base import RedditMetrics
from rds_ticker_analysis.models.market import MarketData, TechnicalIndicators
from rds_ticker_analysis.models.sentiment import SentimentAnalysis, SentimentLabel


class ScoringService:
    """
    Mathematical scoring service for ticker opportunity ranking.
    
    Features:
    - Multi-factor scoring algorithm
    - Weighted component scores
    - Risk-adjusted scoring
    - Grade classification
    - Confidence assessment
    - Customizable scoring weights
    """
    
    def __init__(
        self,
        sentiment_weight: float = 0.25,
        volume_weight: float = 0.20,
        quality_weight: float = 0.20,
        momentum_weight: float = 0.15,
        technical_weight: float = 0.15,
        fundamental_weight: float = 0.05,
    ) -> None:
        """
        Initialize the scoring service with component weights.
        
        Args:
            sentiment_weight: Weight for sentiment score
            volume_weight: Weight for volume/activity score
            quality_weight: Weight for content quality score
            momentum_weight: Weight for momentum score
            technical_weight: Weight for technical analysis score
            fundamental_weight: Weight for fundamental analysis score
        """
        # Validate weights sum to 1.0
        total_weight = (
            sentiment_weight + volume_weight + quality_weight +
            momentum_weight + technical_weight + fundamental_weight
        )
        
        if abs(total_weight - 1.0) > 0.01:
            msg = f"Weights must sum to 1.0, got {total_weight}"
            raise ValueError(msg)
        
        self.weights = {
            'sentiment': sentiment_weight,
            'volume': volume_weight,
            'quality': quality_weight,
            'momentum': momentum_weight,
            'technical': technical_weight,
            'fundamental': fundamental_weight,
        }
        
        logger.info(f"Initialized ScoringService with weights: {self.weights}")
    
    def calculate_opportunity_score(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
        market_data: Optional[MarketData] = None,
        volatility_squeeze_data: Optional[Dict] = None,
    ) -> OpportunityScore:
        """
        Calculate comprehensive opportunity score for a ticker.
        
        Args:
            sentiment_analyses: List of sentiment analysis results
            reddit_metrics: Aggregated Reddit metrics
            market_data: Current market data
            volatility_squeeze_data: Optional volatility squeeze signal data
            
        Returns:
            OpportunityScore with detailed breakdown
        """
        # Calculate component scores
        sentiment_score = self._calculate_sentiment_score(sentiment_analyses)
        volume_score = self._calculate_volume_score(reddit_metrics)
        quality_score = self._calculate_quality_score(sentiment_analyses, reddit_metrics)
        momentum_score = self._calculate_momentum_score(reddit_metrics)
        technical_score = self._calculate_technical_score(market_data, volatility_squeeze_data)
        fundamental_score = self._calculate_fundamental_score(market_data)
        
        # Calculate composite scores
        reddit_composite = (
            sentiment_score * 0.4 +
            volume_score * 0.3 +
            quality_score * 0.2 +
            momentum_score * 0.1
        )
        
        market_composite = (
            technical_score * 0.8 +
            fundamental_score * 0.2
        )
        
        # Calculate overall score using configured weights
        overall_score = (
            sentiment_score * self.weights['sentiment'] +
            volume_score * self.weights['volume'] +
            quality_score * self.weights['quality'] +
            momentum_score * self.weights['momentum'] +
            technical_score * self.weights['technical'] +
            fundamental_score * self.weights['fundamental']
        )
        
        # Determine grade and signal strength
        opportunity_grade = self._determine_grade(overall_score)
        signal_strength = self._determine_signal_strength(overall_score, reddit_composite)
        
        # Calculate confidence and reliability
        score_confidence = self._calculate_score_confidence(
            sentiment_analyses, reddit_metrics, market_data
        )
        data_reliability = self._calculate_data_reliability(
            sentiment_analyses, reddit_metrics, market_data
        )
        
        return OpportunityScore(
            sentiment_score=Decimal(str(round(sentiment_score, 4))),
            volume_score=Decimal(str(round(volume_score, 4))),
            quality_score=Decimal(str(round(quality_score, 4))),
            momentum_score=Decimal(str(round(momentum_score, 4))),
            technical_score=Decimal(str(round(technical_score, 4))),
            fundamental_score=Decimal(str(round(fundamental_score, 4))),
            reddit_composite_score=Decimal(str(round(reddit_composite, 4))),
            market_composite_score=Decimal(str(round(market_composite, 4))),
            overall_score=Decimal(str(round(overall_score, 4))),
            opportunity_grade=opportunity_grade,
            signal_strength=signal_strength,
            score_confidence=Decimal(str(round(score_confidence, 4))),
            data_reliability=Decimal(str(round(data_reliability, 4))),
            weights={k: Decimal(str(v)) for k, v in self.weights.items()},
        )
    
    def calculate_risk_assessment(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
        market_data: Optional[MarketData] = None,
        opportunity_score: Optional[OpportunityScore] = None,
    ) -> RiskAssessment:
        """
        Calculate comprehensive risk assessment.
        
        Args:
            sentiment_analyses: List of sentiment analysis results
            reddit_metrics: Aggregated Reddit metrics
            market_data: Current market data
            opportunity_score: Calculated opportunity score
            
        Returns:
            RiskAssessment with detailed risk analysis
        """
        # Calculate individual risk components
        market_risk = self._calculate_market_risk(market_data)
        liquidity_risk = self._calculate_liquidity_risk(market_data, reddit_metrics)
        volatility_risk = self._calculate_volatility_risk(market_data)
        sentiment_risk = self._calculate_sentiment_risk(sentiment_analyses, reddit_metrics)
        manipulation_risk = self._calculate_manipulation_risk(sentiment_analyses, reddit_metrics)
        
        # Calculate overall risk score
        overall_risk = (
            market_risk * 0.25 +
            liquidity_risk * 0.20 +
            volatility_risk * 0.20 +
            sentiment_risk * 0.20 +
            manipulation_risk * 0.15
        )
        
        # Determine risk level
        risk_level = self._determine_risk_level(overall_risk)
        
        # Generate risk factors and mitigation suggestions
        risk_factors = self._identify_key_risk_factors(
            market_risk, liquidity_risk, volatility_risk, sentiment_risk, manipulation_risk
        )
        mitigation_suggestions = self._generate_mitigation_suggestions(risk_factors)
        
        # Calculate position sizing recommendations
        max_position_size = self._calculate_max_position_size(overall_risk)
        stop_loss_pct = self._calculate_stop_loss_percentage(volatility_risk, market_data)
        
        # Calculate risk-adjusted score
        risk_adjusted_score = 0.0
        if opportunity_score:
            risk_adjusted_score = float(opportunity_score.overall_score) * (1.0 - overall_risk * 0.5)
        
        # Estimate Sharpe ratio (simplified)
        sharpe_estimate = self._estimate_sharpe_ratio(market_data, overall_risk)
        
        return RiskAssessment(
            market_risk=Decimal(str(round(market_risk, 4))),
            liquidity_risk=Decimal(str(round(liquidity_risk, 4))),
            volatility_risk=Decimal(str(round(volatility_risk, 4))),
            sentiment_risk=Decimal(str(round(sentiment_risk, 4))),
            manipulation_risk=Decimal(str(round(manipulation_risk, 4))),
            overall_risk_score=Decimal(str(round(overall_risk, 4))),
            risk_level=risk_level,
            key_risk_factors=risk_factors,
            risk_mitigation_suggestions=mitigation_suggestions,
            max_position_size_pct=Decimal(str(round(max_position_size, 2))),
            recommended_stop_loss_pct=Decimal(str(round(stop_loss_pct, 2))),
            risk_adjusted_score=Decimal(str(round(risk_adjusted_score, 4))),
            sharpe_estimate=Decimal(str(round(sharpe_estimate, 3))) if sharpe_estimate else None,
        )
    
    def _calculate_sentiment_score(self, sentiment_analyses: List[SentimentAnalysis]) -> float:
        """Calculate sentiment component score."""
        if not sentiment_analyses:
            return 0.0
        
        # Weight sentiments by confidence and quality
        weighted_sentiments = []
        sentiment_values = {
            SentimentLabel.VERY_BULLISH: 1.0,
            SentimentLabel.BULLISH: 0.75,
            SentimentLabel.SLIGHTLY_BULLISH: 0.55,
            SentimentLabel.NEUTRAL: 0.5,
            SentimentLabel.SLIGHTLY_BEARISH: 0.45,
            SentimentLabel.BEARISH: 0.25,
            SentimentLabel.VERY_BEARISH: 0.0,
        }
        
        for analysis in sentiment_analyses:
            sentiment_value = sentiment_values.get(analysis.sentiment.label, 0.5)
            weight = analysis.sentiment.confidence * analysis.content_quality_score
            weighted_sentiments.append(sentiment_value * weight)
        
        if not weighted_sentiments:
            return 0.5
        
        # Calculate weighted average
        avg_sentiment = sum(weighted_sentiments) / len(weighted_sentiments)
        
        # Apply volume boost (more analyses = higher confidence)
        volume_boost = min(0.1, len(sentiment_analyses) / 100)
        
        return min(1.0, avg_sentiment + volume_boost)
    
    def _calculate_volume_score(self, reddit_metrics: RedditMetrics) -> float:
        """Calculate volume/activity component score."""
        # Normalize metrics to 0-1 scale
        mention_score = min(1.0, reddit_metrics.total_mentions / 100)  # 100+ mentions = max score
        author_score = min(1.0, reddit_metrics.unique_authors / 50)    # 50+ authors = max score
        engagement_score = min(1.0, reddit_metrics.engagement_rate / 10)  # 10+ avg engagement = max score
        
        # Recent activity boost
        recent_activity = (
            reddit_metrics.mentions_last_hour * 24 +  # Hourly mentions extrapolated
            reddit_metrics.mentions_last_day
        )
        recency_score = min(1.0, recent_activity / reddit_metrics.total_mentions if reddit_metrics.total_mentions > 0 else 0)
        
        # Combine components
        volume_score = (
            mention_score * 0.3 +
            author_score * 0.3 +
            engagement_score * 0.2 +
            recency_score * 0.2
        )
        
        return volume_score
    
    def _calculate_quality_score(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
    ) -> float:
        """Calculate content quality component score."""
        if not sentiment_analyses:
            return 0.0
        
        # Average content quality from sentiment analyses
        avg_content_quality = statistics.mean(
            analysis.content_quality_score for analysis in sentiment_analyses
        )
        
        # Quality ratio from Reddit metrics
        quality_ratio = reddit_metrics.quality_ratio
        
        # Reliability score from sentiment analyses
        avg_reliability = statistics.mean(
            analysis.reliability_score for analysis in sentiment_analyses
        )
        
        # Combine quality indicators
        quality_score = (
            avg_content_quality * 0.4 +
            quality_ratio * 0.3 +
            avg_reliability * 0.3
        )
        
        return quality_score
    
    def _calculate_momentum_score(self, reddit_metrics: RedditMetrics) -> float:
        """Calculate momentum component score."""
        # Use momentum score directly from Reddit metrics
        base_momentum = reddit_metrics.momentum_score
        
        # Boost for recent activity spikes
        if reddit_metrics.total_mentions > 0:
            recent_ratio = reddit_metrics.mentions_last_day / reddit_metrics.total_mentions
            momentum_boost = min(0.2, recent_ratio * 2)  # Up to 20% boost
        else:
            momentum_boost = 0.0
        
        return min(1.0, base_momentum + momentum_boost)
    
    def _calculate_technical_score(
        self,
        market_data: Optional[MarketData],
        volatility_squeeze_data: Optional[Dict],
    ) -> float:
        """Calculate technical analysis component score."""
        if not market_data or not market_data.technical_indicators:
            return 0.5  # Neutral score when no technical data
        
        tech = market_data.technical_indicators
        technical_factors = []
        
        # RSI analysis (0.3-0.7 is good, avoid overbought/oversold extremes)
        if tech.rsi_14:
            rsi_value = float(tech.rsi_14)
            if 30 <= rsi_value <= 70:
                rsi_score = 0.8
            elif 25 <= rsi_value <= 75:
                rsi_score = 0.6
            else:
                rsi_score = 0.3  # Extreme readings
            technical_factors.append(rsi_score)
        
        # Bollinger Band position
        if tech.bb_percent:
            bb_pos = float(tech.bb_percent)
            if 20 <= bb_pos <= 80:
                bb_score = 0.8
            elif 10 <= bb_pos <= 90:
                bb_score = 0.6
            else:
                bb_score = 0.4
            technical_factors.append(bb_score)
        
        # Trend analysis
        if tech.trend_direction and tech.trend_strength:
            trend_strength = float(tech.trend_strength)
            if tech.trend_direction.value in ['bullish', 'strong_bullish']:
                trend_score = 0.5 + (trend_strength * 0.5)
            elif tech.trend_direction.value in ['bearish', 'strong_bearish']:
                trend_score = 0.5 - (trend_strength * 0.3)
            else:  # sideways
                trend_score = 0.5
            technical_factors.append(trend_score)
        
        # Volume analysis
        volume_ratio = market_data.current_volume / market_data.average_volume if market_data.average_volume else 1.0
        if volume_ratio > 2.0:
            volume_score = 0.9  # High volume
        elif volume_ratio > 1.5:
            volume_score = 0.7
        elif volume_ratio > 1.0:
            volume_score = 0.6
        else:
            volume_score = 0.4  # Low volume
        technical_factors.append(volume_score)
        
        # Volatility squeeze bonus
        if volatility_squeeze_data and volatility_squeeze_data.get('is_squeeze'):
            squeeze_bonus = min(0.2, volatility_squeeze_data.get('signal_strength', 0) * 0.2)
        else:
            squeeze_bonus = 0.0
        
        # Calculate average technical score
        if technical_factors:
            base_score = statistics.mean(technical_factors)
            return min(1.0, base_score + squeeze_bonus)
        else:
            return 0.5
    
    def _calculate_fundamental_score(self, market_data: Optional[MarketData]) -> float:
        """Calculate fundamental analysis component score."""
        if not market_data:
            return 0.5
        
        fundamental_factors = []
        
        # P/E ratio analysis
        if market_data.pe_ratio:
            pe = float(market_data.pe_ratio)
            if 10 <= pe <= 25:
                pe_score = 0.8  # Reasonable P/E
            elif 5 <= pe <= 35:
                pe_score = 0.6
            else:
                pe_score = 0.4  # Extreme P/E
            fundamental_factors.append(pe_score)
        
        # Market cap consideration (prefer mid-large cap for stability)
        if market_data.market_cap:
            market_cap = float(market_data.market_cap)
            if market_cap > 10e9:  # >$10B (large cap)
                cap_score = 0.8
            elif market_cap > 2e9:   # >$2B (mid cap)
                cap_score = 0.7
            elif market_cap > 300e6: # >$300M (small cap)
                cap_score = 0.6
            else:  # Micro cap
                cap_score = 0.4
            fundamental_factors.append(cap_score)
        
        # Price momentum (recent performance)
        if market_data.price_change_pct:
            price_change = float(market_data.price_change_pct)
            if price_change > 5:
                momentum_score = 0.8
            elif price_change > 0:
                momentum_score = 0.6
            elif price_change > -5:
                momentum_score = 0.5
            else:
                momentum_score = 0.3
            fundamental_factors.append(momentum_score)
        
        return statistics.mean(fundamental_factors) if fundamental_factors else 0.5
    
    def _calculate_market_risk(self, market_data: Optional[MarketData]) -> float:
        """Calculate market-related risk."""
        if not market_data:
            return 0.7  # High risk when no market data
        
        risk_factors = []
        
        # Volatility risk (based on recent price changes)
        if market_data.price_change_pct:
            abs_change = abs(float(market_data.price_change_pct))
            if abs_change > 10:
                volatility_risk = 0.9
            elif abs_change > 5:
                volatility_risk = 0.7
            elif abs_change > 2:
                volatility_risk = 0.5
            else:
                volatility_risk = 0.3
            risk_factors.append(volatility_risk)
        
        # Market cap risk (smaller caps are riskier)
        if market_data.market_cap:
            market_cap = float(market_data.market_cap)
            if market_cap < 300e6:  # Micro cap
                cap_risk = 0.9
            elif market_cap < 2e9:  # Small cap
                cap_risk = 0.7
            elif market_cap < 10e9:  # Mid cap
                cap_risk = 0.5
            else:  # Large cap
                cap_risk = 0.3
            risk_factors.append(cap_risk)
        
        return statistics.mean(risk_factors) if risk_factors else 0.5
    
    def _calculate_liquidity_risk(
        self,
        market_data: Optional[MarketData],
        reddit_metrics: RedditMetrics,
    ) -> float:
        """Calculate liquidity-related risk."""
        risk_factors = []
        
        # Volume-based liquidity risk
        if market_data and market_data.average_volume:
            avg_volume = market_data.average_volume
            if avg_volume < 100000:  # Low volume
                volume_risk = 0.9
            elif avg_volume < 500000:
                volume_risk = 0.7
            elif avg_volume < 1000000:
                volume_risk = 0.5
            else:
                volume_risk = 0.3
            risk_factors.append(volume_risk)
        
        # Reddit interest as liquidity proxy
        mention_risk = max(0.1, 1.0 - (reddit_metrics.total_mentions / 100))
        risk_factors.append(mention_risk)
        
        return statistics.mean(risk_factors) if risk_factors else 0.6
    
    def _calculate_volatility_risk(self, market_data: Optional[MarketData]) -> float:
        """Calculate volatility-related risk."""
        if not market_data or not market_data.technical_indicators:
            return 0.6
        
        tech = market_data.technical_indicators
        
        # ATR-based volatility risk
        if tech.atr_20 and market_data.current_price:
            atr_pct = float(tech.atr_20) / float(market_data.current_price) * 100
            if atr_pct > 5:
                return 0.9  # Very volatile
            elif atr_pct > 3:
                return 0.7
            elif atr_pct > 1:
                return 0.5
            else:
                return 0.3
        
        return 0.5
    
    def _calculate_sentiment_risk(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
    ) -> float:
        """Calculate sentiment-related risk."""
        if not sentiment_analyses:
            return 0.8  # High risk when no sentiment data
        
        # Sentiment consistency risk
        sentiment_values = []
        for analysis in sentiment_analyses:
            if analysis.sentiment.label == SentimentLabel.VERY_BULLISH:
                sentiment_values.append(1.0)
            elif analysis.sentiment.label == SentimentLabel.BULLISH:
                sentiment_values.append(0.75)
            elif analysis.sentiment.label == SentimentLabel.SLIGHTLY_BULLISH:
                sentiment_values.append(0.55)
            elif analysis.sentiment.label == SentimentLabel.NEUTRAL:
                sentiment_values.append(0.5)
            elif analysis.sentiment.label == SentimentLabel.SLIGHTLY_BEARISH:
                sentiment_values.append(0.45)
            elif analysis.sentiment.label == SentimentLabel.BEARISH:
                sentiment_values.append(0.25)
            else:  # VERY_BEARISH
                sentiment_values.append(0.0)
        
        # Calculate sentiment volatility
        if len(sentiment_values) > 1:
            sentiment_std = statistics.stdev(sentiment_values)
            consistency_risk = min(0.9, sentiment_std * 2)
        else:
            consistency_risk = 0.5
        
        # Quality-based risk
        avg_quality = statistics.mean(
            analysis.content_quality_score for analysis in sentiment_analyses
        )
        quality_risk = 1.0 - avg_quality
        
        return (consistency_risk + quality_risk) / 2
    
    def _calculate_manipulation_risk(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
    ) -> float:
        """Calculate manipulation/pump risk."""
        risk_factors = []
        
        # Bot ratio risk
        if reddit_metrics.total_mentions > 0:
            human_ratio = reddit_metrics.bot_filtered_mentions / reddit_metrics.total_mentions
            bot_risk = 1.0 - human_ratio
            risk_factors.append(bot_risk)
        
        # Spam filtering effectiveness
        if reddit_metrics.total_mentions > 0:
            spam_ratio = (reddit_metrics.total_mentions - reddit_metrics.spam_filtered_mentions) / reddit_metrics.total_mentions
            spam_risk = spam_ratio
            risk_factors.append(spam_risk)
        
        # Pump-like content detection
        pump_indicators = 0
        for analysis in sentiment_analyses:
            if analysis.classification.is_pump_attempt:
                pump_indicators += 1
            if analysis.classification.is_meme_content:
                pump_indicators += 0.5
        
        if sentiment_analyses:
            pump_risk = min(0.9, pump_indicators / len(sentiment_analyses))
            risk_factors.append(pump_risk)
        
        return statistics.mean(risk_factors) if risk_factors else 0.4
    
    def _determine_grade(self, overall_score: float) -> OpportunityGrade:
        """Determine opportunity grade from overall score."""
        if overall_score >= 0.90:
            return OpportunityGrade.S_TIER
        elif overall_score >= 0.80:
            return OpportunityGrade.A_TIER
        elif overall_score >= 0.70:
            return OpportunityGrade.B_TIER
        elif overall_score >= 0.60:
            return OpportunityGrade.C_TIER
        elif overall_score >= 0.50:
            return OpportunityGrade.D_TIER
        else:
            return OpportunityGrade.F_TIER
    
    def _determine_signal_strength(self, overall_score: float, reddit_score: float) -> SignalStrength:
        """Determine signal strength classification."""
        combined_score = (overall_score + reddit_score) / 2
        
        if combined_score >= 0.85:
            return SignalStrength.VERY_STRONG
        elif combined_score >= 0.70:
            return SignalStrength.STRONG
        elif combined_score >= 0.55:
            return SignalStrength.MODERATE
        elif combined_score >= 0.40:
            return SignalStrength.WEAK
        else:
            return SignalStrength.VERY_WEAK
    
    def _determine_risk_level(self, overall_risk: float) -> RiskLevel:
        """Determine risk level from overall risk score."""
        if overall_risk >= 0.8:
            return RiskLevel.VERY_HIGH
        elif overall_risk >= 0.6:
            return RiskLevel.HIGH
        elif overall_risk >= 0.4:
            return RiskLevel.MODERATE
        elif overall_risk >= 0.2:
            return RiskLevel.LOW
        else:
            return RiskLevel.VERY_LOW
    
    def _calculate_score_confidence(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
        market_data: Optional[MarketData],
    ) -> float:
        """Calculate confidence in the scoring accuracy."""
        confidence_factors = []
        
        # Data availability
        if sentiment_analyses:
            confidence_factors.append(0.8)
        if reddit_metrics.total_mentions > 0:
            confidence_factors.append(0.8)
        if market_data:
            confidence_factors.append(0.8)
        
        # Data quality
        if sentiment_analyses:
            avg_sentiment_confidence = statistics.mean(
                analysis.sentiment.confidence for analysis in sentiment_analyses
            )
            confidence_factors.append(avg_sentiment_confidence)
        
        # Data volume
        volume_confidence = min(1.0, reddit_metrics.total_mentions / 50)
        confidence_factors.append(volume_confidence)
        
        return statistics.mean(confidence_factors) if confidence_factors else 0.3
    
    def _calculate_data_reliability(
        self,
        sentiment_analyses: List[SentimentAnalysis],
        reddit_metrics: RedditMetrics,
        market_data: Optional[MarketData],
    ) -> float:
        """Calculate reliability of underlying data."""
        reliability_factors = []
        
        # Sentiment data reliability
        if sentiment_analyses:
            avg_reliability = statistics.mean(
                analysis.reliability_score for analysis in sentiment_analyses
            )
            reliability_factors.append(avg_reliability)
        
        # Reddit data quality
        quality_ratio = reddit_metrics.quality_ratio
        reliability_factors.append(quality_ratio)
        
        # Market data reliability (assume high for yfinance)
        if market_data:
            reliability_factors.append(0.9)
        
        return statistics.mean(reliability_factors) if reliability_factors else 0.5
    
    def _identify_key_risk_factors(
        self,
        market_risk: float,
        liquidity_risk: float,
        volatility_risk: float,
        sentiment_risk: float,
        manipulation_risk: float,
    ) -> List[str]:
        """Identify key risk factors based on risk scores."""
        risk_factors = []
        
        if market_risk > 0.7:
            risk_factors.append("High market risk due to volatility or small market cap")
        if liquidity_risk > 0.7:
            risk_factors.append("Low liquidity may impact entry/exit execution")
        if volatility_risk > 0.7:
            risk_factors.append("High price volatility increases position risk")
        if sentiment_risk > 0.7:
            risk_factors.append("Inconsistent or low-quality sentiment data")
        if manipulation_risk > 0.7:
            risk_factors.append("Potential manipulation or pump-and-dump activity")
        
        return risk_factors
    
    def _generate_mitigation_suggestions(self, risk_factors: List[str]) -> List[str]:
        """Generate risk mitigation suggestions."""
        suggestions = []
        
        if any("market risk" in factor for factor in risk_factors):
            suggestions.append("Use smaller position sizes and wider stop losses")
        if any("liquidity" in factor for factor in risk_factors):
            suggestions.append("Use limit orders and avoid market orders during low volume periods")
        if any("volatility" in factor for factor in risk_factors):
            suggestions.append("Consider options strategies to limit downside risk")
        if any("sentiment" in factor for factor in risk_factors):
            suggestions.append("Verify sentiment with additional fundamental analysis")
        if any("manipulation" in factor for factor in risk_factors):
            suggestions.append("Avoid FOMO trading and verify unusual activity patterns")
        
        # General suggestions
        suggestions.extend([
            "Diversify across multiple opportunities",
            "Set clear entry and exit criteria before trading",
            "Monitor position regularly for changing conditions"
        ])
        
        return suggestions
    
    def _calculate_max_position_size(self, overall_risk: float) -> float:
        """Calculate maximum recommended position size percentage."""
        # Base position size decreases with risk
        if overall_risk < 0.3:
            return 10.0  # Low risk: up to 10%
        elif overall_risk < 0.5:
            return 7.5   # Moderate risk: up to 7.5%
        elif overall_risk < 0.7:
            return 5.0   # High risk: up to 5%
        else:
            return 2.5   # Very high risk: up to 2.5%
    
    def _calculate_stop_loss_percentage(
        self,
        volatility_risk: float,
        market_data: Optional[MarketData],
    ) -> float:
        """Calculate recommended stop loss percentage."""
        base_stop_loss = 5.0  # Base 5% stop loss
        
        # Adjust for volatility
        volatility_adjustment = volatility_risk * 10  # Up to 10% additional
        
        # Adjust for ATR if available
        atr_adjustment = 0.0
        if market_data and market_data.technical_indicators and market_data.technical_indicators.atr_20:
            atr_pct = float(market_data.technical_indicators.atr_20) / float(market_data.current_price) * 100
            atr_adjustment = min(10.0, atr_pct * 2)  # 2x ATR, max 10%
        
        total_stop_loss = base_stop_loss + volatility_adjustment + atr_adjustment
        return min(20.0, total_stop_loss)  # Cap at 20%
    
    def _estimate_sharpe_ratio(
        self,
        market_data: Optional[MarketData],
        overall_risk: float,
    ) -> Optional[float]:
        """Estimate Sharpe ratio (simplified calculation)."""
        if not market_data:
            return None
        
        # Simplified expected return based on recent performance
        if market_data.price_change_pct:
            daily_return = float(market_data.price_change_pct) / 100
            annualized_return = daily_return * 252  # Approximate annualization
        else:
            annualized_return = 0.0
        
        # Estimate volatility from risk score
        estimated_volatility = overall_risk * 0.5  # Risk proxy for volatility
        
        # Risk-free rate assumption (simplified)
        risk_free_rate = 0.02  # 2%
        
        if estimated_volatility > 0:
            sharpe_ratio = (annualized_return - risk_free_rate) / estimated_volatility
            return max(-3.0, min(3.0, sharpe_ratio))  # Clamp to reasonable range
        
        return None
