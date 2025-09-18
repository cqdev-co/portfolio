#!/usr/bin/env python3
"""
Ticker Quality Filtering System

This module provides comprehensive filtering capabilities to identify 
high-quality US stock tickers suitable for model training and backtesting.
Filters out penny stocks, low-volume stocks, and financially distressed companies.
"""

import logging
import time
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from ratelimit import limits, sleep_and_retry

logger = logging.getLogger(__name__)

@dataclass
class TickerQualityMetrics:
    """Quality metrics for a ticker"""
    symbol: str
    market_cap: Optional[float] = None
    avg_volume: Optional[float] = None
    price: Optional[float] = None
    beta: Optional[float] = None
    pe_ratio: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    revenue_growth: Optional[float] = None
    profit_margin: Optional[float] = None
    is_active: bool = True
    exchange: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    quality_score: float = 0.0
    quality_reasons: List[str] = None
    
    def __post_init__(self):
        if self.quality_reasons is None:
            self.quality_reasons = []

class TickerQualityFilter:
    """Main class for filtering tickers based on quality metrics"""
    
    def __init__(self, alpha_vantage_key: Optional[str] = None):
        self.alpha_vantage_key = alpha_vantage_key
        self.setup_logging()
        
        # Quality thresholds
        self.min_market_cap = 1_000_000_000  # $1B minimum market cap
        self.min_price = 5.0  # Minimum $5 per share (avoid penny stocks)
        self.max_price = 10_000.0  # Maximum $10k per share (avoid outliers)
        self.min_avg_volume = 100_000  # Minimum 100k shares daily volume
        self.max_beta = 3.0  # Maximum beta (volatility measure)
        self.min_current_ratio = 1.0  # Minimum current ratio (liquidity)
        self.max_debt_to_equity = 2.0  # Maximum debt-to-equity ratio
        
        # Excluded exchanges (focus on major US exchanges)
        self.allowed_exchanges = {
            'NASDAQ', 'NYSE', 'NYSEARCA', 'NYSEMKT', 'BATS'
        }
        
        # Excluded sectors (optional - can be configured)
        self.excluded_sectors = {
            'Penny Stocks', 'Shell Companies', 'Closed-End Funds'
        }
        
    def setup_logging(self):
        """Setup logging for the filter"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def filter_us_tickers_only(self, tickers: List[Dict]) -> List[Dict]:
        """Filter to only include US-based tickers"""
        us_tickers = []
        
        for ticker in tickers:
            # Check country field
            if ticker.get('country') == 'US':
                us_tickers.append(ticker)
                continue
                
            # Check exchange for US exchanges
            exchange = ticker.get('exchange')
            if exchange and exchange.upper() in self.allowed_exchanges:
                ticker['country'] = 'US'  # Ensure country is set
                us_tickers.append(ticker)
                continue
                
            # Check symbol patterns (US tickers typically don't have dots)
            symbol = ticker.get('symbol', '')
            if ('.' not in symbol and 
                len(symbol) <= 5 and 
                symbol.isalpha() and 
                not ticker.get('country')):
                # Likely US ticker, add it
                ticker['country'] = 'US'
                us_tickers.append(ticker)
        
        logger.info(f"Filtered to {len(us_tickers)} US tickers from "
                   f"{len(tickers)} total tickers")
        return us_tickers
    
    @sleep_and_retry
    @limits(calls=5, period=60)  # Rate limit for yfinance
    def get_ticker_metrics_yfinance(self, symbol: str) -> TickerQualityMetrics:
        """Get quality metrics for a ticker using yfinance"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            hist = ticker.history(period="3mo")  # 3 months of data
            
            if hist.empty:
                logger.debug(f"No historical data for {symbol}")
                return TickerQualityMetrics(
                    symbol=symbol, 
                    is_active=False,
                    quality_reasons=["No historical data"]
                )
            
            # Calculate metrics
            metrics = TickerQualityMetrics(symbol=symbol)
            
            # Basic info
            metrics.market_cap = info.get('marketCap')
            metrics.price = info.get('currentPrice') or info.get('regularMarketPrice')
            metrics.beta = info.get('beta')
            metrics.pe_ratio = info.get('trailingPE')
            metrics.exchange = info.get('exchange')
            metrics.sector = info.get('sector')
            metrics.industry = info.get('industry')
            
            # Financial ratios
            metrics.debt_to_equity = info.get('debtToEquity')
            metrics.current_ratio = info.get('currentRatio')
            metrics.revenue_growth = info.get('revenueGrowth')
            metrics.profit_margin = info.get('profitMargins')
            
            # Volume calculation (average over 3 months)
            if not hist.empty and 'Volume' in hist.columns:
                metrics.avg_volume = hist['Volume'].mean()
            
            # If price not in info, get from recent history
            if not metrics.price and not hist.empty:
                metrics.price = hist['Close'].iloc[-1]
            
            logger.debug(f"Retrieved metrics for {symbol}")
            return metrics
            
        except Exception as e:
            logger.warning(f"Error getting metrics for {symbol}: {e}")
            return TickerQualityMetrics(
                symbol=symbol, 
                is_active=False,
                quality_reasons=[f"Error retrieving data: {str(e)}"]
            )
    
    @sleep_and_retry
    @limits(calls=5, period=60)  # Rate limit for Alpha Vantage
    def get_ticker_metrics_alpha_vantage(self, symbol: str) -> TickerQualityMetrics:
        """Get quality metrics using Alpha Vantage API"""
        if not self.alpha_vantage_key:
            return TickerQualityMetrics(
                symbol=symbol,
                is_active=False,
                quality_reasons=["No Alpha Vantage API key"]
            )
        
        try:
            # Get company overview
            url = "https://www.alphavantage.co/query"
            params = {
                'function': 'OVERVIEW',
                'symbol': symbol,
                'apikey': self.alpha_vantage_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'Error Message' in data or not data:
                return TickerQualityMetrics(
                    symbol=symbol,
                    is_active=False,
                    quality_reasons=["No data from Alpha Vantage"]
                )
            
            metrics = TickerQualityMetrics(symbol=symbol)
            
            # Parse numeric values safely
            def safe_float(value, default=None):
                try:
                    return float(value) if value and value != 'None' else default
                except (ValueError, TypeError):
                    return default
            
            metrics.market_cap = safe_float(data.get('MarketCapitalization'))
            metrics.pe_ratio = safe_float(data.get('PERatio'))
            metrics.beta = safe_float(data.get('Beta'))
            metrics.debt_to_equity = safe_float(data.get('DebtToEquityRatio'))
            metrics.profit_margin = safe_float(data.get('ProfitMargin'))
            metrics.revenue_growth = safe_float(data.get('QuarterlyRevenueGrowthYOY'))
            metrics.exchange = data.get('Exchange')
            metrics.sector = data.get('Sector')
            metrics.industry = data.get('Industry')
            
            logger.debug(f"Retrieved Alpha Vantage metrics for {symbol}")
            return metrics
            
        except Exception as e:
            logger.warning(f"Error getting Alpha Vantage metrics for {symbol}: {e}")
            return TickerQualityMetrics(
                symbol=symbol,
                is_active=False,
                quality_reasons=[f"Alpha Vantage error: {str(e)}"]
            )
    
    def calculate_quality_score(self, metrics: TickerQualityMetrics) -> float:
        """Calculate a quality score for the ticker (0-100)"""
        if not metrics.is_active:
            return 0.0
        
        score = 0.0
        max_score = 100.0
        reasons = []
        
        # Market cap score (30 points max)
        if metrics.market_cap:
            if metrics.market_cap >= 10_000_000_000:  # $10B+
                score += 30
            elif metrics.market_cap >= 1_000_000_000:  # $1B+
                score += 20
            elif metrics.market_cap >= 100_000_000:  # $100M+
                score += 10
            else:
                reasons.append(f"Low market cap: ${metrics.market_cap:,.0f}")
        else:
            reasons.append("No market cap data")
        
        # Price score (20 points max)
        if metrics.price:
            if 10 <= metrics.price <= 1000:  # Sweet spot
                score += 20
            elif 5 <= metrics.price <= 2000:  # Acceptable
                score += 15
            else:
                reasons.append(f"Price outside optimal range: ${metrics.price:.2f}")
        else:
            reasons.append("No price data")
        
        # Volume score (20 points max)
        if metrics.avg_volume:
            if metrics.avg_volume >= 1_000_000:  # 1M+ daily volume
                score += 20
            elif metrics.avg_volume >= 100_000:  # 100k+ daily volume
                score += 15
            else:
                reasons.append(f"Low volume: {metrics.avg_volume:,.0f}")
        else:
            reasons.append("No volume data")
        
        # Financial health score (20 points max)
        financial_score = 0
        if metrics.debt_to_equity is not None:
            if metrics.debt_to_equity <= 0.5:
                financial_score += 7
            elif metrics.debt_to_equity <= 1.0:
                financial_score += 5
            elif metrics.debt_to_equity <= 2.0:
                financial_score += 2
            else:
                reasons.append(f"High debt-to-equity: {metrics.debt_to_equity:.2f}")
        
        if metrics.current_ratio is not None:
            if metrics.current_ratio >= 2.0:
                financial_score += 7
            elif metrics.current_ratio >= 1.0:
                financial_score += 5
            else:
                reasons.append(f"Low current ratio: {metrics.current_ratio:.2f}")
        
        if metrics.profit_margin is not None:
            if metrics.profit_margin >= 0.15:  # 15%+
                financial_score += 6
            elif metrics.profit_margin >= 0.05:  # 5%+
                financial_score += 3
            elif metrics.profit_margin < 0:
                reasons.append(f"Negative profit margin: {metrics.profit_margin:.2%}")
        
        score += financial_score
        
        # Stability score (10 points max)
        if metrics.beta is not None:
            if metrics.beta <= 1.2:
                score += 10
            elif metrics.beta <= 2.0:
                score += 7
            elif metrics.beta <= 3.0:
                score += 3
            else:
                reasons.append(f"High beta (volatility): {metrics.beta:.2f}")
        
        metrics.quality_score = score
        metrics.quality_reasons = reasons
        
        return score
    
    def is_high_quality_ticker(self, metrics: TickerQualityMetrics, 
                              min_score: float = 60.0) -> bool:
        """Determine if a ticker meets high-quality criteria"""
        if not metrics.is_active:
            return False
        
        # Calculate quality score
        score = self.calculate_quality_score(metrics)
        
        # Hard filters (must pass all)
        hard_filters = [
            (metrics.market_cap is None or metrics.market_cap >= self.min_market_cap,
             f"Market cap too low: ${metrics.market_cap:,.0f}" if metrics.market_cap else "No market cap"),
            
            (metrics.price is None or (self.min_price <= metrics.price <= self.max_price),
             f"Price outside range: ${metrics.price:.2f}" if metrics.price else "No price"),
            
            (metrics.avg_volume is None or metrics.avg_volume >= self.min_avg_volume,
             f"Volume too low: {metrics.avg_volume:,.0f}" if metrics.avg_volume else "No volume"),
            
            (metrics.exchange is None or (metrics.exchange and metrics.exchange.upper() in self.allowed_exchanges),
             f"Exchange not allowed: {metrics.exchange}" if metrics.exchange else "No exchange"),
            
            (metrics.sector is None or metrics.sector not in self.excluded_sectors,
             f"Excluded sector: {metrics.sector}" if metrics.sector else "No sector")
        ]
        
        for passes, reason in hard_filters:
            if not passes:
                metrics.quality_reasons.append(reason)
                return False
        
        # Quality score filter
        if score < min_score:
            metrics.quality_reasons.append(f"Quality score too low: {score:.1f}")
            return False
        
        return True
    
    def filter_tickers_batch(self, symbols: List[str], 
                           batch_size: int = 50,
                           max_workers: int = 10,
                           use_alpha_vantage: bool = True) -> List[TickerQualityMetrics]:
        """Filter a batch of tickers using parallel processing"""
        logger.info(f"Starting quality filtering for {len(symbols)} tickers")
        
        all_metrics = []
        
        # Process in batches to manage memory and rate limits
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}: "
                       f"{len(batch_symbols)} tickers")
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit tasks
                future_to_symbol = {}
                
                for symbol in batch_symbols:
                    if use_alpha_vantage and self.alpha_vantage_key:
                        future = executor.submit(
                            self.get_ticker_metrics_alpha_vantage, symbol
                        )
                    else:
                        future = executor.submit(
                            self.get_ticker_metrics_yfinance, symbol
                        )
                    future_to_symbol[future] = symbol
                
                # Collect results
                for future in as_completed(future_to_symbol):
                    symbol = future_to_symbol[future]
                    try:
                        metrics = future.result()
                        all_metrics.append(metrics)
                    except Exception as e:
                        logger.error(f"Error processing {symbol}: {e}")
                        all_metrics.append(TickerQualityMetrics(
                            symbol=symbol,
                            is_active=False,
                            quality_reasons=[f"Processing error: {str(e)}"]
                        ))
            
            # Rate limiting between batches
            if i + batch_size < len(symbols):
                logger.info("Waiting between batches to respect rate limits...")
                time.sleep(12)  # 12 second delay between batches
        
        logger.info(f"Completed quality filtering for {len(all_metrics)} tickers")
        return all_metrics
    
    def get_high_quality_tickers(self, symbols: List[str],
                               min_quality_score: float = 60.0,
                               **kwargs) -> Tuple[List[str], List[TickerQualityMetrics]]:
        """Get list of high-quality ticker symbols and their metrics"""
        all_metrics = self.filter_tickers_batch(symbols, **kwargs)
        
        high_quality_symbols = []
        high_quality_metrics = []
        
        for metrics in all_metrics:
            if self.is_high_quality_ticker(metrics, min_quality_score):
                high_quality_symbols.append(metrics.symbol)
                high_quality_metrics.append(metrics)
        
        logger.info(f"Found {len(high_quality_symbols)} high-quality tickers "
                   f"out of {len(symbols)} total ({len(high_quality_symbols)/len(symbols)*100:.1f}%)")
        
        return high_quality_symbols, high_quality_metrics
