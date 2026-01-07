#!/usr/bin/env python3
"""
Backfill spread detection for existing signals in database.

This script analyzes historical signals and adds spread detection metadata.
Run this after deploying the spread detection feature to enrich existing data.

Usage:
    poetry run python scripts/backfill_spread_detection.py [--dry-run] [--limit N]
"""

import argparse
import asyncio
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

from dotenv import load_dotenv
from loguru import logger

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client  # noqa: E402

from src.unusual_options.scanner.spread_detector import SpreadDetector  # noqa: E402


class SimpleContract:
    """Simplified contract for spread detection."""

    def __init__(self, signal_data):
        self.ticker = signal_data["ticker"]  # Add ticker field
        self.symbol = signal_data["option_symbol"]
        self.strike = float(signal_data["strike"])
        self.expiry = datetime.strptime(signal_data["expiry"], "%Y-%m-%d").date()
        self.option_type = signal_data["option_type"]
        self.volume = signal_data["current_volume"]
        self.open_interest = signal_data["current_oi"]
        self.last_price = (
            float(signal_data["premium_flow"]) / (self.volume * 100)
            if self.volume > 0
            else 0
        )
        self.implied_volatility = signal_data.get("implied_volatility")
        self.timestamp = datetime.fromisoformat(
            signal_data["detection_timestamp"].replace("Z", "+00:00")
        )


class SimpleDetection:
    """Simplified detection for spread analysis."""

    def __init__(self, signal_data):
        self.contract = SimpleContract(signal_data)
        self.detection_type = "BACKFILL"
        self.metrics = {}
        self.confidence = signal_data.get("confidence", 0.5)
        self.timestamp = self.contract.timestamp
        self.signal_id = signal_data["signal_id"]


async def backfill_spread_detection(
    dry_run: bool = False, limit: int | None = None, days_back: int = 30
):
    """
    Backfill spread detection for existing signals.

    Args:
        dry_run: If True, only analyze without updating database
        limit: Maximum number of signals to process (for testing)
        days_back: Number of days to look back for signals
    """
    # Setup Supabase connection
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
    )

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required"
        )

    logger.info("Connecting to Supabase...")
    client = create_client(url, key)

    # Fetch signals from database (grouped by detection_timestamp for batching)
    logger.info(f"Fetching signals from last {days_back} days...")

    start_date = (datetime.now().date() - timedelta(days=days_back)).isoformat()

    query = (
        client.table("unusual_options_signals")
        .select("*")
        .gte("detection_timestamp", start_date)
        .order("detection_timestamp", desc=False)
    )

    if limit:
        query = query.limit(limit)

    result = query.execute()
    signals = result.data

    logger.info(f"Found {len(signals)} signals to analyze")

    if not signals:
        logger.warning("No signals found in database")
        return

    # Group signals by detection timestamp (scan batch)
    # Spreads can only be detected within same scan
    # Use wider 30-minute windows since signals may be stored minutes apart
    signals_by_scan = defaultdict(list)

    for signal in signals:
        # Group by day and 30-min window
        dt = datetime.fromisoformat(
            signal["detection_timestamp"].replace("Z", "+00:00")
        )
        # Round to nearest 30 minutes
        minute_bucket = (dt.minute // 30) * 30
        dt_rounded = dt.replace(minute=minute_bucket, second=0, microsecond=0)
        scan_key = dt_rounded.strftime("%Y-%m-%d-%H-%M")
        signals_by_scan[scan_key].append(signal)

    logger.info(f"Grouped into {len(signals_by_scan)} scan batches")

    # Initialize spread detector with conservative settings
    detector = SpreadDetector(
        {
            "MIN_SPREAD_CONFIDENCE": 0.80,  # Phase 1: High confidence only
            "MIN_VOLUME_CORRELATION": 0.80,
            "MIN_INDICATORS": 3,
        }
    )

    # Process each scan batch
    total_spreads_detected = 0
    total_high_conf = 0
    total_medium_conf = 0
    updates_to_make = []

    for scan_key, scan_signals in signals_by_scan.items():
        if len(scan_signals) < 2:
            continue  # Can't have spreads with only 1 signal

        logger.debug(f"Analyzing scan {scan_key} with {len(scan_signals)} signals")

        # Convert to Detection objects
        detections = [SimpleDetection(sig) for sig in scan_signals]

        # Run spread analysis
        analyses = detector.analyze_all_signals(detections)

        # Collect updates
        for detection in detections:
            symbol = detection.contract.symbol
            if symbol in analyses:
                analysis = analyses[symbol]

                # Only update if spread confidence >= 60%
                if analysis.spread_confidence >= 0.60:
                    total_spreads_detected += 1

                    if analysis.is_likely_spread:
                        total_high_conf += 1
                    else:
                        total_medium_conf += 1

                    update_data = {
                        "signal_id": detection.signal_id,
                        "is_likely_spread": analysis.is_likely_spread,
                        "spread_confidence": analysis.spread_confidence,
                        "spread_type": analysis.spread_type,
                        "matched_leg_symbols": analysis.matched_contracts,
                        "spread_strike_width": analysis.strike_width,
                        "spread_detection_reason": analysis.reasoning,
                        "spread_net_premium": analysis.net_premium,
                    }

                    updates_to_make.append(update_data)

    logger.info(
        f"\n{'=' * 60}\n"
        f"BACKFILL ANALYSIS COMPLETE\n"
        f"{'=' * 60}\n"
        f"Total signals analyzed: {len(signals)}\n"
        f"Spread patterns detected: {total_spreads_detected}\n"
        f"  - High confidence (≥80%): {total_high_conf}\n"
        f"  - Medium confidence (60-79%): {total_medium_conf}\n"
        f"Spread contamination rate: {total_spreads_detected / len(signals) * 100:.1f}%\n"
        f"{'=' * 60}"
    )

    if dry_run:
        logger.info("\n🔍 DRY RUN MODE - No database updates performed")

        # Show sample spreads
        logger.info("\nSample high-confidence spreads detected:")
        high_conf_samples = [u for u in updates_to_make if u.get("is_likely_spread")][
            :10
        ]

        for i, update in enumerate(high_conf_samples, 1):
            logger.info(
                f"{i}. {update.get('spread_type')} - "
                f"Confidence: {update.get('spread_confidence', 0):.0%} - "
                f"Reason: {update.get('spread_detection_reason')}"
            )

        return

    # Perform database updates
    if updates_to_make:
        logger.info(f"\nUpdating {len(updates_to_make)} signals in database...")

        # Update in batches
        batch_size = 50
        updated_count = 0

        for i in range(0, len(updates_to_make), batch_size):
            batch = updates_to_make[i : i + batch_size]

            for update in batch:
                signal_id = update.pop("signal_id")

                try:
                    client.table("unusual_options_signals").update(update).eq(
                        "signal_id", signal_id
                    ).execute()

                    updated_count += 1

                except Exception as e:
                    logger.error(f"Failed to update signal {signal_id}: {e}")

            logger.debug(f"Updated {updated_count}/{len(updates_to_make)} signals")

        logger.info(f"✅ Successfully updated {updated_count} signals")
    else:
        logger.info("No signals required updates")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Backfill spread detection for existing signals"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Analyze without updating database"
    )
    parser.add_argument(
        "--limit", type=int, help="Maximum number of signals to process (for testing)"
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=30,
        help="Number of days to look back (default: 30)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logger.remove()
        logger.add(sys.stderr, level="DEBUG")

    logger.info("Starting spread detection backfill...")

    # Run backfill
    asyncio.run(
        backfill_spread_detection(
            dry_run=args.dry_run, limit=args.limit, days_back=args.days_back
        )
    )

    logger.info("Backfill complete!")


if __name__ == "__main__":
    main()
