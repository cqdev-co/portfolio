"""Command-line interface for unusual options scanner."""

import asyncio
from typing import Optional
from datetime import date
import click
from rich.console import Console
from rich.table import Table
from loguru import logger

from .config import load_config, setup_logging

console = Console()

# Cache for earnings dates (shared across CLI invocations)
_earnings_cache = {}

def get_earnings_date(ticker: str) -> Optional[date]:
    """Get next earnings date for a ticker using yfinance (with caching)"""
    if ticker in _earnings_cache:
        return _earnings_cache[ticker]
    
    try:
        import yfinance as yf
        yf_ticker = yf.Ticker(ticker)
        calendar = yf_ticker.calendar
        
        if calendar and 'Earnings Date' in calendar:
            earnings_dates = calendar['Earnings Date']
            if isinstance(earnings_dates, list) and len(earnings_dates) > 0:
                next_earnings = earnings_dates[0]
                _earnings_cache[ticker] = next_earnings
                return next_earnings
            elif isinstance(earnings_dates, date):
                _earnings_cache[ticker] = earnings_dates
                return earnings_dates
    except Exception:
        # Silently fail - not all tickers have earnings data
        pass
    
    _earnings_cache[ticker] = None
    return None

def days_to_earnings(ticker: str, reference_date: date = None) -> Optional[int]:
    """Calculate days until next earnings date"""
    if reference_date is None:
        reference_date = date.today()
    
    earnings_date = get_earnings_date(ticker)
    if earnings_date:
        delta = (earnings_date - reference_date).days
        return delta if delta >= 0 else None
    return None


@click.group()
@click.version_option(version="0.1.0")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """🕵️ Unusual Options Activity Scanner
    
    Find large, suspicious options bets that might indicate insider information.
    
    Example: Someone buys $6.5M in ORCL calls 4 days before OpenAI partnership news.
    Goal: Detect these plays BEFORE the news drops so you can follow the smart money.
    """
    # Load config and setup logging
    ctx.ensure_object(dict)
    ctx.obj['config'] = load_config()
    setup_logging(ctx.obj['config'])


@cli.command()
@click.argument('tickers', nargs=-1, required=True)
@click.option('--watch', is_flag=True, help='Continuously monitor')
@click.option('--interval', default=300, help='Watch interval in seconds')
@click.option('--min-grade', default='C', help='Minimum signal grade')
@click.option('--output', type=click.Path(), help='Output file path')
@click.option('--store', is_flag=True, help='Store signals in database')
@click.pass_context
def scan(
    ctx: click.Context,
    tickers: tuple,
    watch: bool,
    interval: int,
    min_grade: str,
    output: str,
    store: bool
) -> None:
    """Scan specific tickers for large, suspicious options bets
    
    Looks for:
    • Large premium flow ($1M+)
    • Short-dated positions (someone knows timing)
    • Aggressive buying (desperate to get in)
    • Unusual volume spikes
    
    Examples:
      unusual-options scan ORCL              # Single ticker
      unusual-options scan AAPL MSFT NVDA    # Multiple tickers
      unusual-options scan TSLA --min-grade A --store  # High-grade only, save to DB
    """
    import asyncio
    from .scanner.orchestrator import ScanOrchestrator
    
    config = ctx.obj['config']
    
    if watch:
        console.print(f"[yellow]Monitoring {', '.join(tickers)} every {interval}s[/yellow]")
        console.print("[dim]Press Ctrl+C to stop[/dim]\n")
        
        import time
        try:
            while True:
                asyncio.run(_run_scan(config, list(tickers), min_grade, output, store))
                time.sleep(interval)
        except KeyboardInterrupt:
            console.print("\n[yellow]Stopping monitor...[/yellow]")
    else:
        asyncio.run(_run_scan(config, list(tickers), min_grade, output, store))


@cli.command(name='scan-all')
@click.option('--limit', default=None, type=int, help='Maximum number of tickers to scan (default: unlimited)')
@click.option('--min-grade', default='B', help='Minimum signal grade to display')
@click.option('--output', type=click.Path(), help='Output file path')
@click.option('--store', is_flag=True, help='Store signals in database')
@click.pass_context
def scan_all(
    ctx: click.Context,
    limit: Optional[int],
    min_grade: str,
    output: str,
    store: bool
) -> None:
    """Scan entire market for suspicious options activity
    
    Scans 2500+ liquid tickers looking for insider-type plays:
    • Large concentrated bets ($3M+)
    • Urgent short-dated positioning
    • Fresh new interest (volume >> open interest)
    
    Examples:
      unusual-options scan-all                    # Scan all tickers
      unusual-options scan-all --min-grade A --store  # High-grade, save to DB
      unusual-options scan-all --limit 500        # Scan first 500 tickers (faster)
    """
    import asyncio
    from .scanner.orchestrator import ScanOrchestrator
    
    config = ctx.obj['config']
    
    console.print(f"[yellow]Scanning all liquid tickers (limit: {limit or 'unlimited'}, min grade: {min_grade})[/yellow]")
    console.print("[dim]This may take several minutes...[/dim]\n")
    
    asyncio.run(_run_scan_all(config, limit, min_grade, output, store))


@cli.command()
@click.option('--days', default=7, help='Number of days to look back')
@click.option('--min-grade', default='C', help='Minimum signal grade')
@click.pass_context
def signals(ctx: click.Context, days: int, min_grade: str) -> None:
    """List recent signals from database
    
    Examples:
    
      unusual-options signals --days 7
      
      unusual-options signals --days 30 --min-grade A
    """
    config = ctx.obj['config']
    
    console.print(f"[yellow]Fetching signals from last {days} days...[/yellow]")
    
    from .storage_helpers import list_signals
    asyncio.run(list_signals(config, days, min_grade))


@cli.command()
@click.pass_context
def status(ctx: click.Context) -> None:
    """Check system status and connectivity
    
    Verifies:
    - Supabase connection
    - Data provider connection
    - Configuration validity
    """
    config = ctx.obj['config']
    
    console.print("\n[bold]System Status Check[/bold]\n")
    
    # Check configuration
    has_supabase = bool(config.get('SUPABASE_URL') and config.get('SUPABASE_KEY'))
    has_provider = bool(config.get('DATA_PROVIDER'))
    
    if has_supabase:
        console.print("✓ Supabase: [green]Configured[/green]")
    else:
        console.print("✗ Supabase: [red]Not configured[/red]")
    
    if has_provider:
        provider = config.get('DATA_PROVIDER')
        console.print(f"✓ Data Provider: [green]{provider}[/green]")
    else:
        console.print("✗ Data Provider: [red]Not configured[/red]")
    
    # Check detection thresholds
    console.print(f"\n[bold]Detection Thresholds:[/bold]")
    console.print(f"  Volume Multiplier: {config.get('VOLUME_MULTIPLIER_THRESHOLD')}x")
    console.print(f"  OI Change: {config.get('OI_CHANGE_THRESHOLD'):.0%}")
    console.print(f"  Min Premium Flow: ${config.get('MIN_PREMIUM_FLOW'):,.0f}")
    
    if has_supabase and has_provider:
        console.print("\n[green]✓ System configured and ready[/green]")
    else:
        console.print("\n[yellow]⚠ System not fully configured. See .env.example[/yellow]")


@cli.command()
@click.option('--start', required=True, help='Start date (YYYY-MM-DD)')
@click.option('--end', required=True, help='End date (YYYY-MM-DD)')
@click.option('--tickers', help='Comma-separated ticker list')
@click.pass_context
def backtest(ctx: click.Context, start: str, end: str, tickers: str) -> None:
    """Run historical backtest of detection algorithm
    
    Examples:
    
      unusual-options backtest --start 2024-01-01 --end 2024-12-31
      
      unusual-options backtest --start 2024-01-01 --end 2024-12-31 --tickers AAPL,MSFT
    """
    console.print(f"[yellow]Running backtest from {start} to {end}...[/yellow]")
    
    # TODO: Implement backtesting
    console.print("[red]Backtesting not yet implemented[/red]")
    console.print("[dim]Coming soon in next development phase[/dim]")


@cli.command()
def init() -> None:
    """Initialize the unusual options scanner
    
    This command:
    - Checks for .env file
    - Tests database connection
    - Verifies API credentials
    - Creates necessary directories
    """
    console.print("[bold]Initializing Unusual Options Scanner...[/bold]\n")
    
    # Check for .env file
    from pathlib import Path
    env_path = Path(".env")
    
    if not env_path.exists():
        console.print("[yellow]⚠ No .env file found[/yellow]")
        console.print("Creating .env from template...")
        
        example_path = Path(".env.example")
        if example_path.exists():
            env_path.write_text(example_path.read_text())
            console.print("[green]✓ Created .env file[/green]")
            console.print("[yellow]Please edit .env with your credentials[/yellow]")
        else:
            console.print("[red]✗ .env.example not found[/red]")
    else:
        console.print("[green]✓ .env file exists[/green]")
    
    # Create directories
    directories = ["logs", "data", "cache"]
    for directory in directories:
        path = Path(directory)
        path.mkdir(exist_ok=True)
        console.print(f"✓ Created directory: {directory}")
    
    console.print("\n[green]✓ Initialization complete[/green]")
    console.print("\nNext steps:")
    console.print("1. Edit .env with your API credentials")
    console.print("2. Run 'unusual-options status' to verify configuration")
    console.print("3. Run 'unusual-options scan AAPL' to test scanning")


async def _run_scan(config: dict, tickers: list, min_grade: str, output: str, store: bool = False) -> None:
    """Execute a scan operation."""
    from .scanner.orchestrator import ScanOrchestrator
    from rich.progress import Progress, SpinnerColumn, TextColumn
    
    orchestrator = ScanOrchestrator(config)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(f"Scanning {len(tickers)} tickers...", total=None)
        
        try:
            # When user explicitly requests specific tickers, bypass blocking filters
            # (they know what they want to scan)
            if len(tickers) == 1:
                signals = await orchestrator.scan_ticker(tickers[0], skip_blocking=True)
            else:
                signals = await orchestrator.scan_multiple(tickers, skip_blocking=True)
            
            progress.update(task, completed=True)
            
        except Exception as e:
            progress.stop()
            console.print(f"[red]Error during scan: {e}[/red]")
            return
    
    # Store signals in database if requested
    if store and signals:
        from .storage_helpers import store_signals
        await store_signals(config, signals)
    
    # Filter by minimum grade
    filtered_signals = _filter_signals_by_grade(signals, min_grade)
    
    # Display results
    if filtered_signals:
        _display_results_table(filtered_signals)
        
        if output:
            _export_results(filtered_signals, output)
            console.print(f"\n[green]Results exported to {output}[/green]")
    else:
        console.print(f"[yellow]No unusual activity detected (grade {min_grade}+)[/yellow]")


async def _run_scan_all(config: dict, limit: Optional[int], min_grade: str, output: str, store: bool = False) -> None:
    """Execute a scan-all operation."""
    from .scanner.orchestrator import ScanOrchestrator
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
    
    orchestrator = ScanOrchestrator(config)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress:
        task = progress.add_task("Scanning all tickers...", total=100)
        
        try:
            signals = await orchestrator.scan_all_tickers(min_grade=min_grade, limit=limit)
            progress.update(task, completed=100)
            
        except Exception as e:
            progress.stop()
            console.print(f"[red]Error during scan-all: {e}[/red]")
            return
    
    # Store signals in database if requested
    if store and signals:
        from .storage_helpers import store_signals
        await store_signals(config, signals)
    
    # Display results
    if signals:
        _display_results_table(signals)
        
        if output:
            _export_results(signals, output)
            console.print(f"\n[green]Results exported to {output}[/green]")
    else:
        console.print(f"[yellow]No unusual activity detected across {limit} tickers (grade {min_grade}+)[/yellow]")


def _filter_signals_by_grade(signals: list, min_grade: str) -> list:
    """Filter signals by minimum grade."""
    grade_order = {'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
    min_grade_value = grade_order.get(min_grade.upper(), 3)
    
    return [
        s for s in signals 
        if grade_order.get(s.grade, 1) >= min_grade_value
    ]


def _display_results_table(signals: list) -> None:
    """Display signals in formatted table - focused on insider-type characteristics."""
    
    # Sort by premium flow (largest bets first) - that's what matters for insider plays
    sorted_signals = sorted(signals, key=lambda s: s.premium_flow if s.premium_flow else 0, reverse=True)
    
    table = Table(
        title="🕵️ Unusual Options Activity (Sorted by Premium Flow)",
        show_lines=True,
        box=None
    )
    
    table.add_column("Ticker\nContract", style="cyan bold", no_wrap=True)
    table.add_column("Grade\nScore", justify="center")
    table.add_column("Premium\nFlow", justify="right", style="green")
    table.add_column("Strike\nExpiry", justify="right")
    table.add_column("Type\nMoneyness", justify="center")
    table.add_column("Suspicion Level", style="yellow")
    
    for signal in sorted_signals[:25]:  # Top 25
        grade_color = {
            'S': 'bold bright_magenta',
            'A': 'bold green',
            'B': 'green',
            'C': 'yellow',
            'D': 'red',
            'F': 'dim red'
        }.get(signal.grade, 'white')
        
        # Format premium (most important for insider plays)
        if signal.premium_flow and signal.premium_flow > 0:
            premium_millions = signal.premium_flow / 1_000_000
            if premium_millions >= 1:
                premium_str = f"${premium_millions:.1f}M"
            else:
                premium_str = f"${signal.premium_flow/1000:.0f}K"
        else:
            premium_str = "-"
        
        # Calculate "suspicion level" based on key factors
        suspicion_factors = []
        suspicion_score = 0
        
        # Large premium = more suspicious
        if signal.premium_flow:
            if signal.premium_flow >= 5_000_000:
                suspicion_factors.append("LARGE BET")
                suspicion_score += 30
            elif signal.premium_flow >= 2_000_000:
                suspicion_factors.append("Big size")
                suspicion_score += 20
        
        # Short DTE = knows timing
        if signal.days_to_expiry:
            if signal.days_to_expiry <= 7:
                suspicion_factors.append("URGENT")
                suspicion_score += 25
            elif signal.days_to_expiry <= 14:
                suspicion_factors.append("Near-term")
                suspicion_score += 15
        
        # ITM/ATM = conviction
        if signal.moneyness in ['ITM', 'ATM']:
            suspicion_factors.append("Conviction")
            suspicion_score += 15
        
        # High grade
        if signal.grade == 'S':
            suspicion_factors.append("S-GRADE")
            suspicion_score += 30
        elif signal.grade == 'A':
            suspicion_factors.append("A-grade")
            suspicion_score += 20
        
        # Aggressive orders
        if signal.aggressive_order_pct and signal.aggressive_order_pct >= 0.70:
            suspicion_factors.append("Aggressive")
            suspicion_score += 10
        
        # Earnings proximity (very important for insider plays)
        days_until_earnings = days_to_earnings(signal.ticker)
        if days_until_earnings is not None and 0 <= days_until_earnings <= 14:
            if days_until_earnings == 0:
                suspicion_factors.append("📊 EARNINGS TODAY")
                suspicion_score += 35
            elif days_until_earnings <= 3:
                suspicion_factors.append(f"📊 Earnings {days_until_earnings}d")
                suspicion_score += 25
            elif days_until_earnings <= 7:
                suspicion_factors.append(f"Earnings {days_until_earnings}d")
                suspicion_score += 15
        
        suspicion_text = " | ".join(suspicion_factors) if suspicion_factors else "Standard"
        
        # Color code suspicion
        if suspicion_score >= 70:
            suspicion_style = "bold red"
        elif suspicion_score >= 50:
            suspicion_style = "bold yellow"
        else:
            suspicion_style = "dim"
        
        # Option type emoji
        type_emoji = "📈" if signal.option_type == 'call' else "📉"
        
        table.add_row(
            f"{signal.ticker}\n{signal.option_symbol}",
            f"[{grade_color}]{signal.grade}[/{grade_color}]\n{signal.overall_score:.2f}",
            f"[bold]{premium_str}[/bold]",
            f"${signal.strike:.0f}\n{signal.days_to_expiry}d",
            f"{type_emoji} {signal.option_type.upper()}\n{signal.moneyness}",
            f"[{suspicion_style}]{suspicion_text}[/{suspicion_style}]"
        )
    
    console.print(table)
    
    # Summary with focus on large plays
    large_plays = [s for s in sorted_signals if s.premium_flow and s.premium_flow >= 3_000_000]
    urgent_plays = [s for s in sorted_signals if s.days_to_expiry and s.days_to_expiry <= 7]
    
    console.print()
    console.print(f"[bold]Summary:[/bold]")
    console.print(f"• Total signals: {len(signals)}")
    console.print(f"• Large bets (>$3M): [bold yellow]{len(large_plays)}[/bold yellow]")
    console.print(f"• Urgent plays (≤7 days): [bold red]{len(urgent_plays)}[/bold red]")
    if signals:
        total_premium = sum([s.premium_flow for s in signals if s.premium_flow])
        console.print(f"• Total premium flow: [bold green]${total_premium/1_000_000:.1f}M[/bold green]")


def _export_results(signals: list, output_path: str) -> None:
    """Export results to file."""
    import json
    from pathlib import Path
    
    # Convert signals to dictionaries
    results = []
    for signal in signals:
        result = {
            'ticker': signal.ticker,
            'option_symbol': signal.option_symbol,
            'grade': signal.grade,
            'score': signal.overall_score,
            'volume': signal.current_volume,
            'premium_flow': signal.premium_flow,
            'sentiment': signal.sentiment,
            'detection_timestamp': signal.detection_timestamp.isoformat(),
            'strike': signal.strike,
            'expiry': signal.expiry.isoformat(),
            'days_to_expiry': signal.days_to_expiry,
            'underlying_price': signal.underlying_price
        }
        results.append(result)
    
    # Write to file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    if output_path.endswith('.json'):
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
    else:
        # Default to JSON
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)


if __name__ == '__main__':
    cli(obj={})

