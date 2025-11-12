"""CLI interface for CDS Finder."""

import typer
from typing import Optional, List, Annotated
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from loguru import logger

from .config import get_config
from .data.signal_fetcher import SignalFetcher
from .data.market_data import MarketDataProvider
from .analyzers.technical import TechnicalAnalyzer
from .analyzers.fundamental import FundamentalAnalyzer
from .analyzers.options import OptionsAnalyzer
from .analyzers.composite import CompositeScorer
from .analyzers.signal_correlation import SignalCorrelationAnalyzer
from .strategies.call_debit_spread import CallDebitSpreadCalculator
from .models.analysis import CallDebitSpreadOpportunity
from .utils.formatters import (
    format_opportunity_table,
    format_opportunity_detail,
    format_summary_stats,
)

app = typer.Typer(
    help="Find golden Call Debit Spread opportunities from unusual options signals",
    add_completion=False,
)
console = Console()


@app.command()
def scan(
    top_n: int = typer.Option(10, "--top-n", "-n", help="Number of top opportunities to show"),
    min_grade: Optional[str] = typer.Option(None, "--min-grade", "-g", help="Minimum signal grade (S/A/B/C)"),
    days_back: Optional[int] = typer.Option(None, "--days-back", "-d", help="Days to look back"),
    min_pop: Optional[float] = typer.Option(None, "--min-pop", help="Minimum probability of profit (%)"),
    min_rr: Optional[float] = typer.Option(None, "--min-rr", help="Minimum risk/reward ratio"),
    rsi_min: Optional[float] = typer.Option(None, "--rsi-min", help="Minimum RSI"),
    rsi_max: Optional[float] = typer.Option(None, "--rsi-max", help="Maximum RSI"),
    ticker: Optional[str] = typer.Option(None, "--ticker", "-t", help="Filter by ticker"),
):
    """
    Scan for Call Debit Spread opportunities.
    
    Example:
        cds-finder scan --top-n 10 --min-grade A --min-pop 50
    """
    console.print("\n[bold blue]🎯 Call Debit Spread Finder[/bold blue]")
    console.print("[dim]Scanning for golden opportunities...[/dim]\n")
    
    try:
        # Load configuration
        config = get_config()
        
        # Override config with CLI args
        if min_grade:
            config.min_grade = min_grade
        if days_back:
            config.days_back = days_back
        if min_pop:
            config.min_pop = min_pop
        if min_rr:
            config.min_rr = min_rr
        
        # Initialize components
        signal_fetcher = SignalFetcher(config)
        market_data = MarketDataProvider()
        technical_analyzer = TechnicalAnalyzer(market_data)
        fundamental_analyzer = FundamentalAnalyzer(market_data)
        spread_calculator = CallDebitSpreadCalculator(market_data)
        options_analyzer = OptionsAnalyzer(spread_calculator)
        composite_scorer = CompositeScorer()
        correlation_analyzer = SignalCorrelationAnalyzer()
        
        # Fetch signals
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Fetching signals...", total=None)
            signals = signal_fetcher.fetch_bullish_signals(
                min_grade=config.min_grade,
                days_back=config.days_back,
            )
            progress.update(task, description=f"Found {len(signals)} signals")
        
        if not signals:
            console.print("[yellow]No signals found matching criteria[/yellow]")
            return
        
        # Filter by ticker if specified
        if ticker:
            signals = [s for s in signals if s.ticker.upper() == ticker.upper()]
            if not signals:
                console.print(f"[yellow]No signals found for ticker {ticker}[/yellow]")
                return
        
        # Analyze signal correlation (multiple signals for same ticker)
        correlation_data = correlation_analyzer.analyze_correlation(signals)
        
        # Analyze each signal
        opportunities = []
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing opportunities...", total=len(signals))
            
            for signal in signals:
                try:
                    # Perform analyses
                    technical = technical_analyzer.analyze(signal)
                    fundamental = fundamental_analyzer.analyze(signal)
                    options = options_analyzer.analyze(signal)
                    
                    # Skip if options analysis failed (can't find suitable strikes)
                    if options is None:
                        logger.debug(f"Skipping {signal.ticker}: no suitable strikes found")
                        progress.update(task, advance=1)
                        continue
                    
                    # Get correlation bonus for this ticker
                    ticker_correlation = correlation_data.get(signal.ticker, {})
                    correlation_bonus = ticker_correlation.get("correlation_bonus", 0.0)
                    
                    # Calculate composite score
                    composite_score = composite_scorer.calculate_composite_score(
                        signal=signal,
                        technical=technical,
                        fundamental=fundamental,
                        options=options,
                        correlation_bonus=correlation_bonus,
                    )
                    
                    # Get confidence level
                    confidence_level = composite_scorer.get_confidence_level(composite_score)
                    
                    # Get recommendation
                    recommendation = composite_scorer.get_recommendation(
                        composite_score=composite_score,
                        confidence_level=confidence_level,
                        options=options,
                    )
                    
                    # Generate warnings and reasons
                    warnings = composite_scorer.generate_warnings(
                        signal=signal,
                        technical=technical,
                        fundamental=fundamental,
                        options=options,
                    )
                    
                    reasons = composite_scorer.generate_reasons(
                        signal=signal,
                        technical=technical,
                        fundamental=fundamental,
                        options=options,
                        composite_score=composite_score,
                    )
                    
                    # Apply quality filters (immediate actions)
                    # Minimum POP filter
                    if options.probability_of_profit < (min_pop or 50.0):
                        continue
                    
                    # Realistic R:R filter (1.5:1 to 3.5:1)
                    # Allow up to 3.5:1 to match fallback strike selection logic
                    if options.risk_reward_ratio < (min_rr or 1.5):
                        continue
                    if options.risk_reward_ratio > 3.5:
                        # R:R > 3.5:1 is unrealistic, likely pricing error
                        logger.debug(
                            f"Skipping {signal.ticker}: unrealistic R:R "
                            f"({options.risk_reward_ratio:.2f}:1)"
                        )
                        continue
                    
                    # Minimum composite score filter
                    if composite_score < 70:
                        continue
                    
                    # RSI filters
                    if rsi_min and technical.rsi < rsi_min:
                        continue
                    if rsi_max and technical.rsi > rsi_max:
                        continue
                    
                    # Create opportunity
                    opportunity = CallDebitSpreadOpportunity(
                        signal_id=signal.signal_id,
                        ticker=signal.ticker,
                        signal=signal,
                        technical=technical,
                        fundamental=fundamental,
                        options=options,
                        composite_score=composite_score,
                        confidence_level=confidence_level,
                        recommendation=recommendation,
                        warnings=warnings,
                        reasons=reasons,
                    )
                    
                    opportunities.append(opportunity)
                    
                except Exception as e:
                    logger.warning(f"Error analyzing {signal.ticker}: {e}")
                    continue
                
                progress.update(task, advance=1)
        
        if not opportunities:
            console.print("[yellow]No opportunities found after filtering[/yellow]")
            return
        
        # Sort by composite score
        opportunities.sort(key=lambda x: x.composite_score, reverse=True)
        
        # Limit to top N
        opportunities = opportunities[:top_n]
        
        # Display results
        console.print("\n")
        console.print(format_summary_stats(opportunities, console))
        console.print("\n")
        console.print(format_opportunity_table(opportunities, console))
        
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        logger.exception("Error in scan command")
        raise typer.Exit(1)


@app.command()
def analyze(
    ticker: str = typer.Argument(..., help="Ticker symbol to analyze"),
    min_grade: str = typer.Option("A", "--min-grade", "-g", help="Minimum signal grade"),
    days_back: int = typer.Option(7, "--days-back", "-d", help="Days to look back"),
):
    """
    Analyze a specific ticker for Call Debit Spread opportunities.
    
    Example:
        cds-finder analyze AAPL
    """
    console.print(f"\n[bold blue]📊 Analyzing {ticker}[/bold blue]\n")
    
    try:
        # Load configuration
        config = get_config()
        config.min_grade = min_grade
        config.days_back = days_back
        
        # Initialize components
        signal_fetcher = SignalFetcher(config)
        market_data = MarketDataProvider()
        technical_analyzer = TechnicalAnalyzer(market_data)
        fundamental_analyzer = FundamentalAnalyzer(market_data)
        spread_calculator = CallDebitSpreadCalculator(market_data)
        options_analyzer = OptionsAnalyzer(spread_calculator)
        composite_scorer = CompositeScorer()
        
        # Fetch signals for ticker
        signals = signal_fetcher.fetch_bullish_signals(
            min_grade=config.min_grade,
            days_back=config.days_back,
        )
        
        # Filter by ticker
        signals = [s for s in signals if s.ticker.upper() == ticker.upper()]
        
        if not signals:
            console.print(f"[yellow]No signals found for {ticker}[/yellow]")
            return
        
        # Analyze signal correlation
        correlation_analyzer = SignalCorrelationAnalyzer()
        correlation_data = correlation_analyzer.analyze_correlation(signals)
        
        # Analyze each signal
        opportunities = []
        for signal in signals:
            try:
                technical = technical_analyzer.analyze(signal)
                fundamental = fundamental_analyzer.analyze(signal)
                options = options_analyzer.analyze(signal)
                
                # Skip if options analysis failed (can't find suitable strikes)
                if options is None:
                    logger.debug(f"Skipping {signal.ticker}: no suitable strikes found")
                    continue
                
                # Get correlation bonus for this ticker
                ticker_correlation = correlation_data.get(signal.ticker, {})
                correlation_bonus = ticker_correlation.get("correlation_bonus", 0.0)
                
                composite_score = composite_scorer.calculate_composite_score(
                    signal=signal,
                    technical=technical,
                    fundamental=fundamental,
                    options=options,
                    correlation_bonus=correlation_bonus,
                )
                
                confidence_level = composite_scorer.get_confidence_level(composite_score)
                recommendation = composite_scorer.get_recommendation(
                    composite_score=composite_score,
                    confidence_level=confidence_level,
                    options=options,
                )
                
                warnings = composite_scorer.generate_warnings(
                    signal=signal,
                    technical=technical,
                    fundamental=fundamental,
                    options=options,
                )
                
                reasons = composite_scorer.generate_reasons(
                    signal=signal,
                    technical=technical,
                    fundamental=fundamental,
                    options=options,
                    composite_score=composite_score,
                )
                
                opportunity = CallDebitSpreadOpportunity(
                    signal_id=signal.signal_id,
                    ticker=signal.ticker,
                    signal=signal,
                    technical=technical,
                    fundamental=fundamental,
                    options=options,
                    composite_score=composite_score,
                    confidence_level=confidence_level,
                    recommendation=recommendation,
                    warnings=warnings,
                    reasons=reasons,
                )
                
                opportunities.append(opportunity)
                
            except Exception as e:
                logger.warning(f"Error analyzing signal: {e}")
                continue
        
        if not opportunities:
            console.print(f"[yellow]No opportunities found for {ticker}[/yellow]")
            return
        
        # Sort by score
        opportunities.sort(key=lambda x: x.composite_score, reverse=True)
        
        # Display details for top opportunity
        console.print(format_opportunity_detail(opportunities[0], console))
        
        # Show other opportunities if any
        if len(opportunities) > 1:
            console.print(f"\n[dim]Found {len(opportunities)} total opportunities for {ticker}[/dim]")
            console.print("[dim]Showing top opportunity. Use 'scan' command to see all.[/dim]")
        
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        logger.exception("Error in analyze command")
        raise typer.Exit(1)


@app.command()
def show(
    signal_id: str = typer.Argument(..., help="Signal ID to show"),
):
    """
    Show detailed information for a specific opportunity.
    
    Example:
        cds-finder show <signal_id>
    """
    console.print(f"\n[bold blue]🔍 Showing Signal: {signal_id}[/bold blue]\n")
    
    # This would require fetching by signal_id
    # For now, show a placeholder
    console.print("[yellow]Feature not yet implemented. Use 'scan' or 'analyze' commands.[/yellow]")


if __name__ == "__main__":
    app()

