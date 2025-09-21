"""Streaming pipeline service for real-time fetch-analyze-store processing."""

import asyncio
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, AsyncGenerator, Callable
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import queue
import threading

from loguru import logger
import yfinance as yf

from volatility_scanner.models.market_data import MarketData
from volatility_scanner.models.analysis import AnalysisResult
from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.services.database_service import DatabaseService
from volatility_scanner.services.signal_continuity_service import SignalContinuityService
from volatility_scanner.config.settings import Settings


@dataclass
class PipelineStats:
    """Statistics for pipeline processing."""
    symbols_processed: int = 0
    symbols_analyzed: int = 0
    signals_found: int = 0
    signals_stored: int = 0
    fetch_time: float = 0.0
    analysis_time: float = 0.0
    storage_time: float = 0.0
    total_time: float = 0.0
    current_rate: float = 0.0
    errors: int = 0


class StreamingPipelineService:
    """
    High-performance streaming pipeline that processes symbols as they're fetched.
    
    This service implements a producer-consumer pattern where:
    1. Producer: Fetches market data concurrently
    2. Consumer: Analyzes data and stores results immediately
    3. Pipeline: Overlaps fetch, analysis, and storage operations
    """
    
    def __init__(
        self, 
        settings: Settings,
        analysis_service: AnalysisService,
        database_service: DatabaseService,
        continuity_service: Optional[SignalContinuityService] = None
    ):
        self.settings = settings
        self.analysis_service = analysis_service
        self.database_service = database_service
        self.continuity_service = continuity_service
        
        # Pipeline configuration - more conservative to avoid rate limits
        self.fetch_concurrency = min(20, settings.bulk_scan_concurrency)  # Reduced multiplier
        self.analysis_workers = min(20, settings.analysis_concurrency or 20)
        self.storage_batch_size = 5  # Smaller batches for faster feedback
        
        # Pipeline queues
        self.fetch_queue = asyncio.Queue(maxsize=200)  # Symbols to fetch
        self.analysis_queue = asyncio.Queue(maxsize=100)  # Data to analyze
        self.storage_queue = asyncio.Queue(maxsize=50)  # Results to store
        self.collection_queue = asyncio.Queue(maxsize=50)  # Results to yield back
        
        # Statistics
        self.stats = PipelineStats()
        self.start_time = None
        
        # Thread pool for CPU-bound operations
        self.thread_pool = ThreadPoolExecutor(max_workers=self.analysis_workers)
        
        logger.info(f"Streaming pipeline initialized: {self.fetch_concurrency} fetchers, "
                   f"{self.analysis_workers} analyzers")
    
    async def process_symbols_streaming(
        self,
        symbols: List[str],
        period: str = "6mo",
        min_score: float = 0.6,
        progress_callback: Optional[Callable[[PipelineStats], None]] = None
    ) -> AsyncGenerator[AnalysisResult, None]:
        """
        Process symbols in a streaming pipeline, yielding results as they're found.
        
        Args:
            symbols: List of symbols to process
            period: Data period to fetch
            min_score: Minimum score threshold
            progress_callback: Optional callback for progress updates
            
        Yields:
            AnalysisResult objects as they're completed
        """
        self.start_time = time.time()
        self.stats = PipelineStats()
        
        logger.info(f"Starting streaming pipeline for {len(symbols)} symbols")
        
        # Start pipeline stages
        fetch_task = asyncio.create_task(
            self._fetch_stage(symbols, period)
        )
        analysis_task = asyncio.create_task(
            self._analysis_stage(min_score)
        )
        storage_task = asyncio.create_task(
            self._storage_stage()
        )
        
        # Result collection
        results_queue = asyncio.Queue()
        
        # Start result collector
        collector_task = asyncio.create_task(
            self._collect_results(results_queue)
        )
        
        try:
            # Process results as they become available
            while True:
                try:
                    # Check if we're done
                    if (fetch_task.done() and 
                        self.analysis_queue.empty() and 
                        self.storage_queue.empty() and
                        results_queue.empty()):
                        break
                    
                    # Get next result with timeout
                    try:
                        result = await asyncio.wait_for(
                            results_queue.get(), timeout=1.0
                        )
                        
                        if result is not None:
                            self.stats.signals_found += 1
                            yield result
                        
                        # Update progress
                        if progress_callback:
                            self._update_stats()
                            progress_callback(self.stats)
                            
                    except asyncio.TimeoutError:
                        # Update stats even without new results
                        if progress_callback:
                            self._update_stats()
                            progress_callback(self.stats)
                        continue
                        
                except Exception as e:
                    logger.error(f"Error in streaming pipeline: {e}")
                    self.stats.errors += 1
                    continue
        
        finally:
            # Clean up tasks
            for task in [fetch_task, analysis_task, storage_task, collector_task]:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            self.thread_pool.shutdown(wait=False)
            
            # Final stats update
            self._update_stats()
            logger.info(f"Pipeline completed: {self.stats.signals_found} signals found, "
                       f"{self.stats.current_rate:.1f} symbols/sec")
    
    async def _fetch_stage(self, symbols: List[str], period: str) -> None:
        """Fetch market data concurrently."""
        logger.debug(f"Starting fetch stage for {len(symbols)} symbols")
        
        # Create semaphore for rate limiting
        semaphore = asyncio.Semaphore(self.fetch_concurrency)
        
        async def fetch_single(symbol: str) -> None:
            async with semaphore:
                try:
                    fetch_start = time.time()
                    
                    # Small delay to respect rate limits
                    await asyncio.sleep(0.05)  # 50ms delay
                    
                    # Fetch data
                    ticker = yf.Ticker(symbol)
                    hist_data = await asyncio.get_event_loop().run_in_executor(
                        self.thread_pool,
                        lambda: ticker.history(period=period)
                    )
                    
                    if not hist_data.empty:
                        # Convert to MarketData (simplified)
                        market_data = await self._convert_to_market_data(hist_data, symbol)
                        
                        # Add to analysis queue
                        await self.analysis_queue.put((symbol, market_data))
                        self.stats.symbols_processed += 1
                        
                        fetch_time = time.time() - fetch_start
                        self.stats.fetch_time += fetch_time
                        
                        logger.debug(f"Fetched {symbol} in {fetch_time:.2f}s")
                    else:
                        logger.warning(f"No data for {symbol}")
                        self.stats.errors += 1
                        
                except Exception as e:
                    logger.debug(f"Failed to fetch {symbol}: {e}")
                    self.stats.errors += 1
        
        # Start all fetch tasks
        fetch_tasks = [fetch_single(symbol) for symbol in symbols]
        await asyncio.gather(*fetch_tasks, return_exceptions=True)
        
        # Signal end of fetch stage
        await self.analysis_queue.put(None)
        logger.debug("Fetch stage completed")
    
    async def _analysis_stage(self, min_score: float) -> None:
        """Analyze market data as it becomes available."""
        logger.debug("Starting analysis stage")
        
        while True:
            try:
                # Get next item to analyze
                item = await self.analysis_queue.get()
                
                # Check for end signal
                if item is None:
                    await self.storage_queue.put(None)
                    break
                
                symbol, market_data = item
                
                try:
                    analysis_start = time.time()
                    
                    # Analyze in thread pool
                    result = await asyncio.get_event_loop().run_in_executor(
                        self.thread_pool,
                        self._analyze_symbol_sync,
                        symbol,
                        market_data,
                        min_score
                    )
                    
                    analysis_time = time.time() - analysis_start
                    self.stats.analysis_time += analysis_time
                    
                    if result:
                        # Add to storage queue
                        await self.storage_queue.put(result)
                        self.stats.symbols_analyzed += 1
                        logger.debug(f"Analyzed {symbol}: score={result.overall_score:.3f}")
                    
                except Exception as e:
                    logger.debug(f"Analysis failed for {symbol}: {e}")
                    self.stats.errors += 1
                
            except Exception as e:
                logger.error(f"Error in analysis stage: {e}")
                self.stats.errors += 1
                break
        
        logger.debug("Analysis stage completed")
    
    async def _storage_stage(self) -> None:
        """Store analysis results as they become available."""
        logger.debug("Starting storage stage")
        
        batch = []
        
        while True:
            try:
                # Get next result to store
                result = await self.storage_queue.get()
                
                # Check for end signal
                if result is None:
                    # Store any remaining results
                    if batch:
                        await self._store_batch(batch)
                    break
                
                batch.append(result)
                
                # Store when batch is full or after timeout
                if len(batch) >= self.storage_batch_size:
                    await self._store_batch(batch)
                    batch = []
                
            except Exception as e:
                logger.error(f"Error in storage stage: {e}")
                self.stats.errors += 1
                break
        
        # Send end signal to collection queue
        await self.collection_queue.put(None)
        logger.debug("Storage stage completed")
    
    async def _store_batch(self, results: List[AnalysisResult]) -> None:
        """Store a batch of results."""
        try:
            storage_start = time.time()
            
            # Store AnalysisResult objects directly (they contain SqueezeSignal)
            if results:
                # Store in database
                await self.database_service.store_signals_batch(results)
                
                # Process continuity if available
                if self.continuity_service:
                    await self.continuity_service.process_signals_with_continuity(results)
                
                # Put results in collection queue for yielding back to caller
                for result in results:
                    await self.collection_queue.put(result)
                
                self.stats.signals_stored += len(results)
            
            storage_time = time.time() - storage_start
            self.stats.storage_time += storage_time
            
            logger.debug(f"Stored batch of {len(results)} results in {storage_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to store batch: {e}")
            self.stats.errors += 1
    
    async def _collect_results(self, results_queue: asyncio.Queue) -> None:
        """Collect results from storage stage and put them in results queue for yielding."""
        stored_results = []
        
        while True:
            try:
                # Get stored results from storage stage
                # We need to modify storage stage to also put results in a collection queue
                result = await self.collection_queue.get()
                
                if result is None:  # End signal
                    break
                    
                # Put result in results queue for yielding
                await results_queue.put(result)
                stored_results.append(result)
                
            except Exception as e:
                logger.error(f"Error in result collection: {e}")
                break
    
    def _analyze_symbol_sync(
        self, 
        symbol: str, 
        market_data: MarketData, 
        min_score: float
    ) -> Optional[AnalysisResult]:
        """Synchronous analysis for thread pool execution."""
        try:
            # Use the existing analysis service
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                result = loop.run_until_complete(
                    self.analysis_service.analyze_symbol(
                        market_data, 
                        include_ai_analysis=False
                    )
                )
                
                if result and result.overall_score >= min_score:
                    return result
                
            finally:
                loop.close()
                
        except Exception as e:
            logger.debug(f"Sync analysis failed for {symbol}: {e}")
        
        return None
    
    async def _convert_to_market_data(self, hist_data, symbol: str) -> MarketData:
        """Convert pandas DataFrame to MarketData object."""
        # Simplified conversion - you'd implement the full conversion logic here
        from volatility_scanner.models.market_data import OHLCV
        
        ohlcv_data = []
        for timestamp, row in hist_data.iterrows():
            ohlcv = OHLCV(
                timestamp=timestamp.to_pydatetime(),
                open=float(row['Open']),
                high=float(row['High']),
                low=float(row['Low']),
                close=float(row['Close']),
                volume=int(row['Volume']) if row['Volume'] > 0 else 0
            )
            ohlcv_data.append(ohlcv)
        
        return MarketData(
            symbol=symbol,
            ohlcv_data=ohlcv_data,
            last_updated=datetime.now(),
            indicators=[],  # Empty indicators list
            data_start=ohlcv_data[0].timestamp if ohlcv_data else datetime.now(),
            data_end=ohlcv_data[-1].timestamp if ohlcv_data else datetime.now()
        )
    
    def _update_stats(self) -> None:
        """Update current statistics."""
        if self.start_time:
            self.stats.total_time = time.time() - self.start_time
            if self.stats.total_time > 0:
                self.stats.current_rate = self.stats.symbols_processed / self.stats.total_time
    
    def get_stats(self) -> PipelineStats:
        """Get current pipeline statistics."""
        self._update_stats()
        return self.stats
