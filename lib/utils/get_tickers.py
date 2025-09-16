"""
Ticker Utility Functions

Comprehensive utility functions to retrieve ticker data from Supabase database.
Can be used across the entire monorepo for consistent ticker data access.

Usage:
    from lib.utils.get_tickers import get_all_tickers, get_ticker_by_symbol
    
    # Get all active tickers
    tickers = get_all_tickers()
    
    # Get specific ticker
    ticker = get_ticker_by_symbol('AAPL')
    
    # Get tickers by exchange
    nasdaq_tickers = get_tickers_by_exchange('NASDAQ')
"""

import os
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class TickerClient:
    """Singleton client for ticker database operations"""
    
    _instance = None
    _client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TickerClient, cls).__new__(cls)
            cls._instance._initialize_client()
        return cls._instance
    
    def _initialize_client(self):
        """Initialize Supabase client"""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_ANON_KEY')  # Use anon key for read operations
        
        if not url or not key:
            raise ValueError(
                "Missing Supabase credentials. Please set SUPABASE_URL "
                "and SUPABASE_ANON_KEY in your .env file"
            )
        
        self._client: Client = create_client(url, key)
        logger.info("Ticker client initialized")
    
    @property
    def client(self) -> Client:
        """Get the Supabase client instance"""
        return self._client

# Global client instance
_ticker_client = TickerClient()

def get_all_tickers(
    active_only: bool = True,
    limit: Optional[int] = None,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    Get all tickers from the database
    
    Args:
        active_only: Only return active tickers (default: True)
        limit: Maximum number of tickers to return (default: None for all)
        offset: Number of records to skip (default: 0)
    
    Returns:
        List of ticker dictionaries
    
    Example:
        >>> tickers = get_all_tickers(limit=100)
        >>> print(f"Found {len(tickers)} tickers")
    """
    try:
        if limit:
            # Simple case: user specified a limit
            query = _ticker_client.client.table('tickers').select('*')
            
            if active_only:
                query = query.eq('is_active', True)
            
            query = query.limit(limit)
            
            if offset > 0:
                query = query.offset(offset)
            
            query = query.order('symbol')
            response = query.execute()
            
            logger.info(f"Retrieved {len(response.data)} tickers")
            return response.data
        else:
            # No limit specified: get ALL records using pagination
            # Supabase has a default limit of 1000, so we need to paginate
            all_tickers = []
            page_size = 1000
            current_offset = offset
            
            while True:
                query = _ticker_client.client.table('tickers').select('*')
                
                if active_only:
                    query = query.eq('is_active', True)
                
                query = query.limit(page_size).offset(current_offset).order('symbol')
                response = query.execute()
                
                if not response.data:
                    break
                
                all_tickers.extend(response.data)
                
                # If we got less than page_size, we've reached the end
                if len(response.data) < page_size:
                    break
                
                current_offset += page_size
                logger.debug(f"Retrieved {len(all_tickers)} tickers so far...")
            
            logger.info(f"Retrieved {len(all_tickers)} total tickers")
            return all_tickers
        
    except Exception as e:
        logger.error(f"Error fetching all tickers: {e}")
        return []

def get_ticker_by_symbol(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific ticker by symbol
    
    Args:
        symbol: Ticker symbol (e.g., 'AAPL', 'GOOGL')
    
    Returns:
        Ticker dictionary or None if not found
    
    Example:
        >>> ticker = get_ticker_by_symbol('AAPL')
        >>> if ticker:
        ...     print(f"Company: {ticker['name']}")
    """
    try:
        response = _ticker_client.client.table('tickers').select('*').eq(
            'symbol', symbol.upper()
        ).execute()
        
        if response.data:
            logger.debug(f"Found ticker: {symbol}")
            return response.data[0]
        else:
            logger.warning(f"Ticker not found: {symbol}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching ticker {symbol}: {e}")
        return None

def get_tickers_by_exchange(
    exchange: str,
    active_only: bool = True,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get tickers by exchange
    
    Args:
        exchange: Exchange name (e.g., 'NASDAQ', 'NYSE')
        active_only: Only return active tickers (default: True)
        limit: Maximum number of tickers to return
    
    Returns:
        List of ticker dictionaries
    
    Example:
        >>> nasdaq_tickers = get_tickers_by_exchange('NASDAQ', limit=50)
    """
    try:
        query = _ticker_client.client.table('tickers').select('*').eq(
            'exchange', exchange.upper()
        )
        
        if active_only:
            query = query.eq('is_active', True)
        
        if limit:
            query = query.limit(limit)
        
        query = query.order('symbol')
        response = query.execute()
        
        logger.info(f"Retrieved {len(response.data)} tickers from {exchange}")
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching tickers for exchange {exchange}: {e}")
        return []

def get_tickers_by_country(
    country: str,
    active_only: bool = True,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get tickers by country
    
    Args:
        country: Country code (e.g., 'US', 'CA', 'GB')
        active_only: Only return active tickers (default: True)
        limit: Maximum number of tickers to return
    
    Returns:
        List of ticker dictionaries
    """
    try:
        query = _ticker_client.client.table('tickers').select('*').eq(
            'country', country.upper()
        )
        
        if active_only:
            query = query.eq('is_active', True)
        
        if limit:
            query = query.limit(limit)
        
        query = query.order('symbol')
        response = query.execute()
        
        logger.info(f"Retrieved {len(response.data)} tickers from {country}")
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching tickers for country {country}: {e}")
        return []

def get_tickers_by_sector(
    sector: str,
    active_only: bool = True,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get tickers by sector
    
    Args:
        sector: Sector name (e.g., 'Technology', 'Healthcare')
        active_only: Only return active tickers (default: True)
        limit: Maximum number of tickers to return
    
    Returns:
        List of ticker dictionaries
    """
    try:
        query = _ticker_client.client.table('tickers').select('*').ilike(
            'sector', f'%{sector}%'
        )
        
        if active_only:
            query = query.eq('is_active', True)
        
        if limit:
            query = query.limit(limit)
        
        query = query.order('symbol')
        response = query.execute()
        
        logger.info(f"Retrieved {len(response.data)} tickers from {sector} sector")
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching tickers for sector {sector}: {e}")
        return []

def search_tickers(
    query: str,
    search_fields: List[str] = ['symbol', 'name'],
    active_only: bool = True,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search tickers by symbol or name
    
    Args:
        query: Search query string
        search_fields: Fields to search in (default: ['symbol', 'name'])
        active_only: Only return active tickers (default: True)
        limit: Maximum number of results (default: 50)
    
    Returns:
        List of matching ticker dictionaries
    
    Example:
        >>> results = search_tickers('apple')
        >>> results = search_tickers('AAPL', search_fields=['symbol'])
    """
    try:
        # Build OR query for multiple fields
        conditions = []
        for field in search_fields:
            conditions.append(f"{field}.ilike.%{query}%")
        
        or_condition = ','.join(conditions)
        
        query_builder = _ticker_client.client.table('tickers').select('*').or_(
            or_condition
        )
        
        if active_only:
            query_builder = query_builder.eq('is_active', True)
        
        query_builder = query_builder.limit(limit).order('symbol')
        response = query_builder.execute()
        
        logger.info(f"Search '{query}' returned {len(response.data)} results")
        return response.data
        
    except Exception as e:
        logger.error(f"Error searching tickers with query '{query}': {e}")
        return []

def get_ticker_count(active_only: bool = True) -> int:
    """
    Get total count of tickers in database
    
    Args:
        active_only: Only count active tickers (default: True)
    
    Returns:
        Total number of tickers
    """
    try:
        query = _ticker_client.client.table('tickers').select(
            'id', count='exact'
        )
        
        if active_only:
            query = query.eq('is_active', True)
        
        response = query.execute()
        count = response.count if response.count is not None else 0
        
        logger.info(f"Total ticker count: {count}")
        return count
        
    except Exception as e:
        logger.error(f"Error getting ticker count: {e}")
        return 0

def get_exchanges() -> List[str]:
    """
    Get list of all unique exchanges in the database
    
    Returns:
        List of exchange names
    """
    try:
        response = _ticker_client.client.table('tickers').select(
            'exchange'
        ).not_.is_('exchange', 'null').execute()
        
        exchanges = list(set(
            item['exchange'] for item in response.data 
            if item['exchange']
        ))
        exchanges.sort()
        
        logger.info(f"Found {len(exchanges)} unique exchanges")
        return exchanges
        
    except Exception as e:
        logger.error(f"Error fetching exchanges: {e}")
        return []

def get_countries() -> List[str]:
    """
    Get list of all unique countries in the database
    
    Returns:
        List of country codes
    """
    try:
        response = _ticker_client.client.table('tickers').select(
            'country'
        ).not_.is_('country', 'null').execute()
        
        countries = list(set(
            item['country'] for item in response.data 
            if item['country']
        ))
        countries.sort()
        
        logger.info(f"Found {len(countries)} unique countries")
        return countries
        
    except Exception as e:
        logger.error(f"Error fetching countries: {e}")
        return []

def get_sectors() -> List[str]:
    """
    Get list of all unique sectors in the database
    
    Returns:
        List of sector names
    """
    try:
        response = _ticker_client.client.table('tickers').select(
            'sector'
        ).not_.is_('sector', 'null').execute()
        
        sectors = list(set(
            item['sector'] for item in response.data 
            if item['sector']
        ))
        sectors.sort()
        
        logger.info(f"Found {len(sectors)} unique sectors")
        return sectors
        
    except Exception as e:
        logger.error(f"Error fetching sectors: {e}")
        return []

# Convenience functions for common use cases
def get_sp500_tickers() -> List[Dict[str, Any]]:
    """Get S&P 500 tickers (approximation based on major US exchanges)"""
    return get_tickers_by_exchange('NYSE') + get_tickers_by_exchange('NASDAQ')

def get_tech_tickers(limit: int = 100) -> List[Dict[str, Any]]:
    """Get technology sector tickers"""
    return get_tickers_by_sector('Technology', limit=limit)

def get_recently_updated_tickers(hours: int = 24) -> List[Dict[str, Any]]:
    """
    Get tickers updated within the last N hours
    
    Args:
        hours: Number of hours to look back (default: 24)
    
    Returns:
        List of recently updated tickers
    """
    try:
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        response = _ticker_client.client.table('tickers').select('*').gte(
            'updated_at', cutoff_time.isoformat()
        ).order('updated_at', desc=True).execute()
        
        logger.info(f"Found {len(response.data)} tickers updated in last {hours} hours")
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching recently updated tickers: {e}")
        return []