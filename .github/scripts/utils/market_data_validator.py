#!/usr/bin/env python3
"""
Market Data Validator

This module provides validation utilities to ensure ticker data quality
and consistency for financial analysis and model training.
"""

import logging
import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass
from datetime import datetime, timedelta
import yfinance as yf

logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Result of ticker validation"""
    symbol: str
    is_valid: bool
    issues: List[str]
    data_quality_score: float = 0.0
    has_sufficient_history: bool = False
    price_stability_score: float = 0.0
    volume_consistency_score: float = 0.0

class MarketDataValidator:
    """Validates market data quality for tickers"""
    
    def __init__(self, min_history_days: int = 252):  # 1 year of trading days
        self.min_history_days = min_history_days
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging for the validator"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def validate_ticker_data_quality(self, symbol: str, 
                                   period: str = "2y") -> ValidationResult:
        """Validate the data quality of a ticker"""
        result = ValidationResult(symbol=symbol, is_valid=False, issues=[])
        
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            
            if hist.empty:
                result.issues.append("No historical data available")
                return result
            
            # Check data completeness
            result.has_sufficient_history = len(hist) >= self.min_history_days
            if not result.has_sufficient_history:
                result.issues.append(
                    f"Insufficient history: {len(hist)} days "
                    f"(minimum: {self.min_history_days})"
                )
            
            # Check for data gaps
            data_gaps = self._check_data_gaps(hist)
            if data_gaps > 0.05:  # More than 5% gaps
                result.issues.append(
                    f"Too many data gaps: {data_gaps:.1%}"
                )
            
            # Check price stability (avoid stocks with extreme volatility)
            result.price_stability_score = self._calculate_price_stability(hist)
            if result.price_stability_score < 0.3:  # Very unstable
                result.issues.append(
                    f"Price too unstable: {result.price_stability_score:.2f}"
                )
            
            # Check volume consistency
            result.volume_consistency_score = self._calculate_volume_consistency(hist)
            if result.volume_consistency_score < 0.4:  # Inconsistent volume
                result.issues.append(
                    f"Volume inconsistent: {result.volume_consistency_score:.2f}"
                )
            
            # Check for suspicious price movements (potential manipulation)
            suspicious_moves = self._detect_suspicious_movements(hist)
            if suspicious_moves:
                result.issues.append(f"Suspicious price movements detected")
            
            # Calculate overall data quality score
            result.data_quality_score = self._calculate_data_quality_score(
                hist, result
            )
            
            # Determine if valid (must pass all critical checks)
            result.is_valid = (
                result.has_sufficient_history and
                data_gaps <= 0.1 and  # Max 10% gaps
                result.price_stability_score >= 0.2 and  # Minimum stability
                result.volume_consistency_score >= 0.3 and  # Minimum consistency
                not suspicious_moves and
                result.data_quality_score >= 50.0
            )
            
        except Exception as e:
            result.issues.append(f"Validation error: {str(e)}")
            logger.warning(f"Error validating {symbol}: {e}")
        
        return result
    
    def _check_data_gaps(self, hist: pd.DataFrame) -> float:
        """Check for missing data gaps in the time series"""
        if hist.empty:
            return 1.0
        
        # Calculate expected trading days (roughly 252 per year)
        date_range = pd.date_range(
            start=hist.index[0], 
            end=hist.index[-1], 
            freq='B'  # Business days
        )
        expected_days = len(date_range)
        actual_days = len(hist)
        
        if expected_days == 0:
            return 0.0
        
        gap_ratio = max(0, (expected_days - actual_days) / expected_days)
        return gap_ratio
    
    def _calculate_price_stability(self, hist: pd.DataFrame) -> float:
        """Calculate price stability score (0-1, higher is more stable)"""
        if hist.empty or 'Close' not in hist.columns:
            return 0.0
        
        try:
            # Calculate daily returns
            returns = hist['Close'].pct_change().dropna()
            
            if len(returns) == 0:
                return 0.0
            
            # Calculate volatility (standard deviation of returns)
            volatility = returns.std()
            
            # Convert to stability score (inverse of volatility, normalized)
            # Typical daily volatility ranges from 0.01 to 0.1 for most stocks
            stability_score = max(0, 1 - (volatility / 0.1))
            
            return min(1.0, stability_score)
            
        except Exception:
            return 0.0
    
    def _calculate_volume_consistency(self, hist: pd.DataFrame) -> float:
        """Calculate volume consistency score (0-1, higher is more consistent)"""
        if hist.empty or 'Volume' not in hist.columns:
            return 0.0
        
        try:
            volumes = hist['Volume'].dropna()
            
            if len(volumes) == 0:
                return 0.0
            
            # Filter out zero volume days
            volumes = volumes[volumes > 0]
            
            if len(volumes) == 0:
                return 0.0
            
            # Calculate coefficient of variation (std/mean)
            mean_volume = volumes.mean()
            std_volume = volumes.std()
            
            if mean_volume == 0:
                return 0.0
            
            cv = std_volume / mean_volume
            
            # Convert to consistency score (lower CV = higher consistency)
            # Typical CV for volume ranges from 0.5 to 3.0
            consistency_score = max(0, 1 - (cv / 3.0))
            
            return min(1.0, consistency_score)
            
        except Exception:
            return 0.0
    
    def _detect_suspicious_movements(self, hist: pd.DataFrame, 
                                   threshold: float = 0.5) -> bool:
        """Detect suspicious price movements that might indicate manipulation"""
        if hist.empty or 'Close' not in hist.columns:
            return False
        
        try:
            # Calculate daily returns
            returns = hist['Close'].pct_change().dropna()
            
            if len(returns) == 0:
                return False
            
            # Check for extreme single-day movements
            extreme_moves = abs(returns) > threshold  # 50% single-day moves
            
            # Check for repeated extreme moves (potential pump/dump)
            extreme_count = extreme_moves.sum()
            
            # If more than 1% of days have extreme moves, flag as suspicious
            if extreme_count > len(returns) * 0.01:
                return True
            
            # Check for sudden volume spikes with price movements
            if 'Volume' in hist.columns:
                volumes = hist['Volume'].dropna()
                if len(volumes) > 0:
                    volume_changes = volumes.pct_change().dropna()
                    
                    # Look for days with both extreme price and volume changes
                    aligned_returns = returns.reindex(volume_changes.index)
                    
                    suspicious_days = (
                        (abs(aligned_returns) > 0.2) &  # 20% price move
                        (volume_changes > 5.0)  # 500% volume increase
                    )
                    
                    if suspicious_days.sum() > 2:  # More than 2 such days
                        return True
            
            return False
            
        except Exception:
            return False
    
    def _calculate_data_quality_score(self, hist: pd.DataFrame, 
                                    result: ValidationResult) -> float:
        """Calculate overall data quality score (0-100)"""
        score = 0.0
        
        # History completeness (30 points)
        if result.has_sufficient_history:
            score += 30
        else:
            # Partial credit based on available history
            if len(hist) > 0:
                score += 30 * (len(hist) / self.min_history_days)
        
        # Price stability (25 points)
        score += 25 * result.price_stability_score
        
        # Volume consistency (25 points)
        score += 25 * result.volume_consistency_score
        
        # Data completeness (20 points)
        if not hist.empty:
            # Check for missing values in key columns
            key_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
            available_columns = [col for col in key_columns if col in hist.columns]
            
            if available_columns:
                completeness_scores = []
                for col in available_columns:
                    non_null_ratio = hist[col].notna().sum() / len(hist)
                    completeness_scores.append(non_null_ratio)
                
                avg_completeness = np.mean(completeness_scores)
                score += 20 * avg_completeness
        
        return min(100.0, score)
    
    def validate_ticker_list(self, symbols: List[str], 
                           max_workers: int = 10) -> Dict[str, ValidationResult]:
        """Validate a list of tickers and return results"""
        logger.info(f"Validating data quality for {len(symbols)} tickers")
        
        results = {}
        
        # For now, process sequentially to avoid rate limits
        # Could be parallelized with proper rate limiting
        for i, symbol in enumerate(symbols):
            if i % 50 == 0:
                logger.info(f"Validated {i}/{len(symbols)} tickers")
            
            result = self.validate_ticker_data_quality(symbol)
            results[symbol] = result
            
            # Small delay to avoid overwhelming the API
            if i % 10 == 0:
                import time
                time.sleep(1)
        
        # Summary statistics
        valid_count = sum(1 for r in results.values() if r.is_valid)
        logger.info(f"Validation complete: {valid_count}/{len(symbols)} "
                   f"tickers passed ({valid_count/len(symbols)*100:.1f}%)")
        
        return results
    
    def get_validation_summary(self, results: Dict[str, ValidationResult]) -> Dict:
        """Generate a summary of validation results"""
        if not results:
            return {}
        
        valid_tickers = [s for s, r in results.items() if r.is_valid]
        invalid_tickers = [s for s, r in results.items() if not r.is_valid]
        
        # Common issues
        all_issues = []
        for result in results.values():
            all_issues.extend(result.issues)
        
        from collections import Counter
        issue_counts = Counter(all_issues)
        
        # Quality scores
        quality_scores = [r.data_quality_score for r in results.values()]
        
        summary = {
            'total_tickers': len(results),
            'valid_tickers': len(valid_tickers),
            'invalid_tickers': len(invalid_tickers),
            'validation_rate': len(valid_tickers) / len(results) * 100,
            'avg_quality_score': np.mean(quality_scores),
            'median_quality_score': np.median(quality_scores),
            'common_issues': dict(issue_counts.most_common(10)),
            'valid_ticker_list': valid_tickers,
            'invalid_ticker_list': invalid_tickers
        }
        
        return summary
