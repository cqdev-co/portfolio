#!/usr/bin/env python3
"""
Script to clean up incorrect days_in_squeeze values in the database.
This script will recalculate days_in_squeeze based on first_detected_date.
"""

import asyncio
import os
from datetime import datetime, date
from typing import Dict, List, Any
from pathlib import Path
import sys

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Set environment variables for the database connection
os.environ['SUPABASE_URL'] = 'https://your-project.supabase.co'  # Replace with actual URL
os.environ['SUPABASE_KEY'] = 'your-anon-key'  # Replace with actual key
os.environ['DEBUG'] = 'false'

try:
    from volatility_scanner.services.database_service import DatabaseService
    from volatility_scanner.config.settings import Settings
except ImportError as e:
    print(f"Import error: {e}")
    print("This script needs to be run with proper environment variables set.")
    print("Please set SUPABASE_URL and SUPABASE_KEY environment variables.")
    sys.exit(1)

class DatabaseCleanup:
    """Cleans up incorrect days_in_squeeze values in the database."""
    
    def __init__(self):
        try:
            self.settings = Settings()
            self.database_service = DatabaseService(self.settings)
        except Exception as e:
            print(f"Failed to initialize database service: {e}")
            print("Make sure environment variables are set correctly.")
            sys.exit(1)
    
    async def analyze_database_issues(self) -> Dict[str, Any]:
        """Analyze issues in the database."""
        print("🔍 Analyzing database for continuity issues...")
        
        if not self.database_service.is_available():
            print("❌ Database service not available")
            return {}
        
        try:
            # Get all signals ordered by symbol and scan_date
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, signal_status, days_in_squeeze, '
                'first_detected_date, last_active_date, created_at'
            ).order('symbol').order('scan_date').execute()
            
            if not response.data:
                print("No signals found in database")
                return {}
            
            signals = response.data
            print(f"Found {len(signals)} signals in database")
            
            # Group by symbol
            signals_by_symbol = {}
            for signal in signals:
                symbol = signal['symbol']
                if symbol not in signals_by_symbol:
                    signals_by_symbol[symbol] = []
                signals_by_symbol[symbol].append(signal)
            
            issues = []
            
            # Analyze each symbol
            for symbol, symbol_signals in signals_by_symbol.items():
                symbol_issues = self._analyze_symbol_issues(symbol, symbol_signals)
                issues.extend(symbol_issues)
            
            print(f"Found {len(issues)} issues across {len(signals_by_symbol)} symbols")
            
            return {
                'total_signals': len(signals),
                'total_symbols': len(signals_by_symbol),
                'total_issues': len(issues),
                'issues': issues
            }
            
        except Exception as e:
            print(f"❌ Error analyzing database: {e}")
            return {}
    
    def _analyze_symbol_issues(self, symbol: str, signals: List[Dict]) -> List[Dict]:
        """Analyze issues for a specific symbol."""
        issues = []
        
        for i, signal in enumerate(signals):
            # Check first signal status
            if i == 0 and signal['signal_status'] != 'NEW':
                issues.append({
                    'type': 'first_signal_not_new',
                    'symbol': symbol,
                    'signal_id': signal['id'],
                    'scan_date': signal['scan_date'],
                    'current_status': signal['signal_status'],
                    'fix': {'signal_status': 'NEW', 'days_in_squeeze': 1}
                })
            
            # Check days_in_squeeze calculation
            first_detected = signal.get('first_detected_date')
            scan_date = signal['scan_date']
            actual_days = signal.get('days_in_squeeze', 1)
            
            if first_detected:
                # Calculate expected days based on first_detected_date
                if isinstance(first_detected, str):
                    first_detected_date = datetime.fromisoformat(first_detected).date()
                else:
                    first_detected_date = first_detected
                
                if isinstance(scan_date, str):
                    scan_date_obj = datetime.fromisoformat(scan_date).date()
                else:
                    scan_date_obj = scan_date
                
                expected_days = (scan_date_obj - first_detected_date).days + 1
                
                if actual_days != expected_days:
                    issues.append({
                        'type': 'incorrect_days_in_squeeze',
                        'symbol': symbol,
                        'signal_id': signal['id'],
                        'scan_date': signal['scan_date'],
                        'actual_days': actual_days,
                        'expected_days': expected_days,
                        'first_detected': first_detected,
                        'fix': {'days_in_squeeze': expected_days}
                    })
        
        return issues
    
    async def fix_database_issues(self, issues: List[Dict], dry_run: bool = True) -> Dict[str, Any]:
        """Fix the identified database issues."""
        print(f"\n{'🔧 FIXING' if not dry_run else '🔍 DRY RUN:'} Database Issues")
        print("=" * 50)
        
        if not self.database_service.is_available():
            print("❌ Database service not available")
            return {}
        
        fixes_applied = 0
        
        for issue in issues:
            try:
                signal_id = issue['signal_id']
                symbol = issue['symbol']
                fix_data = issue['fix']
                
                if not dry_run:
                    # Apply the fix
                    fix_data['updated_at'] = datetime.now().isoformat()
                    
                    response = self.database_service.client.table('volatility_squeeze_signals').update(
                        fix_data
                    ).eq('id', signal_id).execute()
                    
                    if response.data:
                        print(f"  ✅ Fixed {symbol}: {issue['type']}")
                        fixes_applied += 1
                    else:
                        print(f"  ❌ Failed to fix {symbol}: {issue['type']}")
                else:
                    print(f"  🔍 Would fix {symbol}: {issue['type']} - {fix_data}")
                    fixes_applied += 1
                    
            except Exception as e:
                print(f"  ❌ Error fixing {issue['symbol']}: {e}")
        
        print(f"\n{'Applied' if not dry_run else 'Would apply'} {fixes_applied} fixes")
        
        return {'fixes_applied': fixes_applied}
    
    async def run_cleanup(self, dry_run: bool = True) -> Dict[str, Any]:
        """Run the complete database cleanup process."""
        print("🚀 Starting Database Cleanup Process")
        print("=" * 50)
        
        # Step 1: Analyze issues
        analysis = await self.analyze_database_issues()
        
        if analysis.get('total_issues', 0) == 0:
            print("✅ No database issues found!")
            return analysis
        
        # Step 2: Fix issues
        fix_results = await self.fix_database_issues(analysis.get('issues', []), dry_run)
        
        return {
            'analysis': analysis,
            'fixes': fix_results
        }

async def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Clean up database continuity issues")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Run in dry-run mode (default: True)")
    parser.add_argument("--apply-fixes", action="store_true", 
                       help="Actually apply the fixes (overrides --dry-run)")
    
    args = parser.parse_args()
    
    # Determine if we should actually apply fixes
    dry_run = not args.apply_fixes
    
    if not dry_run:
        print("⚠️  WARNING: This will modify the database!")
        response = input("Are you sure you want to apply fixes? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            return
    
    cleanup = DatabaseCleanup()
    
    try:
        results = await cleanup.run_cleanup(dry_run=dry_run)
        print(f"\n✅ Cleanup process completed")
        
    except Exception as e:
        print(f"❌ Error during cleanup process: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
