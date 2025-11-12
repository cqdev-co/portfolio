"""Fundamental analysis using yfinance."""

from typing import Optional
from loguru import logger

from ..data.market_data import MarketDataProvider
from ..models.analysis import FundamentalAnalysis
from ..models.signal import Signal


class FundamentalAnalyzer:
    """Analyze fundamental metrics for signals."""
    
    def __init__(self, market_data_provider: MarketDataProvider):
        """Initialize fundamental analyzer."""
        self.market_data = market_data_provider
    
    def analyze(self, signal: Signal) -> FundamentalAnalysis:
        """
        Perform fundamental analysis on a signal.
        
        Args:
            signal: Signal to analyze
            
        Returns:
            FundamentalAnalysis results
        """
        ticker = signal.ticker
        
        # Get fundamental data
        fundamentals = self.market_data.get_fundamental_data(ticker)
        
        if not fundamentals:
            logger.warning(f"No fundamental data for {ticker}, using defaults")
            return self._default_analysis(signal)
        
        # Extract metrics (use signal data if available, otherwise from yfinance)
        pe_ratio = fundamentals.get("pe_ratio")
        market_cap = signal.market_cap or fundamentals.get("market_cap")
        earnings_growth = fundamentals.get("earnings_growth")
        revenue_growth = fundamentals.get("revenue_growth")
        profit_margin = fundamentals.get("profit_margin")
        debt_to_equity = fundamentals.get("debt_to_equity")
        
        # Use signal's days_to_earnings if available
        days_to_earnings = signal.days_to_earnings
        has_upcoming_catalyst = signal.has_upcoming_catalyst
        
        # Calculate score
        score = self._calculate_score(
            pe_ratio=pe_ratio,
            earnings_growth=earnings_growth,
            market_cap=market_cap,
            revenue_growth=revenue_growth,
            profit_margin=profit_margin,
            debt_to_equity=debt_to_equity,
            days_to_earnings=days_to_earnings,
            has_upcoming_catalyst=has_upcoming_catalyst,
        )
        
        return FundamentalAnalysis(
            pe_ratio=pe_ratio,
            earnings_growth_yoy=earnings_growth,
            revenue_growth_yoy=revenue_growth,
            market_cap=float(market_cap) if market_cap else None,
            profit_margin=profit_margin,
            debt_to_equity=debt_to_equity,
            days_to_earnings=days_to_earnings,
            has_upcoming_catalyst=has_upcoming_catalyst,
            score=score,
        )
    
    def _calculate_score(
        self,
        pe_ratio: Optional[float],
        earnings_growth: Optional[float],
        market_cap: Optional[float],
        revenue_growth: Optional[float],
        profit_margin: Optional[float],
        debt_to_equity: Optional[float],
        days_to_earnings: Optional[int],
        has_upcoming_catalyst: bool,
    ) -> float:
        """
        Calculate fundamental score (0-100).
        
        Scoring:
        - P/E ratio reasonable: 20 points
        - Earnings growth positive: 20 points
        - Market cap appropriate: 15 points
        - Revenue growth: 15 points
        - Profit margins healthy: 15 points
        - Low debt: 10 points
        - Earnings catalyst proximity: 5 points
        """
        score = 0.0
        
        # P/E Ratio (20 points)
        if pe_ratio:
            if 10 <= pe_ratio <= 25:
                score += 20  # Ideal range
            elif 5 <= pe_ratio <= 35:
                score += 15  # Acceptable
            elif pe_ratio < 5 or (pe_ratio > 35 and pe_ratio < 50):
                score += 10  # Extreme but not terrible
            else:
                score += 5  # Very extreme
        
        # Earnings Growth (20 points)
        if earnings_growth:
            if earnings_growth > 0.1:  # > 10%
                score += 20
            elif earnings_growth > 0:
                score += 15
            elif earnings_growth > -0.1:
                score += 10
            else:
                score += 5
        
        # Market Cap (15 points)
        if market_cap:
            if market_cap > 10e9:  # > $10B (large cap)
                score += 15
            elif market_cap > 2e9:  # > $2B (mid cap)
                score += 12
            elif market_cap > 300e6:  # > $300M (small cap)
                score += 10
            else:  # Micro cap
                score += 5
        
        # Revenue Growth (15 points)
        if revenue_growth:
            if revenue_growth > 0.1:  # > 10%
                score += 15
            elif revenue_growth > 0:
                score += 12
            elif revenue_growth > -0.05:
                score += 8
            else:
                score += 5
        
        # Profit Margin (15 points)
        if profit_margin:
            if profit_margin > 0.15:  # > 15%
                score += 15
            elif profit_margin > 0.10:  # > 10%
                score += 12
            elif profit_margin > 0.05:  # > 5%
                score += 10
            elif profit_margin > 0:
                score += 8
            else:
                score += 5
        
        # Debt/Equity (10 points)
        if debt_to_equity is not None:
            if debt_to_equity < 0.5:
                score += 10  # Low debt
            elif debt_to_equity < 1.0:
                score += 8
            elif debt_to_equity < 2.0:
                score += 5
            else:
                score += 2  # High debt
        
        # Earnings Catalyst (5 points)
        if has_upcoming_catalyst and days_to_earnings:
            if 0 < days_to_earnings <= 14:
                score += 5  # Very soon
            elif days_to_earnings <= 30:
                score += 3  # Soon
            elif days_to_earnings <= 60:
                score += 2  # Coming up
        
        return min(100.0, max(0.0, score))
    
    def _default_analysis(self, signal: Signal) -> FundamentalAnalysis:
        """Return default analysis when data is insufficient."""
        return FundamentalAnalysis(
            market_cap=float(signal.market_cap) if signal.market_cap else None,
            days_to_earnings=signal.days_to_earnings,
            has_upcoming_catalyst=signal.has_upcoming_catalyst,
            score=50.0,
        )

