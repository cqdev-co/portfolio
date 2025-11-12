"""Technical analysis using yfinance."""

from typing import Optional
from loguru import logger
import pandas as pd

from ..data.market_data import MarketDataProvider
from ..models.analysis import TechnicalAnalysis
from ..models.signal import Signal


class TechnicalAnalyzer:
    """Analyze technical indicators for signals."""
    
    def __init__(self, market_data_provider: MarketDataProvider):
        """Initialize technical analyzer."""
        self.market_data = market_data_provider
    
    def analyze(self, signal: Signal) -> TechnicalAnalysis:
        """
        Perform technical analysis on a signal.
        
        Args:
            signal: Signal to analyze
            
        Returns:
            TechnicalAnalysis results
        """
        ticker = signal.ticker
        
        # Get historical data
        hist = self.market_data.get_historical_data(ticker, period="1y")
        if hist is None or len(hist) < 50:
            logger.warning(f"Insufficient data for {ticker}, using defaults")
            return self._default_analysis(signal)
        
        # Current price (use from signal or fetch)
        current_price = signal.underlying_price
        
        # Calculate indicators
        closes = hist["Close"]
        volumes = hist["Volume"]
        
        # RSI
        rsi = self.market_data.calculate_rsi(closes, period=14)
        rsi_signal = self._get_rsi_signal(rsi)
        
        # Moving Averages
        sma_20 = float(closes.rolling(window=20).mean().iloc[-1])
        sma_50 = float(closes.rolling(window=50).mean().iloc[-1])
        sma_200 = (
            float(closes.rolling(window=200).mean().iloc[-1])
            if len(closes) >= 200 else None
        )
        
        # EMAs
        ema_12 = float(closes.ewm(span=12, adjust=False).mean().iloc[-1])
        ema_26 = float(closes.ewm(span=26, adjust=False).mean().iloc[-1])
        
        # Price vs MAs
        price_vs_sma20 = ((current_price - sma_20) / sma_20) * 100
        price_vs_sma50 = ((current_price - sma_50) / sma_50) * 100
        
        # Momentum
        momentum_5d = (
            ((closes.iloc[-1] / closes.iloc[-6] - 1) * 100)
            if len(closes) >= 6 else 0.0
        )
        momentum_10d = (
            ((closes.iloc[-1] / closes.iloc[-11] - 1) * 100)
            if len(closes) >= 11 else 0.0
        )
        momentum_20d = (
            ((closes.iloc[-1] / closes.iloc[-21] - 1) * 100)
            if len(closes) >= 21 else None
        )
        
        # Volume ratio (use from signal if available, otherwise calculate)
        if signal.volume_ratio is not None:
            volume_ratio = signal.volume_ratio
        else:
            avg_volume_20d = float(volumes.rolling(window=20).mean().iloc[-1])
            current_volume = float(volumes.iloc[-1])
            volume_ratio = current_volume / avg_volume_20d if avg_volume_20d > 0 else 1.0
        
        # MACD
        macd_data = self.market_data.calculate_macd(closes)
        macd = macd_data["macd"] if macd_data else None
        macd_signal_line = macd_data["signal"] if macd_data else None
        macd_histogram = macd_data["histogram"] if macd_data else None
        
        # Support/Resistance (simplified: recent lows/highs)
        support_level = float(closes.tail(20).min())
        resistance_level = float(closes.tail(20).max())
        
        # Trend determination
        trend = self._determine_trend(
            current_price, sma_20, sma_50, sma_200, momentum_5d
        )
        
        # Calculate score
        score = self._calculate_score(
            rsi=rsi,
            price_vs_sma20=price_vs_sma20,
            price_vs_sma50=price_vs_sma50,
            momentum_5d=momentum_5d,
            volume_ratio=volume_ratio,
            macd_histogram=macd_histogram,
            trend=trend,
        )
        
        return TechnicalAnalysis(
            rsi=rsi or 50.0,
            rsi_signal=rsi_signal,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_12=ema_12,
            ema_26=ema_26,
            price_vs_sma20=price_vs_sma20,
            price_vs_sma50=price_vs_sma50,
            momentum_5d=momentum_5d,
            momentum_10d=momentum_10d,
            momentum_20d=momentum_20d,
            volume_ratio=volume_ratio,
            macd=macd,
            macd_signal=macd_signal_line,
            macd_histogram=macd_histogram,
            support_level=support_level,
            resistance_level=resistance_level,
            trend=trend,
            score=score,
        )
    
    def _get_rsi_signal(self, rsi: Optional[float]) -> str:
        """Get RSI signal classification."""
        if rsi is None:
            return "NEUTRAL"
        if rsi < 30:
            return "OVERSOLD"
        elif rsi > 70:
            return "OVERBOUGHT"
        else:
            return "NEUTRAL"
    
    def _determine_trend(
        self,
        price: float,
        sma_20: float,
        sma_50: float,
        sma_200: Optional[float],
        momentum: float,
    ) -> str:
        """Determine trend direction."""
        bullish_count = 0
        
        if price > sma_20:
            bullish_count += 1
        if price > sma_50:
            bullish_count += 1
        if sma_200 and price > sma_200:
            bullish_count += 1
        if sma_50 > sma_20:
            bullish_count += 1
        if momentum > 0:
            bullish_count += 1
        
        if bullish_count >= 4:
            return "BULLISH"
        elif bullish_count <= 1:
            return "BEARISH"
        else:
            return "NEUTRAL"
    
    def _calculate_score(
        self,
        rsi: Optional[float],
        price_vs_sma20: float,
        price_vs_sma50: float,
        momentum_5d: float,
        volume_ratio: float,
        macd_histogram: Optional[float],
        trend: str,
    ) -> float:
        """
        Calculate technical score (0-100).
        
        Scoring:
        - RSI in sweet spot (40-60): 25 points
        - Price above key MAs: 20 points
        - Positive momentum: 15 points
        - Volume confirmation: 15 points
        - MACD bullish: 15 points
        - Support/resistance alignment: 10 points
        """
        score = 0.0
        
        # RSI (25 points)
        if rsi:
            if 40 <= rsi <= 60:
                score += 25
            elif 35 <= rsi <= 65:
                score += 20
            elif 30 <= rsi <= 70:
                score += 15
            else:
                score += 5
        
        # Price above MAs (20 points)
        ma_score = 0
        if price_vs_sma20 > 0:
            ma_score += 10
        if price_vs_sma50 > 0:
            ma_score += 10
        score += ma_score
        
        # Momentum (15 points)
        if momentum_5d > 3:
            score += 15
        elif momentum_5d > 0:
            score += 10
        elif momentum_5d > -3:
            score += 5
        
        # Volume (15 points)
        if volume_ratio > 1.2:
            score += 15
        elif volume_ratio > 0.8:
            score += 10
        elif volume_ratio > 0.6:
            score += 5
        
        # MACD (15 points)
        if macd_histogram and macd_histogram > 0:
            score += 15
        elif macd_histogram and macd_histogram > -0.5:
            score += 10
        
        # Trend (10 points)
        if trend == "BULLISH":
            score += 10
        elif trend == "NEUTRAL":
            score += 5
        
        return min(100.0, max(0.0, score))
    
    def _default_analysis(self, signal: Signal) -> TechnicalAnalysis:
        """Return default analysis when data is insufficient."""
        return TechnicalAnalysis(
            rsi=50.0,
            rsi_signal="NEUTRAL",
            sma_20=signal.underlying_price,
            sma_50=signal.underlying_price,
            price_vs_sma20=0.0,
            price_vs_sma50=0.0,
            momentum_5d=0.0,
            momentum_10d=0.0,
            volume_ratio=signal.volume_ratio or 1.0,
            trend="NEUTRAL",
            score=50.0,
        )

