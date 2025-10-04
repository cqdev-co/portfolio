#!/usr/bin/env python3
"""
Cleanup script for meaningless trades in performance tracking.

This script removes trades with 0.0% return from the signal_performance table
to keep the performance dashboard clean and meaningful.

Usage:
    python scripts/cleanup_meaningless_trades.py [--dry-run]
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Add the src directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from volatility_scanner.services.database_service import DatabaseService
from volatility_scanner.services.performance_tracking_service import PerformanceTrackingService
from volatility_scanner.config.settings import Settings


async def cleanup_meaningless_trades(dry_run: bool = False) -> int:
    """
    Clean up meaningless trades (0.0% return) from performance tracking.
    
    Args:
        dry_run: If True, show what would be deleted without actually deleting
        
    Returns:
        Number of trades that were (or would be) deleted
    """
    try:
        settings = Settings()
        db = DatabaseService(settings)
        
        if not db.is_available():
            print("❌ Database service not available")
            return 0
        
        print("🧹 PERFORMANCE TRACKING CLEANUP")
        print("=" * 50)
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE CLEANUP'}")
        print()
        
        # Get all closed trades
        response = db.client.table('signal_performance').select(
            'id, symbol, return_pct, days_held, entry_price, exit_price, '
            'entry_date, exit_date, status'
        ).eq('status', 'CLOSED').execute()
        
        if not response.data:
            print("✅ No closed trades found")
            return 0
        
        # Identify meaningless trades
        meaningless_trades = []
        meaningful_trades = []
        
        for record in response.data:
            return_pct = record.get('return_pct', 0)
            
            if abs(return_pct) < 0.01:  # Less than 0.01% (essentially 0.0%)
                meaningless_trades.append(record)
            else:
                meaningful_trades.append(record)
        
        print(f"📊 ANALYSIS RESULTS:")
        print(f"  Total closed trades: {len(response.data)}")
        print(f"  Meaningful trades: {len(meaningful_trades)}")
        print(f"  Meaningless trades (0.0% return): {len(meaningless_trades)}")
        print()
        
        if not meaningless_trades:
            print("✅ No meaningless trades found - dashboard is already clean!")
            return 0
        
        # Show meaningless trades
        print("❌ MEANINGLESS TRADES TO REMOVE:")
        for record in meaningless_trades:
            symbol = record.get('symbol')
            entry_price = record.get('entry_price', 0)
            exit_price = record.get('exit_price', 0)
            return_pct = record.get('return_pct', 0)
            days_held = record.get('days_held', 0)
            entry_date = record.get('entry_date', 'Unknown')[:10]  # Just date part
            
            print(f"  • {symbol}: ${entry_price} → ${exit_price} "
                  f"({return_pct:+.2f}%) in {days_held}d [{entry_date}]")
        
        print()
        
        if dry_run:
            print(f"🔍 DRY RUN: Would remove {len(meaningless_trades)} meaningless trades")
            return len(meaningless_trades)
        
        # Actually delete meaningless trades
        print("🗑️  REMOVING MEANINGLESS TRADES...")
        deleted_count = 0
        
        for record in meaningless_trades:
            try:
                delete_response = db.client.table('signal_performance').delete().eq(
                    'id', record['id']
                ).execute()
                
                if delete_response.data:
                    deleted_count += 1
                    symbol = record.get('symbol')
                    print(f"    ✅ Deleted {symbol}")
                else:
                    symbol = record.get('symbol')
                    print(f"    ❌ Failed to delete {symbol}")
                    
            except Exception as e:
                symbol = record.get('symbol')
                print(f"    ❌ Error deleting {symbol}: {e}")
        
        print()
        print(f"✅ CLEANUP COMPLETE:")
        print(f"  Successfully deleted: {deleted_count}/{len(meaningless_trades)} trades")
        print(f"  Remaining meaningful trades: {len(meaningful_trades)}")
        
        if meaningful_trades:
            print()
            print("📈 SAMPLE MEANINGFUL TRADES:")
            for record in meaningful_trades[:5]:
                symbol = record.get('symbol')
                return_pct = record.get('return_pct', 0)
                days_held = record.get('days_held', 0)
                print(f"  • {symbol}: {return_pct:+.2f}% in {days_held}d")
        
        return deleted_count
        
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        return 0


def main():
    """Main entry point for the cleanup script."""
    parser = argparse.ArgumentParser(
        description="Clean up meaningless trades from performance tracking"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Show what would be deleted without actually deleting"
    )
    
    args = parser.parse_args()
    
    # Run the cleanup
    deleted_count = asyncio.run(cleanup_meaningless_trades(dry_run=args.dry_run))
    
    if args.dry_run:
        print(f"\n🔍 DRY RUN COMPLETE: {deleted_count} trades would be cleaned up")
    else:
        print(f"\n✅ CLEANUP COMPLETE: {deleted_count} meaningless trades removed")
    
    return 0 if deleted_count >= 0 else 1


if __name__ == "__main__":
    sys.exit(main())
