"""Memory-efficient processing manager for large-scale symbol analysis."""

import asyncio
import gc
import psutil
import os
from typing import List, Dict, Any, Optional, AsyncGenerator, Callable
from dataclasses import dataclass
from datetime import datetime
import weakref

from loguru import logger

from volatility_scanner.models.market_data import MarketData
from volatility_scanner.models.analysis import AnalysisResult
from volatility_scanner.services.enhanced_data_service import EnhancedDataService
from volatility_scanner.services.streaming_analysis_service import StreamingAnalysisService
from volatility_scanner.config.settings import Settings


@dataclass
class MemoryStats:
    """Memory usage statistics."""
    total_memory_gb: float
    available_memory_gb: float
    used_memory_gb: float
    memory_percent: float
    process_memory_gb: float
    cache_size_mb: float


class MemoryEfficientProcessor:
    """
    Memory-efficient processor that handles large-scale symbol processing
    with automatic memory management and garbage collection.
    """
    
    def __init__(
        self,
        settings: Settings,
        data_service: EnhancedDataService,
        analysis_service: StreamingAnalysisService
    ):
        """Initialize the memory-efficient processor."""
        self.settings = settings
        self.data_service = data_service
        self.analysis_service = analysis_service
        
        # Memory management configuration
        self.max_memory_usage_percent = 80.0  # Maximum memory usage before cleanup
        self.memory_check_interval = 100  # Check memory every N symbols
        self.gc_threshold = 1000  # Force GC every N symbols
        
        # Processing statistics
        self.stats = {
            'symbols_processed': 0,
            'memory_cleanups': 0,
            'gc_collections': 0,
            'peak_memory_gb': 0.0,
            'cache_evictions': 0
        }
        
        # Weak references for automatic cleanup
        self._weak_cache: weakref.WeakValueDictionary = weakref.WeakValueDictionary()
        
        logger.info("Memory-efficient processor initialized")
    
    async def process_symbols_memory_efficient(
        self,
        symbols: List[str],
        period: str = "6mo",
        min_score: float = 0.5,
        chunk_size: Optional[int] = None,
        progress_callback: Optional[Callable[[int, int, Dict[str, Any]], None]] = None
    ) -> List[AnalysisResult]:
        """
        Process symbols with automatic memory management.
        
        Args:
            symbols: List of symbols to process
            period: Data period
            min_score: Minimum signal score
            chunk_size: Processing chunk size (auto-calculated if None)
            progress_callback: Progress callback function
            
        Returns:
            List of analysis results
        """
        if not symbols:
            return []
        
        # Calculate optimal chunk size based on available memory
        if chunk_size is None:
            chunk_size = self._calculate_optimal_chunk_size(len(symbols))
        
        logger.info(f"Processing {len(symbols)} symbols with memory-efficient chunking "
                   f"(chunk_size: {chunk_size})")
        
        all_results = []
        processed_count = 0
        
        # Process symbols in memory-efficient chunks
        for i in range(0, len(symbols), chunk_size):
            chunk_symbols = symbols[i:i + chunk_size]
            chunk_num = i // chunk_size + 1
            total_chunks = (len(symbols) + chunk_size - 1) // chunk_size
            
            logger.info(f"Processing chunk {chunk_num}/{total_chunks} ({len(chunk_symbols)} symbols)")
            
            # Memory check before processing
            memory_stats = self._get_memory_stats()
            if memory_stats.memory_percent > self.max_memory_usage_percent:
                logger.warning(f"High memory usage ({memory_stats.memory_percent:.1f}%), "
                             f"performing cleanup before processing chunk")
                await self._perform_memory_cleanup()
            
            try:
                # Process chunk
                chunk_results = await self._process_chunk_with_memory_management(
                    chunk_symbols, period, min_score
                )
                
                all_results.extend(chunk_results)
                processed_count += len(chunk_symbols)
                
                # Update statistics
                current_memory = self._get_memory_stats()
                if current_memory.process_memory_gb > self.stats['peak_memory_gb']:
                    self.stats['peak_memory_gb'] = current_memory.process_memory_gb
                
                # Progress callback
                if progress_callback:
                    progress_info = {
                        'chunk': chunk_num,
                        'total_chunks': total_chunks,
                        'processed_symbols': processed_count,
                        'total_symbols': len(symbols),
                        'results_found': len(all_results),
                        'memory_stats': current_memory
                    }
                    try:
                        progress_callback(processed_count, len(symbols), progress_info)
                    except Exception as e:
                        logger.warning(f"Progress callback error: {e}")
                
                # Periodic memory management
                if processed_count % self.memory_check_interval == 0:
                    await self._periodic_memory_management()
                
                # Force garbage collection periodically
                if processed_count % self.gc_threshold == 0:
                    self._force_garbage_collection()
                
            except Exception as e:
                logger.error(f"Error processing chunk {chunk_num}: {e}")
                continue
            
            # Small delay between chunks to prevent overwhelming
            if chunk_num < total_chunks:
                await asyncio.sleep(0.1)
        
        # Final cleanup
        await self._perform_memory_cleanup()
        
        final_memory = self._get_memory_stats()
        logger.info(f"Memory-efficient processing complete: {len(all_results)} results, "
                   f"peak memory: {self.stats['peak_memory_gb']:.1f}GB, "
                   f"final memory: {final_memory.process_memory_gb:.1f}GB")
        
        return all_results
    
    async def _process_chunk_with_memory_management(
        self,
        symbols: List[str],
        period: str,
        min_score: float
    ) -> List[AnalysisResult]:
        """Process a chunk of symbols with memory management."""
        
        # Fetch data for chunk
        symbol_data = await self.data_service.get_multiple_symbols_optimized(
            symbols, period, use_aggressive_settings=True
        )
        
        if not symbol_data:
            return []
        
        # Analyze symbols using streaming service
        results = await self.analysis_service.analyze_symbols_streaming(
            symbol_data,
            min_score=min_score,
            batch_size=min(len(symbol_data), 50)  # Smaller batches for memory efficiency
        )
        
        # Clear symbol_data to free memory immediately
        del symbol_data
        
        # Update processing stats
        self.stats['symbols_processed'] += len(symbols)
        
        return results
    
    def _calculate_optimal_chunk_size(self, total_symbols: int) -> int:
        """Calculate optimal chunk size based on available memory."""
        memory_stats = self._get_memory_stats()
        
        # Base chunk size on available memory
        # Assume ~10MB per symbol for market data + analysis
        available_memory_mb = memory_stats.available_memory_gb * 1024
        symbols_per_gb = 100  # Conservative estimate
        
        # Calculate chunk size to use 60% of available memory
        max_chunk_size = max(10, int((available_memory_mb * 0.6) / 10))  # 10MB per symbol
        
        # Limit chunk size based on settings
        max_setting_chunk = self.settings.bulk_scan_batch_size * 2
        optimal_chunk = min(max_chunk_size, max_setting_chunk)
        
        # Ensure reasonable bounds
        optimal_chunk = max(50, min(optimal_chunk, 1000))
        
        logger.info(f"Calculated optimal chunk size: {optimal_chunk} "
                   f"(available memory: {available_memory_mb:.0f}MB)")
        
        return optimal_chunk
    
    def _get_memory_stats(self) -> MemoryStats:
        """Get current memory statistics."""
        # System memory
        memory = psutil.virtual_memory()
        
        # Process memory
        process = psutil.Process(os.getpid())
        process_memory = process.memory_info().rss / (1024 ** 3)  # GB
        
        # Cache size estimation
        cache_size_mb = len(self.data_service.cache) * 5.0  # Rough estimate: 5MB per cached symbol
        
        return MemoryStats(
            total_memory_gb=memory.total / (1024 ** 3),
            available_memory_gb=memory.available / (1024 ** 3),
            used_memory_gb=memory.used / (1024 ** 3),
            memory_percent=memory.percent,
            process_memory_gb=process_memory,
            cache_size_mb=cache_size_mb
        )
    
    async def _perform_memory_cleanup(self) -> None:
        """Perform comprehensive memory cleanup."""
        logger.info("Performing memory cleanup...")
        
        initial_memory = self._get_memory_stats()
        
        # Clear data service cache (keep some recent entries)
        cache_keys = list(self.data_service.cache.keys())
        if len(cache_keys) > 100:  # Keep last 100 entries
            keys_to_remove = cache_keys[:-100]
            for key in keys_to_remove:
                self.data_service.cache.pop(key, None)
                self.data_service.cache_timestamps.pop(key, None)
            self.stats['cache_evictions'] += len(keys_to_remove)
        
        # Clear weak references
        self._weak_cache.clear()
        
        # Force garbage collection
        self._force_garbage_collection()
        
        # Small delay to allow cleanup to complete
        await asyncio.sleep(0.1)
        
        final_memory = self._get_memory_stats()
        memory_freed = initial_memory.process_memory_gb - final_memory.process_memory_gb
        
        logger.info(f"Memory cleanup complete: freed {memory_freed:.2f}GB, "
                   f"memory usage: {final_memory.memory_percent:.1f}%")
        
        self.stats['memory_cleanups'] += 1
    
    async def _periodic_memory_management(self) -> None:
        """Perform periodic memory management tasks."""
        memory_stats = self._get_memory_stats()
        
        # Log memory usage
        logger.debug(f"Memory check: {memory_stats.memory_percent:.1f}% system, "
                    f"{memory_stats.process_memory_gb:.1f}GB process, "
                    f"{memory_stats.cache_size_mb:.0f}MB cache")
        
        # Cleanup if memory usage is high
        if memory_stats.memory_percent > self.max_memory_usage_percent:
            await self._perform_memory_cleanup()
    
    def _force_garbage_collection(self) -> None:
        """Force garbage collection."""
        collected = gc.collect()
        self.stats['gc_collections'] += 1
        logger.debug(f"Garbage collection: collected {collected} objects")
    
    async def process_symbols_streaming(
        self,
        symbols: List[str],
        period: str = "6mo",
        min_score: float = 0.5,
        chunk_size: Optional[int] = None
    ) -> AsyncGenerator[AnalysisResult, None]:
        """
        Stream processing results as they become available.
        
        Args:
            symbols: List of symbols to process
            period: Data period
            min_score: Minimum signal score
            chunk_size: Processing chunk size
            
        Yields:
            AnalysisResult objects as they're completed
        """
        if chunk_size is None:
            chunk_size = self._calculate_optimal_chunk_size(len(symbols))
        
        logger.info(f"Starting streaming processing of {len(symbols)} symbols")
        
        for i in range(0, len(symbols), chunk_size):
            chunk_symbols = symbols[i:i + chunk_size]
            
            # Memory check
            if i > 0 and i % (chunk_size * 5) == 0:  # Every 5 chunks
                await self._periodic_memory_management()
            
            # Process chunk and yield results
            chunk_results = await self._process_chunk_with_memory_management(
                chunk_symbols, period, min_score
            )
            
            for result in chunk_results:
                yield result
        
        logger.info("Streaming processing complete")
    
    def get_memory_and_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory and performance statistics."""
        memory_stats = self._get_memory_stats()
        
        return {
            # Memory statistics
            'memory': {
                'total_gb': memory_stats.total_memory_gb,
                'available_gb': memory_stats.available_memory_gb,
                'used_percent': memory_stats.memory_percent,
                'process_memory_gb': memory_stats.process_memory_gb,
                'cache_size_mb': memory_stats.cache_size_mb,
                'peak_memory_gb': self.stats['peak_memory_gb']
            },
            
            # Processing statistics
            'processing': {
                'symbols_processed': self.stats['symbols_processed'],
                'memory_cleanups': self.stats['memory_cleanups'],
                'gc_collections': self.stats['gc_collections'],
                'cache_evictions': self.stats['cache_evictions']
            },
            
            # Configuration
            'config': {
                'max_memory_usage_percent': self.max_memory_usage_percent,
                'memory_check_interval': self.memory_check_interval,
                'gc_threshold': self.gc_threshold
            },
            
            # Service statistics
            'data_service_stats': self.data_service.get_performance_stats(),
            'analysis_service_stats': self.analysis_service.get_performance_stats()
        }
    
    def optimize_for_memory_usage(self, target_memory_percent: float = 70.0) -> None:
        """Optimize settings for target memory usage."""
        current_memory = self._get_memory_stats()
        
        if current_memory.memory_percent > target_memory_percent:
            # Reduce memory usage by adjusting thresholds
            self.max_memory_usage_percent = target_memory_percent
            self.memory_check_interval = max(50, self.memory_check_interval // 2)
            self.gc_threshold = max(500, self.gc_threshold // 2)
            
            logger.info(f"Optimized for memory usage: target {target_memory_percent}%")
        else:
            logger.info(f"Memory usage acceptable: {current_memory.memory_percent:.1f}%")
