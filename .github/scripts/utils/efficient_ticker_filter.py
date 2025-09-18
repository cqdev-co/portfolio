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

logger = logging.getLogger(__name__)

@dataclass
class EfficientTickerMetrics:
    """Lightweight ticker metrics for efficient processing"""
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

class EfficientTickerFilter:
    """High-performance ticker filtering with batch processing"""
    
    def __init__(self, alpha_vantage_key: Optional[str] = None, fmp_key: Optional[str] = None):
        self.alpha_vantage_key = alpha_vantage_key
        self.fmp_key = fmp_key
        self.setup_logging()
        
        # Optimized thresholds for quick filtering - more inclusive
        self.min_market_cap = 50_000_000  # $50M (further reduced for small caps)
        self.min_price = 0.10  # $0.10 minimum (very inclusive for penny stocks)
        self.max_price = 10_000.0
        self.min_volume = 50_000  # Reduced from 100k to include more stocks
        
        # US exchanges
        self.us_exchanges = {
            'NASDAQ', 'NYSE', 'NYSEARCA', 'NYSEMKT', 'BATS', 
            'NASDAQ GLOBAL MARKET', 'NASDAQ GLOBAL SELECT', 'NASDAQ CAPITAL MARKET'
        }
        
        # Known high-quality symbols (S&P 500 subset) for quick validation
        self.sp500_symbols = self._load_sp500_symbols()
        
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
    
    def pre_filter_tickers_fast(self, tickers: List[Dict]) -> List[Dict]:
        """Fast pre-filtering based on basic criteria"""
        logger.info(f"Pre-filtering {len(tickers)} tickers...")
        
        filtered = []
        for ticker in tickers:
            symbol = ticker.get('symbol', '')
            exchange = ticker.get('exchange', '')
            name = ticker.get('name', '')
            
            # Quick rejection criteria
            if not symbol or len(symbol) > 5:
                continue
            
            # Skip obvious non-stocks
            if any(x in symbol for x in ['.', '-', '/', '^', '=']):
                continue
                
            # Skip warrants, units, preferred shares
            skip_suffixes = ['W', 'U', 'R', 'P']
            if any(symbol.endswith(suffix) for suffix in skip_suffixes):
                continue
            
            # Skip financial instruments (not penny stocks by price)
            if any(word in name.lower() for word in ['warrant', 'unit', 'right', 'preferred']):
                continue
            
            # Prioritize US exchanges
            if exchange and any(us_ex in exchange.upper() for us_ex in self.us_exchanges):
                ticker['country'] = 'US'
                ticker['priority'] = 1 if symbol in self.sp500_symbols else 2
                filtered.append(ticker)
            elif not exchange and symbol.isalpha():  # Likely US stock
                ticker['country'] = 'US'
                ticker['priority'] = 1 if symbol in self.sp500_symbols else 3
                filtered.append(ticker)
        
        # Sort by priority (S&P 500 first, then others)
        filtered.sort(key=lambda x: x.get('priority', 999))
        
        logger.info(f"Pre-filtered to {len(filtered)} potential US stocks")
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
        
        # Process remaining symbols in batches
        remaining_symbols = [s for s in symbols if s not in self.sp500_symbols]
        
        if self.fmp_key and remaining_symbols:
            # Increased limit for FMP - it can handle more
            metrics.update(self._batch_fmp_metrics(remaining_symbols[:2000]))  
        elif remaining_symbols:
            # Fallback to yfinance for larger batches
            metrics.update(self._batch_yfinance_metrics(remaining_symbols[:1000]))
        
        logger.info(f"Retrieved metrics for {len(metrics)} symbols")
        return metrics
    
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
                    
                    # Quality check - more inclusive for penny stocks
                    is_valid = (
                        market_cap and market_cap >= self.min_market_cap and
                        price and self.min_price <= price <= self.max_price and
                        volume and volume >= self.min_volume
                    )
                    
                    quality_score = 0
                    if is_valid:
                        # Simple scoring
                        if market_cap >= 10_000_000_000:
                            quality_score += 40
                        elif market_cap >= 1_000_000_000:
                            quality_score += 30
                        elif market_cap >= 100_000_000:
                            quality_score += 20  # Give credit to smaller companies
                        elif market_cap >= 50_000_000:
                            quality_score += 15  # Small caps with potential
                        
                        if 10 <= price <= 1000:
                            quality_score += 20
                        elif 2 <= price <= 2000:
                            quality_score += 18  # Good range including growth stocks
                        elif 0.50 <= price < 2:
                            quality_score += 12  # Penny stocks with potential
                        elif 0.10 <= price < 0.50:
                            quality_score += 8   # Very low price stocks with upside
                        
                        if volume >= 1_000_000:
                            quality_score += 20
                        elif volume >= 100_000:
                            quality_score += 15
                        elif volume >= 50_000:
                            quality_score += 10  # Lower volume but still tradeable
                        
                        quality_score += 15  # Base score for passing filters
                    
                    metrics[symbol] = EfficientTickerMetrics(
                        symbol=symbol,
                        market_cap=market_cap,
                        price=price,
                        volume=volume,
                        exchange=exchange,
                        country='US',
                        is_valid=is_valid,
                        quality_score=quality_score,
                        rejection_reason=None if is_valid else "Failed basic criteria"
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
                        
                        # Simple validation - inclusive of penny stocks
                        is_valid = (
                            price and self.min_price <= price <= self.max_price and
                            volume and volume >= self.min_volume
                        )
                        
                        # Simple scoring with penny stock consideration
                        quality_score = 0
                        if is_valid:
                            if price >= 10:
                                quality_score = 60  # Established stocks
                            elif price >= 2:
                                quality_score = 55  # Growth stocks
                            elif price >= 0.50:
                                quality_score = 45  # Penny stocks with potential
                            else:
                                quality_score = 30  # Very low price stocks
                        
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
        
        # Step 2: Limit to reasonable number for API calls (increased limit)
        api_limit = max_tickers * 5  # Increased from 2x to 5x
        if len(pre_filtered) > api_limit:
            logger.info(f"Limiting to top {api_limit} tickers for performance")
            pre_filtered = pre_filtered[:api_limit]
        
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
