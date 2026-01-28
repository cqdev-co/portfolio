"""Service for checking if stop losses were hit during trade lifecycle.

UPDATED Jan 28, 2026: Added trailing stop functionality.
Data shows: 4-7 day holds = 76.5% WR vs 0-1 days = 43.7% WR
Trailing stops help lock in gains while letting winners run.
"""

from datetime import date
from typing import Any

from loguru import logger

from penny_scanner.config.settings import get_settings
from penny_scanner.services.database_service import DatabaseService


class StopLossChecker:
    """Check historical price data to determine if stop losses were hit.

    UPDATED Jan 28, 2026: Added trailing stop support.
    """

    def __init__(self, database_service: DatabaseService, data_service: Any):
        """Initialize stop loss checker."""
        self.database_service = database_service
        self.data_service = data_service
        self.settings = get_settings()

    async def check_stop_loss_hit(
        self,
        symbol: str,
        entry_date: date,
        exit_date: date,
        entry_price: float,
        stop_loss_price: float | None,
    ) -> dict[str, Any]:
        """
        Check if stop loss (fixed or trailing) was hit during the trade period.

        UPDATED Jan 28, 2026: Added trailing stop logic.
        - If price rises above activation threshold (e.g., +5%), trailing stop activates
        - Trailing stop follows high watermark at configured distance (e.g., 10%)
        - Exits at trailing stop if price drops from high watermark

        Args:
            symbol: Stock symbol
            entry_date: Entry date
            exit_date: Exit date
            entry_price: Entry price
            stop_loss_price: Fixed stop loss price level

        Returns:
            Dictionary with stop_hit (bool), actual_exit_price, exit_date, and exit_reason
        """
        if not stop_loss_price:
            # No stop loss set, return market exit
            return {
                "stop_hit": False,
                "exit_price": None,  # Will use market price
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
                "max_price_reached": entry_price,
                "trailing_stop_activated": False,
            }

        try:
            # Fetch historical price data for the period
            # We need daily low and high prices to check stops and trailing
            period_days = (exit_date - entry_date).days + 5  # Add buffer

            # Get historical data
            market_data = await self.data_service.get_market_data(
                symbol, period=f"{period_days}d"
            )

            if not market_data or not market_data.ohlcv_data:
                logger.warning(f"No historical data for {symbol}, assuming no stop hit")
                return {
                    "stop_hit": False,
                    "exit_price": None,
                    "exit_date": exit_date,
                    "exit_reason": "SIGNAL_ENDED",
                    "max_price_reached": entry_price,
                    "trailing_stop_activated": False,
                }

            # Trailing stop configuration
            trailing_enabled = self.settings.trailing_stop_enabled
            activation_pct = self.settings.trailing_stop_activation_pct / 100
            trailing_distance_pct = self.settings.trailing_stop_distance_pct / 100

            # Tracking variables for trailing stop
            max_price_reached = entry_price
            trailing_stop_activated = False
            current_trailing_stop = None

            # Check each day's prices
            for candle in market_data.ohlcv_data:
                candle_date = candle.timestamp.date()

                # Only check dates within the trade period
                if candle_date < entry_date or candle_date > exit_date:
                    continue

                day_low = candle.low
                day_high = candle.high

                # Update high watermark
                if day_high > max_price_reached:
                    max_price_reached = day_high

                    # Update trailing stop if activated
                    if trailing_stop_activated:
                        current_trailing_stop = max_price_reached * (
                            1 - trailing_distance_pct
                        )
                        logger.debug(
                            f"{symbol}: Trailing stop updated to ${current_trailing_stop:.2f} "
                            f"(high: ${max_price_reached:.2f})"
                        )

                # Check if trailing stop should activate
                if (
                    trailing_enabled
                    and not trailing_stop_activated
                    and max_price_reached >= entry_price * (1 + activation_pct)
                ):
                    trailing_stop_activated = True
                    current_trailing_stop = max_price_reached * (
                        1 - trailing_distance_pct
                    )
                    logger.info(
                        f"{symbol}: Trailing stop activated at ${current_trailing_stop:.2f} "
                        f"(gained {activation_pct * 100:.1f}%+, high: ${max_price_reached:.2f})"
                    )

                # Check fixed stop loss first
                if day_low <= stop_loss_price:
                    logger.info(
                        f"{symbol}: Fixed stop loss hit on {candle_date} "
                        f"(Low: ${day_low:.2f}, Stop: ${stop_loss_price:.2f})"
                    )
                    return {
                        "stop_hit": True,
                        "exit_price": stop_loss_price,
                        "exit_date": candle_date,
                        "exit_reason": "STOP_LOSS",
                        "max_price_reached": max_price_reached,
                        "trailing_stop_activated": trailing_stop_activated,
                    }

                # Check trailing stop (only if activated and above fixed stop)
                if (
                    trailing_stop_activated
                    and current_trailing_stop
                    and current_trailing_stop
                    > stop_loss_price  # Only if better than fixed
                    and day_low <= current_trailing_stop
                ):
                    logger.info(
                        f"{symbol}: Trailing stop hit on {candle_date} "
                        f"(Low: ${day_low:.2f}, Trailing: ${current_trailing_stop:.2f}, "
                        f"Max: ${max_price_reached:.2f})"
                    )
                    return {
                        "stop_hit": True,
                        "exit_price": current_trailing_stop,
                        "exit_date": candle_date,
                        "exit_reason": "TRAILING_STOP",
                        "max_price_reached": max_price_reached,
                        "trailing_stop_activated": True,
                    }

            # No stop was hit, use market exit
            return {
                "stop_hit": False,
                "exit_price": None,
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
                "max_price_reached": max_price_reached,
                "trailing_stop_activated": trailing_stop_activated,
            }

        except Exception as e:
            logger.error(f"Error checking stop loss for {symbol}: {e}")
            # On error, assume no stop hit
            return {
                "stop_hit": False,
                "exit_price": None,
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
                "max_price_reached": entry_price,
                "trailing_stop_activated": False,
            }
