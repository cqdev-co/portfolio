#!/usr/bin/env python3
"""
Volatility Squeeze Scanner - Signal Score Cleanup Script

This script cleans volatility squeeze signals from Supabase based on a minimum 
score threshold. It provides safe cleanup operations with backup and confirmation.

Usage:
    python clean_signals.py --help
    python clean_signals.py --min-score 0.80 --dry-run    # Show what would be cleaned
    python clean_signals.py --min-score 0.80              # Clean signals < 0.80
    python clean_signals.py --min-score 0.90 --date 2024-01-15  # Clean specific date
    python clean_signals.py --min-score 0.75 --days-back 7      # Clean last 7 days
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import json
from decimal import Decimal

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
logger.add(
    sys.stdout, 
    level="INFO", 
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}"
)

console = Console()


class SignalCleaner:
    """Service for cleaning volatility squeeze signals based on score thresholds."""
    
    def __init__(self):
        """Initialize the signal cleaner."""
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
    
    async def analyze_signals_by_score(
        self,
        min_score: float,
        target_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> Dict[str, any]:
        """
        Analyze signals that would be cleaned based on score threshold.
        
        Args:
            min_score: Minimum score threshold (signals below this will be cleaned)
            target_date: Specific date to analyze (optional)
            days_back: Number of days back to analyze (optional)
            
        Returns:
            Dictionary with analysis results
        """
        try:
            # Build query for signals below threshold
            query = self.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, overall_score, recommendation, '
                'opportunity_rank, signal_strength, technical_score, '
                'bb_width_percentile, is_actionable, created_at'
            ).lt('overall_score', min_score)
            
            # Apply date filters
            if target_date:
                query = query.eq('scan_date', target_date.isoformat())
            elif days_back:
                start_date = date.today() - timedelta(days=days_back)
                query = query.gte('scan_date', start_date.isoformat())
            
            response = query.order('overall_score', desc=False).execute()
            
            if not response.data:
                return {
                    'total_signals_to_clean': 0,
                    'signals_by_score_range': {},
                    'signals_by_recommendation': {},
                    'signals_by_rank': {},
                    'actionable_signals_to_clean': 0,
                    'related_performance_records': 0,
                    'date_range': self._get_date_range_str(target_date, days_back),
                    'min_score_threshold': min_score,
                    'signals': []
                }
            
            signals = response.data
            signal_ids = [signal['id'] for signal in signals]
            
            # Count related performance tracking records
            perf_count = 0
            try:
                perf_response = self.client.table('signal_performance').select(
                    'id', count='exact'
                ).in_('signal_id', signal_ids).execute()
                perf_count = perf_response.count if perf_response.count else 0
            except Exception as e:
                logger.debug(f"Could not count performance records: {e}")
            
            # Analyze by score ranges
            score_ranges = {
                '0.0-0.2': 0,
                '0.2-0.4': 0,
                '0.4-0.6': 0,
                '0.6-0.8': 0,
                '0.8-1.0': 0
            }
            
            for signal in signals:
                score = float(signal['overall_score'])
                if score < 0.2:
                    score_ranges['0.0-0.2'] += 1
                elif score < 0.4:
                    score_ranges['0.2-0.4'] += 1
                elif score < 0.6:
                    score_ranges['0.4-0.6'] += 1
                elif score < 0.8:
                    score_ranges['0.6-0.8'] += 1
                else:
                    score_ranges['0.8-1.0'] += 1
            
            # Analyze by recommendation
            recommendations = {}
            for signal in signals:
                rec = signal.get('recommendation', 'UNKNOWN')
                recommendations[rec] = recommendations.get(rec, 0) + 1
            
            # Analyze by opportunity rank
            ranks = {}
            for signal in signals:
                rank = signal.get('opportunity_rank', 'UNRANKED')
                ranks[rank] = ranks.get(rank, 0) + 1
            
            # Count actionable signals
            actionable_count = sum(1 for signal in signals if signal.get('is_actionable', False))
            
            return {
                'total_signals_to_clean': len(signals),
                'signals_by_score_range': score_ranges,
                'signals_by_recommendation': recommendations,
                'signals_by_rank': ranks,
                'actionable_signals_to_clean': actionable_count,
                'related_performance_records': perf_count,
                'date_range': self._get_date_range_str(target_date, days_back),
                'min_score_threshold': min_score,
                'signals': signals[:100]  # Limit to first 100 for display
            }
            
        except Exception as e:
            logger.error(f"Error analyzing signals by score: {e}")
            return {}
    
    async def get_total_signals_count(
        self,
        target_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> int:
        """Get total count of signals for comparison."""
        try:
            query = self.client.table('volatility_squeeze_signals').select(
                'id', count='exact'
            )
            
            # Apply date filters
            if target_date:
                query = query.eq('scan_date', target_date.isoformat())
            elif days_back:
                start_date = date.today() - timedelta(days=days_back)
                query = query.gte('scan_date', start_date.isoformat())
            
            response = query.execute()
            return response.count if response.count else 0
            
        except Exception as e:
            logger.error(f"Error getting total signals count: {e}")
            return 0
    
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
    
    async def clean_signals_by_score(
        self,
        min_score: float,
        target_date: Optional[date] = None,
        days_back: Optional[int] = None,
        dry_run: bool = True
    ) -> int:
        """
        Clean signals below the minimum score threshold.
        
        Args:
            min_score: Minimum score threshold (signals below this will be cleaned)
            target_date: Specific date to clean (optional)
            days_back: Number of days back to clean (optional)
            dry_run: If True, only show what would be cleaned
            
        Returns:
            Number of signals removed (or would be removed in dry run)
        """
        # First analyze what would be cleaned
        analysis = await self.analyze_signals_by_score(min_score, target_date, days_back)
        total_signals = await self.get_total_signals_count(target_date, days_back)
        
        if analysis['total_signals_to_clean'] == 0:
            console.print(f"[green]✅ No signals found below score threshold {min_score}[/green]")
            return 0
        
        # Show analysis results
        self._display_score_analysis(analysis, total_signals, dry_run)
        
        if dry_run:
            console.print(f"\n[yellow]🔍 DRY RUN: Would remove {analysis['total_signals_to_clean']} signals below score {min_score}[/yellow]")
            return analysis['total_signals_to_clean']
        
        # Confirm cleanup
        percentage = (analysis['total_signals_to_clean'] / total_signals * 100) if total_signals > 0 else 0
        console.print(f"\n[bold red]⚠️  WARNING: This will permanently delete {analysis['total_signals_to_clean']} signals ({percentage:.1f}% of total)[/bold red]")
        
        if not Confirm.ask(f"Proceed with removing {analysis['total_signals_to_clean']} signals below score {min_score}?"):
            console.print("[yellow]❌ Cleanup cancelled by user[/yellow]")
            return 0
        
        # Perform cleanup in batches with cascading deletes
        removed_count = 0
        batch_size = 100  # Process in smaller batches for safety
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Cleaning signals...", total=analysis['total_signals_to_clean'])
            
            # Get all signal IDs to remove
            query = self.client.table('volatility_squeeze_signals').select('id').lt('overall_score', min_score)
            
            # Apply date filters
            if target_date:
                query = query.eq('scan_date', target_date.isoformat())
            elif days_back:
                start_date = date.today() - timedelta(days=days_back)
                query = query.gte('scan_date', start_date.isoformat())
            
            response = query.execute()
            
            if response.data:
                signal_ids = [signal['id'] for signal in response.data]
                
                # Remove in batches with cascading deletes
                for i in range(0, len(signal_ids), batch_size):
                    batch_ids = signal_ids[i:i + batch_size]
                    
                    try:
                        # First, delete related performance tracking records
                        perf_delete_response = self.client.table('signal_performance').delete().in_(
                            'signal_id', batch_ids
                        ).execute()
                        
                        perf_deleted = len(perf_delete_response.data) if perf_delete_response.data else 0
                        if perf_deleted > 0:
                            logger.debug(f"Removed {perf_deleted} related performance records")
                        
                        # Then delete the signals themselves
                        delete_response = self.client.table('volatility_squeeze_signals').delete().in_(
                            'id', batch_ids
                        ).execute()
                        
                        batch_removed = len(delete_response.data) if delete_response.data else 0
                        removed_count += batch_removed
                        
                        progress.update(task, advance=batch_removed)
                        logger.debug(f"Removed batch of {batch_removed} signals")
                        
                    except Exception as e:
                        logger.error(f"Error removing signal batch: {e}")
                        # Continue with next batch even if one fails
                        continue
        
        console.print(f"[green]✅ Successfully removed {removed_count} signals below score {min_score}[/green]")
        return removed_count
    
    def _display_score_analysis(self, analysis: Dict, total_signals: int, dry_run: bool = True):
        """Display score analysis results in a formatted table."""
        console.print(f"\n[bold blue]📊 Signal Score Analysis Results[/bold blue]")
        console.print(f"Date Range: {analysis['date_range']}")
        console.print(f"Minimum Score Threshold: {analysis['min_score_threshold']}")
        console.print(f"Total Signals in Database: {total_signals}")
        console.print(f"Signals Below Threshold: {analysis['total_signals_to_clean']}")
        
        if total_signals > 0:
            percentage = (analysis['total_signals_to_clean'] / total_signals) * 100
            console.print(f"Percentage to Clean: {percentage:.1f}%")
        
        # Score range distribution
        if analysis['signals_by_score_range']:
            console.print(f"\n[bold yellow]📈 Score Range Distribution:[/bold yellow]")
            
            score_table = Table(show_header=True, header_style="bold magenta")
            score_table.add_column("Score Range", style="cyan")
            score_table.add_column("Count", justify="right", style="yellow")
            score_table.add_column("Action", style="blue")
            
            for score_range, count in analysis['signals_by_score_range'].items():
                if count > 0:
                    action = "Would remove" if dry_run else "Will remove"
                    score_table.add_row(score_range, str(count), f"{action} {count}")
            
            console.print(score_table)
        
        # Recommendation distribution
        if analysis['signals_by_recommendation']:
            console.print(f"\n[bold yellow]💡 Recommendation Distribution:[/bold yellow]")
            
            rec_table = Table(show_header=True, header_style="bold magenta")
            rec_table.add_column("Recommendation", style="cyan")
            rec_table.add_column("Count", justify="right", style="yellow")
            
            for rec, count in analysis['signals_by_recommendation'].items():
                rec_table.add_row(rec or "NONE", str(count))
            
            console.print(rec_table)
        
        # Opportunity rank distribution
        if analysis['signals_by_rank']:
            console.print(f"\n[bold yellow]🏆 Opportunity Rank Distribution:[/bold yellow]")
            
            rank_table = Table(show_header=True, header_style="bold magenta")
            rank_table.add_column("Rank", style="cyan")
            rank_table.add_column("Count", justify="right", style="yellow")
            
            for rank, count in analysis['signals_by_rank'].items():
                rank_table.add_row(rank or "UNRANKED", str(count))
            
            console.print(rank_table)
        
        # Actionable signals warning
        if analysis['actionable_signals_to_clean'] > 0:
            console.print(f"\n[bold red]⚠️  WARNING: {analysis['actionable_signals_to_clean']} actionable signals will be removed![/bold red]")
        
        # Related records warning
        if analysis.get('related_performance_records', 0) > 0:
            console.print(f"[bold yellow]📊 Related Records: {analysis['related_performance_records']} performance tracking records will also be deleted[/bold yellow]")
        
        # Sample signals
        if analysis['signals'] and len(analysis['signals']) > 0:
            console.print(f"\n[bold yellow]📋 Sample Signals to be Cleaned (showing first 10):[/bold yellow]")
            
            sample_table = Table(show_header=True, header_style="bold magenta")
            sample_table.add_column("Symbol", style="cyan")
            sample_table.add_column("Date", style="green")
            sample_table.add_column("Score", justify="right", style="red")
            sample_table.add_column("Recommendation", style="blue")
            sample_table.add_column("Rank", style="yellow")
            
            for signal in analysis['signals'][:10]:
                sample_table.add_row(
                    signal['symbol'],
                    signal['scan_date'],
                    f"{float(signal['overall_score']):.3f}",
                    signal.get('recommendation', 'NONE'),
                    signal.get('opportunity_rank', 'UNRANKED')
                )
            
            console.print(sample_table)
            
            if len(analysis['signals']) > 10:
                console.print(f"[dim]... and {len(analysis['signals']) - 10} more signals[/dim]")


async def main():
    """Main function to handle command line arguments and execute cleanup operations."""
    parser = argparse.ArgumentParser(
        description="Clean volatility squeeze signals based on minimum score threshold",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python clean_signals.py --min-score 0.80 --dry-run    # Preview cleanup for scores < 0.80
  python clean_signals.py --min-score 0.80              # Clean signals with score < 0.80
  python clean_signals.py --min-score 0.90 --date 2024-01-15  # Clean specific date
  python clean_signals.py --min-score 0.75 --days-back 7      # Clean last 7 days
  python clean_signals.py --min-score 0.60 --backup-only      # Create backup only
        """
    )
    
    parser.add_argument('--min-score', type=float, required=True,
                       help='Minimum score threshold (signals below this will be cleaned)')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be cleaned without making changes')
    parser.add_argument('--date', type=str, 
                       help='Clean signals for specific date (YYYY-MM-DD)')
    parser.add_argument('--days-back', type=int, 
                       help='Clean signals for last N days')
    parser.add_argument('--backup-only', action='store_true', 
                       help='Create backup only, do not clean')
    parser.add_argument('--backup-path', type=str, 
                       help='Custom backup file path')
    parser.add_argument('--confirm', action='store_true', 
                       help='Skip confirmation prompts (use with caution)')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.min_score < 0.0 or args.min_score > 1.0:
        console.print("[red]❌ Minimum score must be between 0.0 and 1.0[/red]")
        sys.exit(1)
    
    date_filters = sum([bool(args.date), bool(args.days_back)])
    if date_filters > 1:
        console.print("[red]❌ Please specify only one of: --date or --days-back[/red]")
        sys.exit(1)
    
    # Parse date if provided
    target_date = None
    if args.date:
        try:
            target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
        except ValueError:
            console.print("[red]❌ Invalid date format. Use YYYY-MM-DD[/red]")
            sys.exit(1)
    
    # Initialize cleaner
    console.print("[bold blue]🧹 Volatility Squeeze Scanner - Signal Score Cleaner[/bold blue]\n")
    cleaner = SignalCleaner()
    
    try:
        # Create backup if requested or if doing actual cleanup
        if args.backup_only or (not args.dry_run and not args.confirm):
            backup_path = await cleaner.create_backup(args.backup_path)
            if args.backup_only:
                console.print("[green]✅ Backup completed successfully[/green]")
                return
        
        # Perform cleanup
        removed_count = await cleaner.clean_signals_by_score(
            min_score=args.min_score,
            target_date=target_date,
            days_back=args.days_back,
            dry_run=args.dry_run
        )
        
        if args.dry_run:
            console.print(f"\n[blue]💡 To actually clean signals, run without --dry-run[/blue]")
        elif removed_count > 0:
            console.print(f"\n[green]🎉 Cleanup completed successfully! Removed {removed_count} signals below score {args.min_score}.[/green]")
        
    except KeyboardInterrupt:
        console.print("\n[yellow]❌ Operation cancelled by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]❌ Error during cleanup: {e}[/red]")
        logger.exception("Detailed error information:")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
