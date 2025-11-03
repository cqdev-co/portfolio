"""Storage helper functions for CLI."""

from rich.console import Console
from rich.table import Table
from datetime import datetime, timedelta

console = Console()


async def store_signals(config: dict, signals: list, use_continuity: bool = True) -> None:
    """
    Store signals in database with optional continuity tracking.
    
    Args:
        config: Configuration dictionary
        signals: List of signals to store
        use_continuity: Use deduplication and continuity tracking (default: True)
    """
    if not signals:
        console.print("[yellow]No signals to store[/yellow]")
        return
    
    try:
        if use_continuity:
            # Use continuity service for smart deduplication
            from .storage.continuity_service import create_continuity_service
            
            console.print(f"[cyan]Processing {len(signals)} signals with continuity tracking...[/cyan]")
            
            continuity_service = await create_continuity_service(config)
            
            # Process signals with deduplication
            stats = await continuity_service.process_signals(signals)
            
            # Mark stale signals as inactive
            stale_count = await continuity_service.mark_stale_signals(hours_threshold=3)
            
            if stats['failed_signals'] == 0:
                console.print(f"[green]✓ Stored {stats['new_signals']} new, updated {stats['updated_signals']}, marked {stale_count} inactive[/green]")
            else:
                console.print(f"[yellow]⚠ Stored {stats['new_signals']} new, updated {stats['updated_signals']}, {stats['failed_signals']} failed[/yellow]")
        else:
            # Legacy: Direct storage without continuity tracking
            from .storage.database import get_storage
            
            storage = get_storage(config)
            success = await storage.store_signals(signals)
            
            if success:
                console.print(f"[green]✓ Stored {len(signals)} signals in database[/green]")
            else:
                console.print("[red]✗ Failed to store signals in database[/red]")
            
    except Exception as e:
        console.print(f"[red]✗ Database storage error: {e}[/red]")


async def list_signals(config: dict, days: int, min_grade: str) -> None:
    """List recent signals from database."""
    from .storage.database import get_storage
    
    try:
        storage = get_storage(config)
        
        # Test connection first
        if not await storage.test_connection():
            console.print("[red]✗ Cannot connect to database[/red]")
            return
        
        # Calculate date range - include full days
        end_date = datetime.now().date() + timedelta(days=1)  # Include today
        start_date = end_date - timedelta(days=days + 1)  # Go back the specified days
        
        # Fetch signals
        signals = await storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=100
        )
        
        if signals:
            console.print(f"\n[green]Found {len(signals)} signals from last {days} days:[/green]\n")
            _display_signals_simple(signals)
        else:
            console.print(f"[yellow]No signals found in last {days} days with grade {min_grade}+[/yellow]")
            
    except Exception as e:
        console.print(f"[red]Error fetching signals: {e}[/red]")


def _display_signals_simple(signals: list) -> None:
    """Display signals in a simple table format."""
    table = Table(title="Recent Signals")
    table.add_column("Ticker", style="cyan")
    table.add_column("Grade", style="bold")
    table.add_column("Contract", style="magenta")
    table.add_column("Score", style="green")
    table.add_column("Premium", style="yellow")
    table.add_column("Date", style="dim")
    
    for signal in signals[:50]:  # Limit to 50 for readability
        grade_style = {
            'S': 'bold red',
            'A': 'bold yellow', 
            'B': 'bold blue',
            'C': 'bold green',
            'D': 'dim',
            'F': 'dim red'
        }.get(signal.grade, 'white')
        
        premium_str = f"${signal.premium_flow:,.0f}" if signal.premium_flow else "-"
        date_str = signal.detection_timestamp.strftime("%m/%d %H:%M")
        
        table.add_row(
            signal.ticker,
            f"[{grade_style}]{signal.grade}[/{grade_style}]",
            signal.option_symbol[-12:],  # Show last 12 chars
            f"{signal.overall_score:.3f}",
            premium_str,
            date_str
        )
    
    console.print(table)