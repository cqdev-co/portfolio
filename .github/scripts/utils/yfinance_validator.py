#!/usr/bin/env python3
"""
YFinance Data Quality Validator

Validates that tickers have accessible, high-quality data on YFinance.
Ensures scanners won't encounter empty data, OHLC violations, or missing fields.
"""

import logging
import asyncio
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import random

logger = logging.getLogger(__name__)

@dataclass
class YFinanceValidation:
    """Validation result for a ticker's YFinance data quality"""
    symbol: str
    is_valid: bool
    has_recent_data: bool = False
    has_price_data: bool = False
    has_volume: bool = False
    has_info: bool = False
    data_completeness: float = 0.0  # 0-1 score
    ohlc_quality: float = 0.0  # 0-1 score
    min_history_days: int = 0
    avg_daily_volume: float = 0.0
    last_price: Optional[float] = None
    validation_issues: List[str] = None
    
    def __post_init__(self):
        if self.validation_issues is None:
            self.validation_issues = []


class YFinanceValidator:
    """
    Validates ticker data quality on YFinance to ensure scanners can use them.
    
    This prevents downstream issues like:
    - Empty DataFrames
    - OHLC violations
    - Missing price/volume data
    - Insufficient history
    """
    
    def __init__(
        self,
        min_history_days: int = 90,
        min_volume: float = 10_000,
        min_price: float = 0.50,
        max_price: float = 10_000,
        min_data_completeness: float = 0.85,  # 85% data completeness
        max_gap_ratio: float = 0.10,  # Max 10% gaps allowed
        recency_days: int = 5,  # Must have data within last 5 days
        max_workers: int = 3,  # Reduced to avoid rate limiting
        request_delay: float = 0.5  # Delay between requests
    ):
        self.min_history_days = min_history_days
        self.min_volume = min_volume
        self.min_price = min_price
        self.max_price = max_price
        self.min_data_completeness = min_data_completeness
        self.max_gap_ratio = max_gap_ratio
        self.recency_days = recency_days
        self.max_workers = max_workers
        self.request_delay = request_delay
        self.request_count = 0
        self.last_request_time = time.time()
        
    def _rate_limit_delay(self):
        """Apply rate limiting delay to avoid overwhelming Yahoo Finance"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.request_delay:
            sleep_time = self.request_delay - time_since_last
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
        self.request_count += 1
    
    def validate_ticker(
        self, 
        symbol: str, 
        period: str = "6mo",
        max_retries: int = 3
    ) -> YFinanceValidation:
        """
        Validate a single ticker's YFinance data quality with retry logic.
        
        Args:
            symbol: Ticker symbol to validate
            period: Historical period to check (default: 6mo)
            max_retries: Maximum retry attempts (default: 3)
            
        Returns:
            YFinanceValidation result
        """
        result = YFinanceValidation(symbol=symbol, is_valid=False)
        
        for attempt in range(max_retries):
            try:
                # Rate limiting
                self._rate_limit_delay()
                
                # Add small random delay to spread out requests
                time.sleep(random.uniform(0.1, 0.3))
                
                ticker = yf.Ticker(symbol)
                
                # 1. Check historical data FIRST (most important)
                try:
                    hist = ticker.history(period=period)
                    
                    if hist.empty:
                        result.validation_issues.append("No historical data")
                        return result
                    
                    result.min_history_days = len(hist)
                    
                    # Validate minimum history
                    if len(hist) < self.min_history_days:
                        result.validation_issues.append(
                            f"Insufficient history: {len(hist)} days "
                            f"(need {self.min_history_days})"
                        )
                        return result
                    
                except Exception as e:
                    error_msg = str(e).lower()
                    # Check if it's a rate limit or auth error (retry-able)
                    if any(keyword in error_msg for keyword in [
                        'crumb', '401', 'unauthorized', 'rate limit', '429'
                    ]):
                        if attempt < max_retries - 1:
                            wait_time = (attempt + 1) * 2  # Exponential backoff
                            logger.debug(
                                f"Rate limit hit for {symbol}, "
                                f"retrying in {wait_time}s (attempt {attempt + 1})"
                            )
                            time.sleep(wait_time)
                            continue
                    
                    result.validation_issues.append(
                        f"Cannot fetch historical data: {str(e)[:50]}"
                    )
                    return result
                
                # 2. Check ticker info availability (optional, don't fail if missing)
                try:
                    info = ticker.info
                    if info and len(info) > 5:  # Valid info dict
                        result.has_info = True
                except Exception as e:
                    # Don't fail validation if info fetch fails
                    logger.debug(f"Could not fetch info for {symbol}: {e}")
                    result.has_info = False
                
                # 3. Check data recency
                last_date = hist.index[-1]
                days_since_last = (
                    datetime.now() - last_date.to_pydatetime()
                ).days
                
                if days_since_last > self.recency_days:
                    result.validation_issues.append(
                        f"Stale data: last update {days_since_last} days ago"
                    )
                    return result
                
                result.has_recent_data = True
                
                # 4. Validate OHLC data quality
                ohlc_quality, ohlc_issues = self._validate_ohlc_quality(hist)
                result.ohlc_quality = ohlc_quality
                result.validation_issues.extend(ohlc_issues)
                
                if ohlc_quality < 0.80:  # Less than 80% valid OHLC data
                    return result
                
                # 5. Check price data
                recent_prices = hist['Close'].tail(10)
                if recent_prices.isnull().all():
                    result.validation_issues.append("No valid price data")
                    return result
                
                last_price = recent_prices.iloc[-1]
                result.last_price = float(last_price)
                result.has_price_data = True
                
                # Validate price range
                if not (self.min_price <= last_price <= self.max_price):
                    result.validation_issues.append(
                        f"Price ${last_price:.2f} outside valid range "
                        f"(${self.min_price}-${self.max_price})"
                    )
                    return result
                
                # 6. Check volume data
                recent_volume = hist['Volume'].tail(20)
                if recent_volume.isnull().all() or (recent_volume == 0).all():
                    result.validation_issues.append("No valid volume data")
                    return result
                
                avg_volume = recent_volume.mean()
                result.avg_daily_volume = float(avg_volume)
                result.has_volume = True
                
                if avg_volume < self.min_volume:
                    result.validation_issues.append(
                        f"Insufficient volume: {avg_volume:,.0f} "
                        f"(need {self.min_volume:,.0f})"
                    )
                    return result
                
                # 7. Check data completeness (gaps)
                completeness, gap_ratio = self._check_data_completeness(hist)
                result.data_completeness = completeness
                
                if gap_ratio > self.max_gap_ratio:
                    result.validation_issues.append(
                        f"Too many data gaps: {gap_ratio:.1%}"
                    )
                    return result
                
                # All checks passed!
                result.is_valid = True
                return result  # Success, exit retry loop
                
            except Exception as e:
                error_msg = str(e).lower()
                # Check if it's a rate limit or auth error (retry-able)
                if any(keyword in error_msg for keyword in [
                    'crumb', '401', 'unauthorized', 'rate limit', '429'
                ]) and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2  # Exponential backoff
                    logger.debug(
                        f"Rate limit hit for {symbol}, "
                        f"retrying in {wait_time}s (attempt {attempt + 1})"
                    )
                    time.sleep(wait_time)
                    continue
                
                result.validation_issues.append(
                    f"Validation error: {str(e)[:100]}"
                )
                logger.debug(f"Error validating {symbol}: {e}")
                return result
        
        return result
    
    def _validate_ohlc_quality(
        self, 
        hist: pd.DataFrame
    ) -> Tuple[float, List[str]]:
        """
        Validate OHLC data quality and relationships.
        
        Returns:
            (quality_score, issues_list)
        """
        issues = []
        
        if hist.empty:
            return 0.0, ["Empty DataFrame"]
        
        # Check for required columns
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing_cols = [
            col for col in required_cols if col not in hist.columns
        ]
        if missing_cols:
            return 0.0, [f"Missing columns: {', '.join(missing_cols)}"]
        
        # Check for NaN values
        nan_counts = hist[required_cols].isnull().sum()
        total_rows = len(hist)
        nan_ratio = nan_counts.sum() / (total_rows * len(required_cols))
        
        if nan_ratio > 0.15:  # More than 15% NaN values
            issues.append(f"High NaN ratio: {nan_ratio:.1%}")
        
        # Validate OHLC relationships
        valid_high = (
            (hist['High'] >= hist['Open']) &
            (hist['High'] >= hist['Close']) &
            (hist['High'] >= hist['Low'])
        )
        
        valid_low = (
            (hist['Low'] <= hist['Open']) &
            (hist['Low'] <= hist['Close']) &
            (hist['Low'] <= hist['High'])
        )
        
        valid_positive = (
            (hist['Open'] > 0) &
            (hist['High'] > 0) &
            (hist['Low'] > 0) &
            (hist['Close'] > 0)
        )
        
        valid_rows = valid_high & valid_low & valid_positive
        valid_ratio = valid_rows.sum() / total_rows
        
        if valid_ratio < 0.95:  # Less than 95% valid OHLC
            issues.append(
                f"OHLC violations in {(1-valid_ratio)*100:.1f}% of data"
            )
        
        # Overall quality score
        quality_score = valid_ratio * (1 - nan_ratio)
        
        return quality_score, issues
    
    def _check_data_completeness(
        self, 
        hist: pd.DataFrame
    ) -> Tuple[float, float]:
        """
        Check for data gaps in the historical data.
        
        Returns:
            (completeness_score, gap_ratio)
        """
        if hist.empty or len(hist) < 2:
            return 0.0, 1.0
        
        # Calculate expected vs actual data points
        date_range = (hist.index[-1] - hist.index[0]).days
        expected_trading_days = date_range * 5 / 7  # Rough estimate
        actual_days = len(hist)
        
        completeness = min(actual_days / max(expected_trading_days, 1), 1.0)
        gap_ratio = 1.0 - completeness
        
        return completeness, gap_ratio
    
    def validate_batch(
        self, 
        symbols: List[str], 
        period: str = "6mo",
        verbose: bool = False,
        batch_size: int = 100
    ) -> Dict[str, YFinanceValidation]:
        """
        Validate multiple tickers in batches with rate limiting.
        
        Args:
            symbols: List of ticker symbols
            period: Historical period to check
            verbose: Enable progress logging
            batch_size: Number of symbols per batch
            
        Returns:
            Dictionary mapping symbol to validation result
        """
        results = {}
        
        logger.info(
            f"Validating {len(symbols)} tickers on YFinance "
            f"(workers: {self.max_workers}, batch_size: {batch_size})"
        )
        logger.warning(
            "Note: Validation may take 10-20 minutes due to rate limiting"
        )
        
        # Process in batches to avoid overwhelming Yahoo Finance
        for batch_num, batch_start in enumerate(range(0, len(symbols), batch_size)):
            batch_symbols = symbols[batch_start:batch_start + batch_size]
            batch_results = {}
            
            logger.info(
                f"Processing batch {batch_num + 1}/{(len(symbols) + batch_size - 1) // batch_size} "
                f"({len(batch_symbols)} tickers)"
            )
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all validation tasks for this batch
                future_to_symbol = {
                    executor.submit(
                        self.validate_ticker, symbol, period
                    ): symbol
                    for symbol in batch_symbols
                }
                
                completed = 0
                for future in as_completed(future_to_symbol):
                    symbol = future_to_symbol[future]
                    try:
                        result = future.result()
                        batch_results[symbol] = result
                        
                        completed += 1
                        if verbose and completed % 25 == 0:
                            valid_count = sum(
                                1 for r in batch_results.values() if r.is_valid
                            )
                            logger.info(
                                f"Batch progress: {completed}/{len(batch_symbols)} "
                                f"({valid_count} valid so far)"
                            )
                            
                    except Exception as e:
                        logger.error(f"Error validating {symbol}: {e}")
                        batch_results[symbol] = YFinanceValidation(
                            symbol=symbol,
                            is_valid=False,
                            validation_issues=[f"Validation failed: {e}"]
                        )
            
            results.update(batch_results)
            
            # Pause between batches to avoid rate limiting
            if batch_start + batch_size < len(symbols):
                pause_time = 5
                logger.info(f"Pausing {pause_time}s before next batch...")
                time.sleep(pause_time)
        
        # Summary statistics
        valid_count = sum(1 for r in results.values() if r.is_valid)
        logger.info(
            f"YFinance validation complete: "
            f"{valid_count}/{len(symbols)} tickers passed "
            f"({valid_count/len(symbols)*100:.1f}% pass rate)"
        )
        
        return results
    
    def get_validation_summary(
        self, 
        results: Dict[str, YFinanceValidation]
    ) -> Dict:
        """
        Generate summary statistics from validation results.
        
        Args:
            results: Validation results dictionary
            
        Returns:
            Summary statistics dictionary
        """
        valid_results = [r for r in results.values() if r.is_valid]
        invalid_results = [r for r in results.values() if not r.is_valid]
        
        # Aggregate common issues
        issue_counts = {}
        for result in invalid_results:
            for issue in result.validation_issues:
                # Simplify issue text for grouping
                issue_key = issue.split(':')[0]
                issue_counts[issue_key] = issue_counts.get(issue_key, 0) + 1
        
        # Top rejection reasons
        top_issues = sorted(
            issue_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]
        
        summary = {
            'total_validated': len(results),
            'passed': len(valid_results),
            'failed': len(invalid_results),
            'pass_rate': len(valid_results) / len(results) if results else 0,
            'avg_data_completeness': np.mean([
                r.data_completeness for r in valid_results
            ]) if valid_results else 0,
            'avg_ohlc_quality': np.mean([
                r.ohlc_quality for r in valid_results
            ]) if valid_results else 0,
            'avg_history_days': np.mean([
                r.min_history_days for r in valid_results
            ]) if valid_results else 0,
            'avg_volume': np.mean([
                r.avg_daily_volume for r in valid_results
            ]) if valid_results else 0,
            'price_range': {
                'min': min([
                    r.last_price for r in valid_results if r.last_price
                ], default=0),
                'max': max([
                    r.last_price for r in valid_results if r.last_price
                ], default=0),
                'avg': np.mean([
                    r.last_price for r in valid_results if r.last_price
                ]) if valid_results else 0
            },
            'top_rejection_reasons': [
                {'reason': reason, 'count': count} 
                for reason, count in top_issues
            ],
            'has_recent_data_count': sum(
                1 for r in valid_results if r.has_recent_data
            ),
            'has_price_data_count': sum(
                1 for r in valid_results if r.has_price_data
            ),
            'has_volume_count': sum(
                1 for r in valid_results if r.has_volume
            ),
            'has_info_count': sum(
                1 for r in valid_results if r.has_info
            )
        }
        
        return summary

