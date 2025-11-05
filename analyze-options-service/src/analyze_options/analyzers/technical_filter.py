"""Technical analysis filter to skip bad setups."""

from dataclasses import dataclass
from typing import Optional
from loguru import logger

from ..models.signal import EnrichedSignal, Sentiment
from ..models.analysis import TechnicalIndicators
from ..config import Settings


@dataclass
class FilterResult:
    """Result of technical filtering."""
    
    should_skip: bool
    reason: Optional[str] = None
    
    # Details for display
    rsi_status: str = ""  # "✅ Safe" | "⚠️ Caution" | "❌ Reject"
    trend_status: str = ""
    momentum_status: str = ""
    volume_status: str = ""


class TechnicalFilter:
    """
    Filter out signals with poor technical setups.
    
    Safety checks:
    - RSI overbought/oversold
    - Moving average trend alignment
    - Momentum and volume validation
    """
    
    def __init__(self, config: Settings):
        self.config = config
        self.rsi_overbought = config.rsi_overbought
        self.rsi_oversold = config.rsi_oversold
        self.min_volume_ratio = config.min_volume_ratio
    
    def should_skip_signal(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> FilterResult:
        """
        Determine if signal should be skipped based on technical analysis.
        
        Args:
            signal: The unusual options signal
            technical: Technical indicators for the ticker
            
        Returns:
            FilterResult with skip decision and reasoning
        """
        result = FilterResult(should_skip=False)
        
        # Check 1: RSI - Avoid overbought/oversold extremes
        rsi_check = self._check_rsi(signal, technical)
        if rsi_check:
            result.should_skip = True
            result.reason = rsi_check
            result.rsi_status = f"❌ {rsi_check}"
            return result
        else:
            if technical.rsi < 40:
                result.rsi_status = f"✅ RSI {technical.rsi:.0f} (oversold - good for calls)"
            elif technical.rsi > 60:
                result.rsi_status = f"⚠️ RSI {technical.rsi:.0f} (overbought - caution)"
            else:
                result.rsi_status = f"✅ RSI {technical.rsi:.0f} (healthy range)"
        
        # Check 2: Moving Average Trend Alignment
        trend_check = self._check_trend(signal, technical)
        if trend_check:
            result.should_skip = True
            result.reason = trend_check
            result.trend_status = f"❌ {trend_check}"
            return result
        else:
            if signal.sentiment == Sentiment.BULLISH:
                if technical.is_golden_cross:
                    result.trend_status = "✅ Golden cross (bullish)"
                elif technical.is_above_ma_50:
                    result.trend_status = "✅ Above 50-day MA (uptrend)"
                else:
                    result.trend_status = "⚠️ Below 50-day MA (weak trend)"
            else:
                if technical.is_death_cross:
                    result.trend_status = "✅ Death cross (bearish)"
                elif not technical.is_above_ma_50:
                    result.trend_status = "✅ Below 50-day MA (downtrend)"
                else:
                    result.trend_status = "⚠️ Above 50-day MA (weak trend)"
        
        # Check 3: Momentum
        momentum_check = self._check_momentum(signal, technical)
        if momentum_check:
            result.should_skip = True
            result.reason = momentum_check
            result.momentum_status = f"❌ {momentum_check}"
            return result
        else:
            if abs(technical.momentum_5d) > 5:
                result.momentum_status = f"✅ Strong momentum ({technical.momentum_5d:+.1f}%)"
            elif abs(technical.momentum_5d) > 2:
                result.momentum_status = f"✅ Moderate momentum ({technical.momentum_5d:+.1f}%)"
            else:
                result.momentum_status = f"⚠️ Low momentum ({technical.momentum_5d:+.1f}%)"
        
        # Check 4: Volume
        volume_check = self._check_volume(technical)
        if volume_check:
            result.should_skip = True
            result.reason = volume_check
            result.volume_status = f"❌ {volume_check}"
            return result
        else:
            if technical.volume_ratio > 1.5:
                result.volume_status = f"✅ High volume ({technical.volume_ratio:.1f}x avg)"
            elif technical.volume_ratio > 0.8:
                result.volume_status = f"✅ Normal volume ({technical.volume_ratio:.1f}x avg)"
            else:
                result.volume_status = f"⚠️ Lower volume ({technical.volume_ratio:.1f}x avg)"
        
        # All checks passed
        return result
    
    def _check_rsi(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Optional[str]:
        """Check RSI for overbought/oversold conditions."""
        
        if signal.sentiment == Sentiment.BULLISH:
            if technical.rsi > self.rsi_overbought:
                return (
                    f"RSI at {technical.rsi:.0f} (overbought) - "
                    f"Don't buy calls at the top!"
                )
        
        elif signal.sentiment == Sentiment.BEARISH:
            if technical.rsi < self.rsi_oversold:
                return (
                    f"RSI at {technical.rsi:.0f} (oversold) - "
                    f"Don't buy puts at the bottom!"
                )
        
        return None
    
    def _check_trend(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Optional[str]:
        """Check moving average trend alignment."""
        
        if signal.sentiment == Sentiment.BULLISH:
            # For bullish signals, want price above MAs
            if not technical.is_above_ma_50:
                return (
                    f"Price ${technical.price:.2f} below 50-day MA "
                    f"${technical.ma_50:.2f} - Bearish trend!"
                )
            
            if technical.is_death_cross:
                return (
                    "Death cross pattern (50-MA < 200-MA) - "
                    "Long-term bearish trend!"
                )
        
        elif signal.sentiment == Sentiment.BEARISH:
            # For bearish signals, want price below MAs
            if technical.is_above_ma_50:
                return (
                    f"Price ${technical.price:.2f} above 50-day MA "
                    f"${technical.ma_50:.2f} - Bullish trend!"
                )
            
            if technical.is_golden_cross:
                return (
                    "Golden cross pattern (50-MA > 200-MA) - "
                    "Long-term bullish trend!"
                )
        
        return None
    
    def _check_momentum(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Optional[str]:
        """Check momentum alignment."""
        
        # Skip if momentum is too weak
        if abs(technical.momentum_5d) < 0.5:
            return "No momentum - Sideways price action"
        
        # Check momentum direction matches signal sentiment
        if signal.sentiment == Sentiment.BULLISH:
            if technical.momentum_5d < -2:
                return (
                    f"Negative momentum ({technical.momentum_5d:.1f}%) - "
                    f"Stock falling!"
                )
        
        elif signal.sentiment == Sentiment.BEARISH:
            if technical.momentum_5d > 2:
                return (
                    f"Positive momentum (+{technical.momentum_5d:.1f}%) - "
                    f"Stock rising!"
                )
        
        return None
    
    def _check_volume(
        self,
        technical: TechnicalIndicators
    ) -> Optional[str]:
        """Check volume for liquidity."""
        
        if technical.volume_ratio < self.min_volume_ratio:
            return (
                f"Low volume ({technical.volume_ratio:.1f}x avg) - "
                f"Poor liquidity!"
            )
        
        return None

