"""Service for checking if stop losses were hit during trade lifecycle."""

from datetime import date, timedelta
from typing import Optional, Dict, Any
from loguru import logger
from decimal import Decimal

from penny_scanner.services.database_service import DatabaseService


class StopLossChecker:
    """Check historical price data to determine if stop losses were hit."""

    def __init__(self, database_service: DatabaseService, data_service: Any):
        """Initialize stop loss checker."""
        self.database_service = database_service
        self.data_service = data_service

    async def check_stop_loss_hit(
        self,
        symbol: str,
        entry_date: date,
        exit_date: date,
        entry_price: float,
        stop_loss_price: Optional[float],
    ) -> Dict[str, Any]:
        """
        Check if stop loss was hit during the trade period.

        Args:
            symbol: Stock symbol
            entry_date: Entry date
            exit_date: Exit date
            entry_price: Entry price
            stop_loss_price: Stop loss price level

        Returns:
            Dictionary with stop_hit (bool), actual_exit_price, and exit_date
        """
        if not stop_loss_price:
            # No stop loss set, return market exit
            return {
                "stop_hit": False,
                "exit_price": None,  # Will use market price
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
            }

        try:
            # Fetch historical price data for the period
            # We need daily low prices to check if stop was hit
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
                }

            # Check each day's low price
            for candle in market_data.ohlcv_data:
                candle_date = candle.timestamp.date()

                # Only check dates within the trade period
                if candle_date < entry_date or candle_date > exit_date:
                    continue

                day_low = candle.low

                if day_low <= stop_loss_price:
                    # Stop loss was hit!
                    logger.info(
                        f"{symbol}: Stop loss hit on {candle_date} "
                        f"(Low: ${day_low:.2f}, Stop: ${stop_loss_price:.2f})"
                    )

                    return {
                        "stop_hit": True,
                        "exit_price": stop_loss_price,  # Exit at stop price
                        "exit_date": candle_date,
                        "exit_reason": "STOP_LOSS",
                    }

            # Stop was not hit, use market exit
            return {
                "stop_hit": False,
                "exit_price": None,
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
            }

        except Exception as e:
            logger.error(f"Error checking stop loss for {symbol}: {e}")
            # On error, assume no stop hit
            return {
                "stop_hit": False,
                "exit_price": None,
                "exit_date": exit_date,
                "exit_reason": "SIGNAL_ENDED",
            }
