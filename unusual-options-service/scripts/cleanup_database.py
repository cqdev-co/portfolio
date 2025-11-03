#!/usr/bin/env python3
"""
Database Cleanup Script for Unusual Options Scanner

Removes all unusual options data from the database for fresh testing.
Useful for testing the cron job system with a clean slate.

Usage:
    python scripts/cleanup_database.py                    # Interactive mode
    python scripts/cleanup_database.py --yes              # Skip confirmation
    python scripts/cleanup_database.py --table signals    # Clean specific table
    python scripts/cleanup_database.py --dry-run          # Show what would be deleted
"""

import asyncio
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from unusual_options.config import load_config
from supabase import create_client
from rich.console import Console
from rich.prompt import Confirm
from rich.table import Table

console = Console()


async def get_table_counts(supabase) -> dict:
    """Get record counts from all unusual options tables."""
    counts = {}
    
    tables = [
        'unusual_options_signals',
        'unusual_options_signal_continuity',
        'unusual_options_signal_performance'
    ]
    
    for table in tables:
        try:
            result = supabase.table(table).select('*', count='exact').limit(1).execute()
            counts[table] = result.count or 0
        except Exception as e:
            console.print(f"[yellow]Warning: Could not count {table}: {e}[/yellow]")
            counts[table] = 0
    
    return counts


async def cleanup_table(supabase, table_name: str, dry_run: bool = False) -> int:
    """
    Delete all records from a table.
    
    Args:
        supabase: Supabase client
        table_name: Name of table to clean
        dry_run: If True, don't actually delete
        
    Returns:
        Number of records that would be/were deleted
    """
    try:
        # Get count first
        result = supabase.table(table_name).select('*', count='exact').limit(1).execute()
        count = result.count or 0
        
        if count == 0:
            console.print(f"[dim]Table {table_name} is already empty[/dim]")
            return 0
        
        if dry_run:
            console.print(f"[yellow]Would delete {count} records from {table_name}[/yellow]")
            return count
        
        # Delete all records
        # Supabase requires a filter, so we use a condition that matches all
        delete_result = supabase.table(table_name).delete().neq('created_at', '1900-01-01').execute()
        
        console.print(f"[green]✓ Deleted {count} records from {table_name}[/green]")
        return count
        
    except Exception as e:
        console.print(f"[red]✗ Error cleaning {table_name}: {e}[/red]")
        return 0


async def main():
    """Main cleanup script."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Clean unusual options database for fresh testing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive cleanup (with confirmation)
  python scripts/cleanup_database.py
  
  # Auto-confirm (no prompt)
  python scripts/cleanup_database.py --yes
  
  # Clean specific table only
  python scripts/cleanup_database.py --table signals
  
  # Dry run (see what would be deleted)
  python scripts/cleanup_database.py --dry-run
  
  # Clean all performance tracking data
  python scripts/cleanup_database.py --table performance --yes

Tables:
  signals     - unusual_options_signals (main signals)
  continuity  - unusual_options_signal_continuity (detection history)
  performance - unusual_options_signal_performance (tracking)
  all         - All tables (default)
        """
    )
    
    parser.add_argument(
        '--table',
        choices=['signals', 'continuity', 'performance', 'all'],
        default='all',
        help='Which table to clean (default: all)'
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without deleting'
    )
    
    args = parser.parse_args()
    
    # Load config
    try:
        config = load_config()
    except Exception as e:
        console.print(f"[red]Error loading config: {e}[/red]")
        console.print("[yellow]Make sure you have a .env file or environment variables set[/yellow]")
        sys.exit(1)
    
    # Connect to Supabase
    try:
        url = config.get('SUPABASE_URL')
        key = config.get('SUPABASE_SERVICE_KEY') or config.get('SUPABASE_KEY')
        
        if not url or not key:
            console.print("[red]Error: SUPABASE_URL and SUPABASE_KEY must be set[/red]")
            sys.exit(1)
        
        supabase = create_client(url, key)
        console.print("[green]✓ Connected to Supabase[/green]\n")
        
    except Exception as e:
        console.print(f"[red]Error connecting to Supabase: {e}[/red]")
        sys.exit(1)
    
    # Get current counts
    console.print("[cyan]Checking current database state...[/cyan]")
    counts = await get_table_counts(supabase)
    
    # Display current state
    table = Table(title="Current Database State")
    table.add_column("Table", style="cyan")
    table.add_column("Records", style="yellow", justify="right")
    
    table_map = {
        'signals': 'unusual_options_signals',
        'continuity': 'unusual_options_signal_continuity',
        'performance': 'unusual_options_signal_performance'
    }
    
    total_records = 0
    for display_name, table_name in table_map.items():
        count = counts.get(table_name, 0)
        total_records += count
        table.add_row(display_name, str(count))
    
    table.add_row("[bold]TOTAL[/bold]", f"[bold]{total_records}[/bold]")
    console.print(table)
    console.print()
    
    if total_records == 0:
        console.print("[green]✓ Database is already empty![/green]")
        return
    
    # Determine which tables to clean
    if args.table == 'all':
        tables_to_clean = list(table_map.values())
        action_description = "ALL unusual options data"
    else:
        tables_to_clean = [table_map[args.table]]
        action_description = f"data from {args.table}"
    
    # Confirmation
    if args.dry_run:
        console.print(f"[yellow]DRY RUN - No data will be deleted[/yellow]\n")
    elif not args.yes:
        console.print(f"[bold red]WARNING: This will DELETE {action_description}![/bold red]")
        console.print("[dim]This action cannot be undone.[/dim]\n")
        
        if not Confirm.ask("Are you sure you want to continue?"):
            console.print("[yellow]Cancelled[/yellow]")
            return
    
    # Clean tables
    console.print()
    if args.dry_run:
        console.print("[yellow]DRY RUN - Showing what would be deleted:[/yellow]\n")
    else:
        console.print("[cyan]Cleaning database...[/cyan]\n")
    
    total_deleted = 0
    for table_name in tables_to_clean:
        deleted = await cleanup_table(supabase, table_name, dry_run=args.dry_run)
        total_deleted += deleted
    
    # Summary
    console.print()
    if args.dry_run:
        console.print(f"[yellow]DRY RUN: Would delete {total_deleted} total records[/yellow]")
    else:
        console.print(f"[green]✓ Cleanup complete! Deleted {total_deleted} total records[/green]")
        console.print("\n[dim]You can now run a fresh scan to see new signals with NEW badges[/dim]")


if __name__ == '__main__':
    asyncio.run(main())

