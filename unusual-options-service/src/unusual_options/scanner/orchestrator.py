"""Main scanner orchestrator for coordinating scans."""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

from ..data.providers.yfinance_provider import get_provider_with_fallback
from ..data.models import OptionsChain
from .detector import AnomalyDetector
from ..scoring.grader import SignalGrader
from ..storage.models import UnusualOptionsSignal
from ..utils.tickers import (
    get_liquid_tickers,
    validate_ticker_symbols,
    should_block_ticker,
    should_apply_strict_dte_filtering,
)


class ScanOrchestrator:
    """
    Main coordinator for scanning operations.
    Manages data fetching, detection, scoring, and result aggregation.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.detector = AnomalyDetector(config)
        self.grader = SignalGrader(config)
        self._provider = None

    async def _get_provider(self):
        """Get or initialize the data provider."""
        if self._provider is None:
            self._provider = await get_provider_with_fallback(self.config)
        return self._provider

    async def scan_ticker(
        self, ticker: str, skip_blocking: bool = False
    ) -> List[UnusualOptionsSignal]:
        """
        Scan a single ticker for unusual options activity.

        Args:
            ticker: Stock ticker symbol
            skip_blocking: If True, bypass ticker blocking filters (useful for explicit watchlists)

        Returns:
            List of detected signals
        """
        logger.info(f"Scanning {ticker}")

        # Early filter: Skip blocked tickers (meme stocks only)
        # Note: Popular tickers like TSLA, NVDA, SPY, QQQ are NO LONGER blocked
        # Instead, we filter 0DTE contracts universally (see _should_process_detections)
        if (
            not skip_blocking
            and self.config.get("ENABLE_MEME_STOCK_FILTERING", True)
            and should_block_ticker(ticker)
        ):
            logger.debug(f"Skipping blocked ticker {ticker} (meme stock)")
            return []

        try:
            provider = await self._get_provider()

            # 1. Fetch current options chain with rate limit handling
            try:
                options_chain = await provider.get_options_chain(ticker)
            except Exception as e:
                # Check if it's a rate limit error
                error_msg = str(e).lower()
                if any(
                    phrase in error_msg
                    for phrase in ["rate limit", "too many requests", "429", "throttle"]
                ):
                    logger.warning(f"Rate limit hit for {ticker}, skipping")
                    return []
                else:
                    raise e

            if not options_chain or not options_chain.contracts:
                logger.warning(f"No options data available for {ticker}")
                return []

            logger.debug(
                f"Retrieved {len(options_chain.contracts)} contracts for {ticker}"
            )

            # 2. Fetch historical context (optional for now since YFinance is limited)
            historical_data = await provider.get_historical_options(ticker, days=20)

            # 3. Run detection algorithms
            detections = self.detector.detect_anomalies(options_chain, historical_data)

            if not detections:
                logger.info(f"No anomalies detected for {ticker}")
                return []

            # 4. Group detections by contract and create signals
            signals = []
            detection_groups = self._group_detections_by_contract(detections)

            for contract_symbol, contract_detections in detection_groups.items():
                try:
                    # Pre-filter detections before scoring
                    if not self._should_process_detections(
                        contract_detections, options_chain.underlying_price, ticker
                    ):
                        continue

                    signal = self.grader.create_signal_from_detections(
                        ticker=ticker,
                        underlying_price=options_chain.underlying_price,
                        detections=contract_detections,
                    )

                    # Post-filter signals based on quality
                    if self._should_keep_signal(signal):
                        signals.append(signal)

                except Exception as e:
                    logger.error(f"Error creating signal for {contract_symbol}: {e}")
                    continue

            # 5. Sort by score (best first)
            signals.sort(key=lambda s: s.overall_score, reverse=True)

            logger.info(f"Generated {len(signals)} signals for {ticker}")
            return signals

        except Exception as e:
            logger.error(f"Error scanning {ticker}: {e}")
            return []

    async def scan_multiple(
        self, tickers: List[str], max_concurrent: int = 5, skip_blocking: bool = False
    ) -> List[UnusualOptionsSignal]:
        """
        Scan multiple tickers with concurrency control.

        Args:
            tickers: List of ticker symbols
            max_concurrent: Maximum concurrent scans
            skip_blocking: If True, bypass ticker blocking filters (useful for explicit watchlists)

        Returns:
            Combined list of all signals
        """
        logger.info(
            f"Scanning {len(tickers)} tickers with max {max_concurrent} concurrent"
        )

        # Validate tickers first
        valid_tickers = validate_ticker_symbols(tickers)
        if len(valid_tickers) != len(tickers):
            invalid = set(tickers) - set(valid_tickers)
            logger.warning(f"Invalid tickers removed: {invalid}")

        all_signals = []
        rate_limit_count = 0
        max_rate_limits = (
            len(valid_tickers) // 4
        )  # Allow up to 25% rate limits before backing off

        # Process in batches to respect rate limits
        semaphore = asyncio.Semaphore(max_concurrent)

        async def scan_with_semaphore(ticker: str) -> List[UnusualOptionsSignal]:
            nonlocal rate_limit_count
            async with semaphore:
                try:
                    return await self.scan_ticker(ticker, skip_blocking=skip_blocking)
                except Exception as e:
                    error_msg = str(e).lower()
                    if any(
                        phrase in error_msg
                        for phrase in [
                            "rate limit",
                            "too many requests",
                            "429",
                            "throttle",
                        ]
                    ):
                        rate_limit_count += 1
                        if rate_limit_count > max_rate_limits:
                            logger.warning(
                                f"Too many rate limits ({rate_limit_count}), adding delay"
                            )
                            await asyncio.sleep(
                                5.0
                            )  # Add delay when hitting too many rate limits
                        return []
                    else:
                        logger.error(f"Error scanning {ticker}: {e}")
                        return []

        # Create tasks for all tickers
        tasks = [scan_with_semaphore(ticker) for ticker in valid_tickers]

        # Execute with progress tracking
        completed = 0
        for coro in asyncio.as_completed(tasks):
            try:
                signals = await coro
                all_signals.extend(signals)
                completed += 1

                if completed % 10 == 0:
                    logger.info(f"Completed {completed}/{len(valid_tickers)} scans")

            except Exception as e:
                logger.error(f"Error in batch scan: {e}")
                completed += 1

        # Sort all signals by score
        all_signals.sort(key=lambda s: s.overall_score, reverse=True)

        # Apply ticker cap to prevent any single ticker from dominating
        max_per_ticker = self.config.get("MAX_SIGNALS_PER_TICKER", 5)
        capped_signals = self._apply_ticker_cap(all_signals, max_per_ticker)

        logger.info(
            f"Batch scan complete. Found {len(all_signals)} total signals, "
            f"{len(capped_signals)} after ticker cap ({max_per_ticker}/ticker)"
        )
        return capped_signals

    async def scan_all_tickers(
        self, min_grade: str = "C", limit: Optional[int] = None
    ) -> List[UnusualOptionsSignal]:
        """
        Scan all liquid tickers from the database.

        Args:
            min_grade: Minimum grade to return
            limit: Maximum number of tickers to scan

        Returns:
            List of signals meeting grade criteria
        """
        logger.info(
            f"Starting scan-all with limit {limit or 'unlimited'}, min grade {min_grade}"
        )

        # Get liquid tickers from database
        tickers = get_liquid_tickers(limit=limit)
        logger.info(f"Retrieved {len(tickers)} liquid tickers from database")

        # Scan all tickers
        all_signals = await self.scan_multiple(
            tickers, max_concurrent=3
        )  # Lower concurrency for large scans

        # Filter by minimum grade
        grade_order = {"S": 6, "A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
        min_grade_value = grade_order.get(min_grade, 3)

        filtered_signals = [
            s for s in all_signals if grade_order.get(s.grade, 1) >= min_grade_value
        ]

        logger.info(
            f"Scan-all complete. Found {len(filtered_signals)} signals with grade {min_grade}+"
        )
        return filtered_signals

    def _group_detections_by_contract(self, detections: List) -> Dict[str, List]:
        """Group detections by contract symbol."""
        groups = {}

        for detection in detections:
            contract_symbol = detection.contract.symbol
            if contract_symbol not in groups:
                groups[contract_symbol] = []
            groups[contract_symbol].append(detection)

        return groups

    def _apply_ticker_cap(
        self, signals: List[UnusualOptionsSignal], max_per_ticker: int
    ) -> List[UnusualOptionsSignal]:
        """
        Cap signals per ticker to prevent any single ticker from dominating.

        Keeps the highest-scoring signals for each ticker.

        Args:
            signals: List of signals (should be sorted by score descending)
            max_per_ticker: Maximum signals to keep per ticker

        Returns:
            Filtered list with ticker caps applied
        """
        ticker_counts: Dict[str, int] = {}
        capped_signals = []

        for signal in signals:
            ticker = signal.ticker
            current_count = ticker_counts.get(ticker, 0)

            if current_count < max_per_ticker:
                capped_signals.append(signal)
                ticker_counts[ticker] = current_count + 1
            else:
                logger.debug(
                    f"Ticker cap reached for {ticker}, "
                    f"skipping signal with score {signal.overall_score:.3f}"
                )

        return capped_signals

    def _should_process_detections(
        self, detections: List, underlying_price: float, ticker: str
    ) -> bool:
        """
        Pre-filter detections to avoid processing obviously poor signals.

        Args:
            detections: List of detections for a contract
            underlying_price: Current stock price
            ticker: Stock ticker symbol

        Returns:
            True if detections should be processed
        """
        if not detections:
            return False

        primary_detection = detections[0]
        contract = primary_detection.contract

        # Universal 0DTE filtering - applies to ALL tickers
        # This filters out day-trader noise while preserving legitimate unusual activity
        days_to_expiry = (contract.expiry - contract.timestamp.date()).days

        # Filter short DTE contracts (configurable, default: 10 days minimum)
        # Analysis showed: Short DTE (≤10d) = 27% win rate (noise)
        #                  Mid DTE (11-21d) = 60% win rate (edge)
        # 0-10 DTE = mostly day trading, market makers, expiry pinning
        # ≥10 DTE = legitimate directional plays worth flagging
        min_dte = self.config.get("MIN_DTE_ALL_TICKERS", 10)
        if days_to_expiry < min_dte:
            logger.debug(
                f"Filtered {ticker} contract: {days_to_expiry} DTE < {min_dte} minimum"
            )
            return False

        # Filter out extremely OTM options (> 30% away from current price)
        price_diff_pct = abs(contract.strike - underlying_price) / underlying_price
        if price_diff_pct > 0.30:
            return False

        # Filter out very low volume (< 50 contracts)
        if contract.volume < 50:
            return False

        # Optional: Exclude PUT signals (default: False)
        # Note: In bearish weeks, PUTs could be the edge - don't exclude by default
        # Use hedge_analyzer.py to identify likely hedges instead
        if self.config.get("EXCLUDE_PUT_SIGNALS", False):
            if contract.option_type.upper() == "PUT":
                logger.debug(f"Filtered {ticker} PUT signal (PUT exclusion enabled)")
                return False

        # Filter out options with very wide spreads (> 20% of mid price)
        if contract.bid > 0 and contract.ask > 0:
            spread = contract.ask - contract.bid
            mid_price = (contract.bid + contract.ask) / 2
            if mid_price > 0 and (spread / mid_price) > 0.20:
                return False

        return True

    def _should_keep_signal(self, signal: UnusualOptionsSignal) -> bool:
        """
        Post-filter signals based on quality metrics.

        Args:
            signal: Generated signal

        Returns:
            True if signal should be kept
        """
        # Enhanced DTE filtering based on ticker type
        # Analysis showed: Mid DTE (11-21d) = 60% win rate (edge!)
        if signal.days_to_expiry is not None:
            # Apply stricter filtering for high 0DTE activity tickers
            if should_apply_strict_dte_filtering(signal.ticker):
                # Require minimum 14 days for high 0DTE activity tickers (TSLA, SPY, etc.)
                min_dte = self.config.get("MIN_DTE_HIGH_0DTE_TICKERS", 14)
                if signal.days_to_expiry < min_dte:
                    return False
            else:
                # Standard filtering: minimum 10 days for other tickers
                min_dte = self.config.get("MIN_DTE_STANDARD", 10)
                if signal.days_to_expiry < min_dte:
                    return False

        # Only keep signals with grade C or better
        if signal.grade in ["D", "F"]:
            return False

        # Filter out signals with very low scores (adjusted for new scoring)
        # New scoring: single premium-only detection ~0.15-0.25
        if signal.overall_score < 0.15:
            return False

        # Filter out high-risk signals with low scores
        if signal.risk_level == "HIGH" and signal.overall_score < 0.30:
            return False

        # Filter out signals with too many risk factors
        if len(signal.risk_factors) >= 4:
            return False

        # Filter out very small premium flows (likely retail noise)
        if signal.premium_flow > 0 and signal.premium_flow < 100000:
            return False

        return True

    async def get_provider_status(self) -> Dict[str, Any]:
        """Get status information about the data provider."""
        try:
            provider = await self._get_provider()
            is_connected = await provider.test_connection()
            rate_limit_info = provider.get_rate_limit_info()

            return {
                "provider_name": provider.name,
                "connected": is_connected,
                "rate_limits": rate_limit_info,
            }

        except Exception as e:
            logger.error(f"Error getting provider status: {e}")
            return {"provider_name": "Unknown", "connected": False, "error": str(e)}


# Convenience function for simple scans
async def quick_scan(ticker: str, config: Dict[str, Any]) -> List[UnusualOptionsSignal]:
    """
    Quick scan of a single ticker.

    Args:
        ticker: Stock ticker symbol
        config: Configuration dictionary

    Returns:
        List of signals
    """
    orchestrator = ScanOrchestrator(config)
    return await orchestrator.scan_ticker(ticker)
