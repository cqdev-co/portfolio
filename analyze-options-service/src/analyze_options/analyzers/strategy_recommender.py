"""Strategy recommendation engine - compares spread vs naked options."""

from typing import Optional
from loguru import logger

from ..models.signal import EnrichedSignal
from ..models.analysis import TechnicalIndicators
from ..models.strategy import (
    StrategyComparison,
    StrategyRecommendation,
    VerticalSpreadAnalysis,
    NakedOptionAnalysis
)
from .spread_analyzer import VerticalSpreadAnalyzer
from .naked_analyzer import NakedOptionAnalyzer


class StrategyRecommender:
    """Recommends the best strategy for each signal."""
    
    def __init__(
        self,
        account_size: float = 10000,
        risk_per_trade_pct: float = 2.0,
        risk_tolerance: str = "conservative"
    ):
        """
        Initialize the recommender.
        
        Args:
            account_size: Total account size in dollars
            risk_per_trade_pct: Percentage of account to risk per trade
            risk_tolerance: "conservative", "moderate", or "aggressive"
        """
        self.account_size = account_size
        self.risk_per_trade_pct = risk_per_trade_pct
        self.risk_tolerance = risk_tolerance
        self.max_risk_per_trade = account_size * (risk_per_trade_pct / 100)
        
        # Initialize analyzers
        self.spread_analyzer = VerticalSpreadAnalyzer(account_size, risk_per_trade_pct)
        self.naked_analyzer = NakedOptionAnalyzer(account_size, risk_per_trade_pct)
    
    def recommend(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> StrategyComparison:
        """
        Analyze both strategies and recommend the best one.
        
        Args:
            signal: The enriched signal
            technical: Technical analysis indicators
            
        Returns:
            StrategyComparison with recommendation
        """
        # Analyze vertical spread
        spread = self.spread_analyzer.analyze(signal, technical)
        
        # Analyze naked option
        naked = self.naked_analyzer.analyze(signal, technical)
        
        # Create comparison
        comparison = StrategyComparison(
            ticker=signal.ticker,
            signal_grade=signal.grade,
            sentiment=signal.sentiment.value,
            premium_flow=signal.premium_flow,
            spread=spread,
            naked=naked
        )
        
        # Determine recommendation
        comparison = self._determine_recommendation(comparison, signal)
        
        # Calculate position sizing
        comparison = self._calculate_position_size(comparison)
        
        return comparison
    
    def _determine_recommendation(
        self,
        comparison: StrategyComparison,
        signal: EnrichedSignal
    ) -> StrategyComparison:
        """
        Determine which strategy to recommend based on scores and risk tolerance.
        """
        spread = comparison.spread
        naked = comparison.naked
        
        # If neither strategy available, skip
        if not spread and not naked:
            comparison.recommended_strategy = StrategyRecommendation.SKIP
            comparison.recommendation_reason = "No viable strategies found"
            return comparison
        
        # If only one available, use that
        if not spread:
            comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
            comparison.recommendation_reason = "Only naked option available"
            comparison.composite_score = naked.score
            return comparison
        
        if not naked:
            comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
            comparison.recommendation_reason = "Only vertical spread available"
            comparison.composite_score = spread.score
            return comparison
        
        # Both available - apply decision logic
        
        # Rule 1: Skip if both scores are too low
        if spread.score < 40 and naked.score < 40:
            comparison.recommended_strategy = StrategyRecommendation.SKIP
            comparison.recommendation_reason = "Both strategies scored too low"
            return comparison
        
        # Rule 2: Apply risk tolerance preference
        score_diff = naked.score - spread.score
        
        if self.risk_tolerance == "conservative":
            # Conservative: Prefer spreads, need significant advantage for naked
            if spread.score >= 60:
                # Good spread score, use it unless naked is much better
                if score_diff > 15:
                    comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
                    comparison.recommendation_reason = (
                        f"Naked option scores significantly higher ({naked.score} vs {spread.score})"
                    )
                    comparison.composite_score = naked.score
                else:
                    comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
                    comparison.recommendation_reason = (
                        f"Defined risk preferred (Conservative) - Score: {spread.score}"
                    )
                    comparison.composite_score = spread.score
            else:
                # Spread score mediocre, check naked
                if naked.score >= 70:
                    comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
                    comparison.recommendation_reason = (
                        f"Naked option has excellent score ({naked.score})"
                    )
                    comparison.composite_score = naked.score
                elif spread.score > naked.score:
                    comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
                    comparison.recommendation_reason = f"Spread scores higher ({spread.score} vs {naked.score})"
                    comparison.composite_score = spread.score
                else:
                    comparison.recommended_strategy = StrategyRecommendation.SKIP
                    comparison.recommendation_reason = "Scores too mediocre for conservative risk tolerance"
                    
        elif self.risk_tolerance == "moderate":
            # Moderate: Use highest score, with slight preference for spreads if close
            if abs(score_diff) < 10:
                # Scores close - prefer spread for defined risk
                comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
                comparison.recommendation_reason = (
                    f"Scores similar, prefer defined risk - Spread: {spread.score}, Naked: {naked.score}"
                )
                comparison.composite_score = spread.score
            elif naked.score > spread.score:
                comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
                comparison.recommendation_reason = f"Naked option scores higher ({naked.score} vs {spread.score})"
                comparison.composite_score = naked.score
            else:
                comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
                comparison.recommendation_reason = f"Spread scores higher ({spread.score} vs {naked.score})"
                comparison.composite_score = spread.score
                
        else:  # aggressive
            # Aggressive: Prefer naked options for higher upside
            if naked.score >= 60:
                comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
                comparison.recommendation_reason = (
                    f"Naked option preferred (Aggressive) - Score: {naked.score}"
                )
                comparison.composite_score = naked.score
            elif spread.score > naked.score + 10:
                # Spread much better
                comparison.recommended_strategy = StrategyRecommendation.VERTICAL_SPREAD
                comparison.recommendation_reason = (
                    f"Spread significantly better ({spread.score} vs {naked.score})"
                )
                comparison.composite_score = spread.score
            elif naked.score >= 50:
                comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
                comparison.recommendation_reason = f"Naked option acceptable - Score: {naked.score}"
                comparison.composite_score = naked.score
            else:
                comparison.recommended_strategy = StrategyRecommendation.SKIP
                comparison.recommendation_reason = "Scores too low even for aggressive strategy"
        
        # Rule 3: Grade-based overrides
        # S-grade signals with high premium flow favor naked options
        if signal.grade == 'S' and signal.premium_flow > 2000000 and naked and naked.score >= 65:
            comparison.recommended_strategy = StrategyRecommendation.NAKED_OPTION
            comparison.recommendation_reason = (
                f"S-grade + $2M+ flow + strong score ({naked.score}) → Naked option"
            )
            comparison.composite_score = naked.score
        
        return comparison
    
    def _calculate_position_size(
        self,
        comparison: StrategyComparison
    ) -> StrategyComparison:
        """
        Calculate suggested position size based on risk management rules.
        """
        if comparison.recommended_strategy == StrategyRecommendation.SKIP:
            comparison.suggested_contracts = 0
            comparison.suggested_capital = 0.0
            comparison.risk_per_trade = 0.0
            return comparison
        
        # Determine max loss per contract based on strategy
        if comparison.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD:
            if not comparison.spread or not comparison.spread.net_debit:
                return comparison
            max_loss_per_contract = comparison.spread.net_debit * 100  # Convert to dollars
        else:  # Naked option
            if not comparison.naked or not comparison.naked.premium:
                return comparison
            max_loss_per_contract = comparison.naked.premium * 100  # Can lose 100%
        
        # Calculate number of contracts based on risk tolerance
        if max_loss_per_contract <= 0:
            return comparison
        
        # Max risk per trade based on account size
        max_risk = self.max_risk_per_trade
        
        # Adjust based on signal grade
        grade_multipliers = {
            'S': 1.0,    # Full risk for S-grade
            'A': 0.75,   # 75% for A-grade
            'B': 0.5,    # 50% for B-grade
            'C': 0.25    # 25% for C-grade
        }
        adjusted_risk = max_risk * grade_multipliers.get(comparison.signal_grade, 0.5)
        
        # Calculate contracts
        suggested_contracts = int(adjusted_risk / max_loss_per_contract)
        
        # Minimum 1 contract if we're recommending the strategy
        suggested_contracts = max(1, suggested_contracts)
        
        # Maximum 5 contracts per position for safety
        suggested_contracts = min(5, suggested_contracts)
        
        # Calculate actual capital needed
        comparison.suggested_contracts = suggested_contracts
        comparison.suggested_capital = max_loss_per_contract * suggested_contracts
        comparison.risk_per_trade = comparison.suggested_capital  # Max loss
        
        return comparison
    
    def rank_opportunities(
        self,
        comparisons: list[StrategyComparison]
    ) -> list[StrategyComparison]:
        """
        Rank all strategy comparisons by composite score.
        
        Args:
            comparisons: List of strategy comparisons
            
        Returns:
            Ranked list (highest score first)
        """
        # Filter out skipped strategies
        viable = [c for c in comparisons if c.recommended_strategy != StrategyRecommendation.SKIP]
        
        # Sort by composite score (descending)
        ranked = sorted(viable, key=lambda x: x.composite_score, reverse=True)
        
        # Assign ranks
        for i, comparison in enumerate(ranked, 1):
            comparison.rank = i
        
        return ranked

