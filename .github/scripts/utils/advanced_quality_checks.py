#!/usr/bin/env python3
"""
Advanced Quality Checks for Ticker Filtering

Provides additional quality signals beyond basic price/volume:
- Options eligibility (stocks with options are more established)
- Institutional ownership (institutional backing signals quality)
- Revenue requirements (filter out pre-revenue companies)
- Float validation (ensure adequate liquidity depth)
"""

import logging
import time
import random
from typing import Dict, Optional, List
from dataclasses import dataclass
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


@dataclass
class AdvancedQualityMetrics:
    """Advanced quality metrics for a ticker"""

    symbol: str

    # Options eligibility
    has_options: bool = False
    options_expiry_count: int = 0

    # Institutional ownership
    institutional_ownership: float = 0.0  # 0-1 (percentage)
    institutional_holders: int = 0

    # Fundamentals
    revenue: Optional[float] = None
    net_income: Optional[float] = None
    is_profitable: bool = False
    has_positive_revenue: bool = False

    # Float/shares
    float_shares: Optional[float] = None
    shares_outstanding: Optional[float] = None
    float_percent: float = 0.0
    short_percent: float = 0.0

    # Quality flags
    passes_options_check: bool = False
    passes_institutional_check: bool = False
    passes_fundamental_check: bool = False
    passes_float_check: bool = False

    # Overall
    advanced_quality_score: float = 0.0
    quality_issues: List[str] = None

    def __post_init__(self):
        if self.quality_issues is None:
            self.quality_issues = []


class AdvancedQualityChecker:
    """
    Performs advanced quality checks on tickers using YFinance data.

    These checks add 20-30 points to quality scores for tickers that pass,
    significantly improving the quality of the final ticker list.
    """

    def __init__(
        self,
        # Options requirements
        require_options: bool = True,
        min_option_expiries: int = 2,
        # Institutional requirements
        min_institutional_ownership: float = 0.10,  # 10%
        min_institutional_holders: int = 5,
        # Fundamental requirements
        min_revenue: float = 10_000_000,  # $10M
        require_positive_revenue: bool = True,
        # Float requirements
        min_float_shares: float = 5_000_000,  # 5M shares
        min_float_percent: float = 0.20,  # 20%
        max_short_percent: float = 0.50,  # 50%
        # Processing
        max_workers: int = 3,
        request_delay: float = 0.5,
    ):
        self.require_options = require_options
        self.min_option_expiries = min_option_expiries
        self.min_institutional_ownership = min_institutional_ownership
        self.min_institutional_holders = min_institutional_holders
        self.min_revenue = min_revenue
        self.require_positive_revenue = require_positive_revenue
        self.min_float_shares = min_float_shares
        self.min_float_percent = min_float_percent
        self.max_short_percent = max_short_percent
        self.max_workers = max_workers
        self.request_delay = request_delay

        self.last_request_time = time.time()

    def _rate_limit(self):
        """Apply rate limiting"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed + random.uniform(0.1, 0.3))
        self.last_request_time = time.time()

    def check_ticker(self, symbol: str, max_retries: int = 2) -> AdvancedQualityMetrics:
        """
        Perform all advanced quality checks on a single ticker.

        Args:
            symbol: Ticker symbol to check
            max_retries: Max retry attempts for rate limiting

        Returns:
            AdvancedQualityMetrics with all check results
        """
        metrics = AdvancedQualityMetrics(symbol=symbol)

        for attempt in range(max_retries):
            try:
                self._rate_limit()
                ticker = yf.Ticker(symbol)

                # Get ticker info (contains most data we need)
                info = ticker.info or {}

                # ============================================
                # 1. Options Eligibility Check
                # ============================================
                try:
                    options_dates = ticker.options
                    metrics.has_options = len(options_dates) > 0
                    metrics.options_expiry_count = len(options_dates)
                    metrics.passes_options_check = (
                        metrics.options_expiry_count >= self.min_option_expiries
                    )

                    if not metrics.passes_options_check and self.require_options:
                        metrics.quality_issues.append(
                            f"No options ({metrics.options_expiry_count} expiries)"
                        )
                except Exception:
                    metrics.has_options = False
                    metrics.passes_options_check = False
                    if self.require_options:
                        metrics.quality_issues.append("Options data unavailable")

                # ============================================
                # 2. Institutional Ownership Check
                # ============================================
                inst_ownership = info.get("institutionHoldingsPercent")
                if inst_ownership is None:
                    inst_ownership = info.get("heldPercentInstitutions", 0) or 0

                metrics.institutional_ownership = float(inst_ownership)

                # Count institutional holders from major holders
                try:
                    inst_holders = ticker.institutional_holders
                    if inst_holders is not None and not inst_holders.empty:
                        metrics.institutional_holders = len(inst_holders)
                    else:
                        # Estimate from ownership percentage
                        metrics.institutional_holders = (
                            10
                            if metrics.institutional_ownership > 0.3
                            else 5
                            if metrics.institutional_ownership > 0.1
                            else 0
                        )
                except Exception:
                    metrics.institutional_holders = 0

                metrics.passes_institutional_check = (
                    metrics.institutional_ownership >= self.min_institutional_ownership
                    and metrics.institutional_holders >= self.min_institutional_holders
                )

                if not metrics.passes_institutional_check:
                    metrics.quality_issues.append(
                        f"Low institutional: "
                        f"{metrics.institutional_ownership * 100:.1f}% "
                        f"({metrics.institutional_holders} holders)"
                    )

                # ============================================
                # 3. Fundamental Check (Revenue/Profitability)
                # ============================================
                metrics.revenue = info.get("totalRevenue") or info.get("revenue")
                metrics.net_income = info.get("netIncomeToCommon") or info.get(
                    "netIncome"
                )

                metrics.has_positive_revenue = (
                    metrics.revenue is not None and metrics.revenue > 0
                )
                metrics.is_profitable = (
                    metrics.net_income is not None and metrics.net_income > 0
                )

                metrics.passes_fundamental_check = (
                    metrics.has_positive_revenue
                    and (metrics.revenue or 0) >= self.min_revenue
                )

                if not metrics.passes_fundamental_check:
                    rev_str = (
                        f"${metrics.revenue / 1e6:.1f}M" if metrics.revenue else "N/A"
                    )
                    metrics.quality_issues.append(
                        f"Revenue {rev_str} < ${self.min_revenue / 1e6:.0f}M min"
                    )

                # ============================================
                # 4. Float/Shares Check
                # ============================================
                metrics.float_shares = info.get("floatShares")
                metrics.shares_outstanding = info.get("sharesOutstanding")

                if metrics.float_shares and metrics.shares_outstanding:
                    metrics.float_percent = (
                        metrics.float_shares / metrics.shares_outstanding
                    )

                # Short interest
                short_percent = info.get("shortPercentOfFloat")
                if short_percent:
                    metrics.short_percent = float(short_percent)

                metrics.passes_float_check = (
                    metrics.float_shares is not None
                    and metrics.float_shares >= self.min_float_shares
                    and metrics.float_percent >= self.min_float_percent
                    and metrics.short_percent <= self.max_short_percent
                )

                if not metrics.passes_float_check:
                    float_str = (
                        f"{metrics.float_shares / 1e6:.1f}M"
                        if metrics.float_shares
                        else "N/A"
                    )
                    metrics.quality_issues.append(
                        f"Float {float_str} shares "
                        f"({metrics.float_percent * 100:.0f}% of outstanding)"
                    )

                # ============================================
                # Calculate Advanced Quality Score
                # ============================================
                score = 0.0

                # Options: 8 points
                if metrics.passes_options_check:
                    score += 8
                elif metrics.has_options:
                    score += 4  # Partial credit

                # Institutional: 8 points
                if metrics.passes_institutional_check:
                    score += 8
                elif metrics.institutional_ownership > 0.05:
                    score += 4  # Partial credit

                # Fundamentals: 8 points
                if metrics.passes_fundamental_check:
                    score += 8
                    if metrics.is_profitable:
                        score += 3  # Bonus for profitability
                elif metrics.has_positive_revenue:
                    score += 3  # Partial credit

                # Float: 6 points
                if metrics.passes_float_check:
                    score += 6
                elif metrics.float_shares and metrics.float_shares > 1_000_000:
                    score += 3  # Partial credit

                metrics.advanced_quality_score = score
                return metrics

            except Exception as e:
                error_str = str(e).lower()

                # Retry on rate limits
                if (
                    any(
                        k in error_str for k in ["rate", "429", "limit", "crumb", "401"]
                    )
                    and attempt < max_retries - 1
                ):
                    wait = (attempt + 1) * 2
                    logger.debug(f"Rate limit for {symbol}, retry in {wait}s")
                    time.sleep(wait)
                    continue

                logger.debug(f"Error checking {symbol}: {e}")
                metrics.quality_issues.append(f"Check failed: {str(e)[:50]}")
                return metrics

        return metrics

    def check_batch(
        self, symbols: List[str], verbose: bool = False
    ) -> Dict[str, AdvancedQualityMetrics]:
        """
        Check multiple tickers in parallel.

        Args:
            symbols: List of ticker symbols
            verbose: Enable progress logging

        Returns:
            Dictionary mapping symbol to metrics
        """
        results = {}

        logger.info(
            f"Running advanced quality checks on {len(symbols)} tickers "
            f"(options, institutional, fundamentals, float)"
        )

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_symbol = {
                executor.submit(self.check_ticker, symbol): symbol for symbol in symbols
            }

            completed = 0
            for future in as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                try:
                    result = future.result()
                    results[symbol] = result

                    completed += 1
                    if verbose and completed % 50 == 0:
                        passing = sum(
                            1
                            for r in results.values()
                            if r.advanced_quality_score >= 15
                        )
                        logger.info(
                            f"Progress: {completed}/{len(symbols)} "
                            f"({passing} high quality so far)"
                        )

                except Exception as e:
                    logger.debug(f"Error checking {symbol}: {e}")
                    results[symbol] = AdvancedQualityMetrics(
                        symbol=symbol, quality_issues=[f"Check failed: {e}"]
                    )

        # Summary
        passing = sum(1 for r in results.values() if r.advanced_quality_score >= 15)
        avg_score = (
            sum(r.advanced_quality_score for r in results.values()) / len(results)
            if results
            else 0
        )

        logger.info(
            f"Advanced checks complete: {passing}/{len(results)} passed "
            f"(avg score: {avg_score:.1f}/33)"
        )

        return results

    def get_summary(self, results: Dict[str, AdvancedQualityMetrics]) -> Dict:
        """Generate summary statistics from check results."""
        if not results:
            return {}

        metrics_list = list(results.values())

        return {
            "total_checked": len(metrics_list),
            "with_options": sum(1 for m in metrics_list if m.has_options),
            "passes_options": sum(1 for m in metrics_list if m.passes_options_check),
            "passes_institutional": sum(
                1 for m in metrics_list if m.passes_institutional_check
            ),
            "passes_fundamental": sum(
                1 for m in metrics_list if m.passes_fundamental_check
            ),
            "passes_float": sum(1 for m in metrics_list if m.passes_float_check),
            "profitable": sum(1 for m in metrics_list if m.is_profitable),
            "avg_institutional_ownership": sum(
                m.institutional_ownership for m in metrics_list
            )
            / len(metrics_list)
            * 100,
            "avg_advanced_score": sum(m.advanced_quality_score for m in metrics_list)
            / len(metrics_list),
            "high_quality_count": sum(
                1 for m in metrics_list if m.advanced_quality_score >= 20
            ),
        }
