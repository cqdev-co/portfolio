"""Signal continuity service for tracking penny stock signals across multiple scans."""

from datetime import date, timedelta
from typing import List, Dict, Optional, Set
from loguru import logger

from penny_scanner.models.analysis import AnalysisResult, SignalStatus
from penny_scanner.services.database_service import DatabaseService


# US Market Holidays (approximate - update annually)
# These are the major market closure dates
US_MARKET_HOLIDAYS_2024 = {
    date(2024, 1, 1),  # New Year's Day
    date(2024, 1, 15),  # MLK Day
    date(2024, 2, 19),  # Presidents Day
    date(2024, 3, 29),  # Good Friday
    date(2024, 5, 27),  # Memorial Day
    date(2024, 6, 19),  # Juneteenth
    date(2024, 7, 4),  # Independence Day
    date(2024, 9, 2),  # Labor Day
    date(2024, 11, 28),  # Thanksgiving
    date(2024, 12, 25),  # Christmas
}

US_MARKET_HOLIDAYS_2025 = {
    date(2025, 1, 1),  # New Year's Day
    date(2025, 1, 20),  # MLK Day
    date(2025, 2, 17),  # Presidents Day
    date(2025, 4, 18),  # Good Friday
    date(2025, 5, 26),  # Memorial Day
    date(2025, 6, 19),  # Juneteenth
    date(2025, 7, 4),  # Independence Day
    date(2025, 9, 1),  # Labor Day
    date(2025, 11, 27),  # Thanksgiving
    date(2025, 12, 25),  # Christmas
}

US_MARKET_HOLIDAYS_2026 = {
    date(2026, 1, 1),  # New Year's Day
    date(2026, 1, 19),  # MLK Day
    date(2026, 2, 16),  # Presidents Day
    date(2026, 4, 3),  # Good Friday
    date(2026, 5, 25),  # Memorial Day
    date(2026, 6, 19),  # Juneteenth
    date(2026, 7, 3),  # Independence Day (observed)
    date(2026, 9, 7),  # Labor Day
    date(2026, 11, 26),  # Thanksgiving
    date(2026, 12, 25),  # Christmas
}

# Combined set for quick lookup
US_MARKET_HOLIDAYS: Set[date] = (
    US_MARKET_HOLIDAYS_2024 | US_MARKET_HOLIDAYS_2025 | US_MARKET_HOLIDAYS_2026
)


def is_trading_day(check_date: date) -> bool:
    """
    Check if a given date is a US market trading day.

    Args:
        check_date: Date to check

    Returns:
        True if it's a trading day, False otherwise
    """
    # Weekend check (Saturday = 5, Sunday = 6)
    if check_date.weekday() >= 5:
        return False

    # Holiday check
    if check_date in US_MARKET_HOLIDAYS:
        return False

    return True


def get_previous_trading_day(from_date: date, max_lookback: int = 10) -> date:
    """
    Get the most recent trading day before the given date.

    Args:
        from_date: Starting date
        max_lookback: Maximum days to look back (safety limit)

    Returns:
        The previous trading day
    """
    check_date = from_date - timedelta(days=1)

    for _ in range(max_lookback):
        if is_trading_day(check_date):
            return check_date
        check_date -= timedelta(days=1)

    # Fallback: return the date even if we couldn't find a trading day
    logger.warning(
        f"Could not find trading day within {max_lookback} days of {from_date}"
    )
    return from_date - timedelta(days=1)


class SignalContinuityService:
    """
    Service for tracking signal continuity across multiple scan dates.
    Determines if signals are NEW, CONTINUING, or ENDED.
    """

    def __init__(
        self,
        database_service: DatabaseService,
        performance_service: Optional["PerformanceTrackingService"] = None,
    ):
        """Initialize signal continuity service."""
        self.database_service = database_service
        self.performance_service = performance_service

    async def process_signals_with_continuity(
        self, current_signals: List[AnalysisResult], scan_date: date
    ) -> List[AnalysisResult]:
        """
        Process signals and determine continuity status.

        Compares today's signals with yesterday's to determine:
        - NEW: First time appearing
        - CONTINUING: Appeared yesterday and today
        - Days tracking: How many consecutive days signal has been active

        Args:
            current_signals: Today's analysis results
            scan_date: Date of current scan

        Returns:
            Analysis results with updated continuity status
        """
        if not self.database_service.is_available():
            logger.warning("Database unavailable, skipping continuity tracking")
            return current_signals

        try:
            # Get the previous trading day (handles weekends and holidays)
            previous_trading_day = get_previous_trading_day(scan_date)

            logger.info(
                f"Continuity check: scan_date={scan_date}, "
                f"previous_trading_day={previous_trading_day}"
            )

            # Get signals from the previous trading day
            previous_signals = await self.database_service.get_signals_by_date(
                previous_trading_day
            )

            # Build lookup dictionary for previous day's signals
            previous_lookup = {signal["symbol"]: signal for signal in previous_signals}

            logger.info(
                f"Processing continuity: {len(current_signals)} current, "
                f"{len(previous_signals)} from {previous_trading_day}"
            )

            # Update each signal's continuity status
            updated_signals = []
            new_signals = []
            new_count = 0
            continuing_count = 0

            for result in current_signals:
                symbol = result.symbol

                if symbol in previous_lookup:
                    # Signal was present on previous trading day - CONTINUING
                    previous_signal = previous_lookup[symbol]
                    previous_days = previous_signal.get("days_active", 0)

                    result.explosion_signal.signal_status = SignalStatus.CONTINUING
                    result.explosion_signal.days_active = previous_days + 1

                    continuing_count += 1

                    logger.debug(
                        f"{symbol}: CONTINUING (day {result.explosion_signal.days_active})"
                    )
                else:
                    # Signal is new today - NEW
                    result.explosion_signal.signal_status = SignalStatus.NEW
                    result.explosion_signal.days_active = 1

                    new_count += 1
                    new_signals.append(result)

                    logger.debug(f"{symbol}: NEW signal")

                updated_signals.append(result)

            logger.info(
                f"Continuity tracking complete: {new_count} NEW, "
                f"{continuing_count} CONTINUING"
            )

            # Track performance for new signals
            if self.performance_service and new_signals:
                await self.performance_service.track_new_signals(new_signals, scan_date)

            # Track ended signals (present on previous trading day but not today)
            await self._track_ended_signals(
                current_signals, previous_signals, scan_date
            )

            return updated_signals

        except Exception as e:
            logger.error(f"Error processing signal continuity: {e}")
            # Return original signals if continuity processing fails
            return current_signals

    async def _track_ended_signals(
        self,
        current_signals: List[AnalysisResult],
        previous_signals: List[Dict],
        scan_date: date,
    ) -> None:
        """
        Track signals that have ended (present on previous trading day but not today).

        Args:
            current_signals: Today's signals
            previous_signals: Signals from the previous trading day
            scan_date: Current scan date
        """
        current_symbols = {signal.symbol for signal in current_signals}
        previous_symbols = {signal["symbol"] for signal in previous_signals}

        ended_symbols = list(previous_symbols - current_symbols)

        if ended_symbols:
            logger.info(
                f"Signals ended today: {len(ended_symbols)} symbols no longer "
                f"meeting criteria"
            )
            logger.debug(f"Ended signals: {', '.join(sorted(ended_symbols)[:10])}")

            # Close performance tracking for ended signals
            if self.performance_service:
                await self.performance_service.close_ended_signals(
                    ended_symbols, scan_date
                )

    async def get_signal_history(
        self, symbol: str, trading_days_back: int = 7
    ) -> List[Dict]:
        """
        Get historical signals for a specific symbol.

        Args:
            symbol: Stock symbol
            trading_days_back: Number of trading days to look back

        Returns:
            List of historical signals (most recent first)
        """
        if not self.database_service.is_available():
            return []

        try:
            # Get signals for the last N trading days
            history = []
            check_date = date.today()
            trading_days_checked = 0
            max_calendar_days = trading_days_back * 2  # Safety limit
            calendar_days_checked = 0

            while (
                trading_days_checked < trading_days_back
                and calendar_days_checked < max_calendar_days
            ):
                if is_trading_day(check_date):
                    signal = await self.database_service.get_signal_by_symbol_date(
                        symbol, check_date
                    )

                    if signal:
                        history.append(signal)

                    trading_days_checked += 1

                check_date -= timedelta(days=1)
                calendar_days_checked += 1

            return history

        except Exception as e:
            logger.error(f"Error fetching signal history for {symbol}: {e}")
            return []

    async def get_longest_running_signals(
        self, scan_date: date, limit: int = 10
    ) -> List[Dict]:
        """
        Get signals with the most consecutive days active.

        Args:
            scan_date: Date to query
            limit: Maximum number of signals to return

        Returns:
            List of signals ordered by days_active (descending)
        """
        if not self.database_service.is_available():
            return []

        try:
            signals = await self.database_service.get_signals_by_date(scan_date)

            # Sort by days_active descending
            signals.sort(key=lambda x: x.get("days_active", 0), reverse=True)

            return signals[:limit]

        except Exception as e:
            logger.error(f"Error fetching longest running signals: {e}")
            return []

    async def get_continuity_stats(self, scan_date: date) -> Dict[str, int]:
        """
        Get continuity statistics for a scan date.

        Args:
            scan_date: Date to analyze

        Returns:
            Dictionary with continuity statistics
        """
        if not self.database_service.is_available():
            return {}

        try:
            signals = await self.database_service.get_signals_by_date(scan_date)

            stats = {
                "total_signals": len(signals),
                "new_signals": len(
                    [s for s in signals if s.get("signal_status") == "NEW"]
                ),
                "continuing_signals": len(
                    [s for s in signals if s.get("signal_status") == "CONTINUING"]
                ),
                "avg_days_active": 0,
                "max_days_active": 0,
            }

            if signals:
                days_active_list = [s.get("days_active", 0) for s in signals]
                stats["avg_days_active"] = sum(days_active_list) / len(days_active_list)
                stats["max_days_active"] = max(days_active_list)

            return stats

        except Exception as e:
            logger.error(f"Error calculating continuity stats: {e}")
            return {}
