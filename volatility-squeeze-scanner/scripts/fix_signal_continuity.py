#!/usr/bin/env python3
"""
Script to fix signal continuity issues in the volatility squeeze scanner.
Identifies and corrects problematic signal status transitions.
"""

import json
import asyncio
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from volatility_scanner.services.database_service import DatabaseService
from volatility_scanner.config.settings import Settings

class SignalContinuityFixer:
    """Fixes signal continuity issues in the database."""
    
    def __init__(self):
        self.settings = Settings()
        self.database_service = DatabaseService(self.settings)
        
    async def analyze_continuity_issues(self, days_back: int = 30) -> Dict[str, Any]:
        """Analyze signal continuity issues in the database."""
        print("🔍 Analyzing signal continuity issues...")
        
        if not self.database_service.is_available():
            print("❌ Database service not available")
            return {}
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        
        try:
            # Get all signals in the date range
            response = self.database_service.client.table('volatility_squeeze_signals').select(
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
            print(f"Found {len(signals)} signals to analyze")
            
            # Group signals by symbol
            signals_by_symbol = {}
            for signal in signals:
                symbol = signal['symbol']
                if symbol not in signals_by_symbol:
                    signals_by_symbol[symbol] = []
                signals_by_symbol[symbol].append(signal)
            
            # Sort each symbol's signals by scan_date
            for symbol in signals_by_symbol:
                signals_by_symbol[symbol].sort(key=lambda x: x['scan_date'])
            
            issues = []
            
            # Analyze each symbol's signal sequence
            for symbol, symbol_signals in signals_by_symbol.items():
                symbol_issues = self._analyze_symbol_continuity(symbol, symbol_signals)
                issues.extend(symbol_issues)
            
            print(f"Found {len(issues)} continuity issues")
            
            # Categorize issues
            issue_types = {}
            for issue in issues:
                issue_type = issue['type']
                if issue_type not in issue_types:
                    issue_types[issue_type] = []
                issue_types[issue_type].append(issue)
            
            print("\nIssue breakdown:")
            for issue_type, type_issues in issue_types.items():
                print(f"  {issue_type}: {len(type_issues)} issues")
            
            return {
                'total_signals': len(signals),
                'total_issues': len(issues),
                'issue_types': issue_types,
                'signals_by_symbol': signals_by_symbol
            }
            
        except Exception as e:
            print(f"❌ Error analyzing continuity issues: {e}")
            return {}
    
    def _analyze_symbol_continuity(self, symbol: str, signals: List[Dict]) -> List[Dict]:
        """Analyze continuity issues for a specific symbol."""
        issues = []
        
        if not signals:
            return issues
        
        # Check first signal
        first_signal = signals[0]
        if first_signal['signal_status'] != 'NEW':
            issues.append({
                'type': 'first_signal_not_new',
                'symbol': symbol,
                'signal_id': first_signal['id'],
                'scan_date': first_signal['scan_date'],
                'current_status': first_signal['signal_status'],
                'expected_status': 'NEW',
                'description': f"First signal for {symbol} has status '{first_signal['signal_status']}' instead of 'NEW'"
            })
        
        # Check days_in_squeeze progression
        for i in range(len(signals)):
            signal = signals[i]
            
            # Check if days_in_squeeze makes sense
            expected_days = i + 1  # Simple expectation: should increase by 1 each day
            actual_days = signal.get('days_in_squeeze', 1)
            
            # Allow some flexibility for gaps (weekends, etc.)
            if i > 0:
                prev_signal = signals[i-1]
                prev_date = datetime.fromisoformat(prev_signal['scan_date']).date()
                curr_date = datetime.fromisoformat(signal['scan_date']).date()
                days_gap = (curr_date - prev_date).days
                
                # Expected days should account for the gap
                expected_days = prev_signal.get('days_in_squeeze', 1) + days_gap
            
            # Check for unreasonable days_in_squeeze values
            if actual_days > expected_days + 5:  # Allow some tolerance
                issues.append({
                    'type': 'days_in_squeeze_too_high',
                    'symbol': symbol,
                    'signal_id': signal['id'],
                    'scan_date': signal['scan_date'],
                    'actual_days': actual_days,
                    'expected_days': expected_days,
                    'description': f"Days in squeeze ({actual_days}) seems too high for {symbol} on {signal['scan_date']}"
                })
            
            # Check status transitions
            if i > 0:
                prev_signal = signals[i-1]
                prev_status = prev_signal['signal_status']
                curr_status = signal['signal_status']
                
                # Invalid transitions
                if prev_status == 'ENDED' and curr_status in ['NEW', 'CONTINUING']:
                    issues.append({
                        'type': 'invalid_status_transition',
                        'symbol': symbol,
                        'signal_id': signal['id'],
                        'scan_date': signal['scan_date'],
                        'prev_status': prev_status,
                        'curr_status': curr_status,
                        'description': f"Invalid transition from {prev_status} to {curr_status} for {symbol}"
                    })
                
                # Check if continuing signals have proper days_in_squeeze
                if curr_status == 'CONTINUING' and actual_days <= prev_signal.get('days_in_squeeze', 1):
                    issues.append({
                        'type': 'continuing_days_not_increasing',
                        'symbol': symbol,
                        'signal_id': signal['id'],
                        'scan_date': signal['scan_date'],
                        'actual_days': actual_days,
                        'prev_days': prev_signal.get('days_in_squeeze', 1),
                        'description': f"CONTINUING signal days_in_squeeze not increasing for {symbol}"
                    })
        
        return issues
    
    async def fix_continuity_issues(self, issues: Dict[str, Any], dry_run: bool = True) -> Dict[str, Any]:
        """Fix the identified continuity issues."""
        print(f"\n{'🔧 FIXING' if not dry_run else '🔍 DRY RUN:'} Continuity Issues")
        print("=" * 50)
        
        if not self.database_service.is_available():
            print("❌ Database service not available")
            return {}
        
        fixes_applied = []
        
        for issue_type, type_issues in issues.get('issue_types', {}).items():
            print(f"\nProcessing {len(type_issues)} '{issue_type}' issues...")
            
            for issue in type_issues:
                fix_result = await self._fix_individual_issue(issue, dry_run)
                if fix_result:
                    fixes_applied.append(fix_result)
        
        print(f"\n{'Applied' if not dry_run else 'Would apply'} {len(fixes_applied)} fixes")
        
        return {
            'fixes_applied': len(fixes_applied),
            'fixes_details': fixes_applied
        }
    
    async def _fix_individual_issue(self, issue: Dict, dry_run: bool) -> Optional[Dict]:
        """Fix an individual continuity issue."""
        issue_type = issue['type']
        signal_id = issue['signal_id']
        symbol = issue['symbol']
        
        try:
            if issue_type == 'first_signal_not_new':
                # Fix: Set first signal status to NEW and days_in_squeeze to 1
                update_data = {
                    'signal_status': 'NEW',
                    'days_in_squeeze': 1,
                    'first_detected_date': issue['scan_date'],
                    'updated_at': datetime.now().isoformat()
                }
                
                if not dry_run:
                    response = self.database_service.client.table('volatility_squeeze_signals').update(
                        update_data
                    ).eq('id', signal_id).execute()
                    
                    if response.data:
                        print(f"  ✅ Fixed first signal for {symbol}: set to NEW")
                        return {
                            'type': issue_type,
                            'symbol': symbol,
                            'signal_id': signal_id,
                            'action': 'Set status to NEW, days_in_squeeze to 1',
                            'success': True
                        }
                    else:
                        print(f"  ❌ Failed to fix first signal for {symbol}")
                        return None
                else:
                    print(f"  🔍 Would fix first signal for {symbol}: set to NEW")
                    return {
                        'type': issue_type,
                        'symbol': symbol,
                        'signal_id': signal_id,
                        'action': 'Would set status to NEW, days_in_squeeze to 1',
                        'success': True
                    }
            
            elif issue_type == 'days_in_squeeze_too_high':
                # Fix: Recalculate days_in_squeeze based on position in sequence
                expected_days = issue['expected_days']
                
                update_data = {
                    'days_in_squeeze': expected_days,
                    'updated_at': datetime.now().isoformat()
                }
                
                if not dry_run:
                    response = self.database_service.client.table('volatility_squeeze_signals').update(
                        update_data
                    ).eq('id', signal_id).execute()
                    
                    if response.data:
                        print(f"  ✅ Fixed days_in_squeeze for {symbol}: {issue['actual_days']} → {expected_days}")
                        return {
                            'type': issue_type,
                            'symbol': symbol,
                            'signal_id': signal_id,
                            'action': f"Corrected days_in_squeeze from {issue['actual_days']} to {expected_days}",
                            'success': True
                        }
                    else:
                        print(f"  ❌ Failed to fix days_in_squeeze for {symbol}")
                        return None
                else:
                    print(f"  🔍 Would fix days_in_squeeze for {symbol}: {issue['actual_days']} → {expected_days}")
                    return {
                        'type': issue_type,
                        'symbol': symbol,
                        'signal_id': signal_id,
                        'action': f"Would correct days_in_squeeze from {issue['actual_days']} to {expected_days}",
                        'success': True
                    }
            
            # Add more fix types as needed
            
        except Exception as e:
            print(f"  ❌ Error fixing issue for {symbol}: {e}")
            return None
        
        return None
    
    async def validate_fixes(self) -> Dict[str, Any]:
        """Validate that the fixes were applied correctly."""
        print("\n🔍 Validating fixes...")
        
        # Re-run the analysis to see if issues were resolved
        new_analysis = await self.analyze_continuity_issues()
        
        remaining_issues = new_analysis.get('total_issues', 0)
        print(f"Remaining issues after fixes: {remaining_issues}")
        
        return new_analysis
    
    async def run_full_fix(self, dry_run: bool = True) -> Dict[str, Any]:
        """Run the complete fix process."""
        print("🚀 Starting Signal Continuity Fix Process")
        print("=" * 50)
        
        # Step 1: Analyze issues
        analysis = await self.analyze_continuity_issues()
        
        if analysis.get('total_issues', 0) == 0:
            print("✅ No continuity issues found!")
            return analysis
        
        # Step 2: Fix issues
        fix_results = await self.fix_continuity_issues(analysis, dry_run)
        
        # Step 3: Validate fixes (only if not dry run)
        if not dry_run:
            validation = await self.validate_fixes()
            fix_results['validation'] = validation
        
        return {
            'analysis': analysis,
            'fixes': fix_results
        }

async def main():
    """Main function to run the signal continuity fixer."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix signal continuity issues")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Run in dry-run mode (default: True)")
    parser.add_argument("--apply-fixes", action="store_true", 
                       help="Actually apply the fixes (overrides --dry-run)")
    parser.add_argument("--days-back", type=int, default=30,
                       help="Number of days back to analyze (default: 30)")
    
    args = parser.parse_args()
    
    # Determine if we should actually apply fixes
    dry_run = not args.apply_fixes
    
    if not dry_run:
        print("⚠️  WARNING: This will modify the database!")
        response = input("Are you sure you want to apply fixes? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            return
    
    fixer = SignalContinuityFixer()
    
    try:
        results = await fixer.run_full_fix(dry_run=dry_run)
        
        # Save results
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = Path("exports") / f"continuity_fix_results_{timestamp}.json"
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Error during fix process: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
