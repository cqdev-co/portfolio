#!/usr/bin/env python3
"""
Validate spread detection accuracy over time.

This script tracks spread detection performance by analyzing:
1. Did flagged spreads behave like spreads? (neutral P&L on both legs)
2. Did non-spreads show directional movement?
3. False positive rate calculation

Run this after 2-4 weeks of spread detection to validate accuracy.

Usage:
    poetry run python scripts/validate_spread_detection.py --days-back 14
"""

import argparse
import os
import sys
from datetime import datetime, timedelta

import yfinance as yf
from dotenv import load_dotenv
from loguru import logger

# Load environment variables from .env file
load_dotenv()

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client  # noqa: E402


def get_price_change(
    ticker: str, start_date: datetime, days_forward: int = 5
) -> float | None:
    """Get price change percentage over period."""
    try:
        end_date = start_date + timedelta(days=days_forward + 2)

        stock = yf.Ticker(ticker)
        hist = stock.history(start=start_date.date(), end=end_date.date())

        if len(hist) < 2:
            return None

        start_price = hist["Close"].iloc[0]
        end_price = hist["Close"].iloc[-1]

        return ((end_price - start_price) / start_price) * 100

    except Exception as e:
        logger.debug(f"Could not fetch price for {ticker}: {e}")
        return None


async def validate_spread_detection(days_back: int = 14):
    """
    Validate spread detection accuracy by analyzing outcomes.

    Logic:
    - Spread signals should show LOW underlying movement (< 3%)
    - Directional signals should show HIGHER movement
    - Calculate false positive rate
    """
    # Setup Supabase
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
    )

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")

    client = create_client(url, key)

    # Fetch signals with spread detection data
    start_date = (datetime.now() - timedelta(days=days_back)).isoformat()

    logger.info(f"Fetching signals from last {days_back} days...")

    result = (
        client.table("unusual_options_signals")
        .select("*")
        .gte("detection_timestamp", start_date)
        .not_.is_("spread_confidence", "null")
        .execute()
    )

    signals = result.data

    logger.info(f"Found {len(signals)} signals with spread analysis")

    if not signals:
        logger.warning("No signals with spread detection found")
        return

    # Categorize signals
    high_conf_spreads = [s for s in signals if s.get("is_likely_spread")]
    medium_conf_spreads = [
        s
        for s in signals
        if s.get("spread_confidence", 0) >= 0.60 and not s.get("is_likely_spread")
    ]
    directional_signals = [s for s in signals if s.get("spread_confidence", 0) < 0.60]

    logger.info(
        f"\nSignal breakdown:\n"
        f"  High-confidence spreads (≥80%): {len(high_conf_spreads)}\n"
        f"  Medium-confidence spreads (60-79%): {len(medium_conf_spreads)}\n"
        f"  Directional signals (<60%): {len(directional_signals)}"
    )

    # Analyze price movements
    logger.info("\nAnalyzing price movements...")

    def analyze_category(signals_list: list, category_name: str):
        """Analyze price movements for a category."""
        movements = []

        for signal in signals_list:
            ticker = signal["ticker"]
            det_time = datetime.fromisoformat(
                signal["detection_timestamp"].replace("Z", "+00:00")
            )

            # Get 5-day forward price change
            pct_change = get_price_change(ticker, det_time, days_forward=5)

            if pct_change is not None:
                movements.append(abs(pct_change))

        if movements:
            avg_movement = sum(movements) / len(movements)
            low_movement = sum(1 for m in movements if m < 3) / len(movements) * 100
            high_movement = sum(1 for m in movements if m > 5) / len(movements) * 100

            logger.info(
                f"\n{category_name}:\n"
                f"  Signals analyzed: {len(movements)}/{len(signals_list)}\n"
                f"  Avg absolute movement: {avg_movement:.2f}%\n"
                f"  Low movement (<3%): {low_movement:.1f}%\n"
                f"  High movement (>5%): {high_movement:.1f}%"
            )

            return {
                "count": len(movements),
                "avg_movement": avg_movement,
                "low_movement_pct": low_movement,
                "high_movement_pct": high_movement,
            }
        else:
            logger.warning(f"No price data available for {category_name}")
            return None

    high_conf_stats = analyze_category(
        high_conf_spreads, "High-Confidence Spreads (≥80%)"
    )
    analyze_category(medium_conf_spreads, "Medium-Confidence Spreads (60-79%)")
    directional_stats = analyze_category(
        directional_signals, "Directional Signals (<60%)"
    )

    # Calculate false positive rate
    logger.info(f"\n{'=' * 60}")
    logger.info("VALIDATION RESULTS")
    logger.info(f"{'=' * 60}")

    if high_conf_stats and directional_stats:
        # False positive = flagged as spread but showed directional movement
        # True positive = flagged as spread and showed low movement

        spread_low_movement = high_conf_stats["low_movement_pct"]
        directional_high_movement = directional_stats["high_movement_pct"]

        logger.info(
            f"\n📊 Accuracy Metrics:\n"
            f"  Spreads with low movement: {spread_low_movement:.1f}%\n"
            f"  Directional with high movement: {directional_high_movement:.1f}%\n"
        )

        # Estimated false positive rate
        # (Spreads that moved significantly = probably not spreads)
        false_positive_rate = 100 - spread_low_movement

        logger.info(f"\n⚠️  Estimated False Positive Rate: {false_positive_rate:.1f}%\n")

        if false_positive_rate < 20:
            logger.info("✅ EXCELLENT - False positive rate is acceptable (<20%)")
            logger.info("   Recommendation: Proceed with Phase 2 (score reduction)")
        elif false_positive_rate < 30:
            logger.info("⚠️  MODERATE - False positive rate is borderline (20-30%)")
            logger.info(
                "   Recommendation: Keep tagging only, monitor for 1-2 more weeks"
            )
        else:
            logger.info("❌ HIGH - False positive rate is too high (>30%)")
            logger.info("   Recommendation: Adjust thresholds or disable filtering")

    logger.info(f"\n{'=' * 60}\n")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Validate spread detection accuracy")
    parser.add_argument(
        "--days-back",
        type=int,
        default=14,
        help="Number of days to analyze (default: 14)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logger.remove()
        logger.add(sys.stderr, level="DEBUG")

    logger.info("Starting spread detection validation...")

    import asyncio

    asyncio.run(validate_spread_detection(days_back=args.days_back))

    logger.info("Validation complete!")


if __name__ == "__main__":
    main()
