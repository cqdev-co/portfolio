#!/usr/bin/env python3
"""
Volatility Squeeze Scanner - Table Cleanup Script

This script helps clean duplicate entries from the volatility_squeeze_signals table.
It provides safe cleanup operations with backup and confirmation features.

Usage:
    python clean_table.py --help
    python clean_table.py --dry-run                    # Show what would be cleaned
    python clean_table.py --date 2024-01-15           # Clean specific date
    python clean_table.py --days-back 7               # Clean last 7 days
    python clean_table.py --all --confirm             # Clean all duplicates
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import json

# Add the src directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dotenv import load_dotenv
from supabase import create_client, Client
from rich.console import Console
from rich.table import Table
from rich.prompt import Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn
from loguru import logger

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")

console = Console()


class TableCleaner:
    """Service for cleaning duplicate entries from volatility squeeze signals table."""
    
    def __init__(self):
        """Initialize the table cleaner."""
        self.client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client with environment variables."""
        try:
            # Load environment variables from parent directory
            parent_env = Path(__file__).parent.parent.parent / '.env'
            if parent_env.exists():
                load_dotenv(parent_env)
            
            # Also try loading from current directory
            load_dotenv()
            
            # Try to get Supabase credentials from environment
            supabase_url = (
                os.getenv('NEXT_PUBLIC_SUPABASE_URL') or 
                os.getenv('SUPABASE_URL')
            )
            supabase_key = (
                os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or
                os.getenv('SUPABASE_ANON_KEY')
            )
            
            if not supabase_url or not supabase_key:
                console.print("[red]❌ Supabase credentials not found in environment[/red]")
                console.print("Please ensure the following environment variables are set:")
                console.print("- NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL")
                console.print("- NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY")
                sys.exit(1)
            
            self.client = create_client(supabase_url, supabase_key)
            console.print("[green]✅ Connected to Supabase successfully[/green]")
            
        except Exception as e:
            console.print(f"[red]❌ Failed to initialize database connection: {e}[/red]")
            sys.exit(1)
    
    async def test_constraint_integrity(self) -> Dict[str, any]:
        """
        Test if the unique constraint is working properly.
        
        Returns:
            Dictionary with constraint test results
        """
        try:
            # Get an existing record to test with
            response = self.client.table('volatility_squeeze_signals').select(
                'symbol, scan_date'
            ).limit(1).execute()
            
            if not response.data:
                return {'constraint_working': False, 'error': 'No data to test with'}
            
            existing = response.data[0]
            test_data = {
                'symbol': existing['symbol'],
                'scan_date': existing['scan_date'],
                'scan_timestamp': '2025-09-20T20:00:00+00:00',
                'close_price': 100.0,
                'bb_width': 0.05,
                'bb_width_percentile': 0.5,
                'is_squeeze': True,
                'is_expansion': False,
                'signal_strength': 0.7,
                'technical_score': 0.7,
                'overall_score': 0.7
            }
            
            # Test regular insert (should fail)
            try:
                insert_response = self.client.table('volatility_squeeze_signals').insert(test_data).execute()
                # If we get here, constraint is NOT working
                # Clean up the test record
                if insert_response.data:
                    cleanup_id = insert_response.data[0]['id']
                    self.client.table('volatility_squeeze_signals').delete().eq('id', cleanup_id).execute()
                
                return {
                    'constraint_working': False, 
                    'error': 'Unique constraint not enforced - duplicate insert succeeded'
                }
            except Exception as e:
                if '23505' in str(e) or 'unique constraint' in str(e).lower():
                    return {'constraint_working': True, 'message': 'Unique constraint properly enforced'}
                else:
                    return {'constraint_working': False, 'error': f'Unexpected error: {e}'}
                    
        except Exception as e:
            return {'constraint_working': False, 'error': f'Test failed: {e}'}

    async def analyze_ticker_duplicates(
        self, 
        target_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> Dict[str, any]:
        """
        Analyze duplicate ticker entries (same ticker on different dates).
        
        Args:
            target_date: Specific date to analyze (optional)
            days_back: Number of days back to analyze (optional)
            
        Returns:
            Dictionary with ticker duplicate analysis results
        """
        try:
            query = self.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, scan_timestamp, overall_score, created_at'
            )
            
            # Apply date filters
            if target_date:
                query = query.eq('scan_date', target_date.isoformat())
            elif days_back:
                start_date = date.today() - timedelta(days=days_back)
                query = query.gte('scan_date', start_date.isoformat())
            
            response = query.order('symbol').order('scan_date', desc=True).order('created_at', desc=True).execute()
            
            if not response.data:
                return {
                    'total_signals': 0,
                    'unique_tickers': 0,
                    'duplicate_tickers': 0,
                    'duplicate_groups': [],
                    'date_range': self._get_date_range_str(target_date, days_back)
                }
            
            signals = response.data
            
            # Group by ticker symbol to find duplicates
            ticker_groups = {}
            for signal in signals:
                symbol = signal['symbol']
                if symbol not in ticker_groups:
                    ticker_groups[symbol] = []
                ticker_groups[symbol].append(signal)
            
            # Identify ticker duplicate groups
            duplicate_groups = []
            total_duplicates = 0
            
            for symbol, records in ticker_groups.items():
                if len(records) > 1:
                    # Sort by scan_date (desc) then created_at (desc) to keep the most recent
                    records.sort(key=lambda x: (x['scan_date'], x['created_at']), reverse=True)
                    
                    duplicate_groups.append({
                        'symbol': symbol,
                        'total_count': len(records),
                        'duplicates_to_remove': len(records) - 1,
                        'most_recent_date': records[0]['scan_date'],
                        'oldest_date': records[-1]['scan_date'],
                        'signals': records
                    })
                    total_duplicates += len(records) - 1
            
            return {
                'total_signals': len(signals),
                'unique_tickers': len(ticker_groups),
                'duplicate_tickers': len(duplicate_groups),
                'total_duplicates': total_duplicates,
                'duplicate_groups': duplicate_groups,
                'date_range': self._get_date_range_str(target_date, days_back)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing ticker duplicates: {e}")
            return {}

    async def analyze_duplicates(
        self, 
        target_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> Dict[str, any]:
        """
        Analyze duplicate entries in the table (same ticker + same date).
        
        Args:
            target_date: Specific date to analyze (optional)
            days_back: Number of days back to analyze (optional)
            
        Returns:
            Dictionary with duplicate analysis results
        """
        try:
            query = self.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, scan_timestamp, overall_score, created_at'
            )
            
            # Apply date filters
            if target_date:
                query = query.eq('scan_date', target_date.isoformat())
            elif days_back:
                start_date = date.today() - timedelta(days=days_back)
                query = query.gte('scan_date', start_date.isoformat())
            
            response = query.order('symbol').order('scan_date').order('created_at', desc=True).execute()
            
            if not response.data:
                return {
                    'total_signals': 0,
                    'unique_combinations': 0,
                    'duplicates': 0,
                    'duplicate_groups': [],
                    'date_range': self._get_date_range_str(target_date, days_back)
                }
            
            signals = response.data
            
            # Group by symbol and scan_date to find duplicates
            groups = {}
            for signal in signals:
                key = (signal['symbol'], signal['scan_date'])
                if key not in groups:
                    groups[key] = []
                groups[key].append(signal)
            
            # Identify duplicate groups
            duplicate_groups = []
            total_duplicates = 0
            
            for key, group in groups.items():
                if len(group) > 1:
                    # Sort by created_at to keep the most recent
                    group.sort(key=lambda x: x['created_at'], reverse=True)
                    
                    duplicate_groups.append({
                        'symbol': key[0],
                        'scan_date': key[1],
                        'total_count': len(group),
                        'duplicates_to_remove': len(group) - 1,
                        'signals': group
                    })
                    total_duplicates += len(group) - 1
            
            return {
                'total_signals': len(signals),
                'unique_combinations': len(groups),
                'duplicates': total_duplicates,
                'duplicate_groups': duplicate_groups,
                'date_range': self._get_date_range_str(target_date, days_back)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing duplicates: {e}")
            return {}
    
    def _get_date_range_str(self, target_date: Optional[date], days_back: Optional[int]) -> str:
        """Get a human-readable date range string."""
        if target_date:
            return f"Date: {target_date}"
        elif days_back:
            start_date = date.today() - timedelta(days=days_back)
            return f"Range: {start_date} to {date.today()}"
        else:
            return "All dates"
    
    async def create_backup(self, backup_path: Optional[str] = None) -> str:
        """
        Create a backup of the signals table before cleanup.
        
        Args:
            backup_path: Optional custom backup file path
            
        Returns:
            Path to the created backup file
        """
        if backup_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"backup_volatility_signals_{timestamp}.json"
        
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Creating backup...", total=None)
                
                response = self.client.table('volatility_squeeze_signals').select('*').execute()
                
                if response.data:
                    backup_data = {
                        'backup_timestamp': datetime.now().isoformat(),
                        'total_records': len(response.data),
                        'records': response.data
                    }
                    
                    with open(backup_path, 'w') as f:
                        json.dump(backup_data, f, indent=2, default=str)
                    
                    progress.update(task, completed=True)
                    console.print(f"[green]✅ Backup created: {backup_path} ({len(response.data)} records)[/green]")
                    return backup_path
                else:
                    console.print("[yellow]⚠️  No data found to backup[/yellow]")
                    return ""
                    
        except Exception as e:
            console.print(f"[red]❌ Failed to create backup: {e}[/red]")
            raise
    
    async def clean_duplicates(
        self,
        target_date: Optional[date] = None,
        days_back: Optional[int] = None,
        dry_run: bool = True
    ) -> int:
        """
        Clean duplicate entries from the table.
        
        Args:
            target_date: Specific date to clean (optional)
            days_back: Number of days back to clean (optional)
            dry_run: If True, only show what would be cleaned
            
        Returns:
            Number of duplicates removed (or would be removed in dry run)
        """
        analysis = await self.analyze_duplicates(target_date, days_back)
        
        if analysis['duplicates'] == 0:
            console.print("[green]✅ No duplicates found to clean[/green]")
            return 0
        
        # Show analysis results
        self._display_duplicate_analysis(analysis, dry_run)
        
        if dry_run:
            console.print(f"\n[yellow]🔍 DRY RUN: Would remove {analysis['duplicates']} duplicate records[/yellow]")
            return analysis['duplicates']
        
        # Confirm cleanup
        if not Confirm.ask(f"\nProceed with removing {analysis['duplicates']} duplicate records?"):
            console.print("[yellow]❌ Cleanup cancelled by user[/yellow]")
            return 0
        
        # Perform cleanup
        removed_count = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Cleaning duplicates...", total=len(analysis['duplicate_groups']))
            
            for group in analysis['duplicate_groups']:
                try:
                    # Keep the first (most recent) record, remove the rest
                    signals_to_remove = group['signals'][1:]  # Skip first (most recent)
                    ids_to_remove = [signal['id'] for signal in signals_to_remove]
                    
                    # Remove duplicates in batches
                    batch_size = 50
                    for i in range(0, len(ids_to_remove), batch_size):
                        batch_ids = ids_to_remove[i:i + batch_size]
                        
                        delete_response = self.client.table('volatility_squeeze_signals').delete().in_(
                            'id', batch_ids
                        ).execute()
                        
                        batch_removed = len(delete_response.data) if delete_response.data else 0
                        removed_count += batch_removed
                    
                    logger.debug(f"Cleaned {group['duplicates_to_remove']} duplicates for {group['symbol']} on {group['scan_date']}")
                    
                except Exception as e:
                    logger.error(f"Error cleaning duplicates for {group['symbol']}: {e}")
                
                progress.advance(task)
        
        console.print(f"[green]✅ Successfully removed {removed_count} duplicate records[/green]")
        return removed_count
    
    async def clean_ticker_duplicates(
        self,
        target_date: Optional[date] = None,
        days_back: Optional[int] = None,
        dry_run: bool = False
    ) -> int:
        """
        Clean duplicate ticker entries (same ticker on different dates).
        Keeps the most recent record for each ticker.
        
        Args:
            target_date: Specific date to analyze (optional)
            days_back: Number of days back to analyze (optional)
            dry_run: If True, only show what would be cleaned
            
        Returns:
            Number of duplicate ticker records removed (or would be removed in dry run)
        """
        analysis = await self.analyze_ticker_duplicates(target_date, days_back)
        
        if analysis['duplicate_tickers'] == 0:
            console.print("[green]✅ No duplicate tickers found to clean[/green]")
            return 0
        
        # Show analysis results
        self._display_ticker_duplicate_analysis(analysis, dry_run)
        
        if dry_run:
            console.print(f"\n[yellow]🔍 DRY RUN: Would remove {analysis['total_duplicates']} duplicate ticker records[/yellow]")
            return analysis['total_duplicates']
        
        # Confirm cleanup
        if not Confirm.ask(f"\nProceed with removing {analysis['total_duplicates']} duplicate ticker records?"):
            console.print("[yellow]❌ Cleanup cancelled by user[/yellow]")
            return 0
        
        # Perform cleanup
        removed_count = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Cleaning duplicate tickers...", total=len(analysis['duplicate_groups']))
            
            for group in analysis['duplicate_groups']:
                try:
                    # Keep the first (most recent) record, remove the rest
                    most_recent_signal = group['signals'][0]  # Keep this one
                    signals_to_remove = group['signals'][1:]  # Remove these
                    ids_to_remove = [signal['id'] for signal in signals_to_remove]
                    
                    # First, handle foreign key constraints by updating performance records
                    for signal_to_remove in signals_to_remove:
                        # Check if this signal has performance tracking
                        perf_check = self.client.table('signal_performance').select('id').eq(
                            'signal_id', signal_to_remove['id']
                        ).execute()
                        
                        if perf_check.data:
                            # Update performance records to reference the most recent signal
                            update_response = self.client.table('signal_performance').update({
                                'signal_id': most_recent_signal['id']
                            }).eq('signal_id', signal_to_remove['id']).execute()
                            
                            logger.debug(f"Updated {len(update_response.data) if update_response.data else 0} performance records for {group['symbol']}")
                    
                    # Now safely remove the duplicate signal records
                    batch_size = 50
                    for i in range(0, len(ids_to_remove), batch_size):
                        batch_ids = ids_to_remove[i:i + batch_size]
                        
                        delete_response = self.client.table('volatility_squeeze_signals').delete().in_(
                            'id', batch_ids
                        ).execute()
                        
                        batch_removed = len(delete_response.data) if delete_response.data else 0
                        removed_count += batch_removed
                    
                    logger.debug(f"Cleaned {group['duplicates_to_remove']} duplicate records for ticker {group['symbol']}")
                    
                except Exception as e:
                    logger.error(f"Error cleaning duplicates for ticker {group['symbol']}: {e}")
                
                progress.advance(task)
        
        console.print(f"[green]✅ Successfully removed {removed_count} duplicate ticker records[/green]")
        return removed_count
    
    async def check_foreign_key_constraints(self, ticker_symbols: list) -> Dict[str, any]:
        """
        Check foreign key constraints for specific tickers.
        
        Args:
            ticker_symbols: List of ticker symbols to check
            
        Returns:
            Dictionary with constraint information
        """
        constraint_info = {}
        
        for symbol in ticker_symbols:
            try:
                # Get signal records for this ticker
                signals_response = self.client.table('volatility_squeeze_signals').select(
                    'id, scan_date, created_at'
                ).eq('symbol', symbol).order('scan_date', desc=True).execute()
                
                # Get performance records for this ticker
                performance_response = self.client.table('signal_performance').select(
                    'signal_id, entry_date, status'
                ).eq('symbol', symbol).execute()
                
                constraint_info[symbol] = {
                    'signal_records': len(signals_response.data),
                    'performance_records': len(performance_response.data),
                    'signals': signals_response.data,
                    'performance': performance_response.data
                }
                
            except Exception as e:
                constraint_info[symbol] = {'error': str(e)}
        
        return constraint_info
    
    def _display_duplicate_analysis(self, analysis: Dict, dry_run: bool = True):
        """Display duplicate analysis results in a formatted table."""
        console.print(f"\n[bold blue]📊 Duplicate Analysis Results[/bold blue]")
        console.print(f"Date Range: {analysis['date_range']}")
        console.print(f"Total Signals: {analysis['total_signals']}")
        console.print(f"Unique Combinations: {analysis['unique_combinations']}")
        console.print(f"Duplicate Records: {analysis['duplicates']}")
        
        if analysis['duplicate_groups']:
            console.print(f"\n[bold yellow]🔍 Duplicate Groups Found:[/bold yellow]")
            
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Symbol", style="cyan")
            table.add_column("Scan Date", style="green")
            table.add_column("Total Count", justify="right", style="yellow")
            table.add_column("Duplicates", justify="right", style="red")
            table.add_column("Action", style="blue")
            
            for group in analysis['duplicate_groups'][:20]:  # Show first 20
                action = "Would remove" if dry_run else "Will remove"
                table.add_row(
                    group['symbol'],
                    group['scan_date'],
                    str(group['total_count']),
                    str(group['duplicates_to_remove']),
                    f"{action} {group['duplicates_to_remove']}"
                )
            
            console.print(table)
            
            if len(analysis['duplicate_groups']) > 20:
                console.print(f"[dim]... and {len(analysis['duplicate_groups']) - 20} more groups[/dim]")
    
    def _display_ticker_duplicate_analysis(self, analysis: Dict, dry_run: bool = True):
        """Display ticker duplicate analysis results in a formatted table."""
        console.print(f"\n[bold blue]📊 Ticker Duplicate Analysis Results[/bold blue]")
        console.print(f"Date Range: {analysis['date_range']}")
        console.print(f"Total Signals: {analysis['total_signals']}")
        console.print(f"Unique Tickers: {analysis['unique_tickers']}")
        console.print(f"Duplicate Tickers: {analysis['duplicate_tickers']}")
        console.print(f"Total Duplicate Records: {analysis['total_duplicates']}")
        
        if analysis['duplicate_groups']:
            console.print(f"\n[bold yellow]🔍 Duplicate Tickers Found:[/bold yellow]")
            
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Ticker", style="cyan")
            table.add_column("Total Records", justify="right", style="yellow")
            table.add_column("Most Recent", style="green")
            table.add_column("Oldest", style="red")
            table.add_column("Duplicates", justify="right", style="red")
            table.add_column("Action", style="blue")
            
            for group in analysis['duplicate_groups'][:20]:  # Show first 20
                action = "Would remove" if dry_run else "Will remove"
                table.add_row(
                    group['symbol'],
                    str(group['total_count']),
                    group['most_recent_date'],
                    group['oldest_date'],
                    str(group['duplicates_to_remove']),
                    f"{action} {group['duplicates_to_remove']}"
                )
            
            console.print(table)
            
            if len(analysis['duplicate_groups']) > 20:
                console.print(f"[dim]... and {len(analysis['duplicate_groups']) - 20} more tickers[/dim]")


async def main():
    """Main function to handle command line arguments and execute cleanup operations."""
    parser = argparse.ArgumentParser(
        description="Clean duplicate entries from volatility squeeze signals table",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python clean_table.py --analyze-tickers           # Analyze ticker duplicates
  python clean_table.py --clean-tickers --dry-run   # Preview ticker cleanup
  python clean_table.py --clean-tickers             # Clean duplicate tickers
  python clean_table.py --dry-run                   # Show date-based duplicates
  python clean_table.py --date 2024-01-15          # Clean specific date
  python clean_table.py --days-back 7              # Clean last 7 days
  python clean_table.py --backup-only              # Create backup only
        """
    )
    
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be cleaned without making changes')
    parser.add_argument('--date', type=str, 
                       help='Clean duplicates for specific date (YYYY-MM-DD)')
    parser.add_argument('--days-back', type=int, 
                       help='Clean duplicates for last N days')
    parser.add_argument('--all', action='store_true', 
                       help='Clean all duplicates in the table')
    parser.add_argument('--confirm', action='store_true', 
                       help='Skip confirmation prompts (use with caution)')
    parser.add_argument('--backup-only', action='store_true', 
                       help='Create backup only, do not clean')
    parser.add_argument('--backup-path', type=str, 
                       help='Custom backup file path')
    parser.add_argument('--test-constraints', action='store_true', 
                       help='Test database constraint integrity')
    parser.add_argument('--clean-tickers', action='store_true', 
                       help='Clean duplicate tickers (keep most recent record per ticker)')
    parser.add_argument('--analyze-tickers', action='store_true', 
                       help='Analyze duplicate tickers without cleaning')
    parser.add_argument('--check-constraints', action='store_true', 
                       help='Check foreign key constraints for problematic tickers')
    
    args = parser.parse_args()
    
    # Validate arguments
    date_filters = sum([bool(args.date), bool(args.days_back), args.all])
    if date_filters > 1:
        console.print("[red]❌ Please specify only one of: --date, --days-back, or --all[/red]")
        sys.exit(1)
    
    if not date_filters and not args.backup_only and not args.test_constraints and not args.clean_tickers and not args.analyze_tickers and not args.check_constraints:
        console.print("[yellow]⚠️  No date filter specified. Use --dry-run to see all duplicates or specify a filter.[/yellow]")
        args.dry_run = True
        args.all = True
    
    # Parse date if provided
    target_date = None
    if args.date:
        try:
            target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
        except ValueError:
            console.print("[red]❌ Invalid date format. Use YYYY-MM-DD[/red]")
            sys.exit(1)
    
    # Initialize cleaner
    console.print("[bold blue]🧹 Volatility Squeeze Scanner - Table Cleaner[/bold blue]\n")
    cleaner = TableCleaner()
    
    try:
        # Test constraints if requested
        if args.test_constraints:
            console.print("[bold blue]🔧 Testing Database Constraint Integrity[/bold blue]")
            constraint_result = await cleaner.test_constraint_integrity()
            
            if constraint_result['constraint_working']:
                console.print(f"[green]✅ {constraint_result['message']}[/green]")
            else:
                console.print(f"[red]❌ Constraint Issue: {constraint_result['error']}[/red]")
            
            console.print("[green]✅ Constraint test completed[/green]")
            return
        
        # Analyze ticker duplicates if requested
        if args.analyze_tickers:
            console.print("[bold blue]📊 Analyzing Ticker Duplicates[/bold blue]")
            analysis = await cleaner.analyze_ticker_duplicates(
                target_date=target_date,
                days_back=args.days_back
            )
            cleaner._display_ticker_duplicate_analysis(analysis, dry_run=True)
            console.print("[green]✅ Ticker analysis completed[/green]")
            return
        
        # Clean ticker duplicates if requested
        if args.clean_tickers:
            console.print("[bold blue]🧹 Cleaning Ticker Duplicates[/bold blue]")
            
            # Create backup first
            if not args.dry_run:
                backup_path = await cleaner.create_backup(args.backup_path)
                console.print(f"[green]✅ Backup created: {backup_path}[/green]")
            
            removed_count = await cleaner.clean_ticker_duplicates(
                target_date=target_date,
                days_back=args.days_back,
                dry_run=args.dry_run
            )
            
            if args.dry_run:
                console.print(f"\n[blue]💡 To actually clean ticker duplicates, run with --clean-tickers (without --dry-run)[/blue]")
            elif removed_count > 0:
                console.print(f"\n[green]🎉 Ticker cleanup completed! Removed {removed_count} duplicate records.[/green]")
            
            return
        
        # Check foreign key constraints if requested
        if args.check_constraints:
            console.print("[bold blue]🔗 Checking Foreign Key Constraints[/bold blue]")
            problematic_tickers = ['ALXO', 'CBL', 'DAWN']
            
            constraint_info = await cleaner.check_foreign_key_constraints(problematic_tickers)
            
            for ticker, info in constraint_info.items():
                console.print(f"\n[bold cyan]📊 {ticker}:[/bold cyan]")
                if 'error' in info:
                    console.print(f"  [red]❌ Error: {info['error']}[/red]")
                else:
                    console.print(f"  Signal records: {info['signal_records']}")
                    console.print(f"  Performance records: {info['performance_records']}")
                    
                    if info['signals']:
                        console.print("  [yellow]Signal details:[/yellow]")
                        for i, signal in enumerate(info['signals']):
                            console.print(f"    {i+1}. {signal['scan_date']} - ID: {signal['id'][:8]}...")
                    
                    if info['performance']:
                        console.print("  [green]Performance details:[/green]")
                        for i, perf in enumerate(info['performance']):
                            console.print(f"    {i+1}. Entry: {perf['entry_date']} - Status: {perf['status']} - Signal ID: {perf['signal_id'][:8]}...")
            
            console.print("\n[green]✅ Foreign key constraint check completed[/green]")
            return
        
        # Create backup if requested or if doing actual cleanup
        if args.backup_only or (not args.dry_run and not args.confirm):
            backup_path = await cleaner.create_backup(args.backup_path)
            if args.backup_only:
                console.print("[green]✅ Backup completed successfully[/green]")
                return
        
        # Perform cleanup
        removed_count = await cleaner.clean_duplicates(
            target_date=target_date,
            days_back=args.days_back,
            dry_run=args.dry_run
        )
        
        if args.dry_run:
            console.print(f"\n[blue]💡 To actually clean duplicates, run without --dry-run[/blue]")
        elif removed_count > 0:
            console.print(f"\n[green]🎉 Cleanup completed successfully! Removed {removed_count} duplicates.[/green]")
        
    except KeyboardInterrupt:
        console.print("\n[yellow]❌ Operation cancelled by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]❌ Error during cleanup: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())