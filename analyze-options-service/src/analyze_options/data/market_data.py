"""Market data provider using yfinance."""

import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from loguru import logger

from ..models.analysis import TechnicalIndicators


class MarketDataProvider:
    """
    Fetch market data and technical indicators using yfinance.
    Optimized to only fetch data for tickers with signals.
    """
    
    def __init__(self):
        self.cache: Dict[str, tuple[datetime, any]] = {}
        self.cache_ttl = timedelta(minutes=15)
    
    def get_technical_indicators(
        self, 
        ticker: str
    ) -> Optional[TechnicalIndicators]:
        """
        Get technical indicators (RSI, MA, momentum) for a ticker.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            TechnicalIndicators or None if error
        """
        try:
            # Fetch historical data (1 year for 200-day MA)
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            
            if hist.empty or len(hist) < 20:
                logger.warning(f"Insufficient data for {ticker}")
                return None
            
            # Current price
            current_price = float(hist['Close'].iloc[-1])
            
            # RSI (14-day)
            rsi = self._calculate_rsi(hist['Close'], period=14)
            
            # Moving Averages
            ma_20 = float(hist['Close'].rolling(window=20).mean().iloc[-1])
            ma_50 = float(hist['Close'].rolling(window=50).mean().iloc[-1])
            ma_200 = float(hist['Close'].rolling(window=200).mean().iloc[-1])
            
            # Momentum
            momentum_5d = float(
                (hist['Close'].iloc[-1] / hist['Close'].iloc[-6] - 1) * 100
            ) if len(hist) >= 6 else 0.0
            
            momentum_10d = float(
                (hist['Close'].iloc[-1] / hist['Close'].iloc[-11] - 1) * 100
            ) if len(hist) >= 11 else 0.0
            
            # Volume
            current_volume = int(hist['Volume'].iloc[-1])
            avg_volume_20d = float(hist['Volume'].rolling(window=20).mean().iloc[-1])
            volume_ratio = current_volume / avg_volume_20d if avg_volume_20d > 0 else 0
            
            # Trend signals
            is_above_ma_50 = current_price > ma_50
            is_above_ma_200 = current_price > ma_200
            is_golden_cross = ma_50 > ma_200
            is_death_cross = ma_50 < ma_200
            
            return TechnicalIndicators(
                ticker=ticker,
                price=current_price,
                rsi=rsi,
                ma_20=ma_20,
                ma_50=ma_50,
                ma_200=ma_200,
                momentum_5d=momentum_5d,
                momentum_10d=momentum_10d,
                current_volume=current_volume,
                avg_volume_20d=avg_volume_20d,
                volume_ratio=volume_ratio,
                is_above_ma_50=is_above_ma_50,
                is_above_ma_200=is_above_ma_200,
                is_golden_cross=is_golden_cross,
                is_death_cross=is_death_cross
            )
            
        except Exception as e:
            logger.error(f"Error fetching technical indicators for {ticker}: {e}")
            return None
    
    def batch_get_technical_indicators(
        self,
        tickers: List[str]
    ) -> Dict[str, Optional[TechnicalIndicators]]:
        """
        Fetch technical indicators for multiple tickers efficiently.
        
        Args:
            tickers: List of stock symbols
            
        Returns:
            Dict mapping ticker to TechnicalIndicators
        """
        logger.info(f"Fetching technical indicators for {len(tickers)} tickers")
        
        results = {}
        for ticker in tickers:
            results[ticker] = self.get_technical_indicators(ticker)
        
        return results
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """Get current stock price."""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            return float(info.get('currentPrice', info.get('regularMarketPrice', 0)))
        except Exception as e:
            logger.error(f"Error fetching price for {ticker}: {e}")
            return None
    
    def get_option_chain(self, ticker: str, expiry_date: str) -> Optional[pd.DataFrame]:
        """
        Get option chain for a specific expiry.
        
        Args:
            ticker: Stock symbol
            expiry_date: Expiry date string (YYYY-MM-DD)
            
        Returns:
            DataFrame with calls and puts
        """
        try:
            stock = yf.Ticker(ticker)
            option_chain = stock.option_chain(expiry_date)
            return option_chain
        except Exception as e:
            logger.error(f"Error fetching option chain for {ticker}: {e}")
            return None
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """
        Calculate RSI (Relative Strength Index).
        
        Args:
            prices: Series of closing prices
            period: RSI period (default 14)
            
        Returns:
            RSI value (0-100)
        """
        delta = prices.diff()
        
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
    
    def get_earnings_date(self, ticker: str) -> Optional[datetime]:
        """Get next earnings date."""
        try:
            stock = yf.Ticker(ticker)
            calendar = stock.calendar
            
            if calendar and 'Earnings Date' in calendar:
                earnings_dates = calendar['Earnings Date']
                if isinstance(earnings_dates, list) and len(earnings_dates) > 0:
                    return earnings_dates[0]
                elif isinstance(earnings_dates, datetime):
                    return earnings_dates
        except Exception as e:
            logger.debug(f"Could not fetch earnings date for {ticker}: {e}")
        
        return None


# Singleton instance for convenience
_provider = MarketDataProvider()


# Standalone helper functions for easy imports
def get_technical_indicators(ticker: str) -> Optional[TechnicalIndicators]:
    """Get technical indicators for a ticker."""
    return _provider.get_technical_indicators(ticker)


def batch_get_technical_indicators(tickers: List[str]) -> Dict[str, Optional[TechnicalIndicators]]:
    """Batch fetch technical indicators for multiple tickers."""
    return _provider.batch_get_technical_indicators(tickers)


def get_current_price(ticker: str) -> Optional[float]:
    """Get current stock price."""
    return _provider.get_current_price(ticker)


def get_option_chain(ticker: str, expiry_date):
    """Get option chain for a specific expiry."""
    # Convert date object to string if needed
    if hasattr(expiry_date, 'strftime'):
        expiry_date = expiry_date.strftime('%Y-%m-%d')
    return _provider.get_option_chain(ticker, expiry_date)


def get_implied_volatility(ticker: str, strike: float, expiry_date: str, option_type: str = 'call') -> Optional[float]:
    """Get implied volatility for a specific option."""
    chain = get_option_chain(ticker, expiry_date)
    if chain is None:
        return None
    
    try:
        options_df = chain.calls if option_type == 'call' else chain.puts
        option = options_df[options_df['strike'] == strike]
        
        if not option.empty and 'impliedVolatility' in option.columns:
            return float(option['impliedVolatility'].iloc[0])
    except Exception as e:
        logger.error(f"Error getting IV for {ticker}: {e}")
    
    return None

