"""Command-line interface for the penny stock scanner."""

import asyncio
from datetime import datetime, date
from typing import List, Optional
import json

import typer
from typer import Typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from loguru import logger

from penny_scanner.config.settings import get_settings
from penny_scanner.services.data_service import DataService
from penny_scanner.services.analysis_service import AnalysisService
from penny_scanner.services.ticker_service import TickerService
from penny_scanner.services.database_service import DatabaseService
from penny_scanner.services.signal_continuity_service import SignalContinuityService

# Initialize console
console = Console()

app = typer.Typer(
    name="penny-scanner",
    help="Professional-grade penny stock scanner for explosion setups"
)


def get_services():
    """Initialize and return service instances."""
    try:
        settings = get_settings()
        
        data_service = DataService(settings)
        analysis_service = AnalysisService(settings)
        ticker_service = TickerService(settings)
        database_service = DatabaseService(settings)
        
        # Signal continuity service (requires database)
        continuity_service = None
        if database_service.is_available():
            continuity_service = SignalContinuityService(database_service)
        
        # Show service status
        if ticker_service.is_available():
            console.print(
                "[green]✅ Ticker service ready "
                f"({ticker_service.get_ticker_count()} penny stocks)[/green]"
            )
        else:
            console.print(
                "[yellow]⚠️  Ticker service unavailable - "
                "will use provided symbols[/yellow]"
            )
        
        if database_service.is_available():
            console.print(
                "[green]✅ Database service ready for signal storage[/green]"
            )
            if continuity_service:
                console.print(
                    "[green]✅ Signal continuity tracking enabled[/green]"
                )
        else:
            console.print(
                "[yellow]⚠️  Database service unavailable - "
                "signals won't be stored[/yellow]"
            )
        
        return (data_service, analysis_service, ticker_service, 
                database_service, continuity_service)
        
    except Exception as e:
        console.print(f"[red]❌ Failed to initialize services: {e}[/red]")
        raise


@app.command()
def analyze(
    symbol: str = typer.Argument(..., help="Stock symbol to analyze"),
    output: Optional[str] = typer.Option(
        None, "--output", help="Output file (JSON)"
    )
) -> None:
    """Analyze a single penny stock for explosion setup signals."""
    
    async def _analyze():
        data_service, analysis_service, _, _, _ = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            # Fetch data
            task = progress.add_task(
                f"Fetching data for {symbol}...", total=None
            )
            market_data = await data_service.get_market_data(symbol, "6mo")
            progress.update(task, description=f"Analyzing {symbol}...")
            
            # Perform analysis
            result = await analysis_service.analyze_symbol(
                market_data,
                include_ai_analysis=False
            )
            
            if not result:
                progress.update(task, description="No signals found")
                console.print(
                    f"[yellow]No explosion setup signals found for "
                    f"{symbol}[/yellow]"
                )
                return
            
            progress.update(task, description="Complete!")
        
        # Display results
        _display_analysis_result(result)
        
        # Save to file if requested
        if output:
            with open(output, 'w') as f:
                json.dump(result.dict(), f, indent=2, default=str)
            console.print(f"[green]Results saved to {output}[/green]")
    
    asyncio.run(_analyze())


@app.command()
def batch(
    symbols: str = typer.Argument(
        ..., help="Comma-separated symbols to analyze"
    ),
    min_score: float = typer.Option(
        0.60, "--min-score", help="Minimum signal score threshold"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", help="Output file (JSON)"
    ),
    store: bool = typer.Option(
        True, "--store/--no-store", help="Store results in database"
    )
) -> None:
    """Analyze multiple penny stocks in batch."""
    
    async def _batch_analyze():
        (data_service, analysis_service, 
         _, database_service, continuity_service) = get_services()
        
        # Parse symbols
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            task = progress.add_task(
                "Fetching data...", total=len(symbol_list)
            )
            
            # Fetch data
            symbol_data = await data_service.get_multiple_symbols(
                symbol_list, "6mo"
            )
            progress.update(task, advance=len(symbol_data))
            
            # Analyze each symbol
            results = []
            for symbol, market_data in symbol_data.items():
                progress.update(task, description=f"Analyzing {symbol}...")
                
                try:
                    result = await analysis_service.analyze_symbol(
                        market_data,
                        include_ai_analysis=False
                    )
                    
                    if result and result.overall_score >= min_score:
                        results.append(result)
                        
                except Exception as e:
                    console.print(f"[red]Error analyzing {symbol}: {e}[/red]")
                
                progress.update(task, advance=1)
        
        # Process signal continuity
        if results and continuity_service:
            try:
                today = date.today()
                console.print(
                    "[bold blue]🔄 Processing signal continuity...[/bold blue]"
                )
                results = await continuity_service.process_signals_with_continuity(
                    results, today
                )
                
                # Show continuity stats
                new_count = len([
                    s for s in results 
                    if s.explosion_signal.signal_status.value == 'NEW'
                ])
                continuing_count = len([
                    s for s in results 
                    if s.explosion_signal.signal_status.value == 'CONTINUING'
                ])
                console.print(
                    f"[green]✅ Continuity: {new_count} NEW, "
                    f"{continuing_count} CONTINUING[/green]"
                )
            except Exception as e:
                console.print(
                    f"[yellow]⚠️  Continuity tracking failed: {e}[/yellow]"
                )
        
        # Store signals in database
        if results and store and database_service.is_available():
            try:
                today = date.today()
                stored_count = await database_service.store_signals_batch(
                    results, today
                )
                if stored_count > 0:
                    console.print(
                        f"[green]💾 Stored {stored_count} signals "
                        f"in database[/green]"
                    )
            except Exception as e:
                console.print(
                    f"[yellow]⚠️  Failed to store signals: {e}[/yellow]"
                )
        
        # Display results
        if results:
            _display_batch_results(results, min_score)
        else:
            console.print(
                f"[yellow]No signals found above threshold {min_score}[/yellow]"
            )
        
        # Save to file if requested
        if output and results:
            results_data = [r.dict() for r in results]
            with open(output, 'w') as f:
                json.dump(results_data, f, indent=2, default=str)
            console.print(f"[green]Results saved to {output}[/green]")
    
    asyncio.run(_batch_analyze())


@app.command()
def scan_all(
    min_score: float = typer.Option(
        0.70, "--min-score", help="Minimum signal score threshold"
    ),
    max_symbols: Optional[int] = typer.Option(
        None, "--max-symbols", help="Maximum symbols to scan"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", help="Output file (JSON)"
    ),
    store: bool = typer.Option(
        True, "--store/--no-store", help="Store results in database"
    )
) -> None:
    """Scan all available penny stocks for explosion setups."""
    
    async def _scan_all():
        (data_service, analysis_service,
         ticker_service, database_service, continuity_service) = get_services()
        
        try:
            # Get all penny stock symbols
            if ticker_service.is_available():
                console.print(
                    "[bold blue]📊 Fetching penny stock symbols...[/bold blue]"
                )
                all_symbols = ticker_service.get_all_symbols()
                
                if max_symbols and len(all_symbols) > max_symbols:
                    console.print(
                        f"[yellow]⚠️  Limiting to {max_symbols} symbols "
                        f"(found {len(all_symbols)})[/yellow]"
                    )
                    all_symbols = all_symbols[:max_symbols]
                
                console.print(
                    f"[green]🔍 Scanning {len(all_symbols)} "
                    f"penny stocks[/green]"
                )
            else:
                console.print(
                    "[red]❌ Ticker service unavailable[/red]"
                )
                return
            
            if not all_symbols:
                console.print("[red]❌ No symbols found[/red]")
                return
            
            # Fetch market data
            console.print(
                "[bold blue]📈 Fetching market data...[/bold blue]"
            )
            
            symbol_data = await data_service.get_multiple_symbols(
                all_symbols, "6mo"
            )
            
            console.print(
                f"✅ Retrieved data for {len(symbol_data)}/{len(all_symbols)} "
                f"symbols"
            )
            
            # Analyze symbols
            console.print(
                f"[bold blue]🔬 Analyzing for explosion setups...[/bold blue]"
            )
            
            signals = []
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task(
                    "Analyzing...", total=len(symbol_data)
                )
                
                for symbol, market_data in symbol_data.items():
                    try:
                        result = await analysis_service.analyze_symbol(
                            market_data,
                            include_ai_analysis=False
                        )
                        if result and result.overall_score >= min_score:
                            signals.append(result)
                    except Exception as e:
                        logger.debug(f"Analysis failed for {symbol}: {e}")
                    
                    progress.update(task, advance=1)
            
            # Get today's date for continuity and storage
            today = date.today()
            
            # Process signal continuity
            if signals and continuity_service:
                try:
                    console.print(
                        "[bold blue]🔄 Processing signal continuity...[/bold blue]"
                    )
                    signals = await continuity_service.process_signals_with_continuity(
                        signals, today
                    )
                    
                    # Show continuity stats
                    new_count = len([
                        s for s in signals 
                        if s.explosion_signal.signal_status.value == 'NEW'
                    ])
                    continuing_count = len([
                        s for s in signals 
                        if s.explosion_signal.signal_status.value == 'CONTINUING'
                    ])
                    console.print(
                        f"[green]✅ Continuity: {new_count} NEW, "
                        f"{continuing_count} CONTINUING[/green]"
                    )
                except Exception as e:
                    console.print(
                        f"[yellow]⚠️  Continuity tracking failed: {e}[/yellow]"
                    )
            
            # Store signals
            if signals and store and database_service.is_available():
                try:
                    stored_count = await database_service.store_signals_batch(
                        signals, today
                    )
                    if stored_count > 0:
                        console.print(
                            f"[green]💾 Stored {stored_count} signals[/green]"
                        )
                except Exception as e:
                    console.print(
                        f"[yellow]⚠️  Failed to store signals: {e}[/yellow]"
                    )
            
            # Display results
            if signals:
                signals.sort(key=lambda x: x.overall_score, reverse=True)
                
                console.print(
                    f"\n[bold green]🎯 Found {len(signals)} explosion setups "
                    f"(min score: {min_score})[/bold green]\n"
                )
                
                _display_scan_results(signals)
                
                # Save to file if requested
                if output:
                    results_data = [
                        {
                            "symbol": s.symbol,
                            "overall_score": s.overall_score,
                            "opportunity_rank": s.opportunity_rank.value,
                            "recommendation": s.recommendation,
                            "close_price": s.explosion_signal.close_price,
                            "volume_ratio": s.explosion_signal.volume_ratio,
                            "volume_spike_factor": (
                                s.explosion_signal.volume_spike_factor
                            ),
                            "is_breakout": s.explosion_signal.is_breakout,
                            "is_consolidating": (
                                s.explosion_signal.is_consolidating
                            ),
                            "trend_direction": (
                                s.explosion_signal.trend_direction.value
                            ),
                            "analysis_timestamp": s.timestamp.isoformat()
                        }
                        for s in signals
                    ]
                    
                    with open(output, 'w') as f:
                        json.dump(results_data, f, indent=2)
                    console.print(f"[green]💾 Results saved to {output}[/green]")
            else:
                console.print(
                    f"[yellow]❌ No signals found above threshold "
                    f"{min_score}[/yellow]"
                )
                console.print(
                    "[dim]Try lowering the --min-score threshold[/dim]"
                )
            
            # Summary stats
            console.print(f"\n[bold]📊 Scan Summary:[/bold]")
            console.print(f"   Symbols scanned: {len(all_symbols)}")
            console.print(f"   Data retrieved: {len(symbol_data)}")
            console.print(f"   Signals found: {len(signals)}")
            if symbol_data:
                signal_rate = len(signals) / len(symbol_data) * 100
                console.print(f"   Signal rate: {signal_rate:.1f}%")
            
        except Exception as e:
            console.print(f"[red]❌ Error during scan: {e}[/red]")
            raise typer.Exit(1)
    
    asyncio.run(_scan_all())


@app.command()
def query(
    limit: int = typer.Option(50, "--limit", help="Maximum signals to return"),
    min_score: Optional[float] = typer.Option(
        None, "--min-score", help="Minimum score filter"
    ),
    recommendation: Optional[str] = typer.Option(
        None, "--recommendation", help="Filter by recommendation"
    ),
    scan_date: Optional[str] = typer.Option(
        None, "--date", help="Filter by date (YYYY-MM-DD)"
    )
) -> None:
    """Query stored penny stock signals from database."""
    
    async def _query():
        _, _, _, database_service, _ = get_services()
        
        if not database_service.is_available():
            console.print("[red]❌ Database service not available[/red]")
            return
        
        try:
            if scan_date:
                query_date = datetime.strptime(scan_date, "%Y-%m-%d").date()
                signals = await database_service.get_signals_by_date(
                    query_date
                )
                console.print(
                    f"[bold blue]📊 Signals for {scan_date}[/bold blue]"
                )
            else:
                signals = await database_service.get_latest_signals(
                    limit=limit,
                    min_score=min_score,
                    recommendation=recommendation
                )
                console.print(
                    f"[bold blue]📊 Latest {limit} signals[/bold blue]"
                )
            
            if not signals:
                console.print(
                    "[yellow]No signals found matching criteria[/yellow]"
                )
                return
            
            # Display results
            _display_query_results(signals)
            
        except Exception as e:
            console.print(f"[red]❌ Error querying signals: {e}[/red]")
    
    asyncio.run(_query())


@app.command()
def version() -> None:
    """Show version information and system status."""
    console.print("[bold blue]Penny Stock Scanner[/bold blue]")
    console.print("Version: 0.1.0")
    console.print("Strategy: Volume-focused explosion setup detection")
    
    try:
        settings = get_settings()
        console.print("[green]✅ Settings loaded successfully[/green]")
        
        # Validate scoring weights
        if settings.validate_weights():
            console.print("[green]✅ Scoring weights validated (sum = 1.0)[/green]")
        else:
            console.print("[yellow]⚠️  Scoring weights don't sum to 1.0[/yellow]")
        
        # Check database
        if settings.is_database_enabled():
            console.print("[green]✅ Database configured[/green]")
        else:
            console.print("[yellow]⚠️  Database not configured[/yellow]")
            
    except Exception as e:
        console.print(f"[red]❌ System check failed: {e}[/red]")


def _display_analysis_result(result) -> None:
    """Display single analysis result."""
    signal = result.explosion_signal
    
    info_text = f"""
Symbol: {result.symbol}
Price: ${signal.close_price:.2f}
Overall Score: {result.overall_score:.3f}/1.0
Opportunity Rank: {result.opportunity_rank.value}-Tier
Recommendation: {result.recommendation}

Volume Analysis (50%): {signal.volume_score:.3f}
  - Volume Ratio: {signal.volume_ratio:.2f}x (avg: {signal.avg_volume_20d:,.0f})
  - Volume Spike: {signal.volume_spike_factor:.1f}x
  - Dollar Volume: ${signal.dollar_volume:,.0f}

Price Momentum (30%): {signal.momentum_score:.3f}
  - Consolidating: {'Yes' if signal.is_consolidating else 'No'}
  - Breakout: {'Yes' if signal.is_breakout else 'No'}
  - Price Change (20d): {signal.price_change_20d:.1f}%
  - Higher Lows: {'Yes' if signal.higher_lows_detected else 'No'}

Relative Strength (15%): {signal.relative_strength_score:.3f}
  - From 52w Low: {signal.distance_from_52w_low:.1f}%
  - From 52w High: {signal.distance_from_52w_high:.1f}%

Risk & Liquidity (5%): {signal.risk_score:.3f}
  - Pump Risk: {signal.pump_dump_risk.value}
  - Volatility: {signal.daily_volatility:.2f}%
  - Low Float: {'Yes' if signal.is_low_float else 'No'}

Risk Management:
  - Stop Loss: ${result.stop_loss_level:.2f}
  - Position Size: {result.position_size_pct:.1f}%
"""
    
    console.print(
        Panel(
            info_text.strip(),
            title="Explosion Setup Analysis",
            border_style="green"
        )
    )


def _display_batch_results(results, min_score: float) -> None:
    """Display batch analysis results."""
    table = Table(
        title=f"Penny Stock Explosion Setups (Score ≥ {min_score})"
    )
    table.add_column("Symbol", style="cyan", no_wrap=True)
    table.add_column("Rank", style="magenta", justify="center")
    table.add_column("Score", style="green", justify="right")
    table.add_column("Price", style="white", justify="right")
    table.add_column("Vol Ratio", style="yellow", justify="right")
    table.add_column("Breakout", style="blue", justify="center")
    table.add_column("Trend", style="white")
    
    for result in sorted(results, key=lambda x: x.overall_score, reverse=True):
        signal = result.explosion_signal
        
        rank_emoji = {
            'S': '🏆',
            'A': '🥇',
            'B': '🥈',
            'C': '🥉',
            'D': '📉'
        }
        rank_display = f"{rank_emoji.get(result.opportunity_rank.value, '❓')} {result.opportunity_rank.value}"
        
        table.add_row(
            result.symbol,
            rank_display,
            f"{result.overall_score:.3f}",
            f"${signal.close_price:.2f}",
            f"{signal.volume_ratio:.1f}x",
            "✅" if signal.is_breakout else "⏳",
            signal.trend_direction.value.title()
        )
    
    console.print(table)


def _display_scan_results(signals) -> None:
    """Display full scan results."""
    table = Table(title="🔥 Penny Stock Explosion Setups")
    table.add_column("Symbol", style="cyan", no_wrap=True)
    table.add_column("Rank", style="bold magenta", justify="center")
    table.add_column("Status", style="blue", no_wrap=True)
    table.add_column("Days", style="dim yellow", justify="right")
    table.add_column("Score", style="green", justify="right")
    table.add_column("Price", style="white", justify="right")
    table.add_column("Vol Spike", style="yellow", justify="right")
    table.add_column("Setup", style="blue")
    
    for result in signals[:25]:  # Show top 25
        signal = result.explosion_signal
        
        rank_emoji = {'S': '🏆', 'A': '🥇', 'B': '🥈', 'C': '🥉', 'D': '📉'}
        rank_display = (
            f"{rank_emoji.get(result.opportunity_rank.value, '❓')} "
            f"{result.opportunity_rank.value}"
        )
        
        # Format status with emoji
        status_emoji = {
            'NEW': '🆕',
            'CONTINUING': '🔄',
            'ENDED': '🔚'
        }
        status_display = status_emoji.get(
            signal.signal_status.value, '❓'
        )
        
        setup_status = []
        if signal.is_consolidating:
            setup_status.append("📦")
        if signal.is_breakout:
            setup_status.append("🚀")
        if signal.higher_lows_detected:
            setup_status.append("📈")
        
        setup_text = " ".join(setup_status) if setup_status else "—"
        
        table.add_row(
            result.symbol,
            rank_display,
            status_display,
            str(signal.days_active),
            f"{result.overall_score:.3f}",
            f"${signal.close_price:.2f}",
            f"{signal.volume_spike_factor:.1f}x",
            setup_text
        )
    
    console.print(table)
    
    if len(signals) > 25:
        console.print(f"[dim]... and {len(signals) - 25} more signals[/dim]")


def _display_query_results(signals) -> None:
    """Display database query results."""
    table = Table(title="📊 Stored Penny Stock Signals")
    table.add_column("Symbol", style="cyan")
    table.add_column("Date", style="white")
    table.add_column("Score", style="magenta", justify="right")
    table.add_column("Rank", style="green")
    table.add_column("Recommendation", style="yellow")
    
    for signal in signals:
        table.add_row(
            signal['symbol'],
            signal.get('scan_date', 'N/A'),
            f"{signal.get('overall_score', 0):.3f}",
            signal.get('opportunity_rank', 'N/A'),
            signal.get('recommendation', 'N/A')
        )
    
    console.print(table)
    console.print(f"\n[bold]Found {len(signals)} signals[/bold]")


if __name__ == "__main__":
    try:
        app()
    except Exception as e:
        console.print(f"[red]❌ CLI Error: {e}[/red]")
        raise

