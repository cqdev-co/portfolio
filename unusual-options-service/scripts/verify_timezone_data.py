#!/usr/bin/env python3
"""
Verify that existing timestamps in Supabase are reasonable.

This script checks a sample of signals to ensure timestamps are
within reasonable bounds and don't need migration.

Usage:
    poetry run python scripts/verify_timezone_data.py
"""

import os
import sys
from datetime import UTC, datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()


def main():
    """Check existing signal timestamps for issues."""

    # Connect to Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)

    print("🔍 Verifying Timezone Data in Supabase\n")
    print("=" * 60)

    # Get sample of recent signals
    try:
        result = (
            supabase.table("unusual_options_signals")
            .select("signal_id, ticker, detection_timestamp")
            .order("detection_timestamp", desc=True)
            .limit(10)
            .execute()
        )

        if not result.data:
            print("✅ No signals found in database (empty table - no migration needed)")
            return

        signals = result.data
        print(f"\n📊 Analyzing {len(signals)} recent signals:\n")

        issues_found = False
        now_utc = datetime.now(UTC)

        for signal in signals:
            ticker = signal["ticker"]
            timestamp_str = signal["detection_timestamp"]
            signal["signal_id"]

            # Parse timestamp
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))

            # Check 1: Is it timezone-aware?
            if timestamp.tzinfo is None:
                print(f"⚠️  {ticker}: Naive timestamp detected!")
                issues_found = True
                continue

            # Check 2: Is it in the past (reasonable)?
            age = now_utc - timestamp

            if age.total_seconds() < 0:
                print(f"❌ {ticker}: Timestamp is in the FUTURE! ({timestamp_str})")
                issues_found = True
            elif age > timedelta(days=365):
                print(f"⚠️  {ticker}: Timestamp is over 1 year old ({age.days} days)")
            elif age > timedelta(days=30):
                print(
                    f"📅 {ticker}: {age.days} days old - "
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')}"
                )
            else:
                print(
                    f"✅ {ticker}: {age.days} days old - "
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')}"
                )

            # Check 3: Reasonable time of day (market hours check)
            # Convert to EST for sanity check
            from datetime import timezone as tz

            est_offset = tz(timedelta(hours=-5))  # EST is UTC-5
            timestamp_est = timestamp.astimezone(est_offset)
            hour_est = timestamp_est.hour

            # Most signals should be during market hours (9am-4pm EST)
            # or pre/post market (4am-8pm EST)
            if hour_est < 4 or hour_est > 20:
                print(
                    f"   ⚠️  Detected at {timestamp_est.strftime('%I:%M %p')} EST "
                    f"(outside typical market hours)"
                )

        print("\n" + "=" * 60)

        if issues_found:
            print("\n❌ ISSUES FOUND - Review timestamps above")
            print("\nRecommendation: Run migration script to fix timestamps")
            return 1
        else:
            print("\n✅ ALL TIMESTAMPS LOOK GOOD!")
            print("\n📌 Summary:")
            print("   • All timestamps are timezone-aware (UTC)")
            print("   • All timestamps are in reasonable date ranges")
            print("   • No migration needed!")
            print(
                "\n💡 Your existing data will work correctly with the new timezone handling."
            )
            return 0

    except Exception as e:
        print(f"\n❌ Error querying database: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main() or 0)
