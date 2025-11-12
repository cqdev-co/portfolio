"""Signal correlation analyzer - finds multiple signals for same ticker."""

from typing import List, Dict
from collections import defaultdict
from loguru import logger

from ..models.signal import Signal


class SignalCorrelationAnalyzer:
    """Analyze correlation between multiple signals for the same ticker."""
    
    def analyze_correlation(self, signals: List[Signal]) -> Dict[str, Dict]:
        """
        Analyze correlation between signals.
        
        Groups signals by ticker and calculates correlation metrics.
        
        Args:
            signals: List of signals to analyze
            
        Returns:
            Dictionary mapping ticker to correlation data
        """
        # Group signals by ticker
        ticker_signals = defaultdict(list)
        for signal in signals:
            ticker_signals[signal.ticker].append(signal)
        
        correlation_data = {}
        
        for ticker, ticker_signal_list in ticker_signals.items():
            if len(ticker_signal_list) == 1:
                # Single signal - no correlation bonus
                correlation_data[ticker] = {
                    "signal_count": 1,
                    "correlation_score": 0,
                    "correlation_bonus": 0,
                    "same_direction": True,
                    "total_premium_flow": ticker_signal_list[0].premium_flow,
                    "avg_grade_score": self._grade_to_score(ticker_signal_list[0].grade),
                    "has_sweep": ticker_signal_list[0].has_sweep,
                    "has_block_trade": ticker_signal_list[0].has_block_trade,
                }
            else:
                # Multiple signals - calculate correlation
                correlation_data[ticker] = self._calculate_correlation(
                    ticker, ticker_signal_list
                )
        
        return correlation_data
    
    def _calculate_correlation(
        self, ticker: str, signals: List[Signal]
    ) -> Dict:
        """
        Calculate correlation metrics for multiple signals.
        
        Args:
            ticker: Ticker symbol
            signals: List of signals for this ticker
            
        Returns:
            Correlation data dictionary
        """
        signal_count = len(signals)
        
        # Check if all signals are same direction (bullish)
        same_direction = all(s.sentiment == "BULLISH" for s in signals)
        
        # Calculate aggregate metrics
        total_premium_flow = sum(s.premium_flow for s in signals)
        avg_grade_score = sum(
            self._grade_to_score(s.grade) for s in signals
        ) / signal_count
        
        # Detection flags
        has_sweep = any(s.has_sweep for s in signals)
        has_block_trade = any(s.has_block_trade for s in signals)
        has_premium_flow = any(s.has_premium_flow for s in signals)
        
        # Calculate correlation score
        correlation_score = 0
        
        # Multiple signals bonus
        if signal_count >= 3:
            correlation_score += 15  # Strong correlation
        elif signal_count == 2:
            correlation_score += 8   # Moderate correlation
        
        # Same direction bonus
        if same_direction:
            correlation_score += 5
        
        # High premium flow bonus
        if total_premium_flow > 1000000:  # $1M+
            correlation_score += 10
        elif total_premium_flow > 500000:  # $500K+
            correlation_score += 5
        
        # Detection flags bonus
        if has_sweep:
            correlation_score += 5
        if has_block_trade:
            correlation_score += 5
        if has_premium_flow:
            correlation_score += 3
        
        # High average grade bonus
        if avg_grade_score >= 85:  # A or S average
            correlation_score += 5
        
        # Convert to bonus points (0-20 max)
        correlation_bonus = min(20, correlation_score)
        
        return {
            "signal_count": signal_count,
            "correlation_score": correlation_score,
            "correlation_bonus": correlation_bonus,
            "same_direction": same_direction,
            "total_premium_flow": total_premium_flow,
            "avg_grade_score": avg_grade_score,
            "has_sweep": has_sweep,
            "has_block_trade": has_block_trade,
            "has_premium_flow": has_premium_flow,
        }
    
    def _grade_to_score(self, grade: str) -> float:
        """Convert grade to numeric score."""
        grade_scores = {
            "S": 100,
            "A": 85,
            "B": 70,
            "C": 55,
            "D": 40,
            "F": 20,
        }
        return grade_scores.get(grade, 50)

