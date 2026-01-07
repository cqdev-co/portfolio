"""
Expire signals that have reached their expiration date.

This script marks options signals as inactive when their expiry date
has passed. Should be run daily after market close (4:30 PM ET).
"""

import os
import sys
from pathlib import Path
from datetime import datetime, date, timezone
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Load .env file from repository root
try:
    from dotenv import load_dotenv

    # Try to find .env in repository root (2 levels up from scripts/)
    repo_root = Path(__file__).parent.parent.parent
    env_file = repo_root / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        logger.debug(f"Loaded .env from {env_file}")
    else:
        logger.debug(f".env not found at {env_file}, using system env vars")
except ImportError:
    logger.debug("python-dotenv not installed, using system env vars")

from unusual_options.storage.database import SupabaseStorage


def setup_logging():
    """Configure logging."""
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{message}</cyan>",
        level="INFO",
    )


def get_config() -> dict:
    """Get configuration from environment variables."""
    # Try both naming conventions (with and without NEXT_PUBLIC_ prefix)
    config = {
        "SUPABASE_URL": (
            os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        ),
        "SUPABASE_KEY": (
            os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ),
        "SUPABASE_SERVICE_KEY": (
            os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
        ),
    }

    # Validate required config
    if not config["SUPABASE_URL"]:
        raise ValueError(
            "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable not set"
        )

    if not config.get("SUPABASE_SERVICE_KEY") and not config.get("SUPABASE_KEY"):
        raise ValueError(
            "Either SUPABASE_SERVICE_KEY, "
            "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, "
            "SUPABASE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY "
            "environment variable must be set"
        )

    return config


def expire_signals(dry_run: bool = False) -> dict:
    """
    Expire signals that have passed their expiration date.

    Args:
        dry_run: If True, only report what would be expired
                 without making changes

    Returns:
        Dictionary with statistics about the expiration run
    """
    config = get_config()
    storage = SupabaseStorage(config)
    client = storage._get_client()

    today = date.today()
    logger.info(f"Checking for expired signals as of {today}")

    # Query signals that are active but have expired
    try:
        # Get all active signals with expiry <= today
        result = (
            client.table("unusual_options_signals")
            .select("signal_id, ticker, option_symbol, expiry, grade, overall_score")
            .eq("is_active", True)
            .lte("expiry", today.isoformat())
            .execute()
        )

        if not result.data:
            logger.info("No expired signals found")
            return {
                "success": True,
                "signals_found": 0,
                "signals_expired": 0,
                "dry_run": dry_run,
                "date": today.isoformat(),
            }

        expired_signals = result.data
        logger.info(f"Found {len(expired_signals)} expired signals")

        # Group by expiry date for reporting
        by_expiry = {}
        by_ticker = {}
        by_grade = {}

        for signal in expired_signals:
            expiry = signal["expiry"]
            ticker = signal["ticker"]
            grade = signal["grade"]

            by_expiry[expiry] = by_expiry.get(expiry, 0) + 1
            by_ticker[ticker] = by_ticker.get(ticker, 0) + 1
            by_grade[grade] = by_grade.get(grade, 0) + 1

        # Report statistics
        logger.info("\n" + "=" * 60)
        logger.info("EXPIRATION SUMMARY")
        logger.info("=" * 60)

        logger.info(f"\nBy Expiry Date:")
        for expiry in sorted(by_expiry.keys()):
            count = by_expiry[expiry]
            logger.info(f"  {expiry}: {count:,} signals")

        logger.info(f"\nBy Grade:")
        for grade in sorted(
            by_grade.keys(),
            key=lambda x: {"S": 6, "A": 5, "B": 4, "C": 3, "D": 2, "F": 1}.get(x, 0),
            reverse=True,
        ):
            count = by_grade[grade]
            logger.info(f"  Grade {grade}: {count:,} signals")

        logger.info(f"\nTop 10 Tickers:")
        top_tickers = sorted(by_ticker.items(), key=lambda x: x[1], reverse=True)[:10]
        for ticker, count in top_tickers:
            logger.info(f"  {ticker}: {count:,} signals")

        logger.info("=" * 60)

        # Expire the signals
        if not dry_run:
            logger.info(f"\nMarking {len(expired_signals)} signals as inactive...")

            # Update in batches
            batch_size = 500
            total_updated = 0

            signal_ids = [s["signal_id"] for s in expired_signals]

            for i in range(0, len(signal_ids), batch_size):
                batch = signal_ids[i : i + batch_size]

                update_result = (
                    client.table("unusual_options_signals")
                    .update({"is_active": False})
                    .in_("signal_id", batch)
                    .execute()
                )

                if update_result.data:
                    batch_count = len(update_result.data)
                    total_updated += batch_count
                    logger.debug(
                        f"Updated batch {i // batch_size + 1}: {batch_count} signals"
                    )

            logger.success(f"✓ Successfully expired {total_updated:,} signals")

            return {
                "success": True,
                "signals_found": len(expired_signals),
                "signals_expired": total_updated,
                "by_expiry": by_expiry,
                "by_ticker": by_ticker,
                "by_grade": by_grade,
                "dry_run": False,
                "date": today.isoformat(),
            }
        else:
            logger.info(
                f"\n[DRY RUN] Would have expired {len(expired_signals):,} signals"
            )
            return {
                "success": True,
                "signals_found": len(expired_signals),
                "signals_expired": 0,
                "by_expiry": by_expiry,
                "by_ticker": by_ticker,
                "by_grade": by_grade,
                "dry_run": True,
                "date": today.isoformat(),
            }

    except Exception as e:
        logger.error(f"Error expiring signals: {e}")
        raise


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Expire signals that have reached their expiration date"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be expired without making changes",
    )

    args = parser.parse_args()

    setup_logging()

    logger.info("=" * 60)
    logger.info("UNUSUAL OPTIONS SIGNAL EXPIRATION")
    logger.info("=" * 60)

    if args.dry_run:
        logger.warning("Running in DRY RUN mode - no changes will be made")

    try:
        stats = expire_signals(dry_run=args.dry_run)

        logger.info("\nRun completed successfully")
        logger.info(f"Date: {stats['date']}")
        logger.info(f"Signals found: {stats['signals_found']:,}")
        logger.info(f"Signals expired: {stats['signals_expired']:,}")
        logger.info(f"Dry run: {stats['dry_run']}")

    except Exception as e:
        logger.error(f"Failed to expire signals: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
