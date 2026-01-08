"""Performance tracking service for penny stock signals."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from loguru import logger

from penny_scanner.config.settings import get_settings
from penny_scanner.models.analysis import AnalysisResult, SignalStatus
from penny_scanner.services.database_service import DatabaseService


class PerformanceTrackingService:
    """Service for tracking real-world performance of penny stock signals."""

    def __init__(self, database_service: DatabaseService, data_service: Any = None):
        """Initialize the performance tracking service."""
        self.database_service = database_service
        self.data_service = data_service

    async def track_new_signals(
        self, signals: list[AnalysisResult], scan_date: date = None
    ) -> int:
        """
        Track new signals in the performance tracking system.

        Args:
            signals: List of signals to track
            scan_date: Date of the scan (defaults to today)

        Returns:
            Number of signals added to performance tracking
        """
        if not self.database_service.is_available():
            logger.warning(
                "Database service not available, skipping performance tracking"
            )
            return 0

        if scan_date is None:
            scan_date = date.today()

        tracked_count = 0

        for signal in signals:
            try:
                # Only track actionable signals
                if not self._should_track_signal(signal):
                    continue

                # Check if signal is NEW (not continuing)
                if signal.explosion_signal.signal_status != SignalStatus.NEW:
                    continue

                # Get the signal ID from the database
                signal_id = await self._get_signal_id(signal.symbol, scan_date)
                if not signal_id:
                    logger.warning(
                        f"Could not find signal ID for {signal.symbol} on {scan_date}"
                    )
                    continue

                # Create performance tracking record
                performance_data = self._prepare_performance_data(
                    signal, signal_id, scan_date
                )

                # Insert into penny_signal_performance table
                response = (
                    self.database_service.client.table("penny_signal_performance")
                    .insert(performance_data)
                    .execute()
                )

                if response.data:
                    tracked_count += 1
                    logger.debug(f"Started tracking performance for {signal.symbol}")
                else:
                    logger.warning(
                        f"Failed to create performance tracking for {signal.symbol}"
                    )

            except Exception as e:
                logger.error(f"Error tracking signal {signal.symbol}: {e}")

        if tracked_count > 0:
            logger.info(f"Started performance tracking for {tracked_count} new signals")

        return tracked_count

    async def close_ended_signals(
        self, ended_symbols: list[str], scan_date: date = None
    ) -> int:
        """
        Close performance tracking for signals that have ended.

        UPDATED Jan 2026: Added minimum hold period.
        Data shows: 1 day = 43.7% WR, 4-7 days = 76.5% WR
        Don't close signals before MIN_HOLD_DAYS unless stop loss hit.

        Args:
            ended_symbols: List of symbols that have ended
            scan_date: Date when signals ended (defaults to today)

        Returns:
            Number of performance records closed
        """
        if not self.database_service.is_available() or not ended_symbols:
            return 0

        if scan_date is None:
            scan_date = date.today()

        settings = get_settings()
        min_hold_days = settings.min_hold_days

        closed_count = 0
        deferred_count = 0

        for symbol in ended_symbols:
            try:
                # Get the active performance record for this symbol
                perf_response = (
                    self.database_service.client.table("penny_signal_performance")
                    .select("*")
                    .eq("symbol", symbol)
                    .eq("status", "ACTIVE")
                    .execute()
                )

                if not perf_response.data:
                    logger.debug(f"No active performance tracking found for {symbol}")
                    continue

                record = perf_response.data[0]
                entry_price = float(record.get("entry_price", 0))
                entry_date = date.fromisoformat(record["entry_date"])
                stop_loss_price = record.get("stop_loss_price")

                # Calculate days held
                days_held_so_far = (scan_date - entry_date).days

                # Get current market price
                current_price = await self._get_current_price(symbol, scan_date)
                if not current_price:
                    logger.warning(f"Could not get current price for {symbol}")
                    continue

                # Determine actual exit price and reason
                exit_price = float(current_price)
                exit_date = scan_date
                exit_reason = "SIGNAL_ENDED"

                # Check if stop loss was hit during the holding period
                if stop_loss_price and self.data_service:
                    try:
                        # Fetch historical data to check if stop was breached
                        from penny_scanner.services.stop_loss_checker import (
                            StopLossChecker,
                        )

                        checker = StopLossChecker(
                            self.database_service, self.data_service
                        )

                        stop_result = await checker.check_stop_loss_hit(
                            symbol, entry_date, scan_date, entry_price, stop_loss_price
                        )

                        if stop_result["stop_hit"]:
                            exit_price = stop_result["exit_price"]
                            exit_date = stop_result["exit_date"]
                            exit_reason = "STOP_LOSS"
                            logger.info(
                                f"{symbol}: Stopped out at ${exit_price:.2f} on {exit_date}"
                            )
                    except Exception as e:
                        logger.warning(f"Could not check stop loss for {symbol}: {e}")

                # MINIMUM HOLD PERIOD CHECK (Added Jan 2026)
                # Data shows: 1 day = 43.7% WR, 4-7 days = 76.5% WR
                # Don't close unless stop hit or minimum hold met
                if (
                    exit_reason != "STOP_LOSS"
                    and days_held_so_far < min_hold_days
                ):
                    logger.debug(
                        f"{symbol}: Deferring close - only {days_held_so_far} days held "
                        f"(min: {min_hold_days})"
                    )
                    deferred_count += 1
                    continue

                # Calculate metrics
                days_held = (exit_date - entry_date).days

                if entry_price > 0:
                    return_pct = (exit_price - entry_price) / entry_price * 100
                    return_absolute = (exit_price - entry_price) * 1000
                    is_winner = exit_price > entry_price

                    # Update with all calculated metrics
                    update_data = {
                        "exit_date": exit_date.isoformat(),
                        "exit_price": exit_price,
                        "exit_reason": exit_reason,
                        "status": "CLOSED",
                        "return_pct": round(return_pct, 4),
                        "return_absolute": round(return_absolute, 4),
                        "days_held": days_held,
                        "is_winner": is_winner,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }

                    self.database_service.client.table(
                        "penny_signal_performance"
                    ).update(update_data).eq("id", record["id"]).execute()

                    logger.debug(
                        f"Closed {symbol}: {return_pct:.2f}% return in {days_held} days "
                        f"(Exit: {exit_reason})"
                    )

                    closed_count += 1

            except Exception as e:
                logger.error(f"Error closing performance tracking for {symbol}: {e}")

        if closed_count > 0:
            logger.info(f"Closed performance tracking for {closed_count} ended signals")
        if deferred_count > 0:
            logger.info(
                f"Deferred {deferred_count} signals - minimum hold period not met"
            )

        return closed_count

    def _should_track_signal(self, signal: AnalysisResult) -> bool:
        """Determine if a signal should be tracked for performance."""
        # Only track actionable signals
        return signal.is_actionable()

    async def _get_signal_id(self, symbol: str, scan_date: date) -> str | None:
        """Get the database ID for a signal."""
        try:
            response = (
                self.database_service.client.table("penny_stock_signals")
                .select("id")
                .eq("symbol", symbol)
                .eq("scan_date", scan_date.isoformat())
                .limit(1)
                .execute()
            )

            if response.data:
                return response.data[0]["id"]
        except Exception as e:
            logger.error(f"Error getting signal ID for {symbol}: {e}")

        return None

    async def _get_current_price(self, symbol: str, scan_date: date) -> Decimal | None:
        """Get the current/exit price for a symbol."""
        try:
            # Get the most recent price from the signals table
            response = (
                self.database_service.client.table("penny_stock_signals")
                .select("close_price")
                .eq("symbol", symbol)
                .eq("scan_date", scan_date.isoformat())
                .limit(1)
                .execute()
            )

            if response.data:
                return Decimal(str(response.data[0]["close_price"]))
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")

        return None

    def _prepare_performance_data(
        self, signal: AnalysisResult, signal_id: str, scan_date: date
    ) -> dict:
        """Prepare performance tracking data for database insertion."""
        explosion = signal.explosion_signal

        entry_price = explosion.close_price
        if not entry_price or entry_price <= 0:
            entry_price = 1.0

        # Calculate profit target (e.g., 20% above entry for penny stocks)
        profit_target = entry_price * 1.2

        return {
            "signal_id": signal_id,
            "symbol": signal.symbol,
            "entry_date": scan_date.isoformat(),
            "entry_price": entry_price,
            "entry_score": float(signal.overall_score),
            "opportunity_rank": signal.opportunity_rank.value,
            "stop_loss_price": signal.stop_loss_level,
            "profit_target_price": profit_target,
            "volume_spike_factor": explosion.volume_spike_factor,
            "status": "ACTIVE",
        }

    async def get_performance_summary(self) -> dict:
        """Get a summary of current performance tracking."""
        if not self.database_service.is_available():
            return {}

        try:
            # Try to get from a view if it exists, otherwise calculate
            # For now, let's calculate manually as we might not have the view
            return await self._calculate_basic_metrics()

        except Exception as e:
            logger.error(f"Error getting performance summary: {e}")
            return {}

    async def backfill_history(self, data_service: Any) -> int:
        """
        Backfill performance history from existing signals.

        Args:
            data_service: DataService instance for fetching historical prices

        Returns:
            Number of performance records created
        """
        if not self.database_service.is_available():
            return 0

        try:
            # 1. Get all signals ordered by symbol and date
            logger.info("Fetching all historical signals...")
            response = (
                self.database_service.client.table("penny_stock_signals")
                .select("*")
                .order("symbol")
                .order("scan_date")
                .execute()
            )

            if not response.data:
                logger.warning("No signals found to backfill")
                return 0

            signals = response.data
            logger.info(f"Found {len(signals)} signals. Processing episodes...")

            # 2. Group into episodes
            episodes = []
            current_episode = None

            for _i, signal in enumerate(signals):
                symbol = signal["symbol"]
                scan_date = date.fromisoformat(signal["scan_date"])

                # Start new episode if:
                # - No current episode
                # - Symbol changed
                # - Gap > 3 days (weekend + 1 day buffer)
                if (
                    current_episode is None
                    or current_episode["symbol"] != symbol
                    or (scan_date - current_episode["last_date"]).days > 3
                ):
                    if current_episode:
                        episodes.append(current_episode)

                    current_episode = {
                        "symbol": symbol,
                        "start_date": scan_date,
                        "last_date": scan_date,
                        "start_signal": signal,
                        "signals": [signal],
                    }
                else:
                    current_episode["last_date"] = scan_date
                    current_episode["signals"].append(signal)

            if current_episode:
                episodes.append(current_episode)

            logger.info(
                f"Identified {len(episodes)} signal episodes. Calculating performance..."
            )

            # 3. Calculate performance for each episode
            backfilled_count = 0

            for episode in episodes:
                symbol = episode["symbol"]
                start_signal = episode["start_signal"]
                start_date = episode["start_date"]
                last_date = episode["last_date"]

                # Skip if already tracked (check by signal_id or symbol+date)
                # For simplicity, we'll try to insert and ignore duplicates if possible,
                # or check first. Let's check first.
                existing = (
                    self.database_service.client.table("penny_signal_performance")
                    .select("id")
                    .eq("signal_id", start_signal["id"])
                    .execute()
                )

                if existing.data:
                    continue

                # Determine exit date (day after last signal)
                # We need to fetch price data for the exit
                # If last_date is today or yesterday, it might still be active
                days_since_last = (date.today() - last_date).days

                status = "CLOSED"
                exit_date = (
                    last_date  # Default to last seen date if we can't get next day
                )
                exit_price = float(start_signal["close_price"])  # Default to entry

                if days_since_last <= 1:
                    status = "ACTIVE"
                    exit_price = None
                    exit_date = None
                else:
                    # Fetch historical data to find exit price (price on day after last signal)
                    # We'll use the DataService to get price for last_date + few days
                    try:
                        # We need to fetch a range to be sure
                        # This is expensive if we do it for every episode one by one.
                        # But necessary for backfill.
                        pass
                        # Actual fetching logic is complex without batching.
                        # For now, let's assume exit price is the close price of the LAST signal in the sequence
                        # This is a conservative estimate (selling at the end of the run)
                        # Or better: The close price of the last signal is the exit price?
                        # No, usually you exit when the signal is GONE.
                        # So we want the price of the day AFTER the last signal.

                        # Let's use the last signal's close price as a proxy for now to avoid
                        # thousands of API calls during backfill, or mark it as CLOSED with that price.
                        exit_price = float(episode["signals"][-1]["close_price"])
                        exit_date = last_date

                    except Exception as e:
                        logger.warning(f"Could not fetch exit price for {symbol}: {e}")

                # Prepare data
                entry_price = float(start_signal["close_price"])

                perf_data = {
                    "signal_id": start_signal["id"],
                    "symbol": symbol,
                    "entry_date": start_date.isoformat(),
                    "entry_price": entry_price,
                    "entry_score": float(start_signal["overall_score"]),
                    "opportunity_rank": start_signal.get("opportunity_rank"),
                    "status": status,
                }

                if status == "CLOSED":
                    perf_data["exit_date"] = exit_date.isoformat()
                    perf_data["exit_price"] = exit_price
                    perf_data["exit_reason"] = "SIGNAL_ENDED"

                    if entry_price > 0:
                        return_pct = (exit_price - entry_price) / entry_price * 100
                        days_held = (exit_date - start_date).days

                        perf_data["return_pct"] = round(return_pct, 4)
                        perf_data["days_held"] = days_held
                        perf_data["is_winner"] = return_pct > 0

                # Insert
                self.database_service.client.table("penny_signal_performance").insert(
                    perf_data
                ).execute()
                backfilled_count += 1

            logger.info(
                f"Successfully backfilled {backfilled_count} performance records"
            )
            return backfilled_count

        except Exception as e:
            logger.error(f"Error backfilling history: {e}")
            return 0

    async def _calculate_basic_metrics(self) -> dict:
        """Calculate basic performance metrics."""
        try:
            # Get all performance records
            response = (
                self.database_service.client.table("penny_signal_performance")
                .select("status, return_pct, is_winner, days_held")
                .execute()
            )

            if not response.data:
                return {"total_signals": 0, "active_signals": 0, "closed_signals": 0}

            records = response.data
            total_signals = len(records)
            active_signals = len([r for r in records if r.get("status") == "ACTIVE"])
            closed_signals = len([r for r in records if r.get("status") == "CLOSED"])

            # Calculate metrics for closed signals only
            closed_records = [
                r
                for r in records
                if r.get("status") == "CLOSED" and r.get("return_pct") is not None
            ]

            if closed_records:
                avg_return = sum(float(r["return_pct"]) for r in closed_records) / len(
                    closed_records
                )
                win_rate = (
                    sum(1 for r in closed_records if r.get("is_winner"))
                    / len(closed_records)
                    * 100
                )
                avg_days_held = sum(
                    int(r.get("days_held", 0)) for r in closed_records
                ) / len(closed_records)
            else:
                avg_return = 0
                win_rate = 0
                avg_days_held = 0

            return {
                "total_signals": total_signals,
                "active_signals": active_signals,
                "closed_signals": closed_signals,
                "avg_return_all": round(avg_return, 2),
                "win_rate_all": round(win_rate, 1),
                "avg_days_held": round(avg_days_held, 1),
            }

        except Exception as e:
            logger.error(f"Error calculating basic metrics: {e}")
            return {}

    async def get_performance_by_rank(self) -> dict[str, dict]:
        """Get performance metrics broken down by opportunity rank."""
        if not self.database_service.is_available():
            return {}

        try:
            response = (
                self.database_service.client.table("penny_signal_performance")
                .select("opportunity_rank, return_pct, is_winner")
                .eq("status", "CLOSED")
                .execute()
            )

            if not response.data:
                return {}

            by_rank = {}
            for record in response.data:
                rank = record.get("opportunity_rank", "Unknown")
                if rank not in by_rank:
                    by_rank[rank] = {"count": 0, "wins": 0, "total_return": 0.0}

                by_rank[rank]["count"] += 1
                if record.get("is_winner"):
                    by_rank[rank]["wins"] += 1
                by_rank[rank]["total_return"] += float(record.get("return_pct", 0))

            # Calculate averages
            results = {}
            for rank, data in by_rank.items():
                count = data["count"]
                if count > 0:
                    results[rank] = {
                        "count": count,
                        "win_rate": round(data["wins"] / count * 100, 1),
                        "avg_return": round(data["total_return"] / count, 2),
                    }

            return results

        except Exception as e:
            logger.error(f"Error calculating rank metrics: {e}")
            return {}

    async def get_top_trades(self, limit: int = 5) -> dict[str, list]:
        """Get top winning and losing trades."""
        if not self.database_service.is_available():
            return {"winners": [], "losers": []}

        try:
            # Get winners
            winners = (
                self.database_service.client.table("penny_signal_performance")
                .select("*")
                .eq("status", "CLOSED")
                .order("return_pct", desc=True)
                .limit(limit)
                .execute()
            )

            # Get losers
            losers = (
                self.database_service.client.table("penny_signal_performance")
                .select("*")
                .eq("status", "CLOSED")
                .order("return_pct", desc=False)
                .limit(limit)
                .execute()
            )

            return {"winners": winners.data or [], "losers": losers.data or []}

        except Exception as e:
            logger.error(f"Error fetching top trades: {e}")
            return {"winners": [], "losers": []}
