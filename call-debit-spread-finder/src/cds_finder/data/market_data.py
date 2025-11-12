"""Market data provider using yfinance."""

from typing import Optional, Dict, Any
from loguru import logger
import yfinance as yf
import pandas as pd
import numpy as np


class MarketDataProvider:
    """Fetch market data and technical indicators using yfinance."""
    
    def __init__(self):
        """Initialize market data provider."""
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def get_ticker_info(self, ticker: str) -> Optional[yf.Ticker]:
        """
        Get yfinance Ticker object.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            Ticker object or None if error
        """
        try:
            return yf.Ticker(ticker)
        except Exception as e:
            logger.warning(f"Error getting ticker {ticker}: {e}")
            return None
    
    def get_historical_data(
        self,
        ticker: str,
        period: str = "1y"
    ) -> Optional[pd.DataFrame]:
        """
        Get historical price data.
        
        Args:
            ticker: Stock symbol
            period: Period to fetch (1y, 6mo, 3mo, etc.)
            
        Returns:
            DataFrame with OHLCV data or None
        """
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty:
                logger.warning(f"No historical data for {ticker}")
                return None
            
            return hist
        except Exception as e:
            logger.warning(f"Error fetching historical data for {ticker}: {e}")
            return None
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get current stock price.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            Current price or None
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Try multiple price fields
            price = (
                info.get("currentPrice") or
                info.get("regularMarketPrice") or
                info.get("previousClose")
            )
            
            if price:
                return float(price)
            
            # Fallback: get from history
            hist = self.get_historical_data(ticker, period="1d")
            if hist is not None and not hist.empty:
                return float(hist["Close"].iloc[-1])
            
            return None
        except Exception as e:
            logger.warning(f"Error getting current price for {ticker}: {e}")
            return None
    
    def get_fundamental_data(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get fundamental data from yfinance.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            Dictionary with fundamental metrics
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Extract key fundamental metrics
            fundamentals = {
                "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
                "market_cap": info.get("marketCap"),
                "revenue_growth": info.get("revenueGrowth"),
                "earnings_growth": info.get("earningsGrowth"),
                "profit_margin": info.get("profitMargins"),
                "debt_to_equity": info.get("debtToEquity"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
            }
            
            return fundamentals
        except Exception as e:
            logger.warning(f"Error getting fundamental data for {ticker}: {e}")
            return None
    
    def get_option_chain(
        self,
        ticker: str,
        expiry: Optional[str] = None
    ) -> Optional[Any]:
        """
        Get option chain data.
        
        Args:
            ticker: Stock symbol
            expiry: Expiry date (optional, gets nearest if not provided)
            
        Returns:
            Option chain data or None
        """
        try:
            stock = yf.Ticker(ticker)
            
            if expiry:
                # Get specific expiry
                expirations = stock.options
                if expiry in expirations:
                    opt_chain = stock.option_chain(expiry)
                    return opt_chain
                else:
                    logger.warning(f"Expiry {expiry} not found for {ticker}")
                    return None
            else:
                # Get nearest expiry
                expirations = stock.options
                if not expirations:
                    logger.warning(f"No option expirations for {ticker}")
                    return None
                
                nearest_expiry = expirations[0]
                opt_chain = stock.option_chain(nearest_expiry)
                return opt_chain
        except Exception as e:
            logger.warning(f"Error getting option chain for {ticker}: {e}")
            return None
    
    def calculate_rsi(
        self,
        prices: pd.Series,
        period: int = 14
    ) -> Optional[float]:
        """
        Calculate RSI indicator.
        
        Args:
            prices: Price series
            period: RSI period
            
        Returns:
            RSI value or None
        """
        try:
            if len(prices) < period + 1:
                return None
            
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            
            return float(rsi.iloc[-1])
        except Exception as e:
            logger.warning(f"Error calculating RSI: {e}")
            return None
    
    def calculate_macd(
        self,
        prices: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Optional[Dict[str, float]]:
        """
        Calculate MACD indicator.
        
        Args:
            prices: Price series
            fast: Fast EMA period
            slow: Slow EMA period
            signal: Signal line period
            
        Returns:
            Dictionary with macd, signal, histogram or None
        """
        try:
            if len(prices) < slow + signal:
                return None
            
            ema_fast = prices.ewm(span=fast, adjust=False).mean()
            ema_slow = prices.ewm(span=slow, adjust=False).mean()
            
            macd_line = ema_fast - ema_slow
            signal_line = macd_line.ewm(span=signal, adjust=False).mean()
            histogram = macd_line - signal_line
            
            return {
                "macd": float(macd_line.iloc[-1]),
                "signal": float(signal_line.iloc[-1]),
                "histogram": float(histogram.iloc[-1]),
            }
        except Exception as e:
            logger.warning(f"Error calculating MACD: {e}")
            return None

