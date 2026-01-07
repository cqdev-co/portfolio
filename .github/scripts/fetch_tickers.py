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
import time
import logging
import argparse
from typing import List, Optional, Set
from dataclasses import dataclass
from datetime import datetime, timezone
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Import quality filtering utilities
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utils'))
from utils.efficient_ticker_filter import EfficientTickerFilter, EfficientTickerMetrics
from utils.yfinance_validator import YFinanceValidator, YFinanceValidation
from utils.common_filters import is_cfd_ticker
from utils.db_utils import store_tickers as store_tickers_util
from utils.constants import (
    TABLE_TICKERS,
    DEFAULT_BATCH_SIZE,
    RATE_LIMIT_DELAY_SECONDS,
    TICKER_MIN_PRICE,
    TICKER_MAX_PRICE,
    TICKER_MIN_QUALITY_SCORE,
    TICKER_MIN_HISTORY_DAYS,
    TICKER_MIN_DATA_COMPLETENESS,
    TICKER_MAX_GAP_RATIO,
    TICKER_MIN_VOLUME,
    DEFAULT_MAX_TICKERS
)

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
                 min_quality_score: float = TICKER_MIN_QUALITY_SCORE,
                 enable_cfd_filter: bool = True,
                 max_tickers: int = DEFAULT_MAX_TICKERS,
                 enable_yfinance_validation: bool = True,
                 enable_advanced_checks: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose
        self.enable_quality_filter = enable_quality_filter
        self.us_only = us_only
        self.min_quality_score = min_quality_score
        self.enable_cfd_filter = enable_cfd_filter
        self.max_tickers = max_tickers
        self.enable_yfinance_validation = enable_yfinance_validation
        self.enable_advanced_checks = enable_advanced_checks
        
        self.setup_logging()
        self.setup_supabase()
        self.setup_api_keys()
        self.setup_quality_filter()
        self.setup_yfinance_validator()
        
    def setup_logging(self) -> None:
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
        
    def setup_supabase(self) -> None:
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
        
    def setup_api_keys(self) -> None:
        """Setup API keys for data sources"""
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        self.fmp_key = os.getenv('FMP_API_KEY')
        
        if not self.alpha_vantage_key and not self.fmp_key:
            self.logger.warning(
                "No API keys found. Will use free data sources only."
            )
    
    def setup_quality_filter(self) -> None:
        """Setup quality filtering components"""
        if self.enable_quality_filter:
            self.quality_filter = EfficientTickerFilter(
                alpha_vantage_key=self.alpha_vantage_key,
                fmp_key=self.fmp_key
            )
                
            self.logger.info(
                f"Efficient quality filtering enabled: US-only={self.us_only}, "
                f"min_score={self.min_quality_score}, CFD-filter={self.enable_cfd_filter}, "
                f"max_tickers={self.max_tickers}, "
                f"advanced_checks={self.enable_advanced_checks}"
            )
            
            if self.enable_advanced_checks:
                self.logger.info(
                    "Advanced quality checks ENABLED: "
                    "options eligibility, institutional ownership, "
                    "revenue requirements, float validation"
                )
        else:
            self.quality_filter = None
            self.logger.info("Quality filtering disabled")
    
    def setup_yfinance_validator(self) -> None:
        """Setup YFinance data quality validator with stricter thresholds"""
        if self.enable_yfinance_validation:
            self.yfinance_validator = YFinanceValidator(
                min_history_days=TICKER_MIN_HISTORY_DAYS,
                min_volume=TICKER_MIN_VOLUME,
                min_price=TICKER_MIN_PRICE,
                max_price=TICKER_MAX_PRICE,
                min_data_completeness=TICKER_MIN_DATA_COMPLETENESS,
                max_gap_ratio=TICKER_MAX_GAP_RATIO,
                recency_days=5,
                max_workers=3,  # Reduced to avoid rate limiting
                request_delay=0.5  # 500ms delay between requests
            )
            self.logger.info(
                f"YFinance validation enabled with STRICTER thresholds: "
                f"min_price=${TICKER_MIN_PRICE}, min_volume={TICKER_MIN_VOLUME:,}, "
                f"min_history={TICKER_MIN_HISTORY_DAYS}d, "
                f"completeness={TICKER_MIN_DATA_COMPLETENESS*100:.0f}%"
            )
        else:
            self.yfinance_validator = None
            self.logger.info("YFinance validation disabled")
    
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
            
        except requests.RequestException as e:
            self.logger.error(f"Network error fetching from Alpha Vantage: {e}")
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data parsing error from Alpha Vantage: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error fetching from Alpha Vantage: {e}", exc_info=True)
            
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
            
        except requests.RequestException as e:
            self.logger.error(f"Network error fetching from FMP: {e}")
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data parsing error from FMP: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error fetching from FMP: {e}", exc_info=True)
            
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
            # Use shared CFD detection function
            is_cfd = is_cfd_ticker(
                ticker.symbol, 
                ticker.name or '', 
                ticker.exchange or ''
            )
            
            if is_cfd:
                cfd_count += 1
                continue
            
            filtered_tickers.append(ticker)
        
        self.logger.info(
            f"CFD filtering complete: {len(filtered_tickers)} tickers remaining "
            f"(filtered out {cfd_count} CFDs)"
        )
        
        return filtered_tickers
    
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
            # Choose filtering method based on advanced checks setting
            if self.enable_advanced_checks:
                self.logger.info(
                    "Using ADVANCED filtering (options, institutional, "
                    "fundamentals, float) - this may take 10-15 minutes..."
                )
                high_quality_symbols, quality_metrics = \
                    self.quality_filter.filter_with_advanced_checks(
                        ticker_dicts,
                        min_quality_score=self.min_quality_score,
                        max_tickers=self.max_tickers,
                        enable_advanced_checks=True,
                        verbose=self.verbose
                    )
            else:
                # Standard efficient filtering
                high_quality_symbols, quality_metrics = \
                    self.quality_filter.filter_high_quality_tickers(
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
            metrics_dict = {m.symbol: m for m in quality_metrics}
            
            for ticker in tickers:
                if ticker.symbol in symbol_set:
                    # Update with metrics from filter
                    metrics = metrics_dict.get(ticker.symbol)
                    if metrics:
                        if metrics.market_cap:
                            ticker.market_cap = int(metrics.market_cap)
                        if metrics.exchange:
                            ticker.exchange = metrics.exchange
                        if metrics.sector:
                            ticker.sector = metrics.sector
                        # Set country to US for filtered tickers
                        ticker.country = 'US'
                    
                    filtered_tickers.append(ticker)
            
            # Generate summary
            summary = self.quality_filter.get_filtering_summary(
                high_quality_symbols, quality_metrics
            )
            
            self.logger.info(
                f"Quality filtering complete: {len(filtered_tickers)} high-quality "
                f"tickers from {len(tickers)} total "
                f"({len(filtered_tickers)/len(tickers)*100:.1f}% pass rate)"
            )
            
            if summary:
                self.logger.info(
                    f"Quality summary: avg_score={summary.get('avg_quality_score', 0):.1f}, "
                    f"sp500_count={summary.get('sp500_count', 0)}, "
                    f"avg_price=${summary.get('price_range', {}).get('avg', 0):.2f}"
                )
            
            # Log advanced metrics if available
            if self.enable_advanced_checks and quality_metrics:
                with_options = sum(1 for m in quality_metrics if m.has_options)
                profitable = sum(1 for m in quality_metrics if m.is_profitable)
                self.logger.info(
                    f"Advanced metrics: {with_options} with options, "
                    f"{profitable} profitable"
                )
            
            return filtered_tickers
            
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data error during quality filtering: {e}")
            self.logger.info("Falling back to unfiltered ticker list")
            return tickers
        except Exception as e:
            self.logger.error(
                f"Unexpected error during quality filtering: {e}", 
                exc_info=True
            )
            self.logger.info("Falling back to unfiltered ticker list")
            return tickers
    
    def apply_yfinance_validation(self, tickers: List[TickerInfo]) -> List[TickerInfo]:
        """
        Apply YFinance data quality validation.
        
        This is the final quality gate that ensures:
        - Data is accessible on YFinance
        - Historical data exists and is recent
        - OHLC data is valid (no violations)
        - Volume data is present
        - No excessive data gaps
        """
        if not self.enable_yfinance_validation or not self.yfinance_validator:
            self.logger.info("YFinance validation disabled, skipping")
            return tickers
        
        self.logger.info(
            f"Applying YFinance validation to {len(tickers)} tickers "
            f"(this may take a few minutes...)"
        )
        
        # Extract symbols for validation
        symbols = [t.symbol for t in tickers]
        
        try:
            # Validate all tickers in parallel
            validation_results = self.yfinance_validator.validate_batch(
                symbols,
                period="6mo",
                verbose=self.verbose
            )
            
            # Filter to only valid tickers
            validated_tickers = []
            for ticker in tickers:
                result = validation_results.get(ticker.symbol)
                if result and result.is_valid:
                    # Update ticker info with validation data
                    if result.last_price:
                        ticker.market_cap = ticker.market_cap or 0
                    validated_tickers.append(ticker)
                elif result and self.verbose:
                    self.logger.debug(
                        f"Rejected {ticker.symbol}: "
                        f"{', '.join(result.validation_issues[:2])}"
                    )
            
            # Generate summary
            summary = self.yfinance_validator.get_validation_summary(
                validation_results
            )
            
            self.logger.info(
                f"YFinance validation complete: {len(validated_tickers)} tickers passed "
                f"({summary['pass_rate']*100:.1f}% pass rate)"
            )
            
            if summary['top_rejection_reasons']:
                self.logger.info("Top rejection reasons:")
                for reason_info in summary['top_rejection_reasons'][:5]:
                    self.logger.info(
                        f"  - {reason_info['reason']}: "
                        f"{reason_info['count']} tickers"
                    )
            
            self.logger.info(
                f"Validated data quality: "
                f"avg_completeness={summary['avg_data_completeness']*100:.1f}%, "
                f"avg_ohlc_quality={summary['avg_ohlc_quality']*100:.1f}%, "
                f"avg_history={summary['avg_history_days']:.0f} days"
            )
            
            return validated_tickers
            
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data error during YFinance validation: {e}")
            self.logger.warning(
                "YFinance validation failed, proceeding with unvalidated tickers"
            )
            return tickers
        except Exception as e:
            self.logger.error(f"Unexpected error during YFinance validation: {e}", exc_info=True)
            self.logger.warning(
                "YFinance validation failed, proceeding with unvalidated tickers"
            )
            return tickers
    
    def store_tickers(self, tickers: List[TickerInfo]) -> bool:
        """Store tickers in Supabase database"""
        return store_tickers_util(
            self.supabase,
            tickers,
            TABLE_TICKERS,
            dry_run=self.dry_run,
            batch_size=DEFAULT_BATCH_SIZE,
            rate_limit_delay=RATE_LIMIT_DELAY_SECONDS
        )
    
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
        
        if not all_tickers:
            self.logger.error("No tickers fetched from any source")
            return False
        
        # Deduplicate
        unique_tickers = self.deduplicate_tickers(all_tickers)
        
        # Apply CFD filters (before other filters to reduce processing)
        cfd_filtered_tickers = self.apply_cfd_filters(unique_tickers)
        
        # Choose validation strategy: YFinance validation OR quality filtering
        # YFinance validation already checks price, volume, and data quality,
        # so quality filtering is redundant when YFinance validation is enabled
        if self.enable_yfinance_validation:
            # Skip quality filtering - YFinance validation will handle everything
            self.logger.info(
                "YFinance validation enabled - skipping quality filtering "
                "(YFinance validates price, volume, and data quality)"
            )
            filtered_tickers = cfd_filtered_tickers
        else:
            # Apply quality filters only if YFinance validation is disabled
            filtered_tickers = self.apply_quality_filters(cfd_filtered_tickers)
            if not filtered_tickers:
                self.logger.error("No tickers remaining after quality filtering")
                return False
        
        # Apply YFinance validation if enabled
        if self.enable_yfinance_validation:
            validated_tickers = self.apply_yfinance_validation(filtered_tickers)
            if not validated_tickers:
                self.logger.error("No tickers remaining after YFinance validation")
                return False
        else:
            validated_tickers = filtered_tickers
        
        # Final safety check - ensure we don't exceed max_tickers
        if len(validated_tickers) > self.max_tickers:
            self.logger.info(f"Final limit: Reducing from {len(validated_tickers)} to {self.max_tickers} tickers")
            validated_tickers = validated_tickers[:self.max_tickers]
        
        # Store in database
        success = self.store_tickers(validated_tickers)
        
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
        default=TICKER_MIN_QUALITY_SCORE,
        help=f'Minimum quality score for filtering (0-100, default: {TICKER_MIN_QUALITY_SCORE})'
    )
    parser.add_argument(
        '--disable-cfd-filter',
        action='store_true',
        help='Disable CFD filtering (include Contract for Difference instruments)'
    )
    parser.add_argument(
        '--max-tickers',
        type=int,
        default=DEFAULT_MAX_TICKERS,
        help=f'Maximum number of tickers to store (default: {DEFAULT_MAX_TICKERS})'
    )
    parser.add_argument(
        '--disable-yfinance-validation',
        action='store_true',
        help='Disable YFinance data quality validation (not recommended)'
    )
    parser.add_argument(
        '--enable-advanced-checks',
        action='store_true',
        help='Enable advanced quality checks (options, institutional, '
             'fundamentals, float) - adds ~10-15 min but higher quality'
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
            max_tickers=args.max_tickers,
            enable_yfinance_validation=not args.disable_yfinance_validation,
            enable_advanced_checks=args.enable_advanced_checks
        )
        success = fetcher.run()
        sys.exit(0 if success else 1)
        
    except (ValueError, KeyError) as e:
        logging.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()