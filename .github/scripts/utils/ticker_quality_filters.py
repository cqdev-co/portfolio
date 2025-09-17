#!/usr/bin/env python3
"""
Ticker Quality Filtering Utilities

This module provides comprehensive filtering capabilities to identify 
high-quality tickers for model training and backtesting. It filters out
failing companies, penny stocks, low-volume tickers, and other problematic
securities that could negatively impact analysis results.

Quality Criteria:
- Market Cap: Minimum thresholds based on exchange
- Trading Volume: Consistent daily volume requirements  
- Price Stability: Avoid extreme volatility and penny stocks
- Financial Health: Basic fundamental screening
- Exchange Quality: Prefer major exchanges
- Data Availability: Ensure sufficient historical data
"""

import logging
import requests
import time
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

@dataclass
class QualityMetrics:
    """Data class for ticker quality metrics"""
    symbol: str
    market_cap: Optional[float] = None
    avg_volume: Optional[float] = None
    price: Optional[float] = None
    price_stability_score: Optional[float] = None
    data_availability_score: Optional[float] = None
    exchange_quality_score: Optional[float] = None
    overall_quality_score: Optional[float] = None
    is_penny_stock: bool = False
    is_low_volume: bool = False
    has_sufficient_data: bool = False
    passes_basic_filters: bool = False

class TickerQualityFilter:
    """Main class for filtering ticker quality"""
    
    # Exchange quality ratings (higher is better)
    EXCHANGE_RATINGS = {
        'NYSE': 10,
        'NASDAQ': 10,
        'AMEX': 8,
        'TSX': 8,
        'LSE': 9,
        'EURONEXT': 8,
        'XETRA': 8,
        'ASX': 7,
        'HKEX': 7,
        'TSE': 7,
        'OTC': 3,
        'PINK': 2,
        'GREY': 1
    }
    
        # Minimum market cap thresholds by exchange (in USD millions) - More liberal
    MIN_MARKET_CAP = {
        'NYSE': 100,      # Lower threshold for NYSE
        'NASDAQ': 50,     # Much lower for NASDAQ to include small caps
        'AMEX': 25,       # Very low for AMEX
        'TSX': 100,       # Canadian main exchange
        'LSE': 200,       # London Stock Exchange
        'EURONEXT': 150,  # European exchange
        'XETRA': 150,     # German exchange
        'ASX': 75,        # Australian exchange
        'HKEX': 100,      # Hong Kong exchange
        'TSE': 100,       # Tokyo Stock Exchange
        'OTC': 10,        # Very low for OTC
        'PINK': 5,        # Minimal for pink sheets
        'GREY': 1         # Almost no minimum for grey market
    }
    
    def __init__(self, 
                 min_price: float = 1.0,  # Allow penny stocks
                 min_avg_volume: int = 50000,  # Lower volume requirement
                 max_volatility: float = 1.5,  # Allow higher volatility
                 min_data_days: int = 180,  # Require 6 months instead of 1 year
                 batch_size: int = 50,
                 max_workers: int = 10):
        """
        Initialize quality filter with configurable parameters
        
        Args:
            min_price: Minimum stock price (avoid penny stocks)
            min_avg_volume: Minimum average daily volume
            max_volatility: Maximum acceptable volatility (annualized)
            min_data_days: Minimum days of historical data required
            batch_size: Number of tickers to process in each batch
            max_workers: Maximum number of concurrent workers
        """
        self.min_price = min_price
        self.min_avg_volume = min_avg_volume
        self.max_volatility = max_volatility
        self.min_data_days = min_data_days
        self.batch_size = batch_size
        self.max_workers = max_workers
        
    def get_exchange_quality_score(self, exchange: str) -> float:
        """Get quality score for exchange (0-1 scale)"""
        if not exchange:
            return 0.3
        
        exchange_upper = exchange.upper()
        rating = self.EXCHANGE_RATINGS.get(exchange_upper, 5)
        return rating / 10.0
    
    def get_min_market_cap_for_exchange(self, exchange: str) -> float:
        """Get minimum market cap threshold for exchange"""
        if not exchange:
            return 100  # Default minimum
        
        exchange_upper = exchange.upper()
        return self.MIN_MARKET_CAP.get(exchange_upper, 100)
    
    def fetch_ticker_data(self, symbol: str) -> Optional[Dict]:
        """Fetch comprehensive data for a single ticker"""
        try:
            ticker = yf.Ticker(symbol)
            
            # Get basic info
            info = ticker.info
            
            # Get recent price data (1 year)
            hist = ticker.history(period="1y")
            
            if hist.empty:
                logger.debug(f"No historical data for {symbol}")
                return None
            
            # Calculate metrics
            current_price = hist['Close'].iloc[-1]
            avg_volume = hist['Volume'].mean()
            volatility = hist['Close'].pct_change().std() * (252 ** 0.5)  # Annualized
            
            # Market cap from info or calculate estimate
            market_cap = info.get('marketCap')
            if not market_cap and 'sharesOutstanding' in info:
                shares = info.get('sharesOutstanding', 0)
                if shares > 0:
                    market_cap = current_price * shares
            
            return {
                'symbol': symbol,
                'price': current_price,
                'market_cap': market_cap,
                'avg_volume': avg_volume,
                'volatility': volatility,
                'data_points': len(hist),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'exchange': info.get('exchange'),
                'country': info.get('country'),
                'currency': info.get('currency'),
                'beta': info.get('beta'),
                'pe_ratio': info.get('trailingPE'),
                'forward_pe': info.get('forwardPE'),
                'peg_ratio': info.get('pegRatio'),
                'debt_to_equity': info.get('debtToEquity'),
                'roe': info.get('returnOnEquity'),
                'profit_margins': info.get('profitMargins'),
                'revenue_growth': info.get('revenueGrowth'),
                'earnings_growth': info.get('earningsGrowth')
            }
            
        except Exception as e:
            logger.debug(f"Error fetching data for {symbol}: {e}")
            return None
    
    def calculate_quality_metrics(self, ticker_data: Dict, exchange: str = None) -> QualityMetrics:
        """Calculate comprehensive quality metrics for a ticker"""
        symbol = ticker_data['symbol']
        price = ticker_data.get('price', 0)
        market_cap = ticker_data.get('market_cap', 0)
        avg_volume = ticker_data.get('avg_volume', 0)
        volatility = ticker_data.get('volatility', 1.0)
        data_points = ticker_data.get('data_points', 0)
        ticker_exchange = ticker_data.get('exchange') or exchange
        
        # Basic filters
        is_penny_stock = price < self.min_price
        is_low_volume = avg_volume < self.min_avg_volume
        has_sufficient_data = data_points >= self.min_data_days
        
        # Exchange quality score
        exchange_quality_score = self.get_exchange_quality_score(ticker_exchange)
        
        # Market cap quality score
        min_market_cap = self.get_min_market_cap_for_exchange(ticker_exchange)
        market_cap_millions = (market_cap or 0) / 1_000_000
        
        if market_cap_millions >= min_market_cap * 2:
            market_cap_score = 1.0
        elif market_cap_millions >= min_market_cap:
            market_cap_score = 0.8
        elif market_cap_millions >= min_market_cap * 0.5:
            market_cap_score = 0.6
        elif market_cap_millions >= min_market_cap * 0.25:
            market_cap_score = 0.4
        else:
            market_cap_score = 0.2
        
        # Price stability score (inverse of volatility)
        if volatility <= 0.3:
            price_stability_score = 1.0
        elif volatility <= 0.5:
            price_stability_score = 0.8
        elif volatility <= 0.8:
            price_stability_score = 0.6
        elif volatility <= 1.2:
            price_stability_score = 0.4
        else:
            price_stability_score = 0.2
        
        # Volume quality score
        if avg_volume >= self.min_avg_volume * 10:
            volume_score = 1.0
        elif avg_volume >= self.min_avg_volume * 5:
            volume_score = 0.9
        elif avg_volume >= self.min_avg_volume * 2:
            volume_score = 0.8
        elif avg_volume >= self.min_avg_volume:
            volume_score = 0.7
        else:
            volume_score = 0.3
        
        # Data availability score
        if data_points >= self.min_data_days * 2:
            data_availability_score = 1.0
        elif data_points >= self.min_data_days * 1.5:
            data_availability_score = 0.9
        elif data_points >= self.min_data_days:
            data_availability_score = 0.8
        elif data_points >= self.min_data_days * 0.75:
            data_availability_score = 0.6
        else:
            data_availability_score = 0.3
        
        # Fundamental quality score (if available)
        fundamental_score = 0.7  # Default neutral score
        
        pe_ratio = ticker_data.get('pe_ratio')
        debt_to_equity = ticker_data.get('debt_to_equity')
        roe = ticker_data.get('roe')
        profit_margins = ticker_data.get('profit_margins')
        
        if pe_ratio and debt_to_equity is not None and roe and profit_margins:
            # Positive factors
            score_adjustments = 0
            
            # Reasonable P/E ratio
            if 5 <= pe_ratio <= 25:
                score_adjustments += 0.1
            elif pe_ratio <= 5 or pe_ratio >= 50:
                score_adjustments -= 0.2
                
            # Healthy debt levels
            if debt_to_equity <= 0.3:
                score_adjustments += 0.1
            elif debt_to_equity >= 1.0:
                score_adjustments -= 0.1
                
            # Good ROE
            if roe >= 0.15:
                score_adjustments += 0.1
            elif roe <= 0.05:
                score_adjustments -= 0.1
                
            # Healthy profit margins
            if profit_margins >= 0.1:
                score_adjustments += 0.1
            elif profit_margins <= 0.02:
                score_adjustments -= 0.1
                
            fundamental_score = max(0.2, min(1.0, 0.7 + score_adjustments))
        
        # Calculate overall quality score (weighted average)
        weights = {
            'market_cap': 0.25,
            'exchange': 0.20,
            'volume': 0.20,
            'price_stability': 0.15,
            'data_availability': 0.10,
            'fundamentals': 0.10
        }
        
        overall_quality_score = (
            market_cap_score * weights['market_cap'] +
            exchange_quality_score * weights['exchange'] +
            volume_score * weights['volume'] +
            price_stability_score * weights['price_stability'] +
            data_availability_score * weights['data_availability'] +
            fundamental_score * weights['fundamentals']
        )
        
        # Basic pass/fail
        passes_basic_filters = (
            not is_penny_stock and
            not is_low_volume and
            has_sufficient_data and
            exchange_quality_score >= 0.5 and
            market_cap_score >= 0.4
        )
        
        return QualityMetrics(
            symbol=symbol,
            market_cap=market_cap,
            avg_volume=avg_volume,
            price=price,
            price_stability_score=price_stability_score,
            data_availability_score=data_availability_score,
            exchange_quality_score=exchange_quality_score,
            overall_quality_score=overall_quality_score,
            is_penny_stock=is_penny_stock,
            is_low_volume=is_low_volume,
            has_sufficient_data=has_sufficient_data,
            passes_basic_filters=passes_basic_filters
        )
    
    def filter_tickers_batch(self, tickers: List[Dict]) -> List[Tuple[Dict, QualityMetrics]]:
        """Filter a batch of tickers and return quality metrics"""
        results = []
        
        def process_ticker(ticker_info):
            symbol = ticker_info['symbol']
            exchange = ticker_info.get('exchange')
            
            # Fetch additional data from Yahoo Finance
            ticker_data = self.fetch_ticker_data(symbol)
            
            if not ticker_data:
                # Use basic info if Yahoo Finance fails
                ticker_data = {
                    'symbol': symbol,
                    'price': 0,
                    'market_cap': ticker_info.get('market_cap'),
                    'avg_volume': 0,
                    'volatility': 1.0,
                    'data_points': 0,
                    'exchange': exchange
                }
            
            # Calculate quality metrics
            quality_metrics = self.calculate_quality_metrics(ticker_data, exchange)
            
            return ticker_info, quality_metrics
        
        # Process tickers concurrently
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_ticker = {
                executor.submit(process_ticker, ticker): ticker 
                for ticker in tickers
            }
            
            for future in as_completed(future_to_ticker):
                try:
                    ticker_info, quality_metrics = future.result()
                    results.append((ticker_info, quality_metrics))
                except Exception as e:
                    ticker = future_to_ticker[future]
                    logger.error(f"Error processing ticker {ticker['symbol']}: {e}")
                    continue
                    
                # Rate limiting
                time.sleep(0.01)
        
        return results
    
    def filter_high_quality_tickers(self, 
                                  tickers: List[Dict], 
                                  min_quality_score: float = 0.6,
                                  max_results: Optional[int] = None) -> List[Dict]:
        """
        Filter tickers to return only high-quality ones
        
        Args:
            tickers: List of ticker dictionaries
            min_quality_score: Minimum quality score threshold (0-1)
            max_results: Maximum number of results to return
            
        Returns:
            List of high-quality ticker dictionaries with quality metrics
        """
        logger.info(f"Filtering {len(tickers)} tickers for quality...")
        
        high_quality_tickers = []
        
        # Process in batches
        for i in range(0, len(tickers), self.batch_size):
            batch = tickers[i:i + self.batch_size]
            logger.info(f"Processing batch {i//self.batch_size + 1}/{(len(tickers)-1)//self.batch_size + 1}")
            
            batch_results = self.filter_tickers_batch(batch)
            
            for ticker_info, quality_metrics in batch_results:
                # Apply quality filters
                if (quality_metrics.passes_basic_filters and 
                    quality_metrics.overall_quality_score >= min_quality_score):
                    
                    # Add quality metrics to ticker info
                    enhanced_ticker = ticker_info.copy()
                    enhanced_ticker.update({
                        'quality_score': quality_metrics.overall_quality_score,
                        'market_cap': quality_metrics.market_cap,
                        'avg_volume': quality_metrics.avg_volume,
                        'current_price': quality_metrics.price,
                        'exchange_quality_score': quality_metrics.exchange_quality_score,
                        'price_stability_score': quality_metrics.price_stability_score,
                        'data_availability_score': quality_metrics.data_availability_score,
                        'is_high_quality': True
                    })
                    
                    high_quality_tickers.append(enhanced_ticker)
        
        # Sort by quality score (highest first)
        high_quality_tickers.sort(
            key=lambda x: x['quality_score'], 
            reverse=True
        )
        
        # Limit results if specified
        if max_results:
            high_quality_tickers = high_quality_tickers[:max_results]
        
        logger.info(
            f"Filtered to {len(high_quality_tickers)} high-quality tickers "
            f"({len(high_quality_tickers)/len(tickers)*100:.1f}% pass rate)"
        )
        
        return high_quality_tickers

def create_quality_summary(quality_results: List[Tuple[Dict, QualityMetrics]]) -> Dict:
    """Create a summary of quality filtering results"""
    total_tickers = len(quality_results)
    
    if total_tickers == 0:
        return {}
    
    # Count various categories
    penny_stocks = sum(1 for _, q in quality_results if q.is_penny_stock)
    low_volume = sum(1 for _, q in quality_results if q.is_low_volume)
    insufficient_data = sum(1 for _, q in quality_results if not q.has_sufficient_data)
    passed_basic = sum(1 for _, q in quality_results if q.passes_basic_filters)
    
    # Quality score distribution
    quality_scores = [q.overall_quality_score for _, q in quality_results if q.overall_quality_score]
    
    summary = {
        'total_tickers_analyzed': total_tickers,
        'penny_stocks_filtered': penny_stocks,
        'low_volume_filtered': low_volume,
        'insufficient_data_filtered': insufficient_data,
        'passed_basic_filters': passed_basic,
        'pass_rate_percent': (passed_basic / total_tickers) * 100,
        'avg_quality_score': sum(quality_scores) / len(quality_scores) if quality_scores else 0,
        'quality_score_distribution': {
            'excellent (>= 0.9)': sum(1 for s in quality_scores if s >= 0.9),
            'very_good (>= 0.8)': sum(1 for s in quality_scores if 0.8 <= s < 0.9),
            'good (>= 0.7)': sum(1 for s in quality_scores if 0.7 <= s < 0.8),
            'fair (>= 0.6)': sum(1 for s in quality_scores if 0.6 <= s < 0.7),
            'poor (< 0.6)': sum(1 for s in quality_scores if s < 0.6)
        }
    }
    
    return summary
