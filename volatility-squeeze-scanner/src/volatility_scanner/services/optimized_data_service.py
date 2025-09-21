"""Optimized data service with intelligent caching and aggressive concurrency."""

import asyncio
import random
import time
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Set, Tuple, AsyncGenerator
from concurrent.futures import ThreadPoolExecutor
import threading
from dataclasses import dataclass

import yfinance as yf
import pandas as pd
import numpy as np
from loguru import logger

from volatility_scanner.models.market_data import MarketData, OHLCV
from volatility_scanner.core.exceptions import DataError
from volatility_scanner.config.settings import Settings


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    data: MarketData
    timestamp: datetime
    access_count: int = 0
    last_accessed: datetime = None
    
    def __post_init__(self):
        if self.last_accessed is None:
            self.last_accessed = self.timestamp


@dataclass
class FetchStats:
    """Statistics for data fetching operations."""
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    failed_requests: int = 0
    total_fetch_time: float = 0.0
    average_fetch_time: float = 0.0
    
    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return (self.cache_hits / total * 100) if total > 0 else 0.0


class OptimizedDataService:
    """
    Highly optimized data service with:
    - Intelligent multi-level caching
    - Aggressive concurrency with smart rate limiting
    - Bulk operations with chunking
    - Memory-efficient processing
    - Real-time statistics
    """
    
    def __init__(self, settings: Settings):
        self.settings = settings
        
        # Multi-level cache system
        self.memory_cache: Dict[str, CacheEntry] = {}
        self.failed_symbols: Set[str] = set()  # Permanent failure cache
        self.rate_limited_symbols: Dict[str, datetime] = {}  # Temporary rate limit cache
        
        # Cache configuration
        self.max_cache_size = 5000  # Maximum symbols in memory cache
        self.cache_ttl_seconds = settings.yfinance_cache_ttl or 1800  # 30 minutes default
        self.failed_symbol_ttl = 3600  # 1 hour for failed symbols
        self.rate_limit_ttl = 300  # 5 minutes for rate limited symbols
        
        # Concurrency control
        self.max_concurrent = min(100, settings.bulk_scan_concurrency * 4)  # Aggressive
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        self.request_delay = max(0.01, settings.request_delay_seconds / 4)  # 4x faster
        
        # Thread pool for CPU-bound operations
        self.thread_pool = ThreadPoolExecutor(
            max_workers=min(50, settings.analysis_concurrency or 20)
        )
        
        # Statistics
        self.stats = FetchStats()
        self._stats_lock = threading.Lock()
        
        # Rate limiting
        self._last_request_times: Dict[str, datetime] = {}
        self._request_lock = asyncio.Lock()
        
        logger.info(f"Optimized data service initialized: {self.max_concurrent} concurrent, "
                   f"{self.request_delay*1000:.0f}ms delay, {self.max_cache_size} cache size")
    
    async def get_market_data_optimized(
        self,
        symbol: str,
        period: str = "6mo",
        force_refresh: bool = False
    ) -> Optional[MarketData]:
        """
        Get market data with optimized caching and error handling.
        
        Args:
            symbol: Stock symbol
            period: Data period
            force_refresh: Force cache refresh
            
        Returns:
            MarketData object or None if failed
        """
        cache_key = f"{symbol}_{period}"
        
        # Check permanent failure cache
        if symbol in self.failed_symbols:
            return None
        
        # Check rate limit cache
        if symbol in self.rate_limited_symbols:
            if datetime.now() < self.rate_limited_symbols[symbol]:
                return None
            else:
                del self.rate_limited_symbols[symbol]
        
        # Check memory cache
        if not force_refresh and cache_key in self.memory_cache:
            entry = self.memory_cache[cache_key]
            
            # Check if cache is still valid
            if datetime.now() - entry.timestamp < timedelta(seconds=self.cache_ttl_seconds):
                entry.access_count += 1
                entry.last_accessed = datetime.now()
                
                with self._stats_lock:
                    self.stats.cache_hits += 1
                
                logger.debug(f"Cache hit for {symbol}")
                return entry.data
            else:
                # Remove expired entry
                del self.memory_cache[cache_key]
        
        # Fetch from API
        with self._stats_lock:
            self.stats.cache_misses += 1
            self.stats.total_requests += 1
        
        return await self._fetch_from_api(symbol, period, cache_key)
    
    async def get_multiple_symbols_streaming(
        self,
        symbols: List[str],
        period: str = "6mo",
        chunk_size: int = 50
    ) -> AsyncGenerator[Tuple[str, Optional[MarketData]], None]:
        """
        Stream market data for multiple symbols with chunked processing.
        
        Args:
            symbols: List of symbols to fetch
            period: Data period
            chunk_size: Number of symbols to process per chunk
            
        Yields:
            Tuples of (symbol, market_data) as they become available
        """
        logger.info(f"Streaming data for {len(symbols)} symbols in chunks of {chunk_size}")
        
        # Process in chunks to manage memory
        for i in range(0, len(symbols), chunk_size):
            chunk = symbols[i:i + chunk_size]
            
            # Create tasks for this chunk
            tasks = [
                self.get_market_data_optimized(symbol, period)
                for symbol in chunk
            ]
            
            # Process chunk concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Yield results as they complete
            for symbol, result in zip(chunk, results):
                if isinstance(result, Exception):
                    logger.debug(f"Failed to fetch {symbol}: {result}")
                    yield symbol, None
                else:
                    yield symbol, result
            
            # Small delay between chunks to be respectful
            if i + chunk_size < len(symbols):
                await asyncio.sleep(0.1)
    
    async def get_multiple_symbols_bulk(
        self,
        symbols: List[str],
        period: str = "6mo",
        max_concurrent: Optional[int] = None
    ) -> Dict[str, MarketData]:
        """
        Fetch multiple symbols with optimized bulk processing.
        
        Args:
            symbols: List of symbols to fetch
            period: Data period
            max_concurrent: Override default concurrency
            
        Returns:
            Dictionary of symbol -> MarketData
        """
        if max_concurrent:
            semaphore = asyncio.Semaphore(max_concurrent)
        else:
            semaphore = self.semaphore
        
        async def fetch_with_semaphore(symbol: str) -> Tuple[str, Optional[MarketData]]:
            async with semaphore:
                data = await self.get_market_data_optimized(symbol, period)
                return symbol, data
        
        logger.info(f"Bulk fetching {len(symbols)} symbols with {semaphore._value} concurrency")
        
        # Create all tasks
        tasks = [fetch_with_semaphore(symbol) for symbol in symbols]
        
        # Execute with progress tracking
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        symbol_data = {}
        successful = 0
        
        for result in results:
            if isinstance(result, Exception):
                logger.debug(f"Bulk fetch task failed: {result}")
                continue
            
            symbol, data = result
            if data:
                symbol_data[symbol] = data
                successful += 1
        
        elapsed = time.time() - start_time
        rate = len(symbols) / elapsed if elapsed > 0 else 0
        
        logger.info(f"Bulk fetch completed: {successful}/{len(symbols)} successful "
                   f"in {elapsed:.1f}s ({rate:.1f} symbols/sec)")
        
        return symbol_data
    
    async def _fetch_from_api(
        self,
        symbol: str,
        period: str,
        cache_key: str
    ) -> Optional[MarketData]:
        """Fetch data from yfinance API with optimized error handling."""
        
        async with self.semaphore:
            try:
                # Respect rate limits with jitter
                await self._respect_rate_limit(symbol)
                
                fetch_start = time.time()
                
                # Fetch in thread pool to avoid blocking
                ticker = yf.Ticker(symbol)
                hist_data = await asyncio.get_event_loop().run_in_executor(
                    self.thread_pool,
                    lambda: ticker.history(period=period)
                )
                
                fetch_time = time.time() - fetch_start
                
                with self._stats_lock:
                    self.stats.total_fetch_time += fetch_time
                    self.stats.average_fetch_time = (
                        self.stats.total_fetch_time / self.stats.total_requests
                    )
                
                if hist_data.empty:
                    logger.debug(f"No data available for {symbol}")
                    self.failed_symbols.add(symbol)
                    return None
                
                # Convert to MarketData
                market_data = await self._convert_dataframe_to_market_data(hist_data, symbol)
                
                # Cache the result
                self._cache_data(cache_key, market_data)
                
                logger.debug(f"Fetched {symbol} in {fetch_time:.2f}s")
                return market_data
                
            except Exception as e:
                with self._stats_lock:
                    self.stats.failed_requests += 1
                
                # Handle different types of errors
                error_str = str(e).lower()
                
                if "rate limit" in error_str or "too many requests" in error_str:
                    # Temporary rate limit - retry later with exponential backoff
                    backoff_time = self.rate_limit_ttl * (2 ** min(3, len(self.rate_limited_symbols) // 10))
                    self.rate_limited_symbols[symbol] = (
                        datetime.now() + timedelta(seconds=backoff_time)
                    )
                    logger.warning(f"Rate limited for {symbol}, will retry in {backoff_time}s")
                elif "not found" in error_str or "invalid" in error_str:
                    # Permanent failure
                    self.failed_symbols.add(symbol)
                    logger.debug(f"Permanent failure for {symbol}: {e}")
                else:
                    # Temporary error - don't cache
                    logger.debug(f"Temporary error for {symbol}: {e}")
                
                return None
    
    async def _respect_rate_limit(self, symbol: str) -> None:
        """Smart rate limiting with per-symbol tracking."""
        async with self._request_lock:
            now = datetime.now()
            
            # Check if we have too many rate limited symbols - pause globally
            if len(self.rate_limited_symbols) > 20:
                logger.warning(f"Too many rate limited symbols ({len(self.rate_limited_symbols)}), pausing for 30s")
                await asyncio.sleep(30)
                # Clear old rate limits
                self.rate_limited_symbols = {
                    k: v for k, v in self.rate_limited_symbols.items() 
                    if v > now
                }
            
            # Check global rate limit
            if hasattr(self, '_last_global_request'):
                time_since_last = (now - self._last_global_request).total_seconds()
                if time_since_last < self.request_delay:
                    delay = self.request_delay - time_since_last
                    # Add jitter to avoid thundering herd
                    jitter = random.uniform(0, delay * 0.2)
                    await asyncio.sleep(delay + jitter)
            
            self._last_global_request = now
            self._last_request_times[symbol] = now
    
    def _cache_data(self, cache_key: str, market_data: MarketData) -> None:
        """Cache market data with intelligent eviction."""
        # Check cache size and evict if necessary
        if len(self.memory_cache) >= self.max_cache_size:
            self._evict_cache_entries()
        
        # Add new entry
        entry = CacheEntry(
            data=market_data,
            timestamp=datetime.now(),
            access_count=1,
            last_accessed=datetime.now()
        )
        
        self.memory_cache[cache_key] = entry
    
    def _evict_cache_entries(self) -> None:
        """Evict cache entries using LRU + access frequency strategy."""
        if not self.memory_cache:
            return
        
        # Calculate eviction score (lower = more likely to evict)
        entries_with_scores = []
        now = datetime.now()
        
        for key, entry in self.memory_cache.items():
            age_hours = (now - entry.timestamp).total_seconds() / 3600
            last_access_hours = (now - entry.last_accessed).total_seconds() / 3600
            
            # Score based on age, last access, and access frequency
            score = (entry.access_count / max(1, age_hours)) / max(1, last_access_hours)
            entries_with_scores.append((key, score))
        
        # Sort by score and remove bottom 20%
        entries_with_scores.sort(key=lambda x: x[1])
        to_remove = int(len(entries_with_scores) * 0.2)
        
        for key, _ in entries_with_scores[:to_remove]:
            del self.memory_cache[key]
        
        logger.debug(f"Evicted {to_remove} cache entries")
    
    async def _convert_dataframe_to_market_data(
        self,
        hist_data: pd.DataFrame,
        symbol: str
    ) -> MarketData:
        """Convert pandas DataFrame to MarketData with validation."""
        
        # Clean and validate data
        hist_data = hist_data.dropna()
        
        # Fix OHLC violations
        hist_data['High'] = hist_data[['Open', 'High', 'Low', 'Close']].max(axis=1)
        hist_data['Low'] = hist_data[['Open', 'High', 'Low', 'Close']].min(axis=1)
        
        # Convert to OHLCV objects
        ohlcv_data = []
        for timestamp, row in hist_data.iterrows():
            try:
                ohlcv = OHLCV(
                    timestamp=timestamp.to_pydatetime(),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=int(row['Volume']) if row['Volume'] > 0 else 0
                )
                ohlcv_data.append(ohlcv)
            except (ValueError, KeyError) as e:
                logger.debug(f"Skipping invalid data point for {symbol}: {e}")
                continue
        
        if not ohlcv_data:
            raise DataError(f"No valid data points for {symbol}")
        
        return MarketData(
            symbol=symbol,
            ohlcv_data=ohlcv_data,
            last_updated=datetime.now(),
            indicators=[],  # Empty indicators list
            data_start=ohlcv_data[0].timestamp if ohlcv_data else datetime.now(),
            data_end=ohlcv_data[-1].timestamp if ohlcv_data else datetime.now()
        )
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache and performance statistics."""
        with self._stats_lock:
            return {
                "cache_size": len(self.memory_cache),
                "max_cache_size": self.max_cache_size,
                "failed_symbols": len(self.failed_symbols),
                "rate_limited_symbols": len(self.rate_limited_symbols),
                "cache_hit_rate": self.stats.cache_hit_rate,
                "total_requests": self.stats.total_requests,
                "failed_requests": self.stats.failed_requests,
                "average_fetch_time": self.stats.average_fetch_time,
                "concurrent_limit": self.max_concurrent,
                "request_delay_ms": self.request_delay * 1000
            }
    
    def clear_cache(self, symbol: Optional[str] = None) -> None:
        """Clear cache entries."""
        if symbol:
            # Clear specific symbol
            keys_to_remove = [k for k in self.memory_cache.keys() if k.startswith(f"{symbol}_")]
            for key in keys_to_remove:
                del self.memory_cache[key]
            
            # Also clear from failure caches
            self.failed_symbols.discard(symbol)
            if symbol in self.rate_limited_symbols:
                del self.rate_limited_symbols[symbol]
        else:
            # Clear all caches
            self.memory_cache.clear()
            self.failed_symbols.clear()
            self.rate_limited_symbols.clear()
        
        logger.info(f"Cache cleared for {'all symbols' if not symbol else symbol}")
    
    def cleanup_expired_entries(self) -> None:
        """Clean up expired cache entries."""
        now = datetime.now()
        
        # Clean memory cache
        expired_keys = []
        for key, entry in self.memory_cache.items():
            if now - entry.timestamp > timedelta(seconds=self.cache_ttl_seconds):
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.memory_cache[key]
        
        # Clean rate limit cache
        expired_rate_limits = []
        for symbol, expiry in self.rate_limited_symbols.items():
            if now > expiry:
                expired_rate_limits.append(symbol)
        
        for symbol in expired_rate_limits:
            del self.rate_limited_symbols[symbol]
        
        if expired_keys or expired_rate_limits:
            logger.debug(f"Cleaned up {len(expired_keys)} cache entries and "
                        f"{len(expired_rate_limits)} rate limit entries")
    
    async def warmup_cache(self, symbols: List[str], period: str = "6mo") -> None:
        """Warm up cache with popular symbols."""
        logger.info(f"Warming up cache with {len(symbols)} symbols")
        
        # Use lower concurrency for warmup to be respectful
        warmup_semaphore = asyncio.Semaphore(min(10, self.max_concurrent // 2))
        
        async def warmup_symbol(symbol: str) -> None:
            async with warmup_semaphore:
                await self.get_market_data_optimized(symbol, period)
                await asyncio.sleep(0.1)  # Be extra respectful during warmup
        
        tasks = [warmup_symbol(symbol) for symbol in symbols]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info(f"Cache warmup completed: {len(self.memory_cache)} entries cached")
    
    def __del__(self):
        """Cleanup on destruction."""
        if hasattr(self, 'thread_pool'):
            self.thread_pool.shutdown(wait=False)
