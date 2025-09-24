"""Command-line interface for the volatility scanner service."""

import asyncio
from datetime import datetime, date
from typing import List, Optional
import json

import typer
from typer import Typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich.json import JSON

from volatility_scanner.config.settings import get_settings
from volatility_scanner.services.data_service import DataService
from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.services.ai_service import AIService
from volatility_scanner.services.backtest_service import BacktestService
from volatility_scanner.services.paper_trading_service import PaperTradingService
from volatility_scanner.services.database_service import DatabaseService

# Try to import SimpleTickerService for paper trading
try:
    from volatility_scanner.services.simple_ticker_service import SimpleTickerService
except ImportError:
    SimpleTickerService = None

# Initialize console first
console = Console()

# Try to import the real TickerService
try:
    from volatility_scanner.services.ticker_service import TickerService
    REAL_TICKER_SERVICE_AVAILABLE = True
except ImportError as e:
    # Don't print error during import - only when actually using the CLI
    TickerService = None
    REAL_TICKER_SERVICE_AVAILABLE = False
from volatility_scanner.models.backtest import BacktestConfig

app = typer.Typer(
    name="volatility-scanner",
    help="Enterprise-grade volatility squeeze scanner CLI"
)


def get_services():
    """Initialize and return service instances."""
    try:
        settings = get_settings()
        
        data_service = DataService(settings)
        analysis_service = AnalysisService(settings)
        ai_service = AIService(settings)
        backtest_service = BacktestService(settings, data_service, analysis_service)
        database_service = DatabaseService(settings)
        
        # Use real database ticker service if available, otherwise use basic symbols
        if REAL_TICKER_SERVICE_AVAILABLE and TickerService:
            try:
                ticker_service = TickerService(settings)
                console.print("[green]✅ Using database ticker service with full symbol coverage[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Database ticker service failed: {e}[/yellow]")
                console.print("[yellow]   CLI will use basic symbol lists for scanning[/yellow]")
                ticker_service = None
        else:
            if not REAL_TICKER_SERVICE_AVAILABLE:
                console.print("[yellow]⚠️  Database ticker service unavailable (import failed)[/yellow]")
                console.print("[yellow]   CLI will use basic symbol lists[/yellow]")
            ticker_service = None
        
        # Show database service status
        if database_service.is_available():
            console.print("[green]✅ Database service ready for signal storage[/green]")
        else:
            console.print("[yellow]⚠️  Database service unavailable - signals won't be stored[/yellow]")
        
        # Performance tracking and signal continuity services (depend on database service)
        continuity_service = None
        if database_service and database_service.is_available():
            try:
                from volatility_scanner.services.performance_tracking_service import PerformanceTrackingService
                from volatility_scanner.services.signal_continuity_service import SignalContinuityService
                
                performance_tracking_service = PerformanceTrackingService(database_service)
                continuity_service = SignalContinuityService(database_service, performance_tracking_service)
                console.print("[green]✅ Signal continuity tracking enabled[/green]")
                console.print("[green]✅ Performance tracking enabled[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Signal continuity service failed: {e}[/yellow]")
        
        return data_service, analysis_service, ai_service, backtest_service, ticker_service, database_service, continuity_service
        
    except Exception as e:
        console.print(f"[red]❌ Failed to initialize services: {e}[/red]")
        raise


@app.command()
def analyze(
    symbol: str = typer.Argument(..., help="Stock/ETF symbol to analyze"),
    period: str = typer.Option("1y", "--period", help="Data period"),
    ai: bool = typer.Option(True, "--ai/--no-ai", help="Include AI analysis"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)")
) -> None:
    """Analyze a symbol for volatility squeeze signals."""
    
    async def _analyze():
        data_service, analysis_service, ai_service, _, _, _, _ = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            # Fetch data
            task = progress.add_task(f"Fetching data for {symbol}...", total=None)
            market_data = await data_service.get_market_data(symbol, period)
            progress.update(task, description=f"Analyzing {symbol}...")
            
            # Perform analysis
            result = await analysis_service.analyze_symbol(
                market_data,
                include_ai_analysis=False
            )
            
            if not result:
                progress.update(task, description="No signals found")
                console.print(f"[yellow]No volatility squeeze signals found for {symbol}[/yellow]")
                return
            
            # Add AI analysis if requested
            if ai and ai_service.is_available():
                progress.update(task, description="Running AI analysis...")
                result = await ai_service.analyze_signal(result)
            
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
    symbols: str = typer.Argument(..., help="Comma-separated symbols to analyze"),
    period: str = typer.Option("1y", "--period", help="Data period"),
    ai: bool = typer.Option(True, "--ai/--no-ai", help="Include AI analysis"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)")
) -> None:
    """Analyze multiple symbols for volatility squeeze signals."""
    
    async def _batch_analyze():
        data_service, analysis_service, ai_service, _, _, database_service, continuity_service = get_services()
        
        # Parse comma-separated symbols
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            task = progress.add_task("Fetching data...", total=len(symbol_list))
            
            # Fetch data for all symbols
            symbol_data = await data_service.get_multiple_symbols(symbol_list, period)
            progress.update(task, advance=len(symbol_data))
            
            # Analyze each symbol
            results = []
            for i, (symbol, market_data) in enumerate(symbol_data.items()):
                progress.update(task, description=f"Analyzing {symbol}...")
                
                try:
                    result = await analysis_service.analyze_symbol(
                        market_data,
                        include_ai_analysis=False
                    )
                    
                    if result:
                        if ai and ai_service.is_available():
                            result = await ai_service.analyze_signal(result)
                        results.append(result)
                        
                except Exception as e:
                    console.print(f"[red]Error analyzing {symbol}: {e}[/red]")
                
                progress.update(task, advance=1)
        
        # Process signals for continuity tracking (without performance tracking)
        if results and continuity_service:
            try:
                console.print(f"[bold blue]🔄 Processing signal continuity tracking...[/bold blue]")
                from datetime import date
                today = date.today()
                # Temporarily disable performance tracking during continuity processing
                original_perf_service = continuity_service.performance_tracking_service
                continuity_service.performance_tracking_service = None
                results = await continuity_service.process_signals_with_continuity(results, today)
                continuity_service.performance_tracking_service = original_perf_service
                console.print(f"[green]✅ Signal continuity processing complete[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Signal continuity processing failed: {e}[/yellow]")
        
        # Store signals in database
        if results and database_service.is_available():
            try:
                from datetime import date
                today = date.today()
                stored_count = await database_service.store_signals_batch(results, today)
                if stored_count > 0:
                    console.print(f"[green]💾 Stored/updated {stored_count} signals in database[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Failed to store signals in database: {e}[/yellow]")
        
        # Now handle performance tracking after signals are stored
        if results and continuity_service and continuity_service.performance_tracking_service:
            try:
                console.print(f"[bold blue]📈 Processing performance tracking...[/bold blue]")
                from datetime import date
                today = date.today()
                
                # Track NEW signals
                new_signals = [s for s in results if s.squeeze_signal.signal_status.value == 'NEW']
                if new_signals:
                    tracked_count = await continuity_service.performance_tracking_service.track_new_signals(new_signals, today)
                    if tracked_count > 0:
                        console.print(f"[green]📊 Started tracking {tracked_count} new signals[/green]")
                
                console.print(f"[green]✅ Performance tracking complete[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Performance tracking failed: {e}[/yellow]")
        
        # Display results
        if results:
            _display_batch_results(results)
        else:
            console.print("[yellow]No signals found in any symbols[/yellow]")
        
        # Save to file if requested
        if output and results:
            with open(output, 'w') as f:
                json.dump([r.dict() for r in results], f, indent=2, default=str)
            console.print(f"[green]Results saved to {output}[/green]")
    
    asyncio.run(_batch_analyze())


@app.command()
def backtest(
    symbols: str = typer.Argument(..., help="Comma-separated symbols to backtest"),
    start_date: str = typer.Option("2023-01-01", "--start-date", help="Start date (YYYY-MM-DD)"),
    end_date: str = typer.Option("2023-12-31", "--end-date", help="End date (YYYY-MM-DD)"),
    capital: float = typer.Option(100000.0, "--capital", help="Initial capital"),
    max_position: float = typer.Option(0.1, "--max-position", help="Max position size (0.1 = 10%)"),
    stop_loss: float = typer.Option(0.05, "--stop-loss", help="Stop loss percentage"),
    profit_target: float = typer.Option(0.15, "--profit-target", help="Profit target percentage"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)")
) -> None:
    """Run a backtest of the volatility squeeze strategy."""
    
    async def _backtest():
        _, _, _, backtest_service, _, _, _ = get_services()
        
        # Parse dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Parse comma-separated symbols
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        # Create config
        config = BacktestConfig(
            start_date=start_dt,
            end_date=end_dt,
            symbols=symbol_list,
            initial_capital=capital,
            max_position_size=max_position,
            stop_loss_pct=stop_loss,
            profit_target_pct=profit_target
        )
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            task = progress.add_task("Running backtest...", total=None)
            
            result = await backtest_service.run_backtest(config)
            
            progress.update(task, description="Complete!")
        
        # Display results
        _display_backtest_results(result)
        
        # Save to file if requested
        if output:
            with open(output, 'w') as f:
                json.dump(result.dict(), f, indent=2, default=str)
            console.print(f"[green]Results saved to {output}[/green]")
    
    asyncio.run(_backtest())


@app.command()
def server(
    host: str = typer.Option("0.0.0.0", "--host", help="Host to bind to"),
    port: int = typer.Option(8000, "--port", help="Port to bind to"),
    workers: int = typer.Option(1, "--workers", help="Number of worker processes"),
    reload: bool = typer.Option(False, "--reload", help="Enable auto-reload")
) -> None:
    """Start the FastAPI server."""
    
    import uvicorn
    
    console.print(f"[green]Starting Volatility Scanner API server...[/green]")
    console.print(f"Host: {host}")
    console.print(f"Port: {port}")
    console.print(f"Workers: {workers}")
    console.print(f"Docs: http://{host}:{port}/docs")
    
    uvicorn.run(
        "volatility_scanner.api.app:create_app",
        factory=True,
        host=host,
        port=port,
        workers=workers,
        reload=reload
    )


@app.command()
def version() -> None:
    """Show version information and basic system status."""
    console.print("[bold blue]Volatility Squeeze Scanner[/bold blue]")
    console.print("Version: 0.1.0")
    
    try:
        settings = get_settings()
        console.print("[green]✅ Settings loaded successfully[/green]")
        
        # Test basic imports
        console.print("[green]✅ Core services available[/green]")
        
        # Check environment variables
        import os
        supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        if supabase_url:
            console.print("[green]✅ Supabase URL configured[/green]")
        else:
            console.print("[yellow]⚠️  Supabase URL not configured[/yellow]")
            
    except Exception as e:
        console.print(f"[red]❌ System check failed: {e}[/red]")


@app.command()
def validate(
    symbol: str = typer.Argument(..., help="Symbol to validate")
) -> None:
    """Validate if a symbol exists and has data."""
    
    async def _validate():
        data_service, _, _, _, _, _, _ = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            task = progress.add_task(f"Validating {symbol}...", total=None)
            
            is_valid = await data_service.validate_symbol(symbol)
            
            if is_valid:
                info = await data_service.get_symbol_info(symbol)
                progress.update(task, description="Valid!")
                
                console.print(f"[green]✓ {symbol} is valid[/green]")
                
                # Display info
                table = Table(title=f"{symbol} Information")
                table.add_column("Field", style="cyan")
                table.add_column("Value", style="white")
                
                for key, value in info.items():
                    if value is not None:
                        table.add_row(key.replace('_', ' ').title(), str(value))
                
                console.print(table)
            else:
                progress.update(task, description="Invalid")
                console.print(f"[red]✗ {symbol} is not valid or has no data[/red]")
    
    asyncio.run(_validate())


def _display_analysis_result(result) -> None:
    """Display analysis result in a formatted table."""
    
    # Main info panel
    info_text = f"""
Symbol: {result.symbol}
Timestamp: {result.timestamp}
Overall Score: {result.overall_score:.2f}/1.0
Recommendation: {result.recommendation}
Signal Strength: {result.squeeze_signal.signal_strength:.2f}/1.0
"""
    
    console.print(Panel(info_text.strip(), title="Analysis Result", border_style="green"))
    
    # Technical details table
    table = Table(title="Technical Analysis Details")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="white")
    
    squeeze = result.squeeze_signal
    
    table.add_row("BB Width", f"{squeeze.bb_width:.4f}")
    table.add_row("BB Width Percentile", f"{squeeze.bb_width_percentile:.1f}%")
    table.add_row("Is Squeeze", "✓" if squeeze.is_squeeze else "✗")
    table.add_row("Is Expansion", "✓" if squeeze.is_expansion else "✗")
    table.add_row("Trend Direction", squeeze.trend_direction.value.title())
    table.add_row("Volume Ratio", f"{squeeze.volume_ratio:.2f}x")
    table.add_row("Range vs ATR", f"{squeeze.range_vs_atr:.2f}x")
    
    console.print(table)
    
    # AI analysis if available
    if result.ai_analysis:
        ai_text = f"""
Signal Type: {result.ai_analysis.signal_type.value.title()}
Confidence: {result.ai_analysis.confidence:.2f}/1.0
Rationale: {result.ai_analysis.rationale}
"""
        console.print(Panel(ai_text.strip(), title="AI Analysis", border_style="blue"))


def _display_batch_results(results) -> None:
    """Display batch analysis results in a table."""
    
    table = Table(title=f"Batch Analysis Results ({len(results)} signals found)")
    table.add_column("Symbol", style="cyan")
    table.add_column("Score", style="white")
    table.add_column("Recommendation", style="white")
    table.add_column("Trend", style="white")
    table.add_column("AI Type", style="blue")
    table.add_column("AI Confidence", style="blue")
    
    for result in sorted(results, key=lambda x: x.overall_score, reverse=True):
        ai_type = result.ai_analysis.signal_type.value if result.ai_analysis else "N/A"
        ai_conf = f"{result.ai_analysis.confidence:.2f}" if result.ai_analysis else "N/A"
        
        table.add_row(
            result.symbol,
            f"{result.overall_score:.2f}",
            result.recommendation,
            result.squeeze_signal.trend_direction.value,
            ai_type,
            ai_conf
        )
    
    console.print(table)


def _display_backtest_results(result) -> None:
    """Display backtest results."""
    
    perf = result.performance
    
    # Summary panel
    summary_text = f"""
Backtest ID: {result.backtest_id}
Duration: {result.execution_duration_seconds:.1f} seconds
Total Trades: {perf.total_trades}
Win Rate: {perf.win_rate:.1%}
Total Return: {perf.total_return:.1f}%
Max Drawdown: {perf.max_drawdown:.1f}%
Sharpe Ratio: {perf.sharpe_ratio or 'N/A'}
"""
    
    console.print(Panel(summary_text.strip(), title="Backtest Results", border_style="green"))
    
    # Performance table
    table = Table(title="Performance Metrics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="white")
    
    table.add_row("Total Trades", str(perf.total_trades))
    table.add_row("Winning Trades", str(perf.winning_trades))
    table.add_row("Losing Trades", str(perf.losing_trades))
    table.add_row("Win Rate", f"{perf.win_rate:.1%}")
    table.add_row("Average Return", f"{perf.average_return:.2f}%")
    table.add_row("Best Trade", f"{perf.best_trade:.2f}%")
    table.add_row("Worst Trade", f"{perf.worst_trade:.2f}%")
    table.add_row("Profit Factor", f"{perf.profit_factor:.2f}")
    table.add_row("Average Trade Duration", f"{perf.average_trade_duration:.1f} days")
    
    console.print(table)


@app.command()
def scan_database(
    limit: int = typer.Option(50, "--limit", help="Maximum symbols to scan"),
    exchange: Optional[str] = typer.Option(None, "--exchange", help="Filter by exchange (e.g., NASDAQ, NYSE)"),
    sector: Optional[str] = typer.Option(None, "--sector", help="Filter by sector (e.g., Technology)"),
    min_score: float = typer.Option(0.5, "--min-score", help="Minimum signal score threshold"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)"),
) -> None:
    """Scan ticker database for volatility squeeze signals."""
    
    async def _scan_database():
        data_service, analysis_service, ai_service, _, ticker_service, database_service, _ = get_services()
        
        try:
            # Get symbols based on filters
            console.print(f"[bold blue]📊 Fetching symbols from database...[/bold blue]")
            
            if exchange:
                symbols = ticker_service.get_symbols_by_exchange(exchange, limit=limit)
                console.print(f"Found {len(symbols)} symbols from {exchange}")
            elif sector:
                symbols = ticker_service.get_symbols_by_sector(sector, limit=limit)
                console.print(f"Found {len(symbols)} symbols from {sector} sector")
            else:
                symbols = ticker_service.get_all_symbols(limit=limit)
                console.print(f"Found {len(symbols)} symbols from database")
            
            if not symbols:
                console.print("[red]❌ No symbols found with the specified filters[/red]")
                return
            
            # Fetch market data
            console.print(f"[bold blue]📈 Fetching market data for {len(symbols)} symbols...[/bold blue]")
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Fetching data...", total=None)
                symbol_data = await data_service.get_multiple_symbols(symbols, period="6mo")
                progress.update(task, completed=True)
            
            console.print(f"✅ Retrieved data for {len(symbol_data)}/{len(symbols)} symbols")
            
            # Analyze symbols
            console.print(f"[bold blue]🔬 Analyzing symbols for volatility squeeze signals...[/bold blue]")
            
            signals = []
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Analyzing...", total=len(symbol_data))
                
                for i, (symbol, market_data) in enumerate(symbol_data.items()):
                    try:
                        result = await analysis_service.analyze_symbol(market_data, include_ai_analysis=False)
                        if result and result.overall_score >= min_score:
                            signals.append(result)
                    except Exception as e:
                        console.print(f"[yellow]⚠️  {symbol}: Analysis failed - {e}[/yellow]")
                    
                    progress.update(task, advance=1)
            
            # Display results
            if signals:
                # Sort by score
                signals.sort(key=lambda x: x.overall_score, reverse=True)
                
                console.print(f"\n[bold green]🎯 Found {len(signals)} signals (min score: {min_score})[/bold green]")
                
                # Create results table
                table = Table(title="Volatility Squeeze Signals")
                table.add_column("Symbol", style="cyan", no_wrap=True)
                table.add_column("Score", style="magenta")
                table.add_column("Recommendation", style="green")
                table.add_column("Trend", style="blue")
                table.add_column("BB Width %", style="yellow")
                table.add_column("Squeeze", style="red")
                
                for signal in signals[:20]:  # Show top 20
                    squeeze = signal.squeeze_signal
                    table.add_row(
                        signal.symbol,
                        f"{signal.overall_score:.3f}",
                        signal.recommendation,
                        squeeze.trend_direction.value.title(),
                        f"{squeeze.bb_width_percentile:.1f}%",
                        "Yes" if squeeze.is_squeeze else "No"
                    )
                
                console.print(table)
                
                # Save to file if requested
                if output:
                    results_data = []
                    for signal in signals:
                        squeeze = signal.squeeze_signal
                        results_data.append({
                            "symbol": signal.symbol,
                            "overall_score": signal.overall_score,
                            "recommendation": signal.recommendation,
                            "trend_direction": squeeze.trend_direction.value,
                            "bb_width_percentile": squeeze.bb_width_percentile,
                            "is_squeeze": squeeze.is_squeeze,
                            "is_expansion": squeeze.is_expansion,
                            "signal_strength": squeeze.signal_strength,
                            "analysis_timestamp": datetime.now().isoformat()
                        })
                    
                    with open(output, 'w') as f:
                        json.dump(results_data, f, indent=2)
                    console.print(f"[green]💾 Results saved to {output}[/green]")
                
            else:
                console.print(f"[yellow]❌ No signals found above threshold {min_score}[/yellow]")
                console.print("[dim]Try lowering the --min-score threshold or analyzing different symbols[/dim]")
            
            # Summary stats
            console.print(f"\n[bold]📊 Scan Summary:[/bold]")
            console.print(f"   Symbols requested: {len(symbols)}")
            console.print(f"   Data retrieved: {len(symbol_data)}")
            console.print(f"   Signals found: {len(signals)}")
            console.print(f"   Signal rate: {len(signals)/len(symbol_data)*100:.1f}%" if symbol_data else "0%")
            
        except Exception as e:
            console.print(f"[red]❌ Error during database scan: {e}[/red]")
            raise typer.Exit(1)
    
    asyncio.run(_scan_database())


@app.command()
def cleanup_duplicates(
    target_date: Optional[str] = typer.Option(None, "--date", help="Target date (YYYY-MM-DD, defaults to today)"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be removed without actually removing")
) -> None:
    """Clean up duplicate signals in the database."""
    
    async def _cleanup_duplicates():
        _, _, _, _, _, database_service, _ = get_services()
        
        if not database_service.is_available():
            console.print("[red]❌ Database service not available[/red]")
            raise typer.Exit(1)
        
        # Parse target date
        if target_date:
            try:
                parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            except ValueError:
                console.print("[red]❌ Invalid date format. Use YYYY-MM-DD[/red]")
                raise typer.Exit(1)
        else:
            parsed_date = date.today()
        
        console.print(f"[bold blue]🔍 Analyzing duplicates for {parsed_date}...[/bold blue]")
        
        # Get duplicate statistics
        stats = await database_service.get_duplicate_signals_count(parsed_date)
        
        if not stats:
            console.print("[red]❌ Failed to get duplicate statistics[/red]")
            raise typer.Exit(1)
        
        console.print(f"[cyan]📊 Signal Statistics for {parsed_date}:[/cyan]")
        console.print(f"  • Total signals: {stats['total_signals']}")
        console.print(f"  • Unique symbols: {stats['unique_symbols']}")
        console.print(f"  • Duplicates: {stats['duplicates']}")
        
        if stats['duplicates'] == 0:
            console.print("[green]✅ No duplicates found![/green]")
            return
        
        if dry_run:
            console.print(f"[yellow]🔍 DRY RUN: Would remove {stats['duplicates']} duplicate signals[/yellow]")
            return
        
        # Confirm cleanup
        if not typer.confirm(f"Remove {stats['duplicates']} duplicate signals?"):
            console.print("[yellow]⚠️  Cleanup cancelled[/yellow]")
            return
        
        # Perform cleanup
        console.print("[bold blue]🧹 Cleaning up duplicates...[/bold blue]")
        removed_count = await database_service.cleanup_duplicate_signals(parsed_date)
        
        if removed_count > 0:
            console.print(f"[green]✅ Successfully removed {removed_count} duplicate signals[/green]")
        else:
            console.print("[yellow]⚠️  No duplicates were removed[/yellow]")
    
    asyncio.run(_cleanup_duplicates())


@app.command()
def scan_all(
    min_score: float = typer.Option(0.6, "--min-score", help="Minimum signal score threshold"),
    max_symbols: Optional[int] = typer.Option(None, "--max-symbols", help="Maximum symbols to scan (None for all symbols)"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)"),
    fast: bool = typer.Option(False, "--fast", help="Fast mode: skip detailed analysis")
) -> None:
    """Scan ALL available symbols for volatility squeeze signals."""
    
    async def _scan_all():
        data_service, analysis_service, ai_service, _, ticker_service, database_service, continuity_service = get_services()
        
        try:
            # Get ALL symbols
            if ticker_service:
                console.print(f"[bold blue]🌍 Fetching ALL symbols from database...[/bold blue]")
                all_symbols = ticker_service.get_all_symbols()
                
                # Apply optional limit
                if max_symbols and len(all_symbols) > max_symbols:
                    console.print(f"[yellow]⚠️  Found {len(all_symbols)} symbols, limiting to {max_symbols} as requested[/yellow]")
                    all_symbols = all_symbols[:max_symbols]
                
                console.print(f"[green]🌍 Scanning ALL {len(all_symbols)} symbols from database[/green]")
            else:
                # Fallback to basic symbol list when ticker service is unavailable
                console.print(f"[yellow]⚠️  Using fallback symbol list (database unavailable)[/yellow]")
                basic_symbols = [
                    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 
                    'DIS', 'PYPL', 'ADBE', 'CRM', 'INTC', 'AMD', 'UBER', 'SQ',
                    'SHOP', 'ZOOM', 'DOCU', 'OKTA', 'SNOW', 'PLTR', 'COIN', 'RBLX'
                ]
                
                all_symbols = basic_symbols
                if max_symbols and len(all_symbols) > max_symbols:
                    all_symbols = all_symbols[:max_symbols]
                
                console.print(f"[green]🔍 Scanning {len(all_symbols)} symbols from fallback list[/green]")
            
            if not all_symbols:
                console.print("[red]❌ No symbols found[/red]")
                return
            
            # Fetch market data with optimized chunked approach
            console.print(f"[bold blue]📈 Fetching market data (optimized)...[/bold blue]")
            
            start_time = asyncio.get_event_loop().time()
            
            try:
                # Use chunked approach for better performance
                symbol_data = await data_service.get_multiple_symbols_chunked(
                    all_symbols, 
                    period="6mo"
                )
            except Exception as e:
                console.print(f"[red]Error fetching market data: {e}[/red]")
                return
            
            console.print(f"✅ Retrieved data for {len(symbol_data)}/{len(all_symbols)} symbols")
            
            if not symbol_data:
                console.print("[red]❌ No market data retrieved[/red]")
                return
            
            # Analyze symbols with parallel processing
            console.print(f"[bold blue]🔍 Analyzing {len(symbol_data)} symbols (parallel)...[/bold blue]")
            
            analysis_start_time = asyncio.get_event_loop().time()
            
            # Progress callback for streaming analysis
            def progress_callback(batch_num, total_batches, batch_signals, total_signals):
                console.print(f"[dim]Batch {batch_num}/{total_batches} complete - {batch_signals} signals found (total: {total_signals})[/dim]")
            
            try:
                # Use parallel analysis from the main analysis service
                signals = await analysis_service.analyze_symbols_streaming(
                    symbol_data,
                    min_score=min_score,
                    batch_size=100,
                    callback=progress_callback
                )
            except Exception as e:
                console.print(f"[red]Error during parallel analysis: {e}[/red]")
                # Fallback to sequential analysis
                console.print("[yellow]Falling back to sequential analysis...[/yellow]")
                signals = []
                for symbol, market_data in symbol_data.items():
                    try:
                        result = await analysis_service.analyze_symbol(
                            market_data,
                            include_ai_analysis=not fast
                        )
                        if result and result.overall_score >= min_score:
                            signals.append(result)
                    except Exception:
                        pass
            
            analysis_time = asyncio.get_event_loop().time() - analysis_start_time
            data_fetch_time = analysis_start_time - start_time
            
            # Get today's date for continuity tracking and database operations
            today = date.today()
            
            # Process signals for continuity tracking (without performance tracking)
            if signals and continuity_service:
                try:
                    console.print(f"[bold blue]🔄 Processing signal continuity tracking...[/bold blue]")
                    # Temporarily disable performance tracking during continuity processing
                    original_perf_service = continuity_service.performance_tracking_service
                    continuity_service.performance_tracking_service = None
                    signals = await continuity_service.process_signals_with_continuity(signals, today)
                    continuity_service.performance_tracking_service = original_perf_service
                    console.print(f"[green]✅ Signal continuity processing complete[/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠️  Signal continuity processing failed: {e}[/yellow]")
            
            # Store signals in database (now with duplicate prevention)
            if signals and database_service.is_available():
                try:
                    # Check for existing duplicates before storing
                    duplicate_stats = await database_service.get_duplicate_signals_count(today)
                    
                    if duplicate_stats.get('duplicates', 0) > 0:
                        console.print(f"[yellow]⚠️  Found {duplicate_stats['duplicates']} existing duplicates for today[/yellow]")
                        console.print("[blue]🧹 Cleaning up existing duplicates before storing new signals...[/blue]")
                        
                        cleaned_count = await database_service.cleanup_duplicate_signals(today)
                        if cleaned_count > 0:
                            console.print(f"[green]✅ Cleaned up {cleaned_count} duplicate signals[/green]")
                    
                    # Store new signals (using upsert to prevent new duplicates)
                    stored_count = await database_service.store_signals_batch(signals, today)
                    if stored_count > 0:
                        console.print(f"[green]💾 Stored/updated {stored_count} signals in database[/green]")
                        
                        # Verify no duplicates were created
                        final_stats = await database_service.get_duplicate_signals_count(today)
                        if final_stats.get('duplicates', 0) > 0:
                            console.print(f"[yellow]⚠️  Warning: {final_stats['duplicates']} duplicates still exist[/yellow]")
                            
                except Exception as e:
                    console.print(f"[yellow]⚠️  Failed to store signals in database: {e}[/yellow]")
            
            # Now handle performance tracking after signals are stored
            if signals and continuity_service and continuity_service.performance_tracking_service:
                try:
                    console.print(f"[bold blue]📈 Processing performance tracking...[/bold blue]")
                    
                    # Track NEW signals
                    new_signals = [s for s in signals if s.squeeze_signal.signal_status.value == 'NEW']
                    if new_signals:
                        tracked_count = await continuity_service.performance_tracking_service.track_new_signals(new_signals, today)
                        if tracked_count > 0:
                            console.print(f"[green]📊 Started tracking {tracked_count} new signals[/green]")
                    
                    console.print(f"[green]✅ Performance tracking complete[/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠️  Performance tracking failed: {e}[/yellow]")
            
            # Display results
            if signals:
                # Sort by ranking tier first, then by score within tier
                tier_order = {'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4}
                signals.sort(key=lambda x: (
                    tier_order.get(x.opportunity_rank.value, 5),  # Rank tier first
                    -x.overall_score  # Then by score (descending)
                ))
                
                console.print(f"\n[bold green]🎯 Found {len(signals)} signals above threshold {min_score}[/bold green]\n")
                
                # Create results table with ranking and continuity information
                table = Table(title="🔥 Top Volatility Squeeze Signals")
                table.add_column("Symbol", style="cyan", no_wrap=True)
                table.add_column("Rank", style="bold magenta", no_wrap=True, justify="center")
                table.add_column("Status", style="blue", no_wrap=True)
                table.add_column("Days", style="dim yellow", justify="right")
                table.add_column("Score", style="magenta", justify="right")
                table.add_column("Recommendation", style="green")
                table.add_column("Trend", style="blue")
                table.add_column("BB Width %", style="yellow", justify="right")
                table.add_column("Signal Strength", style="red", justify="right")
                
                for signal in signals[:20]:  # Show top 20
                    squeeze = signal.squeeze_signal
                    
                    # Format status with emoji
                    status_emoji = {
                        'NEW': '🆕',
                        'CONTINUING': '🔄',
                        'ENDED': '🔚'
                    }
                    status_display = f"{status_emoji.get(squeeze.signal_status.value, '❓')} {squeeze.signal_status.value}"
                    
                    # Format ranking with styling
                    rank_colors = {
                        'S': '🏆 S',  # Gold trophy for S-tier
                        'A': '🥇 A',  # Gold medal for A-tier
                        'B': '🥈 B',  # Silver medal for B-tier
                        'C': '🥉 C',  # Bronze medal for C-tier
                        'D': '📉 D'   # Chart down for D-tier
                    }
                    rank_display = rank_colors.get(signal.opportunity_rank.value, f"❓ {signal.opportunity_rank.value}")
                    
                    table.add_row(
                        signal.symbol,
                        rank_display,
                        status_display,
                        str(squeeze.days_in_squeeze),
                        f"{signal.overall_score:.3f}",
                        signal.recommendation,
                        squeeze.trend_direction.value,
                        f"{squeeze.bb_width_percentile:.1f}%",
                        f"{squeeze.signal_strength:.3f}"
                    )
                
                console.print(table)
                
                if len(signals) > 20:
                    console.print(f"[dim]... and {len(signals) - 20} more signals[/dim]")
                
                # Save to file if requested
                if output:
                    results_data = []
                    for signal in signals:
                        squeeze = signal.squeeze_signal
                        results_data.append({
                            "symbol": signal.symbol,
                            "overall_score": signal.overall_score,
                            "recommendation": signal.recommendation,
                            "trend_direction": squeeze.trend_direction.value,
                            "bb_width_percentile": squeeze.bb_width_percentile,
                            "is_squeeze": squeeze.is_squeeze,
                            "is_expansion": squeeze.is_expansion,
                            "signal_strength": squeeze.signal_strength,
                            "analysis_timestamp": datetime.now().isoformat()
                        })
                    
                    with open(output, 'w') as f:
                        json.dump(results_data, f, indent=2)
                    console.print(f"[green]💾 Results saved to {output}[/green]")
                
            else:
                console.print(f"[yellow]❌ No signals found above threshold {min_score}[/yellow]")
                console.print("[dim]Try lowering the --min-score threshold[/dim]")
            
            # Performance summary
            total_time = data_fetch_time + analysis_time
            symbols_per_second = len(symbol_data) / total_time if total_time > 0 else 0
            
            # Summary stats
            console.print(f"\n[bold]📊 Full Market Scan Summary:[/bold]")
            console.print(f"   🌍 Total symbols in database: {ticker_service.get_ticker_count()}")
            console.print(f"   📊 Symbols scanned: {len(all_symbols)}")
            console.print(f"   ✅ Data successfully retrieved: {len(symbol_data)}")
            console.print(f"   🎯 High-quality signals found: {len(signals)}")
            console.print(f"   📈 Signal rate: {len(signals)/len(symbol_data)*100:.1f}%" if symbol_data else "0%")
            console.print(f"   🔄 Data retrieval success: {len(symbol_data)/len(all_symbols)*100:.1f}%")
            
            # Signal continuity summary
            if signals and continuity_service:
                new_count = len([s for s in signals if s.squeeze_signal.signal_status.value == 'NEW'])
                continuing_count = len([s for s in signals if s.squeeze_signal.signal_status.value == 'CONTINUING'])
                avg_days = sum(s.squeeze_signal.days_in_squeeze for s in signals) / len(signals) if signals else 0
                max_days = max(s.squeeze_signal.days_in_squeeze for s in signals) if signals else 0
                
                console.print(f"\n[bold cyan]🔄 Signal Continuity Tracking:[/bold cyan]")
                console.print(f"   🆕 New signals: {new_count}")
                console.print(f"   🔄 Continuing signals: {continuing_count}")
                console.print(f"   📅 Average days in squeeze: {avg_days:.1f}")
                console.print(f"   🏆 Longest running squeeze: {max_days} days")
                
                # Opportunity ranking summary
                rank_counts = {}
                for rank in ['S', 'A', 'B', 'C', 'D']:
                    count = len([s for s in signals if s.opportunity_rank.value == rank])
                    if count > 0:
                        rank_counts[rank] = count
                
                if rank_counts:
                    console.print(f"\n[bold gold1]🏆 Opportunity Rankings:[/bold gold1]")
                    rank_emojis = {'S': '🏆', 'A': '🥇', 'B': '🥈', 'C': '🥉', 'D': '📉'}
                    for rank, count in rank_counts.items():
                        emoji = rank_emojis.get(rank, '❓')
                        console.print(f"   {emoji} {rank}-Tier: {count} signals")
            
            # Performance metrics
            console.print(f"\n[bold green]⚡ Performance Metrics:[/bold green]")
            console.print(f"   📥 Data fetch time: {data_fetch_time:.1f}s")
            console.print(f"   🔍 Analysis time: {analysis_time:.1f}s")
            console.print(f"   ⏱️  Total time: {total_time:.1f}s")
            console.print(f"   🚀 Processing speed: {symbols_per_second:.1f} symbols/second")
            
            if len(signals) > 0:
                avg_score = sum(s.overall_score for s in signals) / len(signals)
                console.print(f"\n[bold magenta]📈 Signal Quality:[/bold magenta]")
                console.print(f"   ⭐ Average signal score: {avg_score:.3f}")
                strong_signals = len([s for s in signals if s.overall_score >= 0.9])
                console.print(f"   🚀 Strong signals (≥0.9): {strong_signals}")
                
            # Show performance stats
            try:
                perf_stats = analysis_service.get_performance_stats()
                console.print(f"\n[bold cyan]🔧 System Configuration:[/bold cyan]")
                console.print(f"   💻 CPU cores: {perf_stats['cpu_count']}")
                console.print(f"   🔄 Analysis workers: {perf_stats['max_workers']}")
                console.print(f"   📦 Batch size: {perf_stats['bulk_scan_batch_size']}")
                console.print(f"   🌐 API concurrency: {perf_stats['bulk_scan_concurrency']}")
            except Exception:
                pass
            
        except Exception as e:
            console.print(f"[red]❌ Error during comprehensive scan: {e}[/red]")
            raise typer.Exit(1)
    
    asyncio.run(_scan_all())


@app.command()
def query_signals(
    limit: int = typer.Option(50, "--limit", help="Maximum number of signals to return"),
    min_score: Optional[float] = typer.Option(None, "--min-score", help="Minimum signal score"),
    recommendation: Optional[str] = typer.Option(None, "--recommendation", help="Filter by recommendation"),
    date: Optional[str] = typer.Option(None, "--date", help="Filter by date (YYYY-MM-DD)")
) -> None:
    """Query stored volatility squeeze signals from database."""
    
    async def _query_signals():
        _, _, _, _, _, database_service, _ = get_services()
        
        if not database_service.is_available():
            console.print("[red]❌ Database service not available[/red]")
            return
        
        try:
            if date:
                from datetime import datetime
                target_date = datetime.strptime(date, "%Y-%m-%d").date()
                signals = await database_service.get_signals_by_date(target_date)
                console.print(f"[bold blue]📊 Signals for {date}[/bold blue]")
            else:
                signals = await database_service.get_latest_signals(
                    limit=limit,
                    min_score=min_score,
                    recommendation=recommendation
                )
                console.print(f"[bold blue]📊 Latest {limit} signals[/bold blue]")
            
            if not signals:
                console.print("[yellow]No signals found matching criteria[/yellow]")
                return
            
            # Create results table
            table = Table(title="🔍 Stored Volatility Squeeze Signals")
            table.add_column("Symbol", style="cyan", no_wrap=True)
            table.add_column("Score", style="magenta", justify="right")
            table.add_column("Recommendation", style="green")
            table.add_column("BB Width %", style="yellow", justify="right")
            table.add_column("Scan Date", style="blue")
            
            for signal_data in signals:
                table.add_row(
                    signal_data['symbol'],
                    f"{signal_data['overall_score']:.3f}",
                    signal_data.get('recommendation', 'N/A'),
                    f"{signal_data.get('bb_width_percentile', 0):.1f}%",
                    signal_data.get('scan_date', 'N/A')
                )
            
            console.print(table)
            console.print(f"\n[bold]Found {len(signals)} signals[/bold]")
            
        except Exception as e:
            console.print(f"[red]❌ Error querying signals: {e}[/red]")
    
    asyncio.run(_query_signals())


@app.command()
def list_tickers(
    exchange: Optional[str] = typer.Option(None, "--exchange", help="Filter by exchange"),
    sector: Optional[str] = typer.Option(None, "--sector", help="Filter by sector"),
    search: Optional[str] = typer.Option(None, "--search", help="Search by name or symbol"),
    limit: int = typer.Option(20, "--limit", help="Maximum results to show"),
) -> None:
    """List available tickers from the database."""
    
    def _list_tickers():
        _, _, _, _, ticker_service, _, _ = get_services()
        
        try:
            console.print("[bold blue]📊 Ticker Database Information[/bold blue]")
            
            # Show database stats
            total_count = ticker_service.get_ticker_count()
            exchanges = ticker_service.get_available_exchanges()
            sectors = ticker_service.get_available_sectors()
            
            console.print(f"Total active tickers: [bold]{total_count:,}[/bold]")
            console.print(f"Available exchanges: [bold]{len(exchanges)}[/bold]")
            console.print(f"Available sectors: [bold]{len(sectors)}[/bold]")
            
            # Get filtered results
            if search:
                symbols = ticker_service.search_symbols(search, limit=limit)
                console.print(f"\n[bold green]🔍 Search results for '{search}':[/bold green]")
            elif exchange:
                symbols = ticker_service.get_symbols_by_exchange(exchange, limit=limit)
                console.print(f"\n[bold green]📈 Symbols from {exchange}:[/bold green]")
            elif sector:
                symbols = ticker_service.get_symbols_by_sector(sector, limit=limit)
                console.print(f"\n[bold green]🏭 Symbols from {sector} sector:[/bold green]")
            else:
                symbols = ticker_service.get_all_symbols(limit=limit)
                console.print(f"\n[bold green]📋 Sample symbols:[/bold green]")
            
            if symbols:
                # Display in columns
                console.print(f"Found {len(symbols)} symbols:")
                
                # Group symbols into rows of 5
                for i in range(0, len(symbols), 5):
                    row_symbols = symbols[i:i+5]
                    console.print("   " + "  ".join(f"[cyan]{s}[/cyan]" for s in row_symbols))
            else:
                console.print("[yellow]No symbols found with the specified filters[/yellow]")
            
            # Show available filters
            console.print(f"\n[bold]Available Exchanges:[/bold]")
            console.print("   " + ", ".join(exchanges[:10]))
            if len(exchanges) > 10:
                console.print(f"   ... and {len(exchanges) - 10} more")
            
            console.print(f"\n[bold]Available Sectors:[/bold]")
            console.print("   " + ", ".join(sectors[:8]))
            if len(sectors) > 8:
                console.print(f"   ... and {len(sectors) - 8} more")
                
        except Exception as e:
            console.print(f"[red]❌ Error accessing ticker database: {e}[/red]")
            console.print("[dim]Make sure your .env file has SUPABASE_URL and SUPABASE_ANON_KEY[/dim]")
            raise typer.Exit(1)
    
    _list_tickers()


# Paper Trading Commands
@app.command()
def paper_create(
    name: str = typer.Argument(..., help="Portfolio name"),
    capital: float = typer.Option(100000.0, "--capital", help="Initial capital"),
    max_position: float = typer.Option(0.08, "--max-position", help="Max position size (0.08 = 8%)"),
    max_exposure: float = typer.Option(0.80, "--max-exposure", help="Max total exposure (0.80 = 80%)"),
) -> None:
    """Create a new paper trading portfolio."""
    
    async def _create_portfolio():
        settings = get_settings()
        paper_service = PaperTradingService(settings)
        
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
            task = progress.add_task("Creating portfolio...", total=None)
            
            portfolio = await paper_service.create_portfolio(
                name=name,
                initial_capital=capital,
                max_position_size_pct=max_position,
                max_total_exposure_pct=max_exposure
            )
            
            progress.update(task, completed=True)
        
        console.print(Panel.fit(
            f"[green]✅ Portfolio Created Successfully[/green]\n\n"
            f"[bold]Name:[/bold] {portfolio.name}\n"
            f"[bold]ID:[/bold] {portfolio.id}\n"
            f"[bold]Initial Capital:[/bold] ${portfolio.initial_capital:,.2f}\n"
            f"[bold]Max Position Size:[/bold] {max_position:.1%}\n"
            f"[bold]Max Exposure:[/bold] {max_exposure:.1%}",
            title="Paper Trading Portfolio"
        ))
    
    asyncio.run(_create_portfolio())


@app.command()
def paper_scan(
    symbols: str = typer.Option("popular", "--symbols", help="Symbol set: popular, tech, volatile, or comma-separated list"),
    min_score: float = typer.Option(0.6, "--min-score", help="Minimum signal score"),
    output: Optional[str] = typer.Option(None, "--output", help="Output file (JSON)")
) -> None:
    """Scan for paper trading signals."""
    
    async def _scan_signals():
        settings = get_settings()
        paper_service = PaperTradingService(settings)
        
        if SimpleTickerService:
            ticker_service = SimpleTickerService(settings)
        else:
            console.print("[yellow]⚠️  SimpleTickerService not available, using fallback symbols[/yellow]")
            ticker_service = None
        
        # Parse symbols
        if symbols in ['popular', 'tech', 'volatile']:
            if ticker_service:
                symbol_sets = ticker_service.get_curated_symbol_sets()
                if symbols == 'popular':
                    scan_symbols = symbol_sets['popular'][:20]
                elif symbols == 'tech':
                    scan_symbols = symbol_sets['technology'][:20]
                elif symbols == 'volatile':
                    scan_symbols = symbol_sets['volatile'][:15]
            else:
                # Fallback symbol sets
                fallback_sets = {
                    'popular': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'],
                    'tech': ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'INTC', 'CRM'],
                    'volatile': ['TSLA', 'GME', 'AMC', 'PLTR', 'COIN', 'RBLX', 'SNOW', 'ZOOM']
                }
                scan_symbols = fallback_sets.get(symbols, fallback_sets['popular'])
        else:
            scan_symbols = [s.strip().upper() for s in symbols.split(',')]
        
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
            task = progress.add_task(f"Scanning {len(scan_symbols)} symbols...", total=None)
            
            signals = await paper_service.scan_for_signals(scan_symbols, min_score)
            progress.update(task, completed=True)
        
        if not signals:
            console.print("[yellow]No actionable signals found[/yellow]")
            console.print("[dim]Try lowering --min-score or scanning different symbols[/dim]")
            return
        
        # Display results
        table = Table(title=f"📊 Trading Signals (Score ≥ {min_score})")
        table.add_column("Symbol", style="cyan", no_wrap=True)
        table.add_column("Score", style="green", justify="right")
        table.add_column("Recommendation", style="bold")
        table.add_column("Price", style="magenta", justify="right")
        table.add_column("Stop Loss", style="red", justify="right")
        table.add_column("Position Size", style="blue", justify="right")
        table.add_column("Risk %", style="yellow", justify="right")
        
        for signal in sorted(signals, key=lambda x: x.signal_score, reverse=True):
            risk_pct = 0
            if signal.stop_loss:
                risk_pct = abs(float((signal.current_price - signal.stop_loss) / signal.current_price)) * 100
            
            table.add_row(
                signal.symbol,
                f"{signal.signal_score:.2f}",
                signal.recommendation,
                f"${signal.current_price:.2f}",
                f"${signal.stop_loss:.2f}" if signal.stop_loss else "N/A",
                f"{signal.position_size_pct:.1%}",
                f"{risk_pct:.1f}%" if signal.stop_loss else "N/A"
            )
        
        console.print(table)
        
        # Save to file if requested
        if output:
            signal_data = [
                {
                    "symbol": s.symbol,
                    "signal_score": s.signal_score,
                    "recommendation": s.recommendation,
                    "current_price": float(s.current_price),
                    "stop_loss": float(s.stop_loss) if s.stop_loss else None,
                    "position_size_pct": s.position_size_pct,
                    "timestamp": s.timestamp.isoformat()
                }
                for s in signals
            ]
            
            with open(output, 'w') as f:
                json.dump(signal_data, f, indent=2)
            
            console.print(f"[green]Signals saved to {output}[/green]")
    
    asyncio.run(_scan_signals())


@app.command()
def paper_demo(
    capital: float = typer.Option(100000.0, "--capital", help="Initial capital"),
    symbols: str = typer.Option("popular", "--symbols", help="Symbol set to scan")
) -> None:
    """Run a paper trading demo with live signals."""
    
    async def _run_demo():
        settings = get_settings()
        paper_service = PaperTradingService(settings)
        
        if SimpleTickerService:
            ticker_service = SimpleTickerService(settings)
        else:
            console.print("[yellow]⚠️  SimpleTickerService not available, using fallback symbols[/yellow]")
            ticker_service = None
        
        console.print(Panel.fit(
            "[bold blue]🚀 Paper Trading Demo[/bold blue]\n\n"
            f"Initial Capital: ${capital:,.2f}\n"
            f"Symbol Set: {symbols}",
            title="Demo Setup"
        ))
        
        # Create demo portfolio
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
            task = progress.add_task("Creating demo portfolio...", total=None)
            
            portfolio = await paper_service.create_portfolio(
                name=f"Demo Portfolio {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                initial_capital=capital
            )
            
            progress.update(task, description="Scanning for signals...", completed=False)
            
            # Get symbols
            if ticker_service:
                symbol_sets = ticker_service.get_curated_symbol_sets()
                if symbols == 'popular':
                    scan_symbols = symbol_sets['popular'][:15]
                elif symbols == 'tech':
                    scan_symbols = symbol_sets['technology'][:15]
                else:
                    scan_symbols = symbol_sets['volatile'][:10]
            else:
                # Fallback symbol sets
                fallback_sets = {
                    'popular': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'],
                    'tech': ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'INTC', 'CRM'],
                    'volatile': ['TSLA', 'GME', 'AMC', 'PLTR', 'COIN', 'RBLX', 'SNOW', 'ZOOM']
                }
                if symbols == 'popular':
                    scan_symbols = fallback_sets['popular'][:15]
                elif symbols == 'tech':
                    scan_symbols = fallback_sets['tech'][:15]
                else:
                    scan_symbols = fallback_sets['volatile'][:10]
            
            # Scan for signals
            signals = await paper_service.scan_for_signals(scan_symbols, min_score=0.6)
            
            progress.update(task, description="Executing trades...", completed=False)
            
            # Execute trades
            trades = await paper_service.auto_trade_signals(portfolio.id, signals)
            
            progress.update(task, completed=True)
        
        # Show results
        console.print(f"\n[green]✅ Demo Complete![/green]")
        console.print(f"📊 Signals Found: {len(signals)}")
        console.print(f"💰 Trades Executed: {len(trades)}")
        
        if trades:
            console.print("\n[bold]Executed Trades:[/bold]")
            for trade in trades:
                console.print(f"  📈 {trade.symbol}: {trade.shares} shares @ ${trade.price:.2f} (Score: {trade.signal_score:.2f})")
        
        # Show portfolio summary
        summary = paper_service.get_portfolio_summary(portfolio.id)
        if summary:
            console.print(f"\n[bold]Portfolio Summary:[/bold]")
            console.print(f"  💰 Total Value: ${summary['total_market_value']:,.2f}")
            console.print(f"  📊 Cash: ${summary['current_cash']:,.2f}")
            console.print(f"  🏢 Positions: {summary['open_positions_count']}")
            console.print(f"  📈 Exposure: {summary['exposure_pct']:.1%}")
    
    asyncio.run(_run_demo())


if __name__ == "__main__":
    try:
        app()
    except Exception as e:
        console.print(f"[red]❌ CLI Error: {e}[/red]")
        import traceback
        console.print(f"[red]Traceback: {traceback.format_exc()}[/red]")
        raise
