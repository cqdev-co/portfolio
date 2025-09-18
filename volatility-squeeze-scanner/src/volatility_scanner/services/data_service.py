"""Data service for market data retrieval and management."""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
import logging

import yfinance as yf
import pandas as pd
import numpy as np
from loguru import logger

from volatility_scanner.models.market_data import MarketData, OHLCV
from volatility_scanner.core.exceptions import DataError
from volatility_scanner.config.settings import Settings


class DataService:
    """Service for retrieving and managing market data."""
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the data service."""
        self.settings = settings
        self.cache: Dict[str, MarketData] = {}
        self.cache_timestamps: Dict[str, datetime] = {}
        self._last_request_time: Optional[datetime] = None
        self._request_lock = asyncio.Lock()
    
    async def _respect_rate_limit(self) -> None:
        """Ensure we respect rate limits by adding delays between requests."""
        async with self._request_lock:
            if self._last_request_time is not None:
                time_since_last = (datetime.now() - self._last_request_time).total_seconds()
                if time_since_last < self.settings.request_delay_seconds:
                    delay = self.settings.request_delay_seconds - time_since_last
                    # Add small random jitter to avoid thundering herd
                    jitter = random.uniform(0, 0.1)
                    await asyncio.sleep(delay + jitter)
            
            self._last_request_time = datetime.now()
    
    async def _retry_with_backoff(self, func, *args, **kwargs):
        """
        Execute a function with exponential backoff retry logic.
        
        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            DataError: If all retries are exhausted
        """
        last_exception = None
        
        for attempt in range(self.settings.max_retries + 1):
            try:
                # Respect rate limits before each attempt
                await self._respect_rate_limit()
                
                # Execute the function
                return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
                
            except Exception as e:
                last_exception = e
                error_msg = str(e).lower()
                
                # Check if this is a rate limit error
                if any(term in error_msg for term in [
                    'rate limit', 'too many requests', 'throttle', 
                    '429', 'quota exceeded', 'limit exceeded'
                ]):
                    if attempt < self.settings.max_retries:
                        # Calculate exponential backoff with jitter
                        delay = (self.settings.retry_delay_base * 
                                (self.settings.rate_limit_backoff_factor ** attempt))
                        jitter = random.uniform(0.1, 0.3) * delay
                        total_delay = delay + jitter
                        
                        logger.warning(
                            f"Rate limited on attempt {attempt + 1}, "
                            f"retrying in {total_delay:.2f}s: {e}"
                        )
                        await asyncio.sleep(total_delay)
                        continue
                
                # For non-rate-limit errors, fail fast
                if attempt == 0:
                    raise e
                
                # For other errors, use shorter backoff
                if attempt < self.settings.max_retries:
                    delay = self.settings.retry_delay_base * (1.5 ** attempt)
                    logger.warning(f"Retrying after error on attempt {attempt + 1}: {e}")
                    await asyncio.sleep(delay)
                    continue
                
                # All retries exhausted
                break
        
        # If we get here, all retries failed
        raise DataError(f"Failed after {self.settings.max_retries + 1} attempts: {last_exception}")
        
    async def get_market_data(
        self,
        symbol: str,
        period: str = "1y",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        force_refresh: bool = False
    ) -> MarketData:
        """
        Get market data for a symbol with enhanced error handling.
        
        Args:
            symbol: Stock/ETF symbol
            period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            start_date: Start date for historical data (YYYY-MM-DD)
            end_date: End date for historical data (YYYY-MM-DD)
            force_refresh: Force refresh from API
            
        Returns:
            MarketData object with OHLCV data
            
        Raises:
            DataError: If data retrieval fails
        """
        symbol = symbol.upper().strip()
        cache_key = f"{symbol}_{period}"
        
        # Check cache first
        if not force_refresh and self._is_cache_valid(cache_key):
            logger.info(f"Returning cached data for {symbol}")
            return self.cache[cache_key]
        
        try:
            # Fetch data from yfinance with retry logic
            logger.info(f"Fetching market data for {symbol} (period: {period})")
            
            async def fetch_data():
                ticker = yf.Ticker(symbol)
                
                # Get historical data with proper date handling
                if start_date and end_date:
                    return ticker.history(start=start_date, end=end_date)
                else:
                    return ticker.history(period=period)
            
            hist_data = await self._retry_with_backoff(fetch_data)
                
            if hist_data.empty:
                raise DataError(f"No data available for symbol {symbol}")
            
            # Clean the data to fix OHLC violations
            hist_data = self._clean_ohlc_data(hist_data, symbol)
            
            # Get ticker info with retry logic
            info = {}
            try:
                async def fetch_info():
                    ticker = yf.Ticker(symbol)
                    return ticker.info
                
                info = await self._retry_with_backoff(fetch_info)
            except Exception as e:
                logger.warning(f"Could not fetch ticker info for {symbol}: {e}")
            
            # Convert to OHLCV objects with proper datetime handling
            ohlcv_data = []
            for timestamp, row in hist_data.iterrows():
                try:
                    # Handle timezone-aware datetimes properly
                    if timestamp.tz is not None:
                        # Convert to UTC and make naive
                        timestamp_naive = timestamp.tz_convert('UTC').tz_localize(None)
                    else:
                        timestamp_naive = timestamp.to_pydatetime()
                    
                    ohlcv = OHLCV(
                        timestamp=timestamp_naive,
                        open=float(row['Open']),
                        high=float(row['High']),
                        low=float(row['Low']),
                        close=float(row['Close']),
                        volume=int(row['Volume'])
                    )
                    ohlcv_data.append(ohlcv)
                    
                except Exception as e:
                    logger.warning(f"Skipping invalid data point for {symbol} at {timestamp}: {e}")
                    continue
            
            # Create MarketData object
            market_data = MarketData(
                symbol=symbol,
                name=info.get('longName', symbol),
                sector=info.get('sector'),
                market_cap=info.get('marketCap'),
                ohlcv_data=ohlcv_data,
                indicators=[],  # Will be populated by technical analysis
                data_start=ohlcv_data[0].timestamp,
                data_end=ohlcv_data[-1].timestamp,
                last_updated=datetime.now()
            )
            
            # Cache the result
            self.cache[cache_key] = market_data
            self.cache_timestamps[cache_key] = datetime.now()
            
            logger.info(
                f"Successfully fetched {len(ohlcv_data)} data points for {symbol}"
            )
            return market_data
            
        except Exception as e:
            error_msg = f"Failed to fetch data for {symbol}: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    async def get_multiple_symbols(
        self,
        symbols: List[str],
        period: str = "1y",
        max_concurrent: Optional[int] = None,
        use_bulk_mode: bool = False
    ) -> Dict[str, MarketData]:
        """
        Get market data for multiple symbols concurrently.
        
        Args:
            symbols: List of symbols to fetch
            period: Data period
            max_concurrent: Maximum concurrent requests
            use_bulk_mode: Use optimized settings for bulk operations
            
        Returns:
            Dictionary mapping symbols to MarketData objects
        """
        if max_concurrent is None:
            if use_bulk_mode:
                max_concurrent = self.settings.bulk_scan_concurrency
            else:
                max_concurrent = self.settings.max_concurrent_requests
        
        # Filter out symbols we already have cached
        cache_hits = {}
        symbols_to_fetch = []
        
        for symbol in symbols:
            cache_key = f"{symbol.upper().strip()}_{period}"
            if self._is_cache_valid(cache_key):
                cache_hits[symbol] = self.cache[cache_key]
            else:
                symbols_to_fetch.append(symbol)
        
        if cache_hits:
            logger.info(f"Cache hits: {len(cache_hits)}/{len(symbols)} symbols")
        
        if not symbols_to_fetch:
            return cache_hits
        
        # Use semaphore for concurrency control
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def fetch_single(symbol: str) -> tuple[str, Optional[MarketData]]:
            async with semaphore:
                try:
                    data = await self.get_market_data(symbol, period)
                    return symbol, data
                except DataError as e:
                    logger.debug(f"Failed to fetch {symbol}: {e}")
                    return symbol, None
                except Exception as e:
                    logger.debug(f"Unexpected error for {symbol}: {e}")
                    return symbol, None
        
        # Execute all requests concurrently
        logger.info(f"Fetching {len(symbols_to_fetch)} symbols with {max_concurrent} concurrent requests")
        tasks = [fetch_single(symbol) for symbol in symbols_to_fetch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        data_dict = cache_hits.copy()
        successful_fetches = 0
        
        for result in results:
            if isinstance(result, Exception):
                logger.debug(f"Task exception: {result}")
                continue
            
            symbol, data = result
            if data is not None:
                data_dict[symbol] = data
                successful_fetches += 1
        
        logger.info(
            f"Successfully fetched {successful_fetches} new + {len(cache_hits)} cached = {len(data_dict)}/{len(symbols)} symbols"
        )
        return data_dict
    
    async def get_multiple_symbols_chunked(
        self,
        symbols: List[str],
        period: str = "1y",
        chunk_size: Optional[int] = None,
        max_concurrent: Optional[int] = None
    ) -> Dict[str, MarketData]:
        """
        Get market data for multiple symbols in chunks to avoid overwhelming APIs.
        
        Args:
            symbols: List of symbols to fetch
            period: Data period
            chunk_size: Size of each chunk
            max_concurrent: Maximum concurrent requests per chunk
            
        Returns:
            Dictionary mapping symbols to MarketData objects
        """
        if chunk_size is None:
            chunk_size = self.settings.bulk_scan_batch_size
        
        if max_concurrent is None:
            max_concurrent = self.settings.bulk_scan_concurrency
        
        all_data = {}
        total_chunks = (len(symbols) + chunk_size - 1) // chunk_size
        
        for i in range(0, len(symbols), chunk_size):
            chunk = symbols[i:i + chunk_size]
            chunk_num = i // chunk_size + 1
            
            logger.info(f"Processing chunk {chunk_num}/{total_chunks} ({len(chunk)} symbols)")
            
            try:
                chunk_data = await self.get_multiple_symbols(
                    chunk, 
                    period=period, 
                    max_concurrent=max_concurrent,
                    use_bulk_mode=True
                )
                all_data.update(chunk_data)
                
                # Delay between chunks to be respectful to APIs
                if chunk_num < total_chunks:
                    await asyncio.sleep(self.settings.chunk_delay_seconds)
                    
            except Exception as e:
                logger.error(f"Error processing chunk {chunk_num}: {e}")
                continue
        
        return all_data
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid."""
        if cache_key not in self.cache or cache_key not in self.cache_timestamps:
            return False
        
        cache_age = datetime.now() - self.cache_timestamps[cache_key]
        return cache_age.total_seconds() < self.settings.yfinance_cache_ttl
    
    def clear_cache(self, symbol: Optional[str] = None) -> None:
        """Clear cache for a specific symbol or all symbols."""
        if symbol:
            symbol = symbol.upper().strip()
            keys_to_remove = [
                key for key in self.cache.keys() 
                if key.startswith(f"{symbol}_")
            ]
            for key in keys_to_remove:
                self.cache.pop(key, None)
                self.cache_timestamps.pop(key, None)
            logger.info(f"Cleared cache for {symbol}")
        else:
            self.cache.clear()
            self.cache_timestamps.clear()
            logger.info("Cleared all cache")
    
    def _clean_ohlc_data(self, data: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """
        Clean OHLC data to fix validation issues.
        
        Args:
            data: Raw OHLC DataFrame from yfinance
            symbol: Symbol name for logging
            
        Returns:
            Cleaned DataFrame with valid OHLC relationships
        """
        original_length = len(data)
        data = data.copy()
        
        # Remove rows with NaN values
        data = data.dropna()
        
        # Fix OHLC relationships
        # Ensure High is at least the maximum of Open, Close, Low
        data['High'] = np.maximum.reduce([
            data['High'], 
            data['Open'], 
            data['Close'], 
            data['Low']
        ])
        
        # Ensure Low is at most the minimum of Open, Close, High
        data['Low'] = np.minimum.reduce([
            data['Low'], 
            data['Open'], 
            data['Close'], 
            data['High']
        ])
        
        # Remove any remaining invalid rows (safety check)
        valid_rows = (
            (data['High'] >= data['Open']) &
            (data['High'] >= data['Close']) &
            (data['High'] >= data['Low']) &
            (data['Low'] <= data['Open']) &
            (data['Low'] <= data['Close']) &
            (data['Low'] <= data['High']) &
            (data['Open'] > 0) &
            (data['High'] > 0) &
            (data['Low'] > 0) &
            (data['Close'] > 0) &
            (data['Volume'] >= 0)
        )
        
        cleaned_data = data[valid_rows]
        
        if len(cleaned_data) < original_length:
            logger.info(f"Cleaned {symbol} data: removed {original_length - len(cleaned_data)} invalid rows")
        
        return cleaned_data
    
    async def validate_symbol(self, symbol: str) -> bool:
        """
        Validate if a symbol exists and has data.
        
        Args:
            symbol: Symbol to validate
            
        Returns:
            True if symbol is valid, False otherwise
        """
        try:
            async def validate():
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                # Check if we got valid info
                if not info or 'regularMarketPrice' not in info:
                    return False
                
                # Try to get a small amount of recent data
                hist = ticker.history(period="5d")
                return not hist.empty
            
            return await self._retry_with_backoff(validate)
            
        except Exception as e:
            logger.warning(f"Symbol validation failed for {symbol}: {e}")
            return False
    
    async def get_symbol_info(self, symbol: str) -> Dict[str, Any]:
        """
        Get detailed information about a symbol.
        
        Args:
            symbol: Symbol to get info for
            
        Returns:
            Dictionary with symbol information
            
        Raises:
            DataError: If symbol info cannot be retrieved
        """
        try:
            async def fetch_symbol_info():
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                if not info:
                    raise DataError(f"No information available for {symbol}")
                
                return info
            
            info = await self._retry_with_backoff(fetch_symbol_info)
            
            # Extract relevant information
            return {
                'symbol': symbol.upper(),
                'name': info.get('longName', symbol),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'market_cap': info.get('marketCap'),
                'current_price': info.get('regularMarketPrice'),
                'currency': info.get('currency', 'USD'),
                'exchange': info.get('exchange'),
                'country': info.get('country'),
                'website': info.get('website'),
                'description': info.get('longBusinessSummary', '')[:500],  # Truncate
                'employees': info.get('fullTimeEmployees'),
                'dividend_yield': info.get('dividendYield'),
                'pe_ratio': info.get('trailingPE'),
                'beta': info.get('beta'),
                '52_week_high': info.get('fiftyTwoWeekHigh'),
                '52_week_low': info.get('fiftyTwoWeekLow'),
                'avg_volume': info.get('averageVolume'),
            }
            
        except Exception as e:
            error_msg = f"Failed to get info for {symbol}: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'cached_symbols': len(self.cache),
            'cache_keys': list(self.cache.keys()),
            'oldest_cache_entry': min(
                self.cache_timestamps.values(), 
                default=None
            ),
            'newest_cache_entry': max(
                self.cache_timestamps.values(),
                default=None
            ),
            'cache_ttl_seconds': self.settings.yfinance_cache_ttl,
        }
