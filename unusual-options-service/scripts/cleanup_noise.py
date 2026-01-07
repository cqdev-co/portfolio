"""
Clean up noisy signals that don't meet quality thresholds.

This script marks low-quality signals as inactive based on:
1. Short DTE (< 7 days at detection)
2. Low premium for normal tickers (< $500K)
3. Low premium for high-volume tickers (< $3M)

Should be run once to clean historical data, then new scans will
apply these filters automatically.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, date, timezone
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Load .env file
try:
    from dotenv import load_dotenv

    repo_root = Path(__file__).parent.parent.parent
    env_file = repo_root / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    # Also try service-specific .env
    service_env = Path(__file__).parent.parent / ".env"
    if service_env.exists():
        load_dotenv(service_env)
except ImportError:
    pass

from supabase import create_client

# High-volume tickers requiring higher premium threshold
HIGH_VOLUME_TICKERS = {
    "TSLA",
    "NVDA",
    "META",
    "SPY",
    "QQQ",
    "AMD",
    "AAPL",
    "AMZN",
    "GOOGL",
    "MSFT",
    "PLTR",
    "AVGO",
    "IWM",
    "XLF",
    "GLD",
    "SLV",
    "COIN",
    "MSTR",
    "HOOD",
    "SOFI",
    "NIO",
    "BABA",
    "INTC",
    "MU",
}

# Thresholds
MIN_DTE = 7
PREMIUM_THRESHOLD_HIGH_VOL = 3_000_000
PREMIUM_THRESHOLD_NORMAL = 500_000


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


def get_client():
    """Get Supabase client."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise ValueError("Supabase URL and key must be set")

    return create_client(url, key)


def cleanup_noise(dry_run: bool = False, hard_delete: bool = False) -> dict:
    """
    Clean up noisy signals that don't meet quality thresholds.

    Args:
        dry_run: If True, only report what would be cleaned
        hard_delete: If True, permanently delete instead of soft delete

    Returns:
        Dictionary with cleanup statistics
    """
    client = get_client()

    logger.info("Fetching all active signals...")

    # Fetch all signals in batches
    all_signals = []
    batch_size = 1000
    offset = 0

    while True:
        result = (
            client.table("unusual_options_signals")
            .select("signal_id, ticker, days_to_expiry, premium_flow, grade")
            .eq("is_active", True)
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        if not result.data:
            break
        all_signals.extend(result.data)
        offset += batch_size

        if len(result.data) < batch_size:
            break

    logger.info(f"Found {len(all_signals):,} active signals")

    # Identify noisy signals
    noise_dte = []  # Short DTE
    noise_premium_high_vol = []  # Low premium on high-vol tickers
    noise_premium_normal = []  # Low premium on normal tickers

    for signal in all_signals:
        signal_id = signal["signal_id"]
        ticker = signal.get("ticker", "")
        dte = signal.get("days_to_expiry") or 0
        premium = signal.get("premium_flow") or 0
        is_high_vol = ticker in HIGH_VOLUME_TICKERS

        # Check DTE
        if dte < MIN_DTE:
            noise_dte.append(signal_id)
            continue

        # Check premium threshold
        if is_high_vol and premium < PREMIUM_THRESHOLD_HIGH_VOL:
            noise_premium_high_vol.append(signal_id)
        elif not is_high_vol and premium < PREMIUM_THRESHOLD_NORMAL:
            noise_premium_normal.append(signal_id)

    # Combine all noise signal IDs
    all_noise = set(noise_dte + noise_premium_high_vol + noise_premium_normal)

    logger.info("\n" + "=" * 60)
    logger.info("NOISE CLEANUP SUMMARY")
    logger.info("=" * 60)
    logger.info(f"\nTotal active signals:     {len(all_signals):,}")
    logger.info(f"Signals to clean up:      {len(all_noise):,}")
    logger.info(f"Signals to keep:          {len(all_signals) - len(all_noise):,}")
    logger.info(f"\nBreakdown:")
    logger.info(f"  - Short DTE (<{MIN_DTE} days):           {len(noise_dte):,}")
    logger.info(f"  - Low premium high-vol (<$3M):   {len(noise_premium_high_vol):,}")
    logger.info(f"  - Low premium normal (<$500K):   {len(noise_premium_normal):,}")
    logger.info("=" * 60)

    if not all_noise:
        logger.info("No noisy signals found - database is clean!")
        return {
            "success": True,
            "signals_found": 0,
            "signals_cleaned": 0,
            "dry_run": dry_run,
        }

    # Perform cleanup
    if not dry_run:
        action = "Deleting" if hard_delete else "Marking as inactive"
        logger.info(f"\n{action} {len(all_noise):,} noisy signals...")

        signal_ids = list(all_noise)
        batch_size = 500
        total_cleaned = 0

        for i in range(0, len(signal_ids), batch_size):
            batch = signal_ids[i : i + batch_size]

            if hard_delete:
                result = (
                    client.table("unusual_options_signals")
                    .delete()
                    .in_("signal_id", batch)
                    .execute()
                )
            else:
                result = (
                    client.table("unusual_options_signals")
                    .update({"is_active": False})
                    .in_("signal_id", batch)
                    .execute()
                )

            if result.data:
                total_cleaned += len(result.data)

            # Progress update
            progress = min(i + batch_size, len(signal_ids))
            logger.debug(f"Progress: {progress:,}/{len(signal_ids):,}")

        action_past = "deleted" if hard_delete else "marked inactive"
        logger.success(f"\n✓ Successfully {action_past} {total_cleaned:,} signals")

        return {
            "success": True,
            "signals_found": len(all_noise),
            "signals_cleaned": total_cleaned,
            "breakdown": {
                "short_dte": len(noise_dte),
                "low_premium_high_vol": len(noise_premium_high_vol),
                "low_premium_normal": len(noise_premium_normal),
            },
            "dry_run": False,
            "hard_delete": hard_delete,
        }
    else:
        logger.info(f"\n[DRY RUN] Would clean up {len(all_noise):,} signals")
        return {
            "success": True,
            "signals_found": len(all_noise),
            "signals_cleaned": 0,
            "breakdown": {
                "short_dte": len(noise_dte),
                "low_premium_high_vol": len(noise_premium_high_vol),
                "low_premium_normal": len(noise_premium_normal),
            },
            "dry_run": True,
        }


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Clean up noisy signals that don't meet quality thresholds"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be cleaned without making changes",
    )
    parser.add_argument(
        "--hard-delete",
        action="store_true",
        help="Permanently delete signals instead of marking inactive",
    )

    args = parser.parse_args()

    setup_logging()

    logger.info("=" * 60)
    logger.info("UNUSUAL OPTIONS NOISE CLEANUP")
    logger.info("=" * 60)
    logger.info(f"\nThresholds:")
    logger.info(f"  - Minimum DTE: {MIN_DTE} days")
    logger.info(f"  - Min premium (normal): ${PREMIUM_THRESHOLD_NORMAL:,}")
    logger.info(f"  - Min premium (high-vol): ${PREMIUM_THRESHOLD_HIGH_VOL:,}")
    logger.info(f"  - High-vol tickers: {len(HIGH_VOLUME_TICKERS)}")

    if args.dry_run:
        logger.warning("\nRunning in DRY RUN mode - no changes will be made")

    if args.hard_delete and not args.dry_run:
        logger.warning("\n⚠️  HARD DELETE mode - signals will be permanently removed!")
        response = input("Are you sure? (yes/no): ")
        if response.lower() != "yes":
            logger.info("Aborted.")
            return

    try:
        stats = cleanup_noise(dry_run=args.dry_run, hard_delete=args.hard_delete)

        logger.info("\n" + "=" * 60)
        logger.info("RUN COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Signals found: {stats['signals_found']:,}")
        logger.info(f"Signals cleaned: {stats['signals_cleaned']:,}")
        logger.info(f"Dry run: {stats['dry_run']}")

    except Exception as e:
        logger.error(f"Failed to clean up signals: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
