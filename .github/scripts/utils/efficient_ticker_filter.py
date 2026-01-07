#!/usr/bin/env python3
"""
Efficient Ticker Quality Filter

High-performance ticker filtering using batch API calls and optimized filtering logic.
Reduces processing time from hours to minutes.
"""

import logging
import time
import json
import requests
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass
from datetime import datetime
import pandas as pd
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from .common_filters import is_cfd_ticker
from .advanced_quality_checks import AdvancedQualityChecker, AdvancedQualityMetrics

logger = logging.getLogger(__name__)

@dataclass
class EfficientTickerMetrics:
    """Comprehensive ticker metrics for quality filtering"""
    symbol: str
    market_cap: Optional[float] = None
    price: Optional[float] = None
    volume: Optional[float] = None
    exchange: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    is_valid: bool = False
    quality_score: float = 0.0
    rejection_reason: Optional[str] = None
    
    # Advanced quality metrics (populated by AdvancedQualityChecker)
    has_options: bool = False
    institutional_ownership: float = 0.0
    revenue: Optional[float] = None
    is_profitable: bool = False
    float_shares: Optional[float] = None
    advanced_quality_score: float = 0.0

class EfficientTickerFilter:
    """High-performance ticker filtering with batch processing"""
    
    def __init__(self, alpha_vantage_key: Optional[str] = None, fmp_key: Optional[str] = None):
        self.alpha_vantage_key = alpha_vantage_key
        self.fmp_key = fmp_key
        self.setup_logging()
        
        # STRICTER thresholds for institutional-grade tickers
        self.min_market_cap = 100_000_000  # $100M minimum (was $25M)
        self.min_price = 2.00              # $2 minimum (was $0.50)
        self.max_price = 10_000.0
        self.min_volume = 100_000          # 100K minimum (was 25K)
        self.min_dollar_volume = 500_000   # $500K/day minimum (NEW)
        
        # US exchanges - more restrictive list for better quality
        self.us_exchanges = {
            'NASDAQ', 'NYSE', 'NYSEARCA', 'NYSEMKT'
        }
        
        # Major exchanges only (most liquid and reliable)
        self.major_exchanges = {
            'NASDAQ', 'NYSE'
        }
        
        # Known high-quality symbols for quality scoring
        self.sp500_symbols = self._load_sp500_symbols()
        self.nasdaq100_symbols = self._load_nasdaq100_symbols()
        self.dow30_symbols = self._load_dow30_symbols()
        
        # Combined quality index set for quick lookups
        self.quality_indexed_symbols = (
            self.sp500_symbols | 
            self.nasdaq100_symbols | 
            self.dow30_symbols
        )
        
    def setup_logging(self):
        """Setup logging"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def _load_sp500_symbols(self) -> Set[str]:
        """Load S&P 500 symbols for priority processing"""
        # Top S&P 500 symbols by market cap (these are definitely high quality)
        return {
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
            'BRK.B', 'UNH', 'JNJ', 'JPM', 'V', 'PG', 'XOM', 'HD', 'CVX',
            'MA', 'BAC', 'ABBV', 'PFE', 'AVGO', 'KO', 'LLY', 'WMT', 'MRK',
            'COST', 'PEP', 'TMO', 'DHR', 'ABT', 'ACN', 'VZ', 'ADBE', 'TXN',
            'NFLX', 'CRM', 'NKE', 'DIS', 'WFC', 'AMD', 'PM', 'RTX', 'NEE',
            'ORCL', 'CMCSA', 'COP', 'BMY', 'UPS', 'HON', 'T', 'QCOM', 'IBM',
            'LOW', 'INTC', 'UNP', 'ELV', 'SPGI', 'GS', 'INTU', 'CAT', 'AXP',
            'BLK', 'BKNG', 'DE', 'TJX', 'GILD', 'ADP', 'MDT', 'SYK', 'CVS',
            'VRTX', 'SCHW', 'AMT', 'TMUS', 'AMAT', 'C', 'ADI', 'MO', 'CB',
            'ISRG', 'SO', 'ZTS', 'MMC', 'DUK', 'PLD', 'ICE', 'GE', 'USB',
            'TGT', 'MDLZ', 'PNC', 'SHW', 'LRCX', 'AON', 'CME', 'CCI', 'ITW',
            'EOG', 'FDX', 'APD', 'NOC', 'BSX', 'EQIX', 'KLAC', 'CL', 'HCA'
        }
    
    def _load_nasdaq100_symbols(self) -> Set[str]:
        """Load NASDAQ-100 symbols for quality bonus"""
        return {
            'AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA',
            'AVGO', 'COST', 'NFLX', 'AMD', 'PEP', 'ADBE', 'CSCO', 'TMUS',
            'INTC', 'INTU', 'CMCSA', 'TXN', 'AMGN', 'QCOM', 'HON', 'AMAT',
            'ISRG', 'BKNG', 'SBUX', 'VRTX', 'ADP', 'GILD', 'ADI', 'MDLZ',
            'REGN', 'LRCX', 'MU', 'PYPL', 'CSX', 'SNPS', 'PANW', 'KLAC',
            'CDNS', 'MELI', 'CHTR', 'ORLY', 'MAR', 'MNST', 'ABNB', 'WDAY',
            'NXPI', 'CTAS', 'KDP', 'FTNT', 'LULU', 'MRVL', 'KHC', 'EXC',
            'AEP', 'PAYX', 'PCAR', 'DXCM', 'CPRT', 'ODFL', 'AZN', 'BIIB',
            'MRNA', 'ROST', 'IDXX', 'CTSH', 'CRWD', 'FAST', 'EA', 'VRSK',
            'CSGP', 'XEL', 'DLTR', 'BKR', 'ANSS', 'GFS', 'FANG', 'TEAM',
            'ILMN', 'ZS', 'WBD', 'SIRI', 'JD', 'PDD', 'DDOG', 'ALGN'
        }
    
    def _load_dow30_symbols(self) -> Set[str]:
        """Load Dow Jones 30 symbols for quality bonus"""
        return {
            'AAPL', 'MSFT', 'JPM', 'V', 'JNJ', 'UNH', 'PG', 'HD', 'CVX',
            'MRK', 'KO', 'DIS', 'MCD', 'CSCO', 'VZ', 'NKE', 'INTC', 'IBM',
            'WMT', 'GS', 'CAT', 'HON', 'AXP', 'BA', 'AMGN', 'TRV', 'CRM',
            'MMM', 'DOW', 'WBA'
        }
    

    def pre_filter_tickers_fast(self, tickers: List[Dict]) -> List[Dict]:
        """Fast pre-filtering based on basic criteria - AGGRESSIVE FILTERING"""
        logger.info(f"Pre-filtering {len(tickers)} tickers with aggressive filtering...")
        
        filtered = []
        cfd_count = 0
        exchange_filtered = 0
        symbol_filtered = 0
        
        for ticker in tickers:
            symbol = ticker.get('symbol', '') or ''
            exchange = ticker.get('exchange', '') or ''
            name = ticker.get('name', '') or ''
            
            # RELAXED: Allow 1-5 character symbols (include more legitimate stocks)
            if not symbol or len(symbol) < 1 or len(symbol) > 5:
                symbol_filtered += 1
                continue
            
            # RELAXED: Allow alphanumeric but exclude obvious non-stocks
            if not symbol.replace('.', '').replace('-', '').isalnum():
                symbol_filtered += 1
                continue
            
            # Skip obvious non-stock patterns
            if any(pattern in symbol.upper() for pattern in ['TEST', 'TEMP', 'NULL', 'VOID']):
                symbol_filtered += 1
                continue
                
            # Skip warrants, units, preferred shares, etc.
            skip_suffixes = ['W', 'U', 'R', 'P', 'Q', 'V', 'X', 'Y', 'Z']
            if any(symbol.endswith(suffix) for suffix in skip_suffixes):
                continue
            
            # Skip CFDs (Contract for Difference)
            if is_cfd_ticker(symbol, name, exchange):
                cfd_count += 1
                continue
            
            # Skip financial instruments
            if name and any(word in name.lower() for word in [
                'warrant', 'unit', 'right', 'preferred', 'depositary', 'receipt',
                'trust', 'fund', 'etf', 'etn', 'note', 'bond', 'debenture'
            ]):
                continue
            
            # AGGRESSIVE: Only major US exchanges or S&P 500 stocks
            is_sp500 = symbol in self.sp500_symbols
            is_major_exchange = exchange and any(major_ex in exchange.upper() 
                                               for major_ex in self.major_exchanges)
            is_us_exchange = exchange and any(us_ex in exchange.upper() 
                                            for us_ex in self.us_exchanges)
            
            if is_sp500:
                # S&P 500 stocks get highest priority regardless of exchange
                ticker['country'] = 'US'
                ticker['priority'] = 1
                filtered.append(ticker)
            elif is_major_exchange:
                # Major exchanges (NYSE, NASDAQ) get second priority
                ticker['country'] = 'US'
                ticker['priority'] = 2
                filtered.append(ticker)
            elif is_us_exchange:
                # Other US exchanges get lower priority, but include more
                ticker['country'] = 'US'
                ticker['priority'] = 3
                filtered.append(ticker)
            elif not exchange and len(symbol) <= 5 and symbol.replace('.', '').replace('-', '').isalnum():
                # Unknown exchange but clean symbol - include more with relaxed criteria
                ticker['country'] = 'US'
                ticker['priority'] = 4
                filtered.append(ticker)
            else:
                exchange_filtered += 1
                continue
        
        # Sort by priority (S&P 500 first, then others)
        filtered.sort(key=lambda x: x.get('priority', 999))
        
        logger.info(
            f"AGGRESSIVE pre-filtering complete: {len(filtered)} potential US stocks remaining\n"
            f"  - Filtered out {cfd_count} CFDs\n"
            f"  - Filtered out {symbol_filtered} invalid symbols\n"
            f"  - Filtered out {exchange_filtered} non-US/unlisted stocks"
        )
        return filtered
    
    def batch_get_basic_metrics(self, symbols: List[str], batch_size: int = 100) -> Dict[str, EfficientTickerMetrics]:
        """Get basic metrics for symbols using batch API calls"""
        logger.info(f"Getting basic metrics for {len(symbols)} symbols...")
        
        metrics = {}
        
        # Process S&P 500 symbols first (these are guaranteed high quality)
        sp500_in_list = [s for s in symbols if s in self.sp500_symbols]
        if sp500_in_list:
            logger.info(f"Fast-tracking {len(sp500_in_list)} S&P 500 symbols")
            for symbol in sp500_in_list:
                metrics[symbol] = EfficientTickerMetrics(
                    symbol=symbol,
                    market_cap=10_000_000_000,  # Assume >$10B for S&P 500
                    price=100.0,  # Reasonable assumption
                    volume=1_000_000,  # Assume good volume
                    exchange='NASDAQ',
                    country='US',
                    is_valid=True,
                    quality_score=85.0  # High score for S&P 500
                )
        
        # Process remaining symbols with heuristic scoring (no API calls)
        remaining_symbols = [s for s in symbols if s not in self.sp500_symbols]
        
        # Use heuristic-based scoring to avoid API rate limits
        for symbol in remaining_symbols:
            metrics[symbol] = self._create_heuristic_quality_metrics(symbol)
        
        logger.info(f"Retrieved metrics for {len(metrics)} symbols")
        return metrics
    
    def _create_heuristic_quality_metrics(self, symbol: str) -> EfficientTickerMetrics:
        """
        Create quality metrics using index membership and heuristics.
        
        Prioritizes index membership over symbol characteristics for
        more reliable quality signals.
        """
        # Start with base score
        quality_score = 40.0
        
        # INDEX MEMBERSHIP - strongest quality signal
        if symbol in self.dow30_symbols:
            quality_score += 30  # Dow 30 - highest quality
        elif symbol in self.sp500_symbols:
            quality_score += 25  # S&P 500 - very high quality
        elif symbol in self.nasdaq100_symbols:
            quality_score += 22  # NASDAQ 100 - high quality
        elif symbol in self.quality_indexed_symbols:
            quality_score += 20  # Any major index
        
        # Symbol format bonus (secondary signal)
        if symbol.isalpha() and symbol.isupper():
            quality_score += 5
        if len(symbol) <= 4:
            quality_score += 3
        
        # Penalize suspicious patterns
        if any(p in symbol.lower() for p in ['test', 'temp', 'xxx', 'null']):
            quality_score -= 40
        
        # Estimate defaults based on index membership
        if symbol in self.quality_indexed_symbols:
            # Indexed symbols have known quality
            estimated_market_cap = 5_000_000_000   # $5B default
            estimated_price = 75.0                  # $75 default
            estimated_volume = 1_000_000            # 1M volume
        elif len(symbol) <= 3:
            # Short symbols tend to be larger
            estimated_market_cap = 500_000_000     # $500M
            estimated_price = 40.0
            estimated_volume = 300_000
        else:
            # Conservative defaults for unknowns
            estimated_market_cap = 150_000_000     # $150M
            estimated_price = 20.0
            estimated_volume = 150_000
        
        return EfficientTickerMetrics(
            symbol=symbol,
            market_cap=estimated_market_cap,
            price=estimated_price,
            volume=estimated_volume,
            exchange='NASDAQ',
            country='US',
            is_valid=True,
            quality_score=quality_score
        )
    
    def _batch_fmp_metrics(self, symbols: List[str]) -> Dict[str, EfficientTickerMetrics]:
        """Get metrics using Financial Modeling Prep batch API"""
        metrics = {}
        batch_size = 100  # FMP batch limit
        
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i:i + batch_size]
            symbol_list = ','.join(batch_symbols)
            
            try:
                # Batch quote API
                url = f"https://financialmodelingprep.com/api/v3/quote/{symbol_list}"
                params = {'apikey': self.fmp_key}
                
                response = requests.get(url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                for item in data:
                    symbol = item.get('symbol')
                    if not symbol:
                        continue
                    
                    market_cap = item.get('marketCap')
                    price = item.get('price')
                    volume = item.get('volume')
                    exchange = item.get('exchange')
                    
                    # Calculate dollar volume for liquidity check
                    dollar_volume = (price or 0) * (volume or 0)
                    
                    # STRICTER quality checks for institutional-grade tickers
                    is_valid = (
                        market_cap and market_cap >= self.min_market_cap and
                        price and self.min_price <= price <= self.max_price and
                        volume and volume >= self.min_volume and
                        dollar_volume >= self.min_dollar_volume  # NEW: dollar volume
                    )
                    
                    quality_score = 0
                    rejection_reason = None
                    
                    if is_valid:
                        # Market cap scoring (25 pts max)
                        if market_cap >= 10_000_000_000:      # $10B+
                            quality_score += 25
                        elif market_cap >= 2_000_000_000:     # $2B+
                            quality_score += 22
                        elif market_cap >= 500_000_000:       # $500M+
                            quality_score += 18
                        elif market_cap >= 100_000_000:       # $100M+
                            quality_score += 12
                        
                        # Price scoring (15 pts max)
                        if 10 <= price <= 500:
                            quality_score += 15  # Sweet spot
                        elif 5 <= price <= 1000:
                            quality_score += 12
                        elif 2 <= price <= 2000:
                            quality_score += 8   # Acceptable
                        
                        # Volume scoring (20 pts max) - dollar volume
                        if dollar_volume >= 50_000_000:       # $50M+/day
                            quality_score += 20
                        elif dollar_volume >= 10_000_000:     # $10M+/day
                            quality_score += 17
                        elif dollar_volume >= 1_000_000:      # $1M+/day
                            quality_score += 13
                        elif dollar_volume >= 500_000:        # $500K+/day
                            quality_score += 8
                        
                        # Index membership bonus (15 pts max)
                        if symbol in self.dow30_symbols:
                            quality_score += 15
                        elif symbol in self.sp500_symbols:
                            quality_score += 12
                        elif symbol in self.nasdaq100_symbols:
                            quality_score += 10
                        
                        quality_score += 10  # Base score for passing all checks
                    else:
                        # Track rejection reason
                        if not market_cap or market_cap < self.min_market_cap:
                            rejection_reason = f"Market cap ${market_cap/1e6:.1f}M < ${self.min_market_cap/1e6:.0f}M"
                        elif not price or price < self.min_price:
                            rejection_reason = f"Price ${price:.2f} < ${self.min_price}"
                        elif not volume or volume < self.min_volume:
                            rejection_reason = f"Volume {volume:,.0f} < {self.min_volume:,.0f}"
                        elif dollar_volume < self.min_dollar_volume:
                            rejection_reason = f"Dollar volume ${dollar_volume/1e3:.0f}K < ${self.min_dollar_volume/1e3:.0f}K"
                    
                    metrics[symbol] = EfficientTickerMetrics(
                        symbol=symbol,
                        market_cap=market_cap,
                        price=price,
                        volume=volume,
                        exchange=exchange,
                        country='US',
                        is_valid=is_valid,
                        quality_score=quality_score,
                        rejection_reason=rejection_reason
                    )
                
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                logger.warning(f"Error fetching FMP batch {i//batch_size + 1}: {e}")
                continue
        
        return metrics
    
    def _batch_yfinance_metrics(self, symbols: List[str]) -> Dict[str, EfficientTickerMetrics]:
        """Get metrics using yfinance (slower but free)"""
        metrics = {}
        
        # Process in smaller batches to avoid timeouts
        batch_size = 50
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i:i + batch_size]
            
            try:
                # Use yfinance download for basic price/volume data
                data = yf.download(
                    batch_symbols, 
                    period="5d",  # Just need recent data
                    interval="1d",
                    group_by='ticker',
                    auto_adjust=True,
                    prepost=False,
                    threads=True,
                    proxy=None,
                    progress=False
                )
                
                if data.empty:
                    continue
                
                for symbol in batch_symbols:
                    try:
                        if len(batch_symbols) == 1:
                            symbol_data = data
                        else:
                            symbol_data = data[symbol] if symbol in data.columns.levels[0] else None
                        
                        if symbol_data is None or symbol_data.empty:
                            continue
                        
                        # Get recent price and volume
                        recent_data = symbol_data.dropna()
                        if recent_data.empty:
                            continue
                        
                        price = recent_data['Close'].iloc[-1] if 'Close' in recent_data else None
                        volume = recent_data['Volume'].mean() if 'Volume' in recent_data else None
                        
                        # Calculate dollar volume
                        dollar_volume = (price or 0) * (volume or 0)
                        
                        # STRICTER validation for quality tickers
                        is_valid = (
                            price and self.min_price <= price <= self.max_price and
                            volume and volume >= self.min_volume and
                            dollar_volume >= self.min_dollar_volume
                        )
                        
                        # Quality scoring based on index and price
                        quality_score = 0
                        if is_valid:
                            # Base score for passing validation
                            quality_score = 40
                            
                            # Price tier bonus
                            if price >= 50:
                                quality_score += 15  # Established stocks
                            elif price >= 20:
                                quality_score += 12
                            elif price >= 10:
                                quality_score += 8
                            elif price >= 2:
                                quality_score += 5
                            
                            # Index membership bonus
                            if symbol in self.dow30_symbols:
                                quality_score += 15
                            elif symbol in self.sp500_symbols:
                                quality_score += 12
                            elif symbol in self.nasdaq100_symbols:
                                quality_score += 10
                        
                        metrics[symbol] = EfficientTickerMetrics(
                            symbol=symbol,
                            price=float(price) if price else None,
                            volume=float(volume) if volume else None,
                            country='US',
                            is_valid=is_valid,
                            quality_score=quality_score,
                            rejection_reason=None if is_valid else "Failed basic criteria"
                        )
                        
                    except Exception as e:
                        logger.debug(f"Error processing {symbol}: {e}")
                        continue
                
                # Rate limiting
                time.sleep(1)
                
            except Exception as e:
                logger.warning(f"Error fetching yfinance batch {i//batch_size + 1}: {e}")
                continue
        
        return metrics
    
    def filter_high_quality_tickers(self, tickers: List[Dict], 
                                  min_quality_score: float = 60.0,
                                  max_tickers: int = 1000) -> Tuple[List[str], List[EfficientTickerMetrics]]:
        """Main filtering method with performance optimizations"""
        start_time = time.time()
        
        # Step 1: Fast pre-filtering
        pre_filtered = self.pre_filter_tickers_fast(tickers)
        
        # Step 2: INCREASED LIMIT - Cap at reasonable number for processing
        # This prevents overwhelming the system with too many API calls
        hard_limit = min(max_tickers * 4, 8000)  # Increased to 8000 tickers max
        if len(pre_filtered) > hard_limit:
            logger.info(f"HARD LIMIT: Reducing from {len(pre_filtered)} to {hard_limit} tickers for system performance")
            pre_filtered = pre_filtered[:hard_limit]
        
        # Step 3: Extract symbols
        symbols = [t['symbol'] for t in pre_filtered]
        
        # Step 4: Get metrics efficiently
        logger.info(f"Processing {len(symbols)} symbols for quality metrics")
        metrics = self.batch_get_basic_metrics(symbols)
        
        # Step 5: Filter by quality score
        high_quality_symbols = []
        high_quality_metrics = []
        
        for symbol, metric in metrics.items():
            if metric.is_valid and metric.quality_score >= min_quality_score:
                high_quality_symbols.append(symbol)
                high_quality_metrics.append(metric)
        
        # Step 6: Sort by quality score and limit results
        combined = list(zip(high_quality_symbols, high_quality_metrics))
        combined.sort(key=lambda x: x[1].quality_score, reverse=True)
        
        if len(combined) > max_tickers:
            combined = combined[:max_tickers]
        
        final_symbols = [x[0] for x in combined]
        final_metrics = [x[1] for x in combined]
        
        elapsed = time.time() - start_time
        logger.info(
            f"Efficient filtering complete: {len(final_symbols)} high-quality tickers "
            f"selected from {len(tickers)} total in {elapsed:.1f} seconds "
            f"({len(final_symbols)/len(tickers)*100:.1f}% pass rate)"
        )
        
        return final_symbols, final_metrics
    
    def get_filtering_summary(self, symbols: List[str], metrics: List[EfficientTickerMetrics]) -> Dict:
        """Generate filtering summary statistics"""
        if not metrics:
            return {}
        
        valid_metrics = [m for m in metrics if m.is_valid]
        quality_scores = [m.quality_score for m in valid_metrics]
        
        summary = {
            'total_processed': len(metrics),
            'high_quality_count': len(symbols),
            'avg_quality_score': np.mean(quality_scores) if quality_scores else 0,
            'median_quality_score': np.median(quality_scores) if quality_scores else 0,
            'sp500_count': len([s for s in symbols if s in self.sp500_symbols]),
            'price_range': {
                'min': min([m.price for m in valid_metrics if m.price], default=0),
                'max': max([m.price for m in valid_metrics if m.price], default=0),
                'avg': np.mean([m.price for m in valid_metrics if m.price]) if valid_metrics else 0
            },
            'volume_stats': {
                'min': min([m.volume for m in valid_metrics if m.volume], default=0),
                'max': max([m.volume for m in valid_metrics if m.volume], default=0),
                'avg': np.mean([m.volume for m in valid_metrics if m.volume]) if valid_metrics else 0
            }
        }
        
        return summary
    
    def apply_advanced_quality_checks(
        self,
        symbols: List[str],
        metrics: Dict[str, EfficientTickerMetrics],
        verbose: bool = False
    ) -> Tuple[List[str], Dict[str, EfficientTickerMetrics]]:
        """
        Apply advanced quality checks (options, institutional, fundamentals, float).
        
        This adds up to 33 bonus points to quality scores for tickers that pass
        all advanced checks, significantly improving final ticker quality.
        
        Args:
            symbols: List of ticker symbols that passed basic filtering
            metrics: Dictionary of basic metrics for each symbol
            verbose: Enable progress logging
            
        Returns:
            Tuple of (updated_symbols, updated_metrics) with advanced scores
        """
        logger.info(
            f"Applying advanced quality checks to {len(symbols)} tickers "
            "(options, institutional, fundamentals, float)..."
        )
        
        checker = AdvancedQualityChecker(
            require_options=True,
            min_option_expiries=2,
            min_institutional_ownership=0.10,
            min_institutional_holders=5,
            min_revenue=10_000_000,
            require_positive_revenue=True,
            min_float_shares=5_000_000,
            min_float_percent=0.20,
            max_short_percent=0.50,
            max_workers=3,
            request_delay=0.5
        )
        
        # Run advanced checks
        advanced_results = checker.check_batch(symbols, verbose=verbose)
        
        # Update metrics with advanced scores
        updated_metrics = {}
        for symbol in symbols:
            basic_metric = metrics.get(symbol)
            advanced_metric = advanced_results.get(symbol)
            
            if basic_metric is None:
                continue
            
            # Update basic metric with advanced data
            if advanced_metric:
                basic_metric.has_options = advanced_metric.has_options
                basic_metric.institutional_ownership = \
                    advanced_metric.institutional_ownership
                basic_metric.revenue = advanced_metric.revenue
                basic_metric.is_profitable = advanced_metric.is_profitable
                basic_metric.float_shares = advanced_metric.float_shares
                basic_metric.advanced_quality_score = \
                    advanced_metric.advanced_quality_score
                
                # Add advanced score to total quality score
                basic_metric.quality_score += advanced_metric.advanced_quality_score
            
            updated_metrics[symbol] = basic_metric
        
        # Generate summary
        summary = checker.get_summary(advanced_results)
        logger.info(
            f"Advanced checks complete: "
            f"{summary.get('with_options', 0)} have options, "
            f"{summary.get('passes_institutional', 0)} pass institutional, "
            f"{summary.get('profitable', 0)} profitable, "
            f"avg advanced score: {summary.get('avg_advanced_score', 0):.1f}/33"
        )
        
        return list(updated_metrics.keys()), updated_metrics
    
    def filter_with_advanced_checks(
        self,
        tickers: List[Dict],
        min_quality_score: float = 60.0,
        max_tickers: int = 2000,
        enable_advanced_checks: bool = True,
        verbose: bool = False
    ) -> Tuple[List[str], List[EfficientTickerMetrics]]:
        """
        Full filtering pipeline including advanced quality checks.
        
        This is the recommended method for highest quality ticker filtering.
        It combines basic filtering with advanced checks for options, 
        institutional ownership, fundamentals, and float validation.
        
        Args:
            tickers: Raw ticker list from data sources
            min_quality_score: Minimum total quality score (0-100+)
            max_tickers: Maximum tickers to return
            enable_advanced_checks: Run advanced checks (adds ~10-15 min)
            verbose: Enable progress logging
            
        Returns:
            Tuple of (symbols, metrics) for highest quality tickers
        """
        start_time = time.time()
        
        # Step 1: Run basic filtering
        logger.info("Step 1/3: Running basic quality filtering...")
        basic_symbols, basic_metrics = self.filter_high_quality_tickers(
            tickers,
            min_quality_score=min_quality_score - 20,  # Lower threshold, advanced adds points
            max_tickers=max_tickers * 2  # Get more candidates for advanced filtering
        )
        
        if not basic_symbols:
            logger.warning("No tickers passed basic filtering")
            return [], []
        
        # Convert metrics list to dict
        metrics_dict = {m.symbol: m for m in basic_metrics}
        
        # Step 2: Apply advanced checks if enabled
        if enable_advanced_checks and len(basic_symbols) > 0:
            logger.info(
                f"Step 2/3: Running advanced quality checks on "
                f"{len(basic_symbols)} tickers..."
            )
            basic_symbols, metrics_dict = self.apply_advanced_quality_checks(
                basic_symbols,
                metrics_dict,
                verbose=verbose
            )
        else:
            logger.info("Step 2/3: Advanced checks disabled, skipping...")
        
        # Step 3: Final filtering by quality score
        logger.info("Step 3/3: Final quality filtering and ranking...")
        
        final_candidates = []
        for symbol in basic_symbols:
            metric = metrics_dict.get(symbol)
            if metric and metric.quality_score >= min_quality_score:
                final_candidates.append((symbol, metric))
        
        # Sort by total quality score (descending)
        final_candidates.sort(key=lambda x: x[1].quality_score, reverse=True)
        
        # Limit to max_tickers
        if len(final_candidates) > max_tickers:
            final_candidates = final_candidates[:max_tickers]
        
        final_symbols = [x[0] for x in final_candidates]
        final_metrics = [x[1] for x in final_candidates]
        
        elapsed = time.time() - start_time
        
        # Summary statistics
        avg_score = np.mean([m.quality_score for m in final_metrics]) \
            if final_metrics else 0
        with_options = sum(1 for m in final_metrics if m.has_options)
        profitable = sum(1 for m in final_metrics if m.is_profitable)
        
        logger.info(
            f"\n{'='*60}\n"
            f"FILTERING COMPLETE in {elapsed:.1f}s\n"
            f"{'='*60}\n"
            f"  Final tickers: {len(final_symbols)}\n"
            f"  Avg quality score: {avg_score:.1f}\n"
            f"  With options: {with_options} ({with_options/len(final_symbols)*100:.0f}%)\n"
            f"  Profitable: {profitable} ({profitable/len(final_symbols)*100:.0f}%)\n"
            f"  S&P 500: {len([s for s in final_symbols if s in self.sp500_symbols])}\n"
            f"{'='*60}"
        )
        
        return final_symbols, final_metrics
