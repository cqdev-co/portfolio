"""
Ticker Service for Volatility Squeeze Scanner

Integrates with the monorepo ticker database to provide dynamic symbol lists
for analysis instead of hardcoded symbol arrays.
"""

import sys
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
from pathlib import Path

# Add the monorepo lib path to sys.path
current_file = Path(__file__)
# Navigate from: volatility-squeeze-scanner/src/volatility_scanner/services/ticker_service.py
# To: portfolio/lib/
# Go up 4 levels: services -> volatility_scanner -> src -> volatility-squeeze-scanner -> portfolio
monorepo_root = current_file.parents[4]  # Go up to portfolio root
lib_path = monorepo_root / "lib"

# Only add to path if it exists
if lib_path.exists():
    sys.path.insert(0, str(lib_path))
else:
    logging.warning(f"Lib path does not exist: {lib_path}")

try:
    from utils.get_tickers import (
        get_all_tickers,
        get_tickers_by_exchange,
        get_tickers_by_country,
        get_tickers_by_sector,
        search_tickers,
        get_ticker_count,
        get_exchanges,
        get_sectors,
        get_sp500_tickers,
        get_tech_tickers
    )
except ImportError as e:
    error_msg = (
        f"Failed to import ticker utilities from {lib_path}: {e}. "
        f"Make sure the monorepo ticker utilities are properly set up. "
        f"Current path calculation: {current_file} -> {monorepo_root} -> {lib_path}"
    )
    logging.error(error_msg)
    raise ImportError(error_msg) from e

from volatility_scanner.core.exceptions import DataError
from volatility_scanner.config.settings import Settings

logger = logging.getLogger(__name__)


class TickerService:
    """Service for managing ticker symbols from the monorepo database."""
    
    def __init__(self, settings: Settings):
        """Initialize the ticker service."""
        self.settings = settings
        self._cache: Dict[str, Any] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = 3600  # 1 hour cache
        
    def _is_cache_valid(self) -> bool:
        """Check if the ticker cache is still valid."""
        if not self._cache_timestamp:
            return False
        
        age = (datetime.now() - self._cache_timestamp).total_seconds()
        return age < self._cache_ttl
    
    def get_all_symbols(
        self, 
        active_only: bool = True,
        limit: Optional[int] = None,
        exchanges: Optional[List[str]] = None,
        countries: Optional[List[str]] = None,
        sectors: Optional[List[str]] = None
    ) -> List[str]:
        """
        Get all ticker symbols from the database with optional filtering.
        
        Args:
            active_only: Only return active tickers
            limit: Maximum number of symbols to return
            exchanges: Filter by specific exchanges (e.g., ['NASDAQ', 'NYSE'])
            countries: Filter by specific countries (e.g., ['US', 'CA'])
            sectors: Filter by specific sectors (e.g., ['Technology'])
        
        Returns:
            List of ticker symbols
        """
        try:
            cache_key = f"all_symbols_{active_only}_{limit}_{exchanges}_{countries}_{sectors}"
            
            if self._is_cache_valid() and cache_key in self._cache:
                logger.debug("Returning cached ticker symbols")
                return self._cache[cache_key]
            
            logger.info("Fetching ticker symbols from database...")
            
            # Get base set of tickers
            if exchanges:
                # Get tickers from specific exchanges
                all_tickers = []
                for exchange in exchanges:
                    exchange_tickers = get_tickers_by_exchange(
                        exchange, active_only=active_only
                    )
                    all_tickers.extend(exchange_tickers)
            elif countries:
                # Get tickers from specific countries
                all_tickers = []
                for country in countries:
                    country_tickers = get_tickers_by_country(
                        country, active_only=active_only
                    )
                    all_tickers.extend(country_tickers)
            elif sectors:
                # Get tickers from specific sectors
                all_tickers = []
                for sector in sectors:
                    sector_tickers = get_tickers_by_sector(
                        sector, active_only=active_only
                    )
                    all_tickers.extend(sector_tickers)
            else:
                # Get all tickers
                all_tickers = get_all_tickers(
                    active_only=active_only, 
                    limit=limit
                )
            
            # Extract symbols and remove duplicates while preserving order
            symbols = []
            seen = set()
            for ticker in all_tickers:
                symbol = ticker['symbol']
                if symbol not in seen:
                    symbols.append(symbol)
                    seen.add(symbol)
            
            # Apply limit if specified and not already applied
            if limit and len(symbols) > limit:
                symbols = symbols[:limit]
            
            # Cache the result
            self._cache[cache_key] = symbols
            self._cache_timestamp = datetime.now()
            
            logger.info(f"Retrieved {len(symbols)} ticker symbols")
            return symbols
            
        except Exception as e:
            error_msg = f"Failed to fetch ticker symbols: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_symbols_by_exchange(
        self, 
        exchange: str, 
        active_only: bool = True,
        limit: Optional[int] = None
    ) -> List[str]:
        """Get ticker symbols from a specific exchange."""
        try:
            tickers = get_tickers_by_exchange(
                exchange, active_only=active_only, limit=limit
            )
            symbols = [ticker['symbol'] for ticker in tickers]
            logger.info(f"Retrieved {len(symbols)} symbols from {exchange}")
            return symbols
        except Exception as e:
            error_msg = f"Failed to fetch symbols from {exchange}: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_symbols_by_sector(
        self, 
        sector: str, 
        active_only: bool = True,
        limit: Optional[int] = None
    ) -> List[str]:
        """Get ticker symbols from a specific sector."""
        try:
            tickers = get_tickers_by_sector(
                sector, active_only=active_only, limit=limit
            )
            symbols = [ticker['symbol'] for ticker in tickers]
            logger.info(f"Retrieved {len(symbols)} symbols from {sector} sector")
            return symbols
        except Exception as e:
            error_msg = f"Failed to fetch symbols from {sector} sector: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def search_symbols(
        self, 
        query: str, 
        limit: int = 50,
        active_only: bool = True
    ) -> List[str]:
        """Search for ticker symbols by name or symbol."""
        try:
            results = search_tickers(
                query, 
                search_fields=['symbol', 'name'],
                active_only=active_only,
                limit=limit
            )
            symbols = [ticker['symbol'] for ticker in results]
            logger.info(f"Search for '{query}' returned {len(symbols)} symbols")
            return symbols
        except Exception as e:
            error_msg = f"Failed to search symbols for '{query}': {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_sp500_symbols(self) -> List[str]:
        """Get S&P 500 ticker symbols (approximation)."""
        try:
            tickers = get_sp500_tickers()
            symbols = [ticker['symbol'] for ticker in tickers]
            logger.info(f"Retrieved {len(symbols)} S&P 500 symbols")
            return symbols
        except Exception as e:
            error_msg = f"Failed to fetch S&P 500 symbols: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_tech_symbols(self, limit: int = 100) -> List[str]:
        """Get technology sector ticker symbols."""
        try:
            tickers = get_tech_tickers(limit=limit)
            symbols = [ticker['symbol'] for ticker in tickers]
            logger.info(f"Retrieved {len(symbols)} technology symbols")
            return symbols
        except Exception as e:
            error_msg = f"Failed to fetch technology symbols: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_available_exchanges(self) -> List[str]:
        """Get list of available exchanges in the database."""
        try:
            exchanges = get_exchanges()
            logger.info(f"Found {len(exchanges)} exchanges")
            return exchanges
        except Exception as e:
            error_msg = f"Failed to fetch exchanges: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_available_sectors(self) -> List[str]:
        """Get list of available sectors in the database."""
        try:
            sectors = get_sectors()
            logger.info(f"Found {len(sectors)} sectors")
            return sectors
        except Exception as e:
            error_msg = f"Failed to fetch sectors: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_ticker_count(self, active_only: bool = True) -> int:
        """Get total count of tickers in the database."""
        try:
            count = get_ticker_count(active_only=active_only)
            logger.info(f"Total ticker count: {count:,}")
            return count
        except Exception as e:
            error_msg = f"Failed to get ticker count: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def get_curated_symbol_sets(self) -> Dict[str, List[str]]:
        """
        Get curated sets of symbols for different analysis scenarios.
        
        Returns:
            Dictionary with different symbol sets for various use cases
        """
        try:
            symbol_sets = {}
            
            # High-volume US stocks (good for volatility analysis)
            symbol_sets['high_volume_us'] = self.get_symbols_by_exchange('NASDAQ', limit=50)
            symbol_sets['high_volume_us'].extend(
                self.get_symbols_by_exchange('NYSE', limit=50)
            )
            
            # Technology sector (often has good volatility patterns)
            symbol_sets['technology'] = self.get_tech_symbols(limit=30)
            
            # Large cap approximation (major exchanges)
            symbol_sets['large_cap'] = self.get_sp500_symbols()[:100]
            
            # Sample set for quick testing
            symbol_sets['sample'] = self.get_all_symbols(limit=20)
            
            # Popular stocks (search for common names)
            popular_searches = ['Apple', 'Microsoft', 'Google', 'Tesla', 'Amazon']
            symbol_sets['popular'] = []
            for search in popular_searches:
                results = self.search_symbols(search, limit=2)
                symbol_sets['popular'].extend(results)
            
            logger.info(f"Created {len(symbol_sets)} curated symbol sets")
            return symbol_sets
            
        except Exception as e:
            error_msg = f"Failed to create curated symbol sets: {str(e)}"
            logger.error(error_msg)
            raise DataError(error_msg) from e
    
    def clear_cache(self):
        """Clear the ticker cache."""
        self._cache.clear()
        self._cache_timestamp = None
        logger.info("Ticker cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'cached_queries': len(self._cache),
            'cache_timestamp': self._cache_timestamp,
            'cache_ttl_seconds': self._cache_ttl,
            'cache_valid': self._is_cache_valid()
        }
