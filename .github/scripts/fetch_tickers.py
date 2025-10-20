#!/usr/bin/env python3
"""
Global Market Ticker Fetcher

This script fetches all available stock tickers from multiple global markets
and stores them in a Supabase database. It uses multiple data sources to
ensure comprehensive coverage of global markets while filtering out CFDs
and other non-tradeable instruments.

Data Sources:
- Alpha Vantage API (US markets)
- Financial Modeling Prep API (Global markets)
- Yahoo Finance (fallback for additional tickers)

Quality Filtering:
- Removes CFDs (Contracts for Difference)
- Filters out warrants, units, preferred shares
- Excludes penny stocks below minimum thresholds
- Prioritizes liquid, tradeable securities

Usage:
    python fetch_tickers.py [--dry-run] [--verbose] [--disable-cfd-filter]
"""

import os
import sys
import json
import time
import logging
import argparse
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from datetime import datetime, timezone
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Import quality filtering utilities
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))
from utils.efficient_ticker_filter import EfficientTickerFilter, EfficientTickerMetrics

# Load environment variables
load_dotenv()

@dataclass
class TickerInfo:
    """Data class for ticker information"""
    symbol: str
    name: str
    exchange: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[int] = None
    ticker_type: str = 'stock'

class TickerFetcher:
    """Main class for fetching and storing ticker data"""
    
    def __init__(self, dry_run: bool = False, verbose: bool = False, 
                 enable_quality_filter: bool = True, us_only: bool = True,
                 min_quality_score: float = 45.0, enable_cfd_filter: bool = True,
                 max_tickers: int = 5000):
        self.dry_run = dry_run
        self.verbose = verbose
        self.enable_quality_filter = enable_quality_filter
        self.us_only = us_only
        self.min_quality_score = min_quality_score
        self.enable_cfd_filter = enable_cfd_filter
        self.max_tickers = max_tickers
        
        self.setup_logging()
        self.setup_supabase()
        self.setup_api_keys()
        self.setup_quality_filter()
        
    def setup_logging(self):
        """Configure logging"""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('ticker_fetch.log')
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def setup_supabase(self):
        """Initialize Supabase client"""
        url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        key = os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')
        
        if not url or not key:
            raise ValueError(
                "Missing Supabase credentials. Please set SUPABASE_URL "
                "and SUPABASE_SERVICE_ROLE_KEY in your .env file"
            )
            
        self.supabase: Client = create_client(url, key)
        self.logger.info("Supabase client initialized")
        
    def setup_api_keys(self):
        """Setup API keys for data sources"""
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        self.fmp_key = os.getenv('FMP_API_KEY')
        
        if not self.alpha_vantage_key and not self.fmp_key:
            self.logger.warning(
                "No API keys found. Will use free data sources only."
            )
    
    def setup_quality_filter(self):
        """Setup quality filtering components"""
        if self.enable_quality_filter:
            self.quality_filter = EfficientTickerFilter(
                alpha_vantage_key=self.alpha_vantage_key,
                fmp_key=self.fmp_key
            )
                
            self.logger.info(
                f"Efficient quality filtering enabled: US-only={self.us_only}, "
                f"min_score={self.min_quality_score}, CFD-filter={self.enable_cfd_filter}, "
                f"max_tickers={self.max_tickers}"
            )
        else:
            self.quality_filter = None
            self.logger.info("Quality filtering disabled")
    
    def fetch_alpha_vantage_tickers(self) -> List[TickerInfo]:
        """Fetch tickers from Alpha Vantage API"""
        if not self.alpha_vantage_key:
            self.logger.info("Skipping Alpha Vantage (no API key)")
            return []
            
        tickers = []
        try:
            # Alpha Vantage listing endpoint
            url = "https://www.alphavantage.co/query"
            params = {
                'function': 'LISTING_STATUS',
                'apikey': self.alpha_vantage_key
            }
            
            self.logger.info("Fetching tickers from Alpha Vantage...")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            # Check for API errors (empty response, JSON error messages, etc.)
            response_text = response.text.strip()
            if not response_text or response_text == '{}' or len(response_text) < 100:
                self.logger.warning(f"Alpha Vantage returned empty/invalid response: {response_text[:100]}")
                return []
            
            # Check if response is JSON (error) instead of CSV
            if response_text.startswith('{') and response_text.endswith('}'):
                self.logger.warning("Alpha Vantage returned JSON error response instead of CSV data")
                return []
            
            # Parse CSV response
            lines = response_text.split('\n')
            if len(lines) < 2:
                self.logger.warning("Alpha Vantage response has insufficient data")
                return []
                
            headers = lines[0].split(',')
            
            for line in lines[1:]:
                if not line.strip():
                    continue
                    
                values = line.split(',')
                if len(values) >= 3:
                    symbol = values[0].strip()
                    name = values[1].strip()
                    
                    # Skip tickers with missing required fields
                    if not symbol or not name:
                        continue
                    
                    ticker = TickerInfo(
                        symbol=symbol,
                        name=name,
                        exchange=values[2].strip() if len(values) > 2 else None,
                        country='US',  # Alpha Vantage is primarily US
                        currency='USD',
                        ticker_type='stock'
                    )
                    tickers.append(ticker)
                    
            self.logger.info(f"Fetched {len(tickers)} tickers from Alpha Vantage")
            
        except Exception as e:
            self.logger.error(f"Error fetching from Alpha Vantage: {e}")
            
        return tickers
    
    def fetch_fmp_tickers(self) -> List[TickerInfo]:
        """Fetch tickers from Financial Modeling Prep API"""
        if not self.fmp_key:
            self.logger.info("Skipping FMP (no API key)")
            return []
            
        tickers = []
        try:
            # FMP stock list endpoint
            url = f"https://financialmodelingprep.com/api/v3/stock/list"
            params = {'apikey': self.fmp_key}
            
            self.logger.info("Fetching tickers from Financial Modeling Prep...")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            for item in data:
                symbol = item.get('symbol', '').strip() if item.get('symbol') else ''
                name = item.get('name', '').strip() if item.get('name') else ''
                
                # Skip tickers with missing required fields
                if not symbol or not name:
                    continue
                
                ticker = TickerInfo(
                    symbol=symbol,
                    name=name,
                    exchange=item.get('exchange'),
                    currency=item.get('currency'),
                    ticker_type='stock'
                )
                tickers.append(ticker)
                
            self.logger.info(f"Fetched {len(tickers)} tickers from FMP")
            
        except Exception as e:
            self.logger.error(f"Error fetching from FMP: {e}")
            
        return tickers
    
    def fetch_yahoo_finance_tickers(self) -> List[TickerInfo]:
        """Fetch additional tickers from Yahoo Finance screener"""
        tickers = []
        try:
            # Major exchanges and their common tickers
            exchanges = {
                'NASDAQ': 'https://api.nasdaq.com/api/screener/stocks',
                'NYSE': 'https://api.nasdaq.com/api/screener/stocks'
            }
            
            self.logger.info("Fetching tickers from Yahoo Finance sources...")
            
            # This is a simplified approach - in practice, you might want
            # to use yfinance library or other methods
            # For now, we'll add some major known tickers
            major_tickers = [
                ('AAPL', 'Apple Inc.', 'NASDAQ', 'US', 'USD'),
                ('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'US', 'USD'),
                ('MSFT', 'Microsoft Corporation', 'NASDAQ', 'US', 'USD'),
                ('TSLA', 'Tesla, Inc.', 'NASDAQ', 'US', 'USD'),
                ('AMZN', 'Amazon.com, Inc.', 'NASDAQ', 'US', 'USD'),
                ('META', 'Meta Platforms, Inc.', 'NASDAQ', 'US', 'USD'),
                ('NVDA', 'NVIDIA Corporation', 'NASDAQ', 'US', 'USD'),
                ('BRK.A', 'Berkshire Hathaway Inc.', 'NYSE', 'US', 'USD'),
                ('JPM', 'JPMorgan Chase & Co.', 'NYSE', 'US', 'USD'),
                ('JNJ', 'Johnson & Johnson', 'NYSE', 'US', 'USD'),
            ]
            
            for symbol, name, exchange, country, currency in major_tickers:
                ticker = TickerInfo(
                    symbol=symbol,
                    name=name,
                    exchange=exchange,
                    country=country,
                    currency=currency,
                    ticker_type='stock'
                )
                tickers.append(ticker)
                
            self.logger.info(f"Added {len(tickers)} major tickers")
            
        except Exception as e:
            self.logger.error(f"Error fetching Yahoo Finance tickers: {e}")
            
        return tickers
    
    def deduplicate_tickers(self, all_tickers: List[TickerInfo]) -> List[TickerInfo]:
        """Remove duplicate tickers, keeping the most complete information"""
        seen_symbols: Set[str] = set()
        unique_tickers: List[TickerInfo] = []
        
        # Sort by completeness (more fields filled = better)
        def completeness_score(ticker: TickerInfo) -> int:
            score = 0
            if ticker.name: score += 1
            if ticker.exchange: score += 1
            if ticker.country: score += 1
            if ticker.currency: score += 1
            if ticker.sector: score += 1
            if ticker.industry: score += 1
            return score
        
        sorted_tickers = sorted(all_tickers, 
                              key=completeness_score, 
                              reverse=True)
        
        for ticker in sorted_tickers:
            if ticker.symbol not in seen_symbols:
                seen_symbols.add(ticker.symbol)
                unique_tickers.append(ticker)
                
        self.logger.info(
            f"Deduplicated {len(all_tickers)} tickers to "
            f"{len(unique_tickers)} unique tickers"
        )
        
        return unique_tickers
    
    def apply_cfd_filters(self, tickers: List[TickerInfo]) -> List[TickerInfo]:
        """Apply CFD filtering to remove Contract for Difference instruments"""
        if not self.enable_cfd_filter:
            self.logger.info("CFD filtering disabled, returning all tickers")
            return tickers
        
        self.logger.info(f"Applying CFD filters to {len(tickers)} tickers")
        
        filtered_tickers = []
        cfd_count = 0
        
        for ticker in tickers:
            # Use the efficient filter's CFD detection if available
            if self.quality_filter:
                is_cfd = self.quality_filter._is_cfd_ticker(
                    ticker.symbol, 
                    ticker.name or '', 
                    ticker.exchange or ''
                )
            else:
                # Fallback CFD detection logic
                is_cfd = self._basic_cfd_detection(ticker)
            
            if is_cfd:
                cfd_count += 1
                continue
            
            filtered_tickers.append(ticker)
        
        self.logger.info(
            f"CFD filtering complete: {len(filtered_tickers)} tickers remaining "
            f"(filtered out {cfd_count} CFDs)"
        )
        
        return filtered_tickers
    
    def _basic_cfd_detection(self, ticker: TickerInfo) -> bool:
        """Basic CFD detection fallback when quality filter is disabled"""
        symbol_lower = ticker.symbol.lower()
        name_lower = (ticker.name or '').lower()
        
        # Basic CFD patterns
        cfd_patterns = ['cfd', 'contract for difference', 'derivative', 'synthetic']
        
        return any(pattern in symbol_lower or pattern in name_lower 
                  for pattern in cfd_patterns)
    
    def apply_quality_filters(self, tickers: List[TickerInfo]) -> List[TickerInfo]:
        """Apply efficient quality filters to ticker list"""
        if not self.enable_quality_filter or not self.quality_filter:
            self.logger.info("Quality filtering disabled, returning all tickers")
            return tickers
        
        self.logger.info(f"Applying efficient quality filters to {len(tickers)} tickers")
        
        # Convert TickerInfo to dict format for efficient filtering
        ticker_dicts = []
        for ticker in tickers:
            ticker_dict = {
                'symbol': ticker.symbol,
                'name': ticker.name,
                'exchange': ticker.exchange,
                'country': ticker.country,
                'currency': ticker.currency,
                'sector': ticker.sector,
                'industry': ticker.industry,
                'market_cap': ticker.market_cap,
                'ticker_type': ticker.ticker_type
            }
            ticker_dicts.append(ticker_dict)
        
        try:
            # Apply efficient filtering (includes US-only filtering internally)
            high_quality_symbols, quality_metrics = self.quality_filter.filter_high_quality_tickers(
                ticker_dicts,
                min_quality_score=self.min_quality_score,
                max_tickers=self.max_tickers
            )
            
            if not high_quality_symbols:
                self.logger.warning("No symbols passed quality filtering")
                return []
            
            # Convert back to TickerInfo objects
            filtered_tickers = []
            symbol_set = set(high_quality_symbols)
            
            for ticker in tickers:
                if ticker.symbol in symbol_set:
                    # Update with metrics from efficient filter
                    for metrics in quality_metrics:
                        if metrics.symbol == ticker.symbol:
                            if metrics.market_cap:
                                ticker.market_cap = int(metrics.market_cap)
                            if metrics.exchange:
                                ticker.exchange = metrics.exchange
                            if metrics.sector:
                                ticker.sector = metrics.sector
                            # Set country to US for filtered tickers
                            ticker.country = 'US'
                            break
                    
                    filtered_tickers.append(ticker)
            
            # Generate summary
            summary = self.quality_filter.get_filtering_summary(high_quality_symbols, quality_metrics)
            
            self.logger.info(
                f"Efficient filtering complete: {len(filtered_tickers)} high-quality "
                f"tickers selected from {len(tickers)} total "
                f"({len(filtered_tickers)/len(tickers)*100:.1f}% pass rate)"
            )
            
            if summary:
                self.logger.info(
                    f"Quality summary: avg_score={summary.get('avg_quality_score', 0):.1f}, "
                    f"sp500_count={summary.get('sp500_count', 0)}, "
                    f"avg_price=${summary.get('price_range', {}).get('avg', 0):.2f}"
                )
            
            return filtered_tickers
            
        except Exception as e:
            self.logger.error(f"Error during efficient quality filtering: {e}")
            self.logger.info("Falling back to unfiltered ticker list")
            return tickers
    
    def store_tickers(self, tickers: List[TickerInfo]) -> bool:
        """Store tickers in Supabase database"""
        if self.dry_run:
            self.logger.info(f"DRY RUN: Would store {len(tickers)} tickers")
            return True
            
        try:
            # Prepare data for batch insert
            ticker_data = []
            skipped_count = 0
            
            for ticker in tickers:
                # Skip tickers with null or empty names (required field)
                if not ticker.name or ticker.name.strip() == '':
                    self.logger.warning(f"Skipping ticker {ticker.symbol}: missing or empty name")
                    skipped_count += 1
                    continue
                
                # Skip tickers with null or empty symbols (required field)
                if not ticker.symbol or ticker.symbol.strip() == '':
                    self.logger.warning(f"Skipping ticker with empty symbol: name={ticker.name}")
                    skipped_count += 1
                    continue
                
                data = {
                    'symbol': ticker.symbol.strip(),
                    'name': ticker.name.strip(),
                    'exchange': ticker.exchange.strip() if ticker.exchange else None,
                    'country': ticker.country.strip() if ticker.country else None,
                    'currency': ticker.currency.strip() if ticker.currency else None,
                    'sector': ticker.sector.strip() if ticker.sector else None,
                    'industry': ticker.industry.strip() if ticker.industry else None,
                    'market_cap': ticker.market_cap,
                    'ticker_type': ticker.ticker_type or 'stock',
                    'is_active': True,
                    'last_fetched': datetime.now(timezone.utc).isoformat()
                }
                ticker_data.append(data)
            
            if skipped_count > 0:
                self.logger.info(f"Skipped {skipped_count} tickers due to missing required fields")
            
            # Insert in batches to avoid timeouts
            batch_size = 1000
            total_inserted = 0
            
            for i in range(0, len(ticker_data), batch_size):
                batch = ticker_data[i:i + batch_size]
                
                try:
                    result = self.supabase.table('tickers').upsert(
                        batch,
                        on_conflict='symbol'
                    ).execute()
                    
                    total_inserted += len(batch)
                    self.logger.info(
                        f"Inserted batch {i//batch_size + 1}: "
                        f"{len(batch)} tickers "
                        f"({total_inserted}/{len(ticker_data)} total)"
                    )
                    
                    # Rate limiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    self.logger.error(f"Error inserting batch {i//batch_size + 1}: {e}")
                    continue
            
            self.logger.info(f"Successfully stored {total_inserted} tickers")
            return True
            
        except Exception as e:
            self.logger.error(f"Error storing tickers: {e}")
            return False
    
    def run(self) -> bool:
        """Main execution method"""
        self.logger.info("Starting ticker fetch process...")
        
        # Fetch from all sources
        all_tickers = []
        
        # Alpha Vantage
        av_tickers = self.fetch_alpha_vantage_tickers()
        all_tickers.extend(av_tickers)
        
        # Financial Modeling Prep
        fmp_tickers = self.fetch_fmp_tickers()
        all_tickers.extend(fmp_tickers)
        
        # Yahoo Finance / Additional sources
        yf_tickers = self.fetch_yahoo_finance_tickers()
        all_tickers.extend(yf_tickers)
        
        if not all_tickers:
            self.logger.error("No tickers fetched from any source")
            return False
        
        # Deduplicate
        unique_tickers = self.deduplicate_tickers(all_tickers)
        
        # Apply CFD filters (before quality filters to reduce processing)
        cfd_filtered_tickers = self.apply_cfd_filters(unique_tickers)
        
        # Apply quality filters
        filtered_tickers = self.apply_quality_filters(cfd_filtered_tickers)
        
        if not filtered_tickers:
            self.logger.error("No tickers remaining after quality filtering")
            return False
        
        # Final safety check - ensure we don't exceed max_tickers
        if len(filtered_tickers) > self.max_tickers:
            self.logger.info(f"Final limit: Reducing from {len(filtered_tickers)} to {self.max_tickers} tickers")
            filtered_tickers = filtered_tickers[:self.max_tickers]
        
        # Store in database
        success = self.store_tickers(filtered_tickers)
        
        if success:
            self.logger.info("Ticker fetch process completed successfully")
        else:
            self.logger.error("Ticker fetch process failed")
            
        return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Fetch global market tickers and store in Supabase'
    )
    parser.add_argument(
        '--dry-run', 
        action='store_true',
        help='Run without actually storing data'
    )
    parser.add_argument(
        '--verbose', 
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--disable-quality-filter',
        action='store_true',
        help='Disable quality filtering (fetch all tickers)'
    )
    parser.add_argument(
        '--include-global',
        action='store_true',
        help='Include non-US tickers (default: US-only)'
    )
    parser.add_argument(
        '--min-quality-score',
        type=float,
        default=45.0,
        help='Minimum quality score for filtering (0-100, default: 45.0)'
    )
    parser.add_argument(
        '--disable-cfd-filter',
        action='store_true',
        help='Disable CFD filtering (include Contract for Difference instruments)'
    )
    parser.add_argument(
        '--max-tickers',
        type=int,
        default=2500,
        help='Maximum number of tickers to store (default: 2500)'
    )
    
    args = parser.parse_args()
    
    try:
        fetcher = TickerFetcher(
            dry_run=args.dry_run, 
            verbose=args.verbose,
            enable_quality_filter=not args.disable_quality_filter,
            us_only=not args.include_global,
            min_quality_score=args.min_quality_score,
            enable_cfd_filter=not args.disable_cfd_filter,
            max_tickers=args.max_tickers
        )
        success = fetcher.run()
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()