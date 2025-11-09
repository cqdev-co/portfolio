"""Generate labels for expired signals."""

from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf
from loguru import logger

from ml_predictor.data.data_loader import DataLoader


class LabelGenerator:
    """Generate win/loss labels for expired options signals."""

    def __init__(self):
        """Initialize label generator."""
        self.data_loader = DataLoader()
        self._price_cache: Dict[str, pd.DataFrame] = {}

    def _get_stock_price_at_date(
        self, 
        ticker: str, 
        target_date: datetime
    ) -> Optional[float]:
        """
        Get stock price at a specific date.

        Args:
            ticker: Stock ticker symbol
            target_date: Target date

        Returns:
            Closing price or None if not available
        """
        # Check cache first
        cache_key = f"{ticker}_{target_date.strftime('%Y%m%d')}"

        try:
            # Fetch data around the target date (±5 days to handle weekends)
            start_date = target_date - timedelta(days=5)
            end_date = target_date + timedelta(days=5)

            stock = yf.Ticker(ticker)
            hist = stock.history(start=start_date, end=end_date)

            if hist.empty:
                logger.warning(
                    f"No price data for {ticker} around {target_date.date()}"
                )
                return None

            # Try to get exact date first
            target_date_str = target_date.strftime("%Y-%m-%d")
            if target_date_str in hist.index:
                return float(hist.loc[target_date_str, "Close"])

            # If exact date not available, get closest date
            hist_dates = pd.to_datetime(hist.index)
            closest_idx = (
                np.abs(hist_dates - pd.Timestamp(target_date))
            ).argmin()
            closest_price = float(hist.iloc[closest_idx]["Close"])

            logger.debug(
                f"Using closest price for {ticker}: "
                f"{hist_dates[closest_idx].date()} -> ${closest_price:.2f}"
            )

            return closest_price

        except Exception as e:
            logger.error(
                f"Error fetching price for {ticker} at {target_date.date()}: {e}"
            )
            return None

    def _determine_winner(
        self,
        option_type: str,
        strike: float,
        expiry_price: float,
    ) -> bool:
        """
        Determine if option expired in-the-money (winner).

        Args:
            option_type: 'call' or 'put'
            strike: Strike price
            expiry_price: Stock price at expiry

        Returns:
            True if option expired ITM (winner), False otherwise
        """
        if option_type.lower() == "call":
            return expiry_price > strike
        elif option_type.lower() == "put":
            return expiry_price < strike
        else:
            logger.error(f"Invalid option type: {option_type}")
            return False

    def _calculate_intrinsic_value(
        self,
        option_type: str,
        strike: float,
        expiry_price: float,
    ) -> float:
        """
        Calculate intrinsic value at expiry.

        Args:
            option_type: 'call' or 'put'
            strike: Strike price
            expiry_price: Stock price at expiry

        Returns:
            Intrinsic value (0 if OTM)
        """
        if option_type.lower() == "call":
            return max(0, expiry_price - strike)
        elif option_type.lower() == "put":
            return max(0, strike - expiry_price)
        else:
            return 0

    def _estimate_premium(
        self,
        signal_row: pd.Series,
    ) -> Optional[float]:
        """
        Estimate option premium from signal data.

        Args:
            signal_row: Signal data row

        Returns:
            Estimated premium per share
        """
        # If we have premium flow and volume, we can estimate
        if (
            pd.notna(signal_row.get("premium_flow"))
            and signal_row.get("premium_flow") > 0
            and pd.notna(signal_row.get("current_volume"))
            and signal_row.get("current_volume") > 0
        ):
            premium_per_contract = (
                signal_row["premium_flow"] / signal_row["current_volume"]
            )
            premium_per_share = premium_per_contract / 100  # Contract = 100 shares
            return premium_per_share

        # Fallback: estimate from IV and moneyness if available
        if pd.notna(signal_row.get("implied_volatility")):
            # Very rough estimate: ATM option ~ 3-5% of stock price
            # Adjust by moneyness
            stock_price = signal_row.get("underlying_price", 0)
            if stock_price > 0:
                moneyness = signal_row.get("moneyness", "ATM")
                if moneyness == "ITM":
                    premium_pct = 0.05
                elif moneyness == "ATM":
                    premium_pct = 0.03
                else:  # OTM
                    premium_pct = 0.01

                return stock_price * premium_pct

        return None

    def _calculate_return_pct(
        self,
        intrinsic_value: float,
        premium_paid: Optional[float],
    ) -> Optional[float]:
        """
        Calculate return percentage.

        Args:
            intrinsic_value: Value at expiry
            premium_paid: Premium paid to enter

        Returns:
            Return % or None if premium unknown
        """
        if premium_paid is None or premium_paid <= 0:
            return None

        return_pct = ((intrinsic_value - premium_paid) / premium_paid) * 100
        return return_pct

    def label_signals(
        self,
        signals_df: pd.DataFrame,
        batch_size: int = 50,
    ) -> pd.DataFrame:
        """
        Label expired signals with win/loss and returns.

        Args:
            signals_df: DataFrame with expired signals
            batch_size: Process in batches to show progress

        Returns:
            DataFrame with labels added
        """
        if signals_df.empty:
            logger.warning("No signals to label")
            return signals_df

        logger.info(f"Labeling {len(signals_df)} expired signals...")

        labeled_data = []

        for idx, row in signals_df.iterrows():
            try:
                # Parse expiry date
                if isinstance(row["expiry"], str):
                    expiry_date = datetime.strptime(row["expiry"], "%Y-%m-%d")
                else:
                    expiry_date = pd.to_datetime(row["expiry"])

                # Get stock price at expiry
                expiry_price = self._get_stock_price_at_date(
                    row["ticker"], expiry_date
                )

                if expiry_price is None:
                    logger.warning(
                        f"Skipping {row['ticker']} - no price data at expiry"
                    )
                    continue

                # Determine if winner
                is_winner = self._determine_winner(
                    row["option_type"], row["strike"], expiry_price
                )

                # Calculate intrinsic value
                intrinsic_value = self._calculate_intrinsic_value(
                    row["option_type"], row["strike"], expiry_price
                )

                # Estimate premium paid
                premium_paid = self._estimate_premium(row)

                # Calculate return %
                return_pct = self._calculate_return_pct(
                    intrinsic_value, premium_paid
                )

                # Add labels to row
                labeled_row = row.to_dict()
                labeled_row["expiry_price"] = expiry_price
                labeled_row["is_winner"] = is_winner
                labeled_row["intrinsic_value"] = intrinsic_value
                labeled_row["estimated_premium"] = premium_paid
                labeled_row["return_pct"] = return_pct
                labeled_row["labeled_at"] = datetime.now().isoformat()

                labeled_data.append(labeled_row)

                # Log progress
                if (len(labeled_data) % batch_size) == 0:
                    logger.info(f"Labeled {len(labeled_data)}/{len(signals_df)}")

            except Exception as e:
                logger.error(
                    f"Error labeling signal {row.get('signal_id', 'unknown')}: {e}"
                )
                continue

        labeled_df = pd.DataFrame(labeled_data)

        if not labeled_df.empty:
            # Log summary statistics
            win_rate = (
                labeled_df["is_winner"].sum() / len(labeled_df) * 100
            )
            avg_return = labeled_df["return_pct"].mean()

            logger.info(
                f"Labeling complete: {len(labeled_df)} signals"
            )
            logger.info(f"Win rate: {win_rate:.1f}%")
            if pd.notna(avg_return):
                logger.info(f"Average return: {avg_return:.1f}%")

        return labeled_df

    def generate_and_save_labels(
        self,
        min_grade: str = "B",
        limit: Optional[int] = None,
    ) -> pd.DataFrame:
        """
        Fetch expired signals, label them, and save to disk.

        Args:
            min_grade: Minimum signal grade
            limit: Maximum number of signals to process

        Returns:
            Labeled DataFrame
        """
        # Fetch expired signals
        logger.info("Fetching expired signals from database...")
        signals_df = self.data_loader.fetch_expired_signals(
            min_grade=min_grade, 
            limit=limit
        )

        if signals_df.empty:
            logger.warning("No expired signals found")
            return signals_df

        # Label signals
        labeled_df = self.label_signals(signals_df)

        if not labeled_df.empty:
            # Save to disk
            self.data_loader.save_labeled_data(labeled_df)

        return labeled_df

