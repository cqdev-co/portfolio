"""Database storage service for unusual options signals."""

import json
from datetime import date, datetime, timedelta
from typing import Any

from loguru import logger
from supabase import Client, create_client

from .models import UnusualOptionsSignal


class SupabaseStorage:
    """Supabase storage service for unusual options signals."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._client: Client | None = None

    def _get_client(self) -> Client:
        """Get or create Supabase client."""
        if self._client is None:
            url = self.config.get("SUPABASE_URL")
            # Use service key for admin operations, fallback to regular key
            key = self.config.get("SUPABASE_SERVICE_KEY") or self.config.get(
                "SUPABASE_KEY"
            )

            if not url or not key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_KEY) must be set in config"
                )

            logger.debug(f"Creating Supabase client with URL: {url[:20]}...")
            try:
                # Create client with explicit options to avoid any proxy issues
                from supabase.lib.client_options import ClientOptions

                options = ClientOptions()
                self._client = create_client(url, key, options)
                logger.info("Connected to Supabase")
            except Exception as e:
                logger.error(f"Failed to create Supabase client: {e}")
                # Try without options as fallback
                try:
                    logger.debug("Retrying without explicit options...")
                    self._client = create_client(url, key)
                    logger.info("Connected to Supabase (fallback)")
                except Exception as e2:
                    logger.error(f"Fallback also failed: {e2}")
                    raise e from e2

        return self._client

    async def store_signals(self, signals: list[UnusualOptionsSignal]) -> bool:
        """
        Store unusual options signals in the database.

        Args:
            signals: List of signals to store

        Returns:
            True if successful, False otherwise
        """
        if not signals:
            logger.warning("No signals to store")
            return True

        try:
            client = self._get_client()

            # Convert signals to database format
            signal_data = []
            for signal in signals:
                data = {
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
                    "risk_factors": json.dumps(signal.risk_factors)
                    if signal.risk_factors
                    else None,
                    "has_volume_anomaly": signal.has_volume_anomaly,
                    "has_oi_spike": signal.has_oi_spike,
                    "has_premium_flow": signal.has_premium_flow,
                    "data_provider": signal.data_provider,
                    "detection_timestamp": signal.detection_timestamp.isoformat(),
                    # Spread detection fields (Phase 1)
                    "is_likely_spread": signal.is_likely_spread,
                    "spread_confidence": float(signal.spread_confidence)
                    if signal.spread_confidence
                    else None,
                    "spread_type": signal.spread_type,
                    "matched_leg_symbols": signal.matched_leg_symbols
                    if signal.matched_leg_symbols
                    else None,
                    "spread_strike_width": float(signal.spread_strike_width)
                    if signal.spread_strike_width
                    else None,
                    "spread_detection_reason": signal.spread_detection_reason,
                    "spread_net_premium": float(signal.spread_net_premium)
                    if signal.spread_net_premium
                    else None,
                    # Signal Classification (Jan 2026 - data-driven approach)
                    "signal_classification": signal.signal_classification,
                    "classification_reason": signal.classification_reason,
                    "predicted_win_rate": float(signal.predicted_win_rate)
                    if signal.predicted_win_rate is not None
                    else None,
                    "classification_factors": json.dumps(signal.classification_factors)
                    if signal.classification_factors
                    else None,
                }
                signal_data.append(data)

            # Insert signals in batches
            batch_size = 100
            total_inserted = 0

            for i in range(0, len(signal_data), batch_size):
                batch = signal_data[i : i + batch_size]

                result = client.table("unusual_options_signals").insert(batch).execute()

                if result.data:
                    total_inserted += len(result.data)
                    logger.debug(f"Inserted batch of {len(result.data)} signals")
                else:
                    logger.error(f"Failed to insert batch: {result}")
                    return False

            logger.info(f"Successfully stored {total_inserted} signals in database")
            return True

        except Exception as e:
            logger.error(f"Error storing signals: {e}")
            return False

    async def get_signals(
        self,
        ticker: str | None = None,
        min_grade: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
    ) -> list[UnusualOptionsSignal]:
        """
        Retrieve signals from the database.

        Args:
            ticker: Filter by ticker symbol
            min_grade: Minimum grade (S/A/B/C/D/F)
            start_date: Start date for filtering
            end_date: End date for filtering
            limit: Maximum number of results

        Returns:
            List of signals
        """
        try:
            client = self._get_client()

            # Build query
            query = client.table("unusual_options_signals").select("*")

            if ticker:
                query = query.eq("ticker", ticker.upper())

            if min_grade:
                grade_order = {"S": 6, "A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
                min_grade_value = grade_order.get(min_grade, 1)

                # Filter by grade - include all grades >= min_grade
                valid_grades = []
                for grade, value in grade_order.items():
                    if value >= min_grade_value:
                        valid_grades.append(grade)

                if valid_grades:
                    query = query.in_("grade", valid_grades)

            if start_date:
                query = query.gte("detection_timestamp", start_date.isoformat())

            if end_date:
                query = query.lte("detection_timestamp", end_date.isoformat())

            # Order by score and limit
            query = query.order("overall_score", desc=True).limit(limit)

            result = query.execute()

            if not result.data:
                return []

            # Convert to signal objects
            signals = []
            for row in result.data:
                try:
                    signal = UnusualOptionsSignal(
                        ticker=row["ticker"],
                        option_symbol=row["option_symbol"],
                        strike=row["strike"],
                        expiry=datetime.fromisoformat(row["expiry"]).date(),
                        option_type=row["option_type"],
                        days_to_expiry=row["days_to_expiry"],
                        underlying_price=row["underlying_price"],
                        current_volume=row["current_volume"],
                        current_oi=row["current_oi"],
                        implied_volatility=row["implied_volatility"],
                        volume_ratio=row["volume_ratio"],
                        average_volume=row["average_volume"] or 0,
                        oi_change_pct=row["oi_change_pct"],
                        previous_oi=row["previous_oi"] or 0,
                        premium_flow=row["premium_flow"],
                        aggressive_order_pct=row["aggressive_order_pct"],
                        put_call_ratio=row["put_call_ratio"],
                        sentiment=row["sentiment"] or "NEUTRAL",
                        moneyness=row["moneyness"] or "UNKNOWN",
                        overall_score=row["overall_score"],
                        grade=row["grade"],
                        confidence=row["confidence"],
                        risk_level=row["risk_level"] or "LOW",
                        risk_factors=row["risk_factors"]
                        if isinstance(row["risk_factors"], list)
                        else (
                            json.loads(row["risk_factors"])
                            if row["risk_factors"]
                            else []
                        ),
                        has_volume_anomaly=row["has_volume_anomaly"] or False,
                        has_oi_spike=row["has_oi_spike"] or False,
                        has_premium_flow=row["has_premium_flow"] or False,
                        data_provider=row["data_provider"] or "Unknown",
                        detection_timestamp=datetime.fromisoformat(
                            row["detection_timestamp"]
                        ),
                        # Signal Classification fields
                        signal_classification=row.get(
                            "signal_classification", "unclassified"
                        ),
                        classification_reason=row.get("classification_reason", ""),
                        predicted_win_rate=row.get("predicted_win_rate"),
                        classification_factors=row.get("classification_factors")
                        if isinstance(row.get("classification_factors"), list)
                        else (
                            json.loads(row.get("classification_factors"))
                            if row.get("classification_factors")
                            else []
                        ),
                    )
                    signals.append(signal)

                except Exception as e:
                    logger.warning(f"Error parsing signal row: {e}")
                    continue

            logger.info(f"Retrieved {len(signals)} signals from database")
            return signals

        except Exception as e:
            logger.error(f"Error retrieving signals: {e}")
            return []

    async def test_connection(self) -> bool:
        """Test database connection."""
        try:
            client = self._get_client()

            # Simple query to test connection
            (
                client.table("unusual_options_signals")
                .select("signal_id")
                .limit(1)
                .execute()
            )

            logger.info("Database connection test successful")
            return True

        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

    async def get_signal_count(self, ticker: str | None = None) -> int:
        """Get count of signals in database."""
        try:
            client = self._get_client()

            query = client.table("unusual_options_signals").select("id", count="exact")

            if ticker:
                query = query.eq("ticker", ticker.upper())

            result = query.execute()

            return result.count or 0

        except Exception as e:
            logger.error(f"Error getting signal count: {e}")
            return 0

    async def cleanup_old_signals(self, days_old: int = 30) -> int:
        """
        Remove signals older than specified days.

        Args:
            days_old: Number of days to keep signals

        Returns:
            Number of signals deleted
        """
        try:
            client = self._get_client()

            cutoff_date = datetime.now().date() - timedelta(days=days_old)

            result = (
                client.table("unusual_options_signals")
                .delete()
                .lt("detection_timestamp", cutoff_date.isoformat())
                .execute()
            )

            deleted_count = len(result.data) if result.data else 0

            logger.info(
                f"Cleaned up {deleted_count} old signals (older than {days_old} days)"
            )
            return deleted_count

        except Exception as e:
            logger.error(f"Error cleaning up old signals: {e}")
            return 0


# Convenience function for getting storage instance
def get_storage(config: dict[str, Any]) -> SupabaseStorage:
    """Get storage instance."""
    return SupabaseStorage(config)
