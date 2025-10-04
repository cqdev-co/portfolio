"""Enhanced data service with optimized bulk fetching and caching."""

import asyncio
import random
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Set
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

import yfinance as yf
import pandas as pd
import numpy as np
from loguru import logger

from volatility_scanner.models.market_data import MarketData, OHLCV
from volatility_scanner.core.exceptions import DataError
from volatility_scanner.config.settings import Settings


class EnhancedDataService:
    """Enhanced data service with optimized bulk operations and intelligent caching."""
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the enhanced data service."""
        self.settings = settings
        self.cache: Dict[str, MarketData] = {}
        self.cache_timestamps: Dict[str, datetime] = {}
        self.failed_symbols: Set[str] = set()  # Track permanently failed symbols
        self.symbol_info_cache: Dict[str, Dict[str, Any]] = {}
        
        # Performance tracking
        self.stats = {
            'cache_hits': 0,
            'cache_misses': 0,
            'api_calls': 0,
            'failed_fetches': 0,
            'bulk_operations': 0
        }
        
        # Thread pool for CPU-bound operations
        self.thread_pool = ThreadPoolExecutor(
            max_workers=min(32, (settings.analysis_concurrency or 4) * 2)
        )
        
        # Rate limiting
        self._request_semaphore = asyncio.Semaphore(
            settings.max_concurrent_requests * 2  # More aggressive
        )
        self._bulk_semaphore = asyncio.Semaphore(
            settings.bulk_scan_concurrency * 3  # 3x more aggressive
        )
        self._last_request_time = None
        self._request_lock = asyncio.Lock()
        
        logger.info(f"Enhanced data service initialized with {self.thread_pool._max_workers} workers")
    
    async def get_multiple_symbols_optimized(
        self,
        symbols: List[str],
        period: str = "6mo",
        use_aggressive_settings: bool = True
    ) -> Dict[str, MarketData]:
        """
        Optimized bulk symbol fetching with intelligent batching and caching.
        
        Args:
            symbols: List of symbols to fetch
            period: Data period
            use_aggressive_settings: Use more aggressive concurrency settings
            
        Returns:
            Dictionary mapping symbols to MarketData objects
        """
        self.stats['bulk_operations'] += 1
        start_time = datetime.now()
        
        # Filter symbols
        symbols = [s.upper().strip() for s in symbols if s.strip()]
        symbols = [s for s in symbols if s not in self.failed_symbols]
        
        if not symbols:
            return {}
        
        logger.info(f"Optimized bulk fetch for {len(symbols)} symbols (period: {period})")
        
        # Check cache first
        cache_hits, symbols_to_fetch = self._check_cache_bulk(symbols, period)
        
        if cache_hits:
            logger.info(f"Cache hits: {len(cache_hits)}/{len(symbols)} symbols")
            self.stats['cache_hits'] += len(cache_hits)
        
        if not symbols_to_fetch:
            return cache_hits
        
        self.stats['cache_misses'] += len(symbols_to_fetch)
        
        # Use bulk yfinance download when possible
        if len(symbols_to_fetch) > 10:
            bulk_data = await self._fetch_bulk_yfinance(symbols_to_fetch, period)
        else:
            bulk_data = await self._fetch_individual_optimized(symbols_to_fetch, period, use_aggressive_settings)
        
        # Combine results
        all_data = {**cache_hits, **bulk_data}
        
        # Update cache
        for symbol, data in bulk_data.items():
            cache_key = f"{symbol}_{period}"
            self.cache[cache_key] = data
            self.cache_timestamps[cache_key] = datetime.now()
        
        duration = (datetime.now() - start_time).total_seconds()
        success_rate = len(all_data) / len(symbols) * 100
        
        logger.info(
            f"Bulk fetch complete: {len(all_data)}/{len(symbols)} symbols "
            f"({success_rate:.1f}% success) in {duration:.1f}s "
            f"({len(symbols)/duration:.1f} symbols/sec)"
        )
        
        return all_data
    
    def _check_cache_bulk(self, symbols: List[str], period: str) -> tuple[Dict[str, MarketData], List[str]]:
        """Check cache for multiple symbols efficiently."""
        cache_hits = {}
        symbols_to_fetch = []
        
        for symbol in symbols:
            cache_key = f"{symbol}_{period}"
            if self._is_cache_valid(cache_key):
                cache_hits[symbol] = self.cache[cache_key]
            else:
                symbols_to_fetch.append(symbol)
        
        return cache_hits, symbols_to_fetch
    
    async def _fetch_bulk_yfinance(self, symbols: List[str], period: str) -> Dict[str, MarketData]:
        """Use yfinance bulk download for better performance."""
        logger.info(f"Using bulk yfinance download for {len(symbols)} symbols")
        
        try:
            # Use yfinance bulk download
            async def bulk_download():
                # Join symbols for bulk download
                symbols_str = " ".join(symbols)
                data = yf.download(
                    symbols_str,
                    period=period,
                    group_by='ticker',
                    auto_adjust=True,
                    prepost=False,
                    threads=True,  # Enable threading
                    progress=False
                )
                return data
            
            self.stats['api_calls'] += 1
            bulk_df = await asyncio.get_event_loop().run_in_executor(
                self.thread_pool, 
                lambda: yf.download(
                    " ".join(symbols),
                    period=period,
                    group_by='ticker',
                    auto_adjust=True,
                    prepost=False,
                    threads=True,
                    progress=False
                )
            )
            
            if bulk_df.empty:
                logger.warning("Bulk download returned empty data")
                return await self._fetch_individual_optimized(symbols, period, True)
            
            # Process bulk data
            result = {}
            
            if len(symbols) == 1:
                # Single symbol case
                symbol = symbols[0]
                if not bulk_df.empty:
                    market_data = await self._process_dataframe_to_market_data(bulk_df, symbol)
                    if market_data:
                        result[symbol] = market_data
            else:
                # Multiple symbols case
                for symbol in symbols:
                    try:
                        if symbol in bulk_df.columns.get_level_values(0):
                            symbol_df = bulk_df[symbol].dropna()
                            if not symbol_df.empty:
                                market_data = await self._process_dataframe_to_market_data(symbol_df, symbol)
                                if market_data:
                                    result[symbol] = market_data
                        else:
                            logger.debug(f"Symbol {symbol} not found in bulk data")
                    except Exception as e:
                        logger.debug(f"Error processing bulk data for {symbol}: {e}")
                        continue
            
            logger.info(f"Bulk download successful: {len(result)}/{len(symbols)} symbols")
            return result
            
        except Exception as e:
            logger.warning(f"Bulk download failed: {e}, falling back to individual fetches")
            return await self._fetch_individual_optimized(symbols, period, True)
    
    async def _fetch_individual_optimized(
        self, 
        symbols: List[str], 
        period: str, 
        use_aggressive_settings: bool
    ) -> Dict[str, MarketData]:
        """Optimized individual symbol fetching with higher concurrency."""
        
        # Use more aggressive concurrency for individual fetches
        max_concurrent = self.settings.bulk_scan_concurrency * 4 if use_aggressive_settings else self.settings.bulk_scan_concurrency
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def fetch_single_optimized(symbol: str) -> tuple[str, Optional[MarketData]]:
            async with semaphore:
                try:
                    # Reduced delay for aggressive mode
                    if use_aggressive_settings:
                        await asyncio.sleep(random.uniform(0.05, 0.1))  # 50-100ms
                    else:
                        await asyncio.sleep(self.settings.request_delay_seconds)
                    
                    ticker = yf.Ticker(symbol)
                    
                    # Fetch data in thread pool
                    hist_data = await asyncio.get_event_loop().run_in_executor(
                        self.thread_pool,
                        lambda: ticker.history(period=period)
                    )
                    
                    if hist_data.empty:
                        self.failed_symbols.add(symbol)  # Cache failure
                        return symbol, None
                    
                    # Process to MarketData
                    market_data = await self._process_dataframe_to_market_data(hist_data, symbol)
                    self.stats['api_calls'] += 1
                    return symbol, market_data
                    
                except Exception as e:
                    logger.debug(f"Failed to fetch {symbol}: {e}")
                    self.stats['failed_fetches'] += 1
                    return symbol, None
        
        # Execute all fetches concurrently
        logger.debug(f"Fetching {len(symbols)} symbols individually with {max_concurrent} concurrency")
        tasks = [fetch_single_optimized(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        data_dict = {}
        for result in results:
            if isinstance(result, Exception):
                continue
            symbol, data = result
            if data is not None:
                data_dict[symbol] = data
        
        return data_dict
    
    async def _process_dataframe_to_market_data(self, df: pd.DataFrame, symbol: str) -> Optional[MarketData]:
        """Convert pandas DataFrame to MarketData object efficiently."""
        try:
            if df.empty:
                return None
            
            # Clean data
            df = self._clean_ohlc_data(df, symbol)
            if df.empty:
                return None
            
            # Convert to OHLCV objects
            ohlcv_data = []
            for timestamp, row in df.iterrows():
                try:
                    # Handle timezone-aware datetimes
                    if hasattr(timestamp, 'tz') and timestamp.tz is not None:
                        timestamp_naive = timestamp.tz_convert('UTC').tz_localize(None)
                    else:
                        timestamp_naive = timestamp.to_pydatetime() if hasattr(timestamp, 'to_pydatetime') else timestamp
                    
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
                    logger.debug(f"Skipping invalid data point for {symbol}: {e}")
                    continue
            
            if not ohlcv_data:
                return None
            
            # Create MarketData object (without expensive ticker.info call)
            market_data = MarketData(
                symbol=symbol,
                name=symbol,  # Use symbol as name to avoid extra API call
                sector=None,
                market_cap=None,
                ohlcv_data=ohlcv_data,
                indicators=[],
                data_start=ohlcv_data[0].timestamp,
                data_end=ohlcv_data[-1].timestamp,
                last_updated=datetime.now()
            )
            
            return market_data
            
        except Exception as e:
            logger.debug(f"Error processing DataFrame for {symbol}: {e}")
            return None
    
    def _clean_ohlc_data(self, data: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Clean OHLC data efficiently."""
        if data.empty:
            return data
        
        original_length = len(data)
        
        # Remove NaN values
        data = data.dropna()
        
        # Fix OHLC relationships using numpy operations
        data.loc[:, 'High'] = np.maximum.reduce([
            data['High'].values, 
            data['Open'].values, 
            data['Close'].values, 
            data['Low'].values
        ])
        
        data.loc[:, 'Low'] = np.minimum.reduce([
            data['Low'].values, 
            data['Open'].values, 
            data['Close'].values, 
            data['High'].values
        ])
        
        # Remove invalid rows
        valid_mask = (
            (data['High'] >= data['Open']) &
            (data['High'] >= data['Close']) &
            (data['High'] >= data['Low']) &
            (data['Low'] <= data['Open']) &
            (data['Low'] <= data['Close']) &
            (data['Open'] > 0) &
            (data['High'] > 0) &
            (data['Low'] > 0) &
            (data['Close'] > 0) &
            (data['Volume'] >= 0)
        )
        
        cleaned_data = data[valid_mask]
        
        if len(cleaned_data) < original_length:
            logger.debug(f"Cleaned {symbol}: removed {original_length - len(cleaned_data)} invalid rows")
        
        return cleaned_data
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid."""
        if cache_key not in self.cache or cache_key not in self.cache_timestamps:
            return False
        
        cache_age = datetime.now() - self.cache_timestamps[cache_key]
        return cache_age.total_seconds() < self.settings.yfinance_cache_ttl
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        total_requests = self.stats['cache_hits'] + self.stats['cache_misses']
        cache_hit_rate = (self.stats['cache_hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self.stats,
            'cache_hit_rate_percent': cache_hit_rate,
            'cached_symbols': len(self.cache),
            'failed_symbols_count': len(self.failed_symbols),
            'thread_pool_workers': self.thread_pool._max_workers
        }
    
    def clear_failed_symbols(self) -> None:
        """Clear the failed symbols cache."""
        self.failed_symbols.clear()
        logger.info("Cleared failed symbols cache")
    
    def __del__(self):
        """Cleanup thread pool on destruction."""
        try:
            self.thread_pool.shutdown(wait=False)
        except:
            pass
