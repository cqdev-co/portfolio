"""Streaming analysis service for high-performance bulk processing."""

import asyncio
import multiprocessing as mp
from datetime import datetime
from typing import List, Optional, Dict, Any, Callable, AsyncGenerator
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import threading
import queue
import time
from dataclasses import dataclass

from loguru import logger
import numpy as np

from volatility_scanner.models.market_data import MarketData
from volatility_scanner.models.analysis import AnalysisResult
from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.config.settings import Settings


@dataclass
class ProcessingBatch:
    """Represents a batch of symbols for processing."""
    batch_id: int
    symbols: List[str]
    market_data: Dict[str, MarketData]
    timestamp: datetime


class StreamingAnalysisService:
    """
    High-performance streaming analysis service that processes symbols in parallel
    with memory-efficient streaming and real-time results.
    """
    
    def __init__(self, settings: Settings, analysis_service: AnalysisService) -> None:
        """Initialize the streaming analysis service."""
        self.settings = settings
        self.analysis_service = analysis_service
        
        # Performance configuration
        cpu_count = mp.cpu_count()
        self.max_workers = min(cpu_count * 2, settings.analysis_concurrency * 2)  # More aggressive
        self.batch_size = min(settings.bulk_scan_batch_size, 200)  # Larger batches
        self.processing_queue_size = self.max_workers * 2
        
        # Thread pools for different types of work
        self.analysis_pool = ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix="analysis"
        )
        self.io_pool = ThreadPoolExecutor(
            max_workers=min(20, self.max_workers),
            thread_name_prefix="io"
        )
        
        # Processing statistics
        self.stats = {
            'total_symbols': 0,
            'processed_symbols': 0,
            'successful_analyses': 0,
            'failed_analyses': 0,
            'batches_processed': 0,
            'processing_rate': 0.0,
            'start_time': None,
            'end_time': None
        }
        
        logger.info(f"Streaming analysis service initialized with {self.max_workers} workers")
    
    async def analyze_symbols_streaming(
        self,
        symbol_data: Dict[str, MarketData],
        min_score: float = 0.5,
        batch_size: Optional[int] = None,
        callback: Optional[Callable[[int, int, int, int], None]] = None
    ) -> List[AnalysisResult]:
        """
        Analyze symbols using streaming processing with real-time callbacks.
        
        Args:
            symbol_data: Dictionary of symbol -> MarketData
            min_score: Minimum score threshold
            batch_size: Override default batch size
            callback: Callback function (batch_num, total_batches, batch_signals, total_signals)
            
        Returns:
            List of analysis results above threshold
        """
        if not symbol_data:
            return []
        
        batch_size = batch_size or self.batch_size
        self.stats['total_symbols'] = len(symbol_data)
        self.stats['start_time'] = time.time()
        
        logger.info(f"Starting streaming analysis of {len(symbol_data)} symbols "
                   f"(batch_size: {batch_size}, workers: {self.max_workers})")
        
        # Create batches
        batches = self._create_batches(symbol_data, batch_size)
        total_batches = len(batches)
        
        # Process batches concurrently with streaming results
        all_results = []
        completed_batches = 0
        
        # Use semaphore to limit concurrent batches
        semaphore = asyncio.Semaphore(min(self.max_workers // 2, 10))
        
        async def process_batch(batch: ProcessingBatch) -> List[AnalysisResult]:
            async with semaphore:
                return await self._process_batch_optimized(batch, min_score)
        
        # Process all batches concurrently
        tasks = [process_batch(batch) for batch in batches]
        
        # Collect results as they complete
        for coro in asyncio.as_completed(tasks):
            try:
                batch_results = await coro
                all_results.extend(batch_results)
                completed_batches += 1
                
                # Update statistics
                self.stats['batches_processed'] = completed_batches
                self.stats['successful_analyses'] += len(batch_results)
                self.stats['processed_symbols'] += len(batch_results)
                
                # Calculate processing rate
                elapsed = time.time() - self.stats['start_time']
                self.stats['processing_rate'] = self.stats['processed_symbols'] / elapsed if elapsed > 0 else 0
                
                # Call callback if provided
                if callback:
                    try:
                        callback(completed_batches, total_batches, len(batch_results), len(all_results))
                    except Exception as e:
                        logger.warning(f"Callback error: {e}")
                
                logger.debug(f"Batch {completed_batches}/{total_batches} complete: "
                           f"{len(batch_results)} signals found "
                           f"(total: {len(all_results)}, rate: {self.stats['processing_rate']:.1f}/s)")
                
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                completed_batches += 1
                continue
        
        self.stats['end_time'] = time.time()
        total_time = self.stats['end_time'] - self.stats['start_time']
        
        logger.info(f"Streaming analysis complete: {len(all_results)} signals found "
                   f"from {len(symbol_data)} symbols in {total_time:.1f}s "
                   f"({len(symbol_data)/total_time:.1f} symbols/sec)")
        
        return all_results
    
    def _create_batches(self, symbol_data: Dict[str, MarketData], batch_size: int) -> List[ProcessingBatch]:
        """Create processing batches from symbol data."""
        batches = []
        symbols = list(symbol_data.keys())
        
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i:i + batch_size]
            batch_data = {symbol: symbol_data[symbol] for symbol in batch_symbols}
            
            batch = ProcessingBatch(
                batch_id=i // batch_size + 1,
                symbols=batch_symbols,
                market_data=batch_data,
                timestamp=datetime.now()
            )
            batches.append(batch)
        
        return batches
    
    async def _process_batch_optimized(
        self, 
        batch: ProcessingBatch, 
        min_score: float
    ) -> List[AnalysisResult]:
        """Process a batch of symbols with optimized parallel analysis."""
        
        # Prepare analysis tasks
        analysis_tasks = []
        for symbol, market_data in batch.market_data.items():
            task = asyncio.get_event_loop().run_in_executor(
                self.analysis_pool,
                self._analyze_symbol_sync,
                symbol,
                market_data,
                min_score
            )
            analysis_tasks.append(task)
        
        # Execute all analyses concurrently
        results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
        
        # Filter successful results
        successful_results = []
        for result in results:
            if isinstance(result, AnalysisResult):
                successful_results.append(result)
            elif isinstance(result, Exception):
                logger.debug(f"Analysis failed: {result}")
                self.stats['failed_analyses'] += 1
        
        return successful_results
    
    def _analyze_symbol_sync(
        self, 
        symbol: str, 
        market_data: MarketData, 
        min_score: float
    ) -> Optional[AnalysisResult]:
        """Synchronous symbol analysis for thread pool execution."""
        try:
            # Calculate indicators if not present
            if not market_data.indicators:
                market_data = self.analysis_service.indicator_calculator.calculate_all_indicators(market_data)
            
            # Create analysis result synchronously
            # Note: This is a simplified version - you might need to adapt the actual analysis logic
            result = asyncio.run(self.analysis_service.analyze_symbol(market_data, include_ai_analysis=False))
            
            if result and result.overall_score >= min_score:
                return result
            
            return None
            
        except Exception as e:
            logger.debug(f"Analysis failed for {symbol}: {e}")
            return None
    
    async def analyze_symbols_pipeline(
        self,
        symbol_data_stream: AsyncGenerator[Dict[str, MarketData], None],
        min_score: float = 0.5,
        callback: Optional[Callable[[AnalysisResult], None]] = None
    ) -> AsyncGenerator[AnalysisResult, None]:
        """
        Pipeline processing that yields results as they're ready.
        
        Args:
            symbol_data_stream: Async generator yielding symbol data batches
            min_score: Minimum score threshold
            callback: Callback for each result
            
        Yields:
            AnalysisResult objects as they're completed
        """
        logger.info("Starting pipeline analysis")
        
        # Processing queue for managing concurrent analyses
        processing_queue = asyncio.Queue(maxsize=self.processing_queue_size)
        results_queue = asyncio.Queue()
        
        # Producer: feed symbol data into processing queue
        async def producer():
            async for batch in symbol_data_stream:
                for symbol, market_data in batch.items():
                    await processing_queue.put((symbol, market_data))
            await processing_queue.put(None)  # Sentinel
        
        # Consumer: process symbols and put results in results queue
        async def consumer():
            while True:
                item = await processing_queue.get()
                if item is None:  # Sentinel
                    await results_queue.put(None)
                    break
                
                symbol, market_data = item
                result = await asyncio.get_event_loop().run_in_executor(
                    self.analysis_pool,
                    self._analyze_symbol_sync,
                    symbol,
                    market_data,
                    min_score
                )
                
                if result:
                    await results_queue.put(result)
        
        # Start producer and multiple consumers
        producer_task = asyncio.create_task(producer())
        consumer_tasks = [
            asyncio.create_task(consumer()) 
            for _ in range(min(self.max_workers, 10))
        ]
        
        # Yield results as they're ready
        active_consumers = len(consumer_tasks)
        while active_consumers > 0:
            result = await results_queue.get()
            if result is None:  # Consumer finished
                active_consumers -= 1
                continue
            
            if callback:
                try:
                    callback(result)
                except Exception as e:
                    logger.warning(f"Pipeline callback error: {e}")
            
            yield result
        
        # Cleanup
        await producer_task
        await asyncio.gather(*consumer_tasks, return_exceptions=True)
        
        logger.info("Pipeline analysis complete")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get detailed performance statistics."""
        stats = self.stats.copy()
        
        if stats['start_time'] and stats['end_time']:
            total_time = stats['end_time'] - stats['start_time']
            stats['total_processing_time'] = total_time
            stats['symbols_per_second'] = stats['processed_symbols'] / total_time if total_time > 0 else 0
        
        stats.update({
            'max_workers': self.max_workers,
            'batch_size': self.batch_size,
            'processing_queue_size': self.processing_queue_size,
            'success_rate_percent': (stats['successful_analyses'] / stats['total_symbols'] * 100) 
                                   if stats['total_symbols'] > 0 else 0
        })
        
        return stats
    
    def __del__(self):
        """Cleanup thread pools on destruction."""
        try:
            self.analysis_pool.shutdown(wait=False)
            self.io_pool.shutdown(wait=False)
        except:
            pass
