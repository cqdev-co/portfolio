"""
Signal continuity service for deduplication and tracking.

This service handles:
1. Detecting if a signal is new or continuing
2. Updating existing signals when re-detected
3. Marking stale signals as inactive
4. Tracking signal history over time
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from loguru import logger
from supabase import Client

from .models import UnusualOptionsSignal


class SignalContinuityService:
    """
    Manages signal continuity and deduplication for hourly cron jobs.
    """

    def __init__(self, client: Client):
        """
        Initialize the continuity service.

        Args:
            client: Supabase client instance
        """
        self.client = client

    async def find_existing_signal(self, signal: UnusualOptionsSignal) -> str | None:
        """
        Check if signal already exists in database (within 24 hours).

        Args:
            signal: Signal to check for duplicates

        Returns:
            signal_id if found, None otherwise
        """
        try:
            result = self.client.rpc(
                "find_existing_signal",
                {
                    "p_ticker": signal.ticker,
                    "p_option_symbol": signal.option_symbol,
                    "p_strike": float(signal.strike),
                    "p_expiry": signal.expiry.isoformat(),
                    "p_option_type": signal.option_type,
                },
            ).execute()

            if result.data:
                logger.debug(
                    f"Found existing signal for {signal.ticker} "
                    f"{signal.option_symbol}: {result.data}"
                )
                return result.data

            return None

        except Exception as e:
            logger.error(f"Error finding existing signal: {e}")
            return None

    async def update_existing_signal(
        self, signal_id: str, signal: UnusualOptionsSignal
    ) -> bool:
        """
        Update an existing signal with new detection data.

        Args:
            signal_id: ID of existing signal
            signal: New signal data

        Returns:
            True if successful
        """
        try:
            self.client.rpc(
                "update_signal_continuity",
                {
                    "p_signal_id": signal_id,
                    "p_new_volume": signal.current_volume,
                    "p_new_oi": signal.current_oi,
                    "p_new_premium_flow": float(signal.premium_flow)
                    if signal.premium_flow
                    else 0.0,
                    "p_new_price": float(signal.underlying_price),
                    "p_new_score": float(signal.overall_score),
                    "p_new_grade": signal.grade,
                },
            ).execute()

            logger.debug(
                f"Updated existing signal {signal_id} "
                f"for {signal.ticker} {signal.option_symbol}"
            )
            return True

        except Exception as e:
            logger.error(f"Error updating signal continuity: {e}")
            return False

    async def store_new_signal(self, signal: UnusualOptionsSignal) -> str | None:
        """
        Store a brand new signal in the database.

        Args:
            signal: Signal to store

        Returns:
            signal_id if successful, None otherwise
        """
        try:
            # Generate UUIDs
            signal_id = str(uuid.uuid4())
            signal_group_id = signal_id  # New signals create their own group

            # Get current time for storage timestamps
            # Use timezone-aware UTC time to match PostgreSQL NOW()
            current_time = datetime.now(UTC).isoformat()

            # Prepare data
            data = {
                "signal_id": signal_id,
                "ticker": signal.ticker,
                "option_symbol": signal.option_symbol,
                "strike": float(signal.strike),
                "expiry": signal.expiry.isoformat(),
                "option_type": signal.option_type,
                "days_to_expiry": signal.days_to_expiry,
                "underlying_price": float(signal.underlying_price),
                "current_volume": signal.current_volume,
                "current_oi": signal.current_oi,
                "implied_volatility": float(signal.implied_volatility)
                if signal.implied_volatility
                else None,
                "volume_ratio": float(signal.volume_ratio)
                if signal.volume_ratio
                else None,
                "average_volume": signal.average_volume,
                "oi_change_pct": float(signal.oi_change_pct)
                if signal.oi_change_pct
                else None,
                "previous_oi": signal.previous_oi,
                "premium_flow": float(signal.premium_flow)
                if signal.premium_flow is not None
                else 0.0,
                "aggressive_order_pct": float(signal.aggressive_order_pct)
                if signal.aggressive_order_pct
                else None,
                "put_call_ratio": float(signal.put_call_ratio)
                if signal.put_call_ratio
                else None,
                "sentiment": signal.sentiment,
                "moneyness": signal.moneyness,
                "overall_score": float(signal.overall_score),
                "grade": signal.grade,
                "confidence": float(signal.confidence),
                "risk_level": signal.risk_level,
                "risk_factors": signal.risk_factors,
                "has_volume_anomaly": signal.has_volume_anomaly,
                "has_oi_spike": signal.has_oi_spike,
                "has_premium_flow": signal.has_premium_flow,
                "data_provider": signal.data_provider,
                "detection_timestamp": signal.detection_timestamp.isoformat(),
                # Continuity fields
                # Use current time to prevent false stale detection
                "is_new_signal": True,
                "signal_group_id": signal_group_id,
                "first_detected_at": current_time,  # When we stored it
                "last_detected_at": current_time,  # When we stored it
                "detection_count": 1,
                "is_active": True,
            }

            result = self.client.table("unusual_options_signals").insert(data).execute()

            if result.data:
                logger.info(
                    f"Stored new signal {signal_id} for "
                    f"{signal.ticker} {signal.option_symbol}"
                )
                return signal_id
            else:
                logger.error(f"Failed to store new signal: {result}")
                return None

        except Exception as e:
            logger.error(f"Error storing new signal: {e}")
            return None

    async def process_signals(
        self, signals: list[UnusualOptionsSignal]
    ) -> dict[str, Any]:
        """
        Process a batch of signals with deduplication.

        Args:
            signals: List of signals to process

        Returns:
            Dictionary with processing statistics
        """
        stats = {
            "total_signals": len(signals),
            "new_signals": 0,
            "updated_signals": 0,
            "failed_signals": 0,
            "signal_ids": [],
        }

        for signal in signals:
            try:
                # Check if signal already exists
                existing_id = await self.find_existing_signal(signal)

                if existing_id:
                    # Update existing signal
                    success = await self.update_existing_signal(existing_id, signal)
                    if success:
                        stats["updated_signals"] += 1
                        stats["signal_ids"].append(existing_id)
                    else:
                        stats["failed_signals"] += 1
                else:
                    # Store as new signal
                    signal_id = await self.store_new_signal(signal)
                    if signal_id:
                        stats["new_signals"] += 1
                        stats["signal_ids"].append(signal_id)
                    else:
                        stats["failed_signals"] += 1

            except Exception as e:
                logger.error(f"Error processing signal {signal.ticker}: {e}")
                stats["failed_signals"] += 1

        logger.info(
            f"Processed {stats['total_signals']} signals: "
            f"{stats['new_signals']} new, "
            f"{stats['updated_signals']} updated, "
            f"{stats['failed_signals']} failed"
        )

        return stats

    async def mark_expired_signals(self, hours_threshold: int = 3) -> int:
        """
        Mark signals as inactive if their option contracts have expired.

        Args:
            hours_threshold: Deprecated parameter kept for backwards compatibility

        Returns:
            Number of signals marked inactive
        """
        try:
            result = self.client.rpc(
                "mark_stale_signals_inactive", {"p_hours_threshold": hours_threshold}
            ).execute()

            count = result.data if result.data else 0

            if count > 0:
                logger.info(
                    f"Marked {count} signals as inactive (option contracts expired)"
                )

            return count

        except Exception as e:
            logger.error(f"Error marking expired signals: {e}")
            return 0

    async def get_signal_history(self, signal_id: str) -> list[dict[str, Any]]:
        """
        Get continuity history for a signal.

        Args:
            signal_id: Signal ID to get history for

        Returns:
            List of continuity records
        """
        try:
            result = (
                self.client.table("unusual_options_signal_continuity")
                .select("*")
                .eq("signal_id", signal_id)
                .order("detected_at", desc=True)
                .execute()
            )

            return result.data if result.data else []

        except Exception as e:
            logger.error(f"Error getting signal history: {e}")
            return []

    async def get_active_signals(
        self,
        ticker: str | None = None,
        min_grade: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Get currently active signals.

        Args:
            ticker: Optional ticker filter
            min_grade: Optional minimum grade filter
            limit: Maximum results

        Returns:
            List of active signals
        """
        try:
            query = (
                self.client.table("unusual_options_signals")
                .select("*")
                .eq("is_active", True)
            )

            if ticker:
                query = query.eq("ticker", ticker.upper())

            if min_grade:
                grade_order = {"S": 6, "A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
                min_grade_value = grade_order.get(min_grade, 1)

                valid_grades = [
                    g for g, v in grade_order.items() if v >= min_grade_value
                ]

                if valid_grades:
                    query = query.in_("grade", valid_grades)

            result = query.order("last_detected_at", desc=True).limit(limit).execute()

            return result.data if result.data else []

        except Exception as e:
            logger.error(f"Error getting active signals: {e}")
            return []


async def create_continuity_service(config: dict[str, Any]) -> SignalContinuityService:
    """
    Factory function to create continuity service.

    Args:
        config: Configuration dictionary with Supabase credentials

    Returns:
        Initialized SignalContinuityService
    """
    from supabase import create_client

    url = config.get("SUPABASE_URL")
    key = config.get("SUPABASE_SERVICE_KEY") or config.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in config")

    client = create_client(url, key)
    return SignalContinuityService(client)
