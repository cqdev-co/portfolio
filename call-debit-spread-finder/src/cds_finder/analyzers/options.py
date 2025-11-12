"""Options-specific analysis."""

from typing import Optional
from loguru import logger

from ..models.analysis import OptionsAnalysis
from ..models.signal import Signal
from ..strategies.call_debit_spread import CallDebitSpreadCalculator


class OptionsAnalyzer:
    """Analyze options-specific metrics."""
    
    def __init__(self, spread_calculator: CallDebitSpreadCalculator):
        """Initialize options analyzer."""
        self.spread_calculator = spread_calculator
    
    def analyze(self, signal: Signal) -> OptionsAnalysis:
        """
        Perform options analysis on a signal.
        
        Args:
            signal: Signal to analyze
            
        Returns:
            OptionsAnalysis results
        """
        # Calculate spread
        spread_data = self.spread_calculator.calculate_spread(signal)
        
        if not spread_data:
            logger.warning(f"Could not calculate spread for {signal.ticker}")
            # Return None to skip this signal (can't find suitable strikes)
            return None
        
        # Extract metrics
        iv_rank = signal.iv_rank
        long_strike = spread_data["long_strike"]
        short_strike = spread_data["short_strike"]
        strike_width = spread_data["strike_width"]
        net_debit = spread_data["net_debit"]
        max_profit = spread_data["max_profit"]
        max_loss = spread_data["max_loss"]
        risk_reward_ratio = spread_data["risk_reward_ratio"]
        probability_of_profit = spread_data["probability_of_profit"]
        breakeven_price = spread_data["breakeven_price"]
        breakeven_pct = spread_data["breakeven_pct"]
        delta = spread_data.get("delta")
        
        # Calculate score
        score = self._calculate_score(
            iv_rank=iv_rank,
            delta=delta,
            probability_of_profit=probability_of_profit,
            risk_reward_ratio=risk_reward_ratio,
            days_to_expiry=signal.days_to_expiry,
            strike_width=strike_width,
            moneyness=signal.moneyness,
        )
        
        return OptionsAnalysis(
            iv_rank=iv_rank,
            long_strike=long_strike,
            short_strike=short_strike,
            strike_width=strike_width,
            net_debit=net_debit,
            max_profit=max_profit,
            max_loss=max_loss,
            risk_reward_ratio=risk_reward_ratio,
            probability_of_profit=probability_of_profit,
            breakeven_price=breakeven_price,
            breakeven_pct=breakeven_pct,
            delta=delta,
            score=score,
        )
    
    def _calculate_score(
        self,
        iv_rank: Optional[float],
        delta: Optional[float],
        probability_of_profit: float,
        risk_reward_ratio: float,
        days_to_expiry: int,
        strike_width: float,
        moneyness: Optional[str],
    ) -> float:
        """
        Calculate options score (0-100).
        
        Scoring:
        - IV Rank favorable (< 50): 25 points
        - Good delta (0.30-0.50): 20 points
        - High POP (> 50%): 20 points
        - Strong R:R (> 2:1): 20 points
        - Reasonable time decay: 10 points
        - Strike width optimal: 5 points
        """
        score = 0.0
        
        # IV Rank (25 points)
        if iv_rank is not None:
            if iv_rank < 30:
                score += 25  # Very low IV
            elif iv_rank < 50:
                score += 20  # Low IV
            elif iv_rank < 70:
                score += 15  # Moderate IV
            else:
                score += 5  # High IV (overpaying)
        
        # Delta (20 points)
        if delta:
            if 0.30 <= delta <= 0.50:
                score += 20  # Sweet spot
            elif 0.25 <= delta <= 0.60:
                score += 15  # Acceptable
            elif 0.20 <= delta <= 0.70:
                score += 10  # Okay
            else:
                score += 5  # Outside ideal range
        
        # Probability of Profit (20 points)
        if probability_of_profit >= 60:
            score += 20
        elif probability_of_profit >= 50:
            score += 15
        elif probability_of_profit >= 40:
            score += 10
        elif probability_of_profit >= 30:
            score += 5
        
        # Risk/Reward Ratio (20 points)
        if risk_reward_ratio >= 3.0:
            score += 20  # Excellent
        elif risk_reward_ratio >= 2.0:
            score += 15  # Good
        elif risk_reward_ratio >= 1.5:
            score += 10  # Acceptable
        elif risk_reward_ratio >= 1.0:
            score += 5  # Minimum
        
        # Time Decay (10 points)
        if 14 <= days_to_expiry <= 45:
            score += 10  # Ideal range
        elif 7 <= days_to_expiry <= 60:
            score += 7  # Acceptable
        elif days_to_expiry < 7:
            score += 2  # Too short
        else:
            score += 5  # Too long
        
        # Strike Width (5 points)
        if 5 <= strike_width <= 15:
            score += 5  # Good width
        elif strike_width < 5:
            score += 2  # Too narrow
        else:
            score += 3  # Wide but okay
        
        # Moneyness bonus
        if moneyness == "ATM":
            score += 2
        
        return min(100.0, max(0.0, score))
    
    def _default_analysis(self, signal: Signal) -> OptionsAnalysis:
        """Return default analysis when spread cannot be calculated."""
        return OptionsAnalysis(
            iv_rank=signal.iv_rank,
            long_strike=signal.strike,
            short_strike=signal.strike + 10,
            strike_width=10.0,
            net_debit=1.0,
            max_profit=9.0,
            max_loss=1.0,
            risk_reward_ratio=9.0,
            probability_of_profit=50.0,
            breakeven_price=signal.strike + 1.0,
            breakeven_pct=((signal.strike + 1.0 - signal.underlying_price) / signal.underlying_price) * 100,
            score=50.0,
        )

