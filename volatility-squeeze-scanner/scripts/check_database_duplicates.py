#!/usr/bin/env python3
"""
Script to check for actual duplicates in the database.
This connects directly to the database to see the current state.
"""

import asyncio
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any
from pathlib import Path
import sys
from collections import defaultdict

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Try to load environment variables from .env.local if it exists
env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)
    print(f"Loaded environment from {env_file}")

# Check if we have the required environment variables
required_vars = ['SUPABASE_URL', 'SUPABASE_KEY']
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    print(f"❌ Missing required environment variables: {missing_vars}")
    print("Please set these environment variables or create a .env.local file")
    print("Example .env.local content:")
    print("SUPABASE_URL=https://your-project.supabase.co")
    print("SUPABASE_KEY=your-anon-key")
    print("DEBUG=false")
    sys.exit(1)

try:
    from supabase import create_client
    from loguru import logger
except ImportError as e:
    print(f"Import error: {e}")
    print("Please install required packages: pip install supabase loguru")
    sys.exit(1)

class DatabaseDuplicateChecker:
    """Checks for actual duplicates in the database."""
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        
        self.client = create_client(self.supabase_url, self.supabase_key)
        print(f"Connected to Supabase: {self.supabase_url}")
    
    async def check_duplicates(self, days_back: int = 7) -> Dict[str, Any]:
        """Check for duplicate signals in the database."""
        print(f"🔍 Checking for duplicates in the last {days_back} days...")
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        
        try:
            # Get all signals in the date range
            response = self.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, signal_status, days_in_squeeze, '
                'first_detected_date, last_active_date, created_at, updated_at'
            ).gte(
                'scan_date', start_date.isoformat()
            ).lte(
                'scan_date', end_date.isoformat()
            ).order('symbol').order('scan_date').execute()
            
            if not response.data:
                print("No signals found in the specified date range")
                return {}
            
            signals = response.data
            print(f"Found {len(signals)} signals in database")
            
            # Group by symbol and scan_date to find duplicates
            symbol_date_groups = defaultdict(list)
            for signal in signals:
                key = (signal['symbol'], signal['scan_date'])
                symbol_date_groups[key].append(signal)
            
            # Find duplicates
            duplicates = {k: v for k, v in symbol_date_groups.items() if len(v) > 1}
            
            print(f"\n📊 DUPLICATE ANALYSIS")
            print(f"Total unique symbol-date combinations: {len(symbol_date_groups)}")
            print(f"Duplicate combinations found: {len(duplicates)}")
            
            if duplicates:
                print(f"\n🚨 DUPLICATES FOUND:")
                for (symbol, scan_date), duplicate_signals in duplicates.items():
                    print(f"\n{symbol} on {scan_date}: {len(duplicate_signals)} duplicates")
                    for i, signal in enumerate(duplicate_signals):
                        created = signal.get('created_at', 'N/A')
                        updated = signal.get('updated_at', 'N/A')
                        status = signal.get('signal_status', 'N/A')
                        days = signal.get('days_in_squeeze', 'N/A')
                        print(f"  {i+1}. ID: {signal['id'][:8]}...")
                        print(f"     Status: {status}, Days: {days}")
                        print(f"     Created: {created}")
                        print(f"     Updated: {updated}")
            else:
                print("✅ No duplicates found!")
            
            # Specific KLG analysis
            klg_signals = [s for s in signals if s['symbol'] == 'KLG']
            if klg_signals:
                print(f"\n🎯 KLG SPECIFIC ANALYSIS")
                print(f"Total KLG signals: {len(klg_signals)}")
                
                klg_by_date = defaultdict(list)
                for signal in klg_signals:
                    klg_by_date[signal['scan_date']].append(signal)
                
                for scan_date, date_signals in sorted(klg_by_date.items()):
                    print(f"\nKLG on {scan_date}: {len(date_signals)} signal(s)")
                    if len(date_signals) > 1:
                        print("  🚨 DUPLICATE DETECTED!")
                    
                    for signal in date_signals:
                        print(f"  - ID: {signal['id'][:8]}...")
                        print(f"    Status: {signal.get('signal_status')}")
                        print(f"    Days: {signal.get('days_in_squeeze')}")
                        print(f"    Created: {signal.get('created_at')}")
                        print(f"    Updated: {signal.get('updated_at')}")
            
            return {
                'total_signals': len(signals),
                'total_combinations': len(symbol_date_groups),
                'duplicate_combinations': len(duplicates),
                'duplicates': duplicates,
                'klg_signals': klg_signals
            }
            
        except Exception as e:
            print(f"❌ Error checking duplicates: {e}")
            return {}
    
    async def fix_duplicates(self, duplicates: Dict, dry_run: bool = True) -> Dict[str, Any]:
        """Fix duplicate signals by keeping the most recent one."""
        print(f"\n{'🔧 FIXING' if not dry_run else '🔍 DRY RUN:'} Duplicate Signals")
        print("=" * 50)
        
        fixes_applied = 0
        
        for (symbol, scan_date), duplicate_signals in duplicates.items():
            if len(duplicate_signals) <= 1:
                continue
            
            # Sort by updated_at to keep the most recent
            duplicate_signals.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
            
            # Keep the first (most recent), delete the rest
            to_keep = duplicate_signals[0]
            to_delete = duplicate_signals[1:]
            
            print(f"\n{symbol} on {scan_date}:")
            print(f"  Keeping: {to_keep['id'][:8]}... (updated: {to_keep.get('updated_at')})")
            print(f"  Deleting: {len(to_delete)} duplicate(s)")
            
            for signal in to_delete:
                try:
                    if not dry_run:
                        delete_response = self.client.table('volatility_squeeze_signals').delete().eq(
                            'id', signal['id']
                        ).execute()
                        
                        if delete_response.data:
                            print(f"    ✅ Deleted {signal['id'][:8]}...")
                            fixes_applied += 1
                        else:
                            print(f"    ❌ Failed to delete {signal['id'][:8]}...")
                    else:
                        print(f"    🔍 Would delete {signal['id'][:8]}... (created: {signal.get('created_at')})")
                        fixes_applied += 1
                        
                except Exception as e:
                    print(f"    ❌ Error deleting {signal['id'][:8]}...: {e}")
        
        print(f"\n{'Applied' if not dry_run else 'Would apply'} {fixes_applied} deletions")
        
        return {'fixes_applied': fixes_applied}
    
    async def run_duplicate_check(self, fix_duplicates: bool = False, dry_run: bool = True) -> Dict[str, Any]:
        """Run the complete duplicate check and fix process."""
        print("🚀 Starting Database Duplicate Check")
        print("=" * 50)
        
        # Step 1: Check for duplicates
        analysis = await self.check_duplicates()
        
        if analysis.get('duplicate_combinations', 0) == 0:
            print("✅ No duplicates found in database!")
            return analysis
        
        # Step 2: Fix duplicates if requested
        if fix_duplicates:
            fix_results = await self.fix_duplicates(analysis.get('duplicates', {}), dry_run)
            analysis['fixes'] = fix_results
        
        return analysis

async def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Check for database duplicates")
    parser.add_argument("--fix", action="store_true", 
                       help="Fix duplicates by deleting older ones")
    parser.add_argument("--apply-fixes", action="store_true", 
                       help="Actually apply the fixes (not dry-run)")
    parser.add_argument("--days-back", type=int, default=7,
                       help="Number of days back to check (default: 7)")
    
    args = parser.parse_args()
    
    # Determine if we should actually apply fixes
    dry_run = not args.apply_fixes
    
    if args.fix and not dry_run:
        print("⚠️  WARNING: This will delete duplicate records from the database!")
        response = input("Are you sure you want to apply fixes? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            return
    
    checker = DatabaseDuplicateChecker()
    
    try:
        results = await checker.run_duplicate_check(fix_duplicates=args.fix, dry_run=dry_run)
        
        # Save results
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = Path("exports") / f"database_duplicate_check_{timestamp}.json"
        
        import json
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Error during duplicate check: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
