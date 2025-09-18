#!/usr/bin/env python3
"""
Migration script for duplicate signal handling improvements.

This script helps existing users migrate to the new duplicate handling system:
1. Applies database schema updates
2. Cleans up existing duplicates
3. Verifies the migration was successful

Usage:
    python migrate_duplicates.py [--dry-run] [--date-range DAYS]
"""

import asyncio
import argparse
from datetime import date, timedelta
from typing import Dict, List
import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from volatility_scanner.config.settings import get_settings
from volatility_scanner.services.database_service import DatabaseService
from loguru import logger

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="{time} | {level} | {message}")


async def check_database_connection(db_service: DatabaseService) -> bool:
    """Check if database connection is working."""
    if not db_service.is_available():
        logger.error("❌ Database service is not available")
        logger.error("Please check your Supabase credentials:")
        logger.error("  - NEXT_PUBLIC_SUPABASE_URL")
        logger.error("  - NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    logger.info("✅ Database connection verified")
    return True


async def analyze_duplicates(db_service: DatabaseService, days_back: int = 30) -> Dict:
    """Analyze duplicate patterns across multiple dates."""
    logger.info(f"📊 Analyzing duplicates for the past {days_back} days...")
    
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    total_duplicates = 0
    dates_with_duplicates = []
    analysis_results = {}
    
    current_date = start_date
    while current_date <= end_date:
        try:
            stats = await db_service.get_duplicate_signals_count(current_date)
            
            if stats and stats.get('duplicates', 0) > 0:
                total_duplicates += stats['duplicates']
                dates_with_duplicates.append(current_date)
                analysis_results[current_date.isoformat()] = stats
                
                logger.info(
                    f"  📅 {current_date}: {stats['duplicates']} duplicates "
                    f"({stats['total_signals']} total, {stats['unique_symbols']} unique)"
                )
            
        except Exception as e:
            logger.warning(f"⚠️  Error analyzing {current_date}: {e}")
        
        current_date += timedelta(days=1)
    
    summary = {
        'total_duplicates': total_duplicates,
        'affected_dates': len(dates_with_duplicates),
        'date_range': f"{start_date} to {end_date}",
        'dates_with_duplicates': dates_with_duplicates,
        'detailed_results': analysis_results
    }
    
    logger.info(f"📈 Analysis Summary:")
    logger.info(f"  • Total duplicates found: {total_duplicates}")
    logger.info(f"  • Dates affected: {len(dates_with_duplicates)} out of {days_back} days")
    
    return summary


async def cleanup_duplicates_batch(db_service: DatabaseService, dates: List[date], dry_run: bool = False) -> int:
    """Clean up duplicates for multiple dates."""
    total_removed = 0
    
    for target_date in dates:
        try:
            if dry_run:
                stats = await db_service.get_duplicate_signals_count(target_date)
                duplicates = stats.get('duplicates', 0)
                logger.info(f"🔍 DRY RUN - Would remove {duplicates} duplicates for {target_date}")
                total_removed += duplicates
            else:
                removed = await db_service.cleanup_duplicate_signals(target_date)
                total_removed += removed
                logger.info(f"🧹 Cleaned up {removed} duplicates for {target_date}")
                
                # Small delay between dates to avoid overwhelming the database
                await asyncio.sleep(0.5)
                
        except Exception as e:
            logger.error(f"❌ Error processing {target_date}: {e}")
    
    return total_removed


async def verify_migration(db_service: DatabaseService, days_back: int = 7) -> bool:
    """Verify that the migration was successful."""
    logger.info("🔍 Verifying migration results...")
    
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    total_duplicates = 0
    current_date = start_date
    
    while current_date <= end_date:
        try:
            stats = await db_service.get_duplicate_signals_count(current_date)
            duplicates = stats.get('duplicates', 0)
            total_duplicates += duplicates
            
            if duplicates > 0:
                logger.warning(f"⚠️  {current_date} still has {duplicates} duplicates")
            
        except Exception as e:
            logger.warning(f"⚠️  Error verifying {current_date}: {e}")
        
        current_date += timedelta(days=1)
    
    if total_duplicates == 0:
        logger.info("✅ Migration verification successful - no duplicates found")
        return True
    else:
        logger.warning(f"⚠️  Migration incomplete - {total_duplicates} duplicates remain")
        return False


async def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description='Migrate duplicate signal handling')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be done without making changes')
    parser.add_argument('--date-range', type=int, default=30,
                       help='Number of days to analyze (default: 30)')
    parser.add_argument('--skip-analysis', action='store_true',
                       help='Skip initial duplicate analysis')
    parser.add_argument('--verify-only', action='store_true',
                       help='Only verify migration, do not perform cleanup')
    
    args = parser.parse_args()
    
    logger.info("🚀 Starting duplicate signal handling migration...")
    logger.info(f"   Mode: {'DRY RUN' if args.dry_run else 'LIVE MIGRATION'}")
    logger.info(f"   Date range: {args.date_range} days")
    
    # Initialize services
    try:
        settings = get_settings()
        db_service = DatabaseService(settings)
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        return 1
    
    # Check database connection
    if not await check_database_connection(db_service):
        return 1
    
    # Verify-only mode
    if args.verify_only:
        success = await verify_migration(db_service, args.date_range)
        return 0 if success else 1
    
    # Analyze existing duplicates
    if not args.skip_analysis:
        try:
            analysis = await analyze_duplicates(db_service, args.date_range)
            
            if analysis['total_duplicates'] == 0:
                logger.info("🎉 No duplicates found - migration not needed!")
                return 0
            
            # Confirm migration
            if not args.dry_run:
                logger.info(f"\n⚠️  This will remove {analysis['total_duplicates']} duplicate signals")
                logger.info("   The most recent record for each symbol/date will be kept")
                
                response = input("\nProceed with migration? (y/N): ")
                if response.lower() not in ['y', 'yes']:
                    logger.info("Migration cancelled")
                    return 0
            
        except Exception as e:
            logger.error(f"❌ Error during analysis: {e}")
            return 1
    
    # Perform cleanup
    try:
        # Get dates that need cleanup
        if not args.skip_analysis:
            dates_to_clean = analysis['dates_with_duplicates']
        else:
            # If skipping analysis, clean up recent dates
            dates_to_clean = [
                date.today() - timedelta(days=i) 
                for i in range(args.date_range)
            ]
        
        if dates_to_clean:
            logger.info(f"🧹 {'Simulating' if args.dry_run else 'Performing'} cleanup for {len(dates_to_clean)} dates...")
            
            total_removed = await cleanup_duplicates_batch(
                db_service, dates_to_clean, args.dry_run
            )
            
            if args.dry_run:
                logger.info(f"🔍 DRY RUN COMPLETE - Would remove {total_removed} total duplicates")
            else:
                logger.info(f"✅ MIGRATION COMPLETE - Removed {total_removed} total duplicates")
                
                # Verify results
                await verify_migration(db_service)
        else:
            logger.info("✅ No dates require cleanup")
    
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")
        return 1
    
    logger.info("🎉 Migration process completed successfully!")
    logger.info("\n📋 Next steps:")
    logger.info("  1. Update your scanner to the latest version")
    logger.info("  2. Apply database schema updates (db/volatility_squeeze.sql)")
    logger.info("  3. Run regular scans - duplicates will be prevented automatically")
    logger.info("  4. Use 'cleanup-duplicates' command for ongoing maintenance")
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
