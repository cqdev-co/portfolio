#!/usr/bin/env python3
"""
Script to analyze and fix duplicate signal issues in the volatility squeeze scanner database.

This script addresses the issue where multiple signals exist for the same symbol with 
conflicting signal_status values (e.g., both "NEW" and "CONTINUING" for the same ticker).
"""

import asyncio
import os
import sys
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from collections import defaultdict

# Add the src directory to the path so we can import our modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from volatility_scanner.services.database_service import DatabaseService
from volatility_scanner.config.settings import Settings
from loguru import logger


class DuplicateSignalFixer:
    """Analyzes and fixes duplicate signal issues."""
    
    def __init__(self):
        """Initialize the duplicate signal fixer."""
        settings = Settings()
        self.database_service = DatabaseService(settings)
        
    async def analyze_duplicates(self, days_back: int = 7) -> Dict:
        """
        Analyze duplicate signals in the database.
        
        Args:
            days_back: Number of days to look back for analysis
            
        Returns:
            Dictionary with analysis results
        """
        if not self.database_service.is_available():
            logger.error("Database service not available")
            return {}
            
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        
        logger.info(f"Analyzing signals from {start_date} to {end_date}")
        
        try:
            # Get all signals in the date range
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, signal_status, days_in_squeeze, '
                'first_detected_date, last_active_date, created_at, updated_at'
            ).gte(
                'scan_date', start_date.isoformat()
            ).lte(
                'scan_date', end_date.isoformat()
            ).order('symbol').order('scan_date').order('created_at').execute()
            
            if not response.data:
                logger.info("No signals found in the specified date range")
                return {}
                
            signals = response.data
            logger.info(f"Found {len(signals)} signals to analyze")
            
            # Group signals by symbol and scan_date
            grouped_signals = defaultdict(lambda: defaultdict(list))
            for signal in signals:
                symbol = signal['symbol']
                scan_date = signal['scan_date']
                grouped_signals[symbol][scan_date].append(signal)
            
            # Analyze for duplicates and inconsistencies
            analysis = {
                'total_signals': len(signals),
                'symbols_analyzed': len(grouped_signals),
                'duplicates_by_date': {},
                'status_conflicts': {},
                'continuity_issues': {},
                'recommendations': []
            }
            
            duplicate_count = 0
            conflict_count = 0
            continuity_issues = 0
            
            for symbol, dates in grouped_signals.items():
                symbol_issues = []
                
                # Check for duplicates on same date
                for scan_date, date_signals in dates.items():
                    if len(date_signals) > 1:
                        duplicate_count += len(date_signals) - 1
                        
                        # Check for status conflicts
                        statuses = set(s['signal_status'] for s in date_signals)
                        if len(statuses) > 1:
                            conflict_count += 1
                            analysis['status_conflicts'][f"{symbol}_{scan_date}"] = {
                                'statuses': list(statuses),
                                'signals': date_signals
                            }
                            symbol_issues.append(f"Status conflict on {scan_date}: {statuses}")
                        
                        analysis['duplicates_by_date'][f"{symbol}_{scan_date}"] = {
                            'count': len(date_signals),
                            'signals': date_signals
                        }
                
                # Check for continuity issues across dates
                sorted_dates = sorted(dates.keys())
                for i in range(len(sorted_dates) - 1):
                    current_date = sorted_dates[i]
                    next_date = sorted_dates[i + 1]
                    
                    current_signals = dates[current_date]
                    next_signals = dates[next_date]
                    
                    # Check if we have ENDED followed by CONTINUING
                    current_statuses = set(s['signal_status'] for s in current_signals)
                    next_statuses = set(s['signal_status'] for s in next_signals)
                    
                    if 'ENDED' in current_statuses and 'CONTINUING' in next_statuses:
                        continuity_issues += 1
                        analysis['continuity_issues'][f"{symbol}_{current_date}_{next_date}"] = {
                            'current_date': current_date,
                            'next_date': next_date,
                            'current_statuses': list(current_statuses),
                            'next_statuses': list(next_statuses),
                            'issue': 'ENDED signal followed by CONTINUING signal'
                        }
                        symbol_issues.append(f"Continuity issue: ENDED on {current_date} -> CONTINUING on {next_date}")
                
                if symbol_issues:
                    logger.warning(f"Issues found for {symbol}: {'; '.join(symbol_issues)}")
            
            analysis['duplicate_count'] = duplicate_count
            analysis['conflict_count'] = conflict_count
            analysis['continuity_issues_count'] = continuity_issues
            
            # Generate recommendations
            if duplicate_count > 0:
                analysis['recommendations'].append(f"Remove {duplicate_count} duplicate signals")
            if conflict_count > 0:
                analysis['recommendations'].append(f"Resolve {conflict_count} status conflicts")
            if continuity_issues > 0:
                analysis['recommendations'].append(f"Fix {continuity_issues} continuity issues")
                
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing duplicates: {e}")
            return {}
    
    async def fix_duplicates(self, dry_run: bool = True) -> Dict:
        """
        Fix duplicate signals by keeping the most recent version.
        
        Args:
            dry_run: If True, only show what would be done without making changes
            
        Returns:
            Dictionary with fix results
        """
        analysis = await self.analyze_duplicates()
        
        if not analysis or analysis.get('duplicate_count', 0) == 0:
            logger.info("No duplicates found to fix")
            return {'fixed': 0, 'errors': 0}
        
        fixed_count = 0
        error_count = 0
        
        logger.info(f"{'DRY RUN: ' if dry_run else ''}Fixing {analysis['duplicate_count']} duplicate signals")
        
        # Fix duplicates by date
        for key, duplicate_info in analysis['duplicates_by_date'].items():
            signals = duplicate_info['signals']
            if len(signals) <= 1:
                continue
                
            # Sort by created_at to keep the most recent
            signals.sort(key=lambda x: x['created_at'], reverse=True)
            keep_signal = signals[0]
            remove_signals = signals[1:]
            
            logger.info(f"{'DRY RUN: ' if dry_run else ''}Keeping signal {keep_signal['id']} for {key}")
            
            for signal in remove_signals:
                try:
                    if not dry_run:
                        self.database_service.client.table('volatility_squeeze_signals').delete().eq(
                            'id', signal['id']
                        ).execute()
                    
                    logger.info(f"{'DRY RUN: ' if dry_run else ''}Removed duplicate signal {signal['id']}")
                    fixed_count += 1
                    
                except Exception as e:
                    logger.error(f"Error removing signal {signal['id']}: {e}")
                    error_count += 1
        
        return {'fixed': fixed_count, 'errors': error_count}
    
    async def fix_continuity_issues(self, dry_run: bool = True) -> Dict:
        """
        Fix continuity issues where ENDED signals are followed by CONTINUING signals.
        
        Args:
            dry_run: If True, only show what would be done without making changes
            
        Returns:
            Dictionary with fix results
        """
        analysis = await self.analyze_duplicates()
        
        if not analysis or analysis.get('continuity_issues_count', 0) == 0:
            logger.info("No continuity issues found to fix")
            return {'fixed': 0, 'errors': 0}
        
        fixed_count = 0
        error_count = 0
        
        logger.info(f"{'DRY RUN: ' if dry_run else ''}Fixing {analysis['continuity_issues_count']} continuity issues")
        
        for key, issue_info in analysis['continuity_issues'].items():
            # For continuity issues, we should mark the CONTINUING signal as NEW
            # since the previous signal was ENDED
            try:
                if not dry_run:
                    # Update all CONTINUING signals on the next_date to be NEW with days_in_squeeze = 1
                    next_date = issue_info['next_date']
                    symbol = key.split('_')[0]  # Extract symbol from key
                    
                    update_data = {
                        'signal_status': 'NEW',
                        'days_in_squeeze': 1,
                        'first_detected_date': next_date,
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    self.database_service.client.table('volatility_squeeze_signals').update(
                        update_data
                    ).eq('symbol', symbol).eq('scan_date', next_date).eq('signal_status', 'CONTINUING').execute()
                
                logger.info(f"{'DRY RUN: ' if dry_run else ''}Fixed continuity issue for {key}")
                fixed_count += 1
                
            except Exception as e:
                logger.error(f"Error fixing continuity issue {key}: {e}")
                error_count += 1
        
        return {'fixed': fixed_count, 'errors': error_count}


async def main():
    """Main function to run the duplicate signal fixer."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze and fix duplicate signals')
    parser.add_argument('--analyze', action='store_true', help='Analyze duplicates without fixing')
    parser.add_argument('--fix-duplicates', action='store_true', help='Fix duplicate signals')
    parser.add_argument('--fix-continuity', action='store_true', help='Fix continuity issues')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--days', type=int, default=7, help='Number of days to look back (default: 7)')
    
    args = parser.parse_args()
    
    fixer = DuplicateSignalFixer()
    
    if args.analyze or (not args.fix_duplicates and not args.fix_continuity):
        # Default to analyze if no specific action is requested
        logger.info("Analyzing duplicate signals...")
        analysis = await fixer.analyze_duplicates(args.days)
        
        if analysis:
            print(f"\n📊 Analysis Results:")
            print(f"   Total signals: {analysis['total_signals']}")
            print(f"   Symbols analyzed: {analysis['symbols_analyzed']}")
            print(f"   Duplicate signals: {analysis['duplicate_count']}")
            print(f"   Status conflicts: {analysis['conflict_count']}")
            print(f"   Continuity issues: {analysis['continuity_issues_count']}")
            
            if analysis['recommendations']:
                print(f"\n💡 Recommendations:")
                for rec in analysis['recommendations']:
                    print(f"   - {rec}")
            
            # Show specific issues
            if analysis['status_conflicts']:
                print(f"\n⚠️  Status Conflicts:")
                for key, conflict in analysis['status_conflicts'].items():
                    print(f"   {key}: {conflict['statuses']}")
            
            if analysis['continuity_issues']:
                print(f"\n🔗 Continuity Issues:")
                for key, issue in analysis['continuity_issues'].items():
                    print(f"   {key}: {issue['issue']}")
    
    if args.fix_duplicates:
        logger.info("Fixing duplicate signals...")
        result = await fixer.fix_duplicates(args.dry_run)
        print(f"\n🔧 Duplicate Fix Results:")
        print(f"   Fixed: {result['fixed']}")
        print(f"   Errors: {result['errors']}")
    
    if args.fix_continuity:
        logger.info("Fixing continuity issues...")
        result = await fixer.fix_continuity_issues(args.dry_run)
        print(f"\n🔗 Continuity Fix Results:")
        print(f"   Fixed: {result['fixed']}")
        print(f"   Errors: {result['errors']}")


if __name__ == "__main__":
    asyncio.run(main())
