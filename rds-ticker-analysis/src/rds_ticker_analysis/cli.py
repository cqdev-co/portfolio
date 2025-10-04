"""Command-line interface for RDS Ticker Analysis."""

import asyncio
import json
import os
import warnings
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import praw
import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.json import JSON

# Load environment variables from .env file
load_dotenv()

# Suppress PRAW async warnings for cleaner output
warnings.filterwarnings("ignore", category=UserWarning, module="praw")
warnings.filterwarnings("ignore", message="It appears that you are using PRAW in an asynchronous environment.*")

# Also suppress all warnings that contain the PRAW async message
import logging
logging.getLogger("praw").setLevel(logging.ERROR)

# Set environment variable to suppress PRAW warnings
os.environ["PRAW_SUPPRESS_ASYNC_WARNING"] = "1"

from rds_ticker_analysis.services.ai_analysis import AIAnalysisService
from rds_ticker_analysis.services.market_data import MarketDataService
from rds_ticker_analysis.services.reddit_sentiment import RedditSentimentService
from rds_ticker_analysis.services.scoring import ScoringService
from rds_ticker_analysis.services.ticker_analysis import TickerAnalysisService

# Initialize CLI app and console
app = typer.Typer(
    name="rds-ticker-analysis",
    help="Enterprise-grade Reddit-based ticker sentiment analysis",
    add_completion=False,
)
console = Console()

# Global services (initialized on first use)
_services = {}


def get_services() -> dict:
    """Initialize and return services."""
    if not _services:
        # Load configuration from environment
        reddit_client_id = os.getenv("REDDIT_CLIENT_ID")
        reddit_client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        reddit_user_agent = os.getenv("REDDIT_USER_AGENT", "rds-ticker-analysis/1.0")
        openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if not reddit_client_id or not reddit_client_secret:
            console.print("[red]Error: Reddit API credentials not found in environment[/red]")
            console.print("Please set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET")
            raise typer.Exit(1)
        
        # Initialize Reddit client
        reddit = praw.Reddit(
            client_id=reddit_client_id,
            client_secret=reddit_client_secret,
            user_agent=reddit_user_agent,
        )
        
        # Default subreddits to monitor
        subreddits = [
            "stocks", "investing", "options", "Daytrading", "wallstreetbets",
            "pennystocks", "SecurityAnalysis", "ValueInvesting"
        ]
        
        # Initialize services
        reddit_service = RedditSentimentService(
            reddit_client=reddit,
            subreddits=subreddits,
        )
        
        market_service = MarketDataService()
        scoring_service = ScoringService()
        
        ai_service = None
        if openai_api_key:
            ai_service = AIAnalysisService(openai_api_key)
        
        ticker_service = TickerAnalysisService(
            reddit_sentiment_service=reddit_service,
            market_data_service=market_service,
            scoring_service=scoring_service,
            ai_analysis_service=ai_service,
        )
        
        _services.update({
            'reddit': reddit_service,
            'market': market_service,
            'scoring': scoring_service,
            'ai': ai_service,
            'ticker': ticker_service,
        })
    
    return _services


@app.command()
def analyze(
    ticker: str = typer.Argument(..., help="Ticker symbol to analyze"),
    hours: int = typer.Option(24, "--hours", "-h", help="Hours of Reddit data to analyze"),
    ai: bool = typer.Option(False, "--ai", help="Include AI analysis (requires OpenAI API key)"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output file path (JSON)"),
) -> None:
    """Analyze a single ticker for investment opportunities."""
    console.print(f"[bold blue]Analyzing {ticker.upper()}[/bold blue]")
    
    async def run_analysis():
        services = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing ticker...", total=None)
            
            # Force AI analysis for now (Typer flag parsing has issues)
            console.print(f"[yellow]AI Analysis: Enabled[/yellow]")
            opportunity = await services['ticker'].analyze_ticker_opportunity(
                ticker_symbol=ticker.upper(),
                analysis_hours=hours,
                include_ai_analysis=True,  # Force AI enabled
            )
            
            progress.update(task, description="Analysis complete!")
        
        if not opportunity:
            console.print(f"[red]No analysis results for {ticker.upper()}[/red]")
            return
        
        # Display results
        display_opportunity_summary(opportunity)
        
        # Save to file if requested
        if output:
            save_opportunity_to_file(opportunity, output)
    
    asyncio.run(run_analysis())


@app.command()
def scan(
    subreddits: Optional[str] = typer.Option(None, "--subreddits", "-s", help="Comma-separated subreddits"),
    hours: int = typer.Option(24, "--hours", "-h", help="Hours of Reddit data to analyze"),
    min_mentions: int = typer.Option(3, "--min-mentions", "-m", help="Minimum mentions required"),
    limit: int = typer.Option(20, "--limit", "-l", help="Maximum opportunities to display"),
    ai: bool = typer.Option(False, "--ai", help="Include AI analysis (expensive)"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output file path (JSON)"),
) -> None:
    """Scan all monitored subreddits for ticker opportunities."""
    console.print("[bold blue]Running comprehensive ticker scan[/bold blue]")
    
    subreddit_list = None
    if subreddits:
        subreddit_list = [s.strip() for s in subreddits.split(",")]
    
    async def run_scan():
        services = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Scanning subreddits...", total=None)
            
            analysis_result = await services['ticker'].run_comprehensive_scan(
                subreddits=subreddit_list,
                analysis_hours=hours,
                min_mentions=min_mentions,
                include_ai_analysis=ai,
            )
            
            progress.update(task, description="Scan complete!")
        
        # Display results
        display_scan_results(analysis_result, limit)
        
        # Save to file if requested
        if output:
            save_analysis_result_to_file(analysis_result, output)
    
    asyncio.run(run_scan())


@app.command()
def validate(
    tickers: str = typer.Argument(..., help="Comma-separated ticker symbols to validate"),
) -> None:
    """Validate ticker symbols using market data."""
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    console.print(f"[bold blue]Validating {len(ticker_list)} tickers[/bold blue]")
    
    async def run_validation():
        services = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Validating tickers...", total=None)
            
            validation_results = await services['market'].validate_tickers(ticker_list)
            
            progress.update(task, description="Validation complete!")
        
        # Display results
        table = Table(title="Ticker Validation Results")
        table.add_column("Ticker", style="cyan")
        table.add_column("Valid", style="green")
        
        for ticker, is_valid in validation_results.items():
            status = "✓" if is_valid else "✗"
            color = "green" if is_valid else "red"
            table.add_row(ticker, f"[{color}]{status}[/{color}]")
        
        console.print(table)
        
        valid_count = sum(validation_results.values())
        console.print(f"\n[bold]{valid_count}/{len(ticker_list)} tickers are valid[/bold]")
    
    asyncio.run(run_validation())


@app.command()
def sentiment(
    subreddit: str = typer.Argument(..., help="Subreddit to analyze"),
    hours: int = typer.Option(24, "--hours", "-h", help="Hours of data to analyze"),
    limit: int = typer.Option(100, "--limit", "-l", help="Maximum posts to analyze"),
) -> None:
    """Analyze sentiment in a specific subreddit."""
    console.print(f"[bold blue]Analyzing sentiment in r/{subreddit}[/bold blue]")
    
    async def run_sentiment_analysis():
        services = get_services()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing sentiment...", total=None)
            
            analyses = await services['reddit'].analyze_subreddit_activity(
                subreddit_name=subreddit,
                hours_back=hours,
                limit=limit,
            )
            
            progress.update(task, description="Sentiment analysis complete!")
        
        if not analyses:
            console.print(f"[red]No sentiment data found for r/{subreddit}[/red]")
            return
        
        # Aggregate results by ticker
        ticker_sentiment = {}
        for analysis in analyses:
            ticker = analysis.ticker_symbol
            if ticker not in ticker_sentiment:
                ticker_sentiment[ticker] = []
            ticker_sentiment[ticker].append(analysis)
        
        # Display results
        table = Table(title=f"Sentiment Analysis - r/{subreddit}")
        table.add_column("Ticker", style="cyan")
        table.add_column("Mentions", justify="right")
        table.add_column("Avg Sentiment", justify="center")
        table.add_column("Confidence", justify="right")
        table.add_column("Quality", justify="right")
        
        for ticker, ticker_analyses in sorted(ticker_sentiment.items(), 
                                           key=lambda x: len(x[1]), reverse=True)[:20]:
            mentions = len(ticker_analyses)
            avg_confidence = sum(a.sentiment.confidence for a in ticker_analyses) / mentions
            avg_quality = sum(a.content_quality_score for a in ticker_analyses) / mentions
            
            # Calculate average sentiment score
            sentiment_scores = []
            for a in ticker_analyses:
                if a.sentiment.label.value == "very_bullish":
                    sentiment_scores.append(1.0)
                elif a.sentiment.label.value == "bullish":
                    sentiment_scores.append(0.75)
                elif a.sentiment.label.value == "slightly_bullish":
                    sentiment_scores.append(0.55)
                elif a.sentiment.label.value == "neutral":
                    sentiment_scores.append(0.5)
                elif a.sentiment.label.value == "slightly_bearish":
                    sentiment_scores.append(0.45)
                elif a.sentiment.label.value == "bearish":
                    sentiment_scores.append(0.25)
                else:  # very_bearish
                    sentiment_scores.append(0.0)
            
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
            
            # Color code sentiment
            if avg_sentiment >= 0.6:
                sentiment_color = "green"
                sentiment_text = "Bullish"
            elif avg_sentiment >= 0.4:
                sentiment_color = "yellow"
                sentiment_text = "Neutral"
            else:
                sentiment_color = "red"
                sentiment_text = "Bearish"
            
            table.add_row(
                ticker,
                str(mentions),
                f"[{sentiment_color}]{sentiment_text}[/{sentiment_color}]",
                f"{avg_confidence:.2f}",
                f"{avg_quality:.2f}",
            )
        
        console.print(table)
        console.print(f"\n[bold]Found {len(analyses)} sentiment analyses for {len(ticker_sentiment)} tickers[/bold]")
    
    asyncio.run(run_sentiment_analysis())


@app.command()
def config() -> None:
    """Show current configuration."""
    console.print("[bold blue]Current Configuration[/bold blue]")
    
    config_data = {
        "reddit_client_id": "✓" if os.getenv("REDDIT_CLIENT_ID") else "✗",
        "reddit_client_secret": "✓" if os.getenv("REDDIT_CLIENT_SECRET") else "✗",
        "openai_api_key": "✓" if os.getenv("OPENAI_API_KEY") else "✗",
        "reddit_user_agent": os.getenv("REDDIT_USER_AGENT", "rds-ticker-analysis/1.0"),
    }
    
    table = Table(title="Environment Configuration")
    table.add_column("Setting", style="cyan")
    table.add_column("Status", justify="center")
    
    for key, value in config_data.items():
        if value in ["✓", "✗"]:
            color = "green" if value == "✓" else "red"
            table.add_row(key, f"[{color}]{value}[/{color}]")
        else:
            table.add_row(key, value)
    
    console.print(table)
    
    if config_data["reddit_client_id"] == "✗" or config_data["reddit_client_secret"] == "✗":
        console.print("\n[red]Warning: Reddit API credentials missing![/red]")
        console.print("Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables")
    
    if config_data["openai_api_key"] == "✗":
        console.print("\n[yellow]Note: OpenAI API key not configured[/yellow]")
        console.print("AI analysis features will be disabled")


def display_comprehensive_ai_analysis(ai_insights) -> None:
    """Display comprehensive AI analysis with full content and beautiful formatting."""
    from rich.text import Text
    from rich.columns import Columns
    
    # Executive Summary
    executive_summary = Text()
    executive_summary.append("📊 Executive Summary\n", style="bold cyan")
    executive_summary.append(ai_insights.executive_summary, style="white")
    
    # Investment Thesis  
    investment_thesis = Text()
    investment_thesis.append("💡 Investment Thesis\n", style="bold green")
    investment_thesis.append(ai_insights.investment_thesis, style="white")
    
    # Key Insights
    key_insights = Text()
    key_insights.append("🔍 Key Insights\n", style="bold yellow")
    for i, insight in enumerate(ai_insights.key_insights, 1):
        key_insights.append(f"{i}. {insight}\n", style="white")
    
    # Risk Factors
    risk_factors = Text()
    risk_factors.append("⚠️  Risk Factors\n", style="bold red")
    for i, risk in enumerate(ai_insights.risk_factors, 1):
        risk_factors.append(f"{i}. {risk}\n", style="white")
    
    # Catalysts
    catalysts = Text()
    catalysts.append("🚀 Potential Catalysts\n", style="bold magenta")
    for i, catalyst in enumerate(ai_insights.catalysts, 1):
        catalysts.append(f"{i}. {catalyst}\n", style="white")
    
    # Price Targets
    price_targets = Text()
    price_targets.append("🎯 Price Analysis\n", style="bold blue")
    if ai_insights.price_target_bull:
        price_targets.append(f"Bull Case: ${ai_insights.price_target_bull:.2f}\n", style="green")
    if ai_insights.price_target_bear:
        price_targets.append(f"Bear Case: ${ai_insights.price_target_bear:.2f}\n", style="red")
    if ai_insights.time_horizon:
        price_targets.append(f"Time Horizon: {ai_insights.time_horizon}\n", style="white")
    
    # Display in panels
    console.print("\n")
    console.print(Panel(executive_summary, title="🤖 AI Analysis - Executive Summary", border_style="cyan", padding=(1, 2)))
    console.print(Panel(investment_thesis, title="💭 Investment Thesis", border_style="green", padding=(1, 2)))
    
    # Display insights and risks side by side if they fit
    if len(str(key_insights)) < 400 and len(str(risk_factors)) < 400:
        insights_panel = Panel(key_insights, title="🔍 Key Insights", border_style="yellow", padding=(1, 1))
        risks_panel = Panel(risk_factors, title="⚠️ Risk Factors", border_style="red", padding=(1, 1))
        console.print(Columns([insights_panel, risks_panel], equal=True, expand=True))
    else:
        console.print(Panel(key_insights, title="🔍 Key Insights", border_style="yellow", padding=(1, 2)))
        console.print(Panel(risk_factors, title="⚠️ Risk Factors", border_style="red", padding=(1, 2)))
    
    # Display catalysts and price targets
    console.print(Panel(catalysts, title="🚀 Potential Catalysts", border_style="magenta", padding=(1, 2)))
    
    if ai_insights.price_target_bull or ai_insights.price_target_bear:
        console.print(Panel(price_targets, title="🎯 Price Analysis", border_style="blue", padding=(1, 2)))
    
    # Final recommendation
    if ai_insights.recommendation:
        recommendation_text = Text()
        recommendation_text.append("🎯 AI Recommendation\n", style="bold white")
        recommendation_text.append(ai_insights.recommendation, style="bold cyan")
        console.print(Panel(recommendation_text, title="🤖 Final AI Recommendation", border_style="bright_cyan", padding=(1, 2)))


def display_opportunity_summary(opportunity) -> None:
    """Display a comprehensive opportunity summary."""
    # Main summary panel
    score = float(opportunity.opportunity_score.overall_score)
    grade = opportunity.opportunity_score.opportunity_grade.value
    risk_level = opportunity.risk_assessment.risk_level.value
    
    summary_text = f"""
[bold]{opportunity.ticker_symbol}[/bold] - {opportunity.company_name}
[bold]Overall Score:[/bold] {score:.3f} ([bold]{grade}[/bold] Grade)
[bold]Risk Level:[/bold] {risk_level.title()}
[bold]Recommendation:[/bold] {opportunity.recommended_action.title()}
[bold]Conviction:[/bold] {float(opportunity.conviction_level):.2f}
    """.strip()
    
    console.print(Panel(summary_text, title="Opportunity Summary", border_style="blue"))
    
    # Scoring breakdown
    scores_table = Table(title="Scoring Breakdown")
    scores_table.add_column("Component", style="cyan")
    scores_table.add_column("Score", justify="right")
    scores_table.add_column("Weight", justify="right")
    
    score_obj = opportunity.opportunity_score
    scores_table.add_row("Sentiment", f"{float(score_obj.sentiment_score):.3f}", f"{float(score_obj.weights['sentiment']):.2f}")
    scores_table.add_row("Volume", f"{float(score_obj.volume_score):.3f}", f"{float(score_obj.weights['volume']):.2f}")
    scores_table.add_row("Quality", f"{float(score_obj.quality_score):.3f}", f"{float(score_obj.weights['quality']):.2f}")
    scores_table.add_row("Momentum", f"{float(score_obj.momentum_score):.3f}", f"{float(score_obj.weights['momentum']):.2f}")
    scores_table.add_row("Technical", f"{float(score_obj.technical_score):.3f}", f"{float(score_obj.weights['technical']):.2f}")
    scores_table.add_row("Fundamental", f"{float(score_obj.fundamental_score):.3f}", f"{float(score_obj.weights['fundamental']):.2f}")
    
    console.print(scores_table)
    
    # Reddit metrics
    reddit_table = Table(title="Reddit Activity")
    reddit_table.add_column("Metric", style="cyan")
    reddit_table.add_column("Value", justify="right")
    
    metrics = opportunity.reddit_metrics
    reddit_table.add_row("Total Mentions", str(metrics.total_mentions))
    reddit_table.add_row("Unique Authors", str(metrics.unique_authors))
    reddit_table.add_row("Last 24h", str(metrics.mentions_last_day))
    reddit_table.add_row("Quality Ratio", f"{metrics.quality_ratio:.2f}")
    reddit_table.add_row("Momentum Score", f"{metrics.momentum_score:.2f}")
    
    console.print(reddit_table)
    
    # Risk assessment
    risk_table = Table(title="Risk Assessment")
    risk_table.add_column("Risk Type", style="cyan")
    risk_table.add_column("Score", justify="right")
    
    risk = opportunity.risk_assessment
    risk_table.add_row("Market Risk", f"{float(risk.market_risk):.3f}")
    risk_table.add_row("Liquidity Risk", f"{float(risk.liquidity_risk):.3f}")
    risk_table.add_row("Volatility Risk", f"{float(risk.volatility_risk):.3f}")
    risk_table.add_row("Sentiment Risk", f"{float(risk.sentiment_risk):.3f}")
    risk_table.add_row("Manipulation Risk", f"{float(risk.manipulation_risk):.3f}")
    
    console.print(risk_table)
    
    # Position sizing recommendations
    position_text = f"""
[bold]Max Position Size:[/bold] {float(risk.max_position_size_pct):.1f}%
[bold]Recommended Stop Loss:[/bold] {float(risk.recommended_stop_loss_pct):.1f}%
[bold]Risk-Adjusted Score:[/bold] {float(risk.risk_adjusted_score):.3f}
    """.strip()
    
    console.print(Panel(position_text, title="Position Sizing", border_style="yellow"))
    
    # AI insights (if available)
    if opportunity.ai_insights:
        display_comprehensive_ai_analysis(opportunity.ai_insights)


def display_scan_results(analysis_result, limit: int) -> None:
    """Display comprehensive scan results."""
    # Summary statistics
    summary_text = f"""
[bold]Analysis Run:[/bold] {analysis_result.analysis_run_id}
[bold]Duration:[/bold] {analysis_result.duration_seconds}s
[bold]Opportunities Found:[/bold] {analysis_result.opportunities_found}
[bold]High-Grade Opportunities:[/bold] {analysis_result.high_grade_opportunities}
[bold]Processing Rate:[/bold] {analysis_result.processing_rate_posts_per_second:.1f} posts/sec
    """.strip()
    
    console.print(Panel(summary_text, title="Scan Results", border_style="blue"))
    
    # Top opportunities table
    if analysis_result.top_opportunities:
        table = Table(title=f"Top {min(limit, len(analysis_result.top_opportunities))} Opportunities")
        table.add_column("Rank", justify="right")
        table.add_column("Ticker", style="cyan")
        table.add_column("Score", justify="right")
        table.add_column("Grade", justify="center")
        table.add_column("Risk", justify="center")
        table.add_column("Mentions", justify="right")
        table.add_column("Action", style="bold")
        
        for i, opp in enumerate(analysis_result.top_opportunities[:limit], 1):
            score = float(opp.opportunity_score.overall_score)
            grade = opp.opportunity_score.opportunity_grade.value
            risk = opp.risk_assessment.risk_level.value
            mentions = opp.reddit_metrics.total_mentions
            action = opp.recommended_action.replace("_", " ").title()
            
            # Color code grade
            if grade in ['S', 'A']:
                grade_color = "green"
            elif grade == 'B':
                grade_color = "yellow"
            else:
                grade_color = "red"
            
            # Color code risk
            if risk in ['very_low', 'low']:
                risk_color = "green"
            elif risk == 'moderate':
                risk_color = "yellow"
            else:
                risk_color = "red"
            
            table.add_row(
                str(i),
                opp.ticker_symbol,
                f"{score:.3f}",
                f"[{grade_color}]{grade}[/{grade_color}]",
                f"[{risk_color}]{risk.title()}[/{risk_color}]",
                str(mentions),
                action,
            )
        
        console.print(table)
    
    # Performance metrics
    perf_text = f"""
[bold]Posts Analyzed:[/bold] {analysis_result.total_reddit_posts_analyzed:,}
[bold]Unique Tickers:[/bold] {analysis_result.unique_tickers_mentioned}
[bold]Data Quality:[/bold] {analysis_result.overall_data_quality:.2f}
[bold]Completeness:[/bold] {analysis_result.data_completeness_pct:.1f}%
    """.strip()
    
    console.print(Panel(perf_text, title="Performance Metrics", border_style="green"))


def save_opportunity_to_file(opportunity, filepath: str) -> None:
    """Save opportunity analysis to JSON file."""
    # Convert to dictionary for JSON serialization
    data = {
        "ticker_symbol": opportunity.ticker_symbol,
        "company_name": opportunity.company_name,
        "analysis_date": opportunity.analysis_date.isoformat(),
        "current_price": float(opportunity.current_price) if opportunity.current_price else None,
        "opportunity_score": {
            "overall_score": float(opportunity.opportunity_score.overall_score),
            "grade": opportunity.opportunity_score.opportunity_grade.value,
            "signal_strength": opportunity.opportunity_score.signal_strength.value,
            "components": {
                "sentiment": float(opportunity.opportunity_score.sentiment_score),
                "volume": float(opportunity.opportunity_score.volume_score),
                "quality": float(opportunity.opportunity_score.quality_score),
                "momentum": float(opportunity.opportunity_score.momentum_score),
                "technical": float(opportunity.opportunity_score.technical_score),
                "fundamental": float(opportunity.opportunity_score.fundamental_score),
            }
        },
        "risk_assessment": {
            "overall_risk": float(opportunity.risk_assessment.overall_risk_score),
            "risk_level": opportunity.risk_assessment.risk_level.value,
            "max_position_size_pct": float(opportunity.risk_assessment.max_position_size_pct),
            "stop_loss_pct": float(opportunity.risk_assessment.recommended_stop_loss_pct),
        },
        "reddit_metrics": {
            "total_mentions": opportunity.reddit_metrics.total_mentions,
            "unique_authors": opportunity.reddit_metrics.unique_authors,
            "mentions_last_day": opportunity.reddit_metrics.mentions_last_day,
            "quality_ratio": opportunity.reddit_metrics.quality_ratio,
            "momentum_score": opportunity.reddit_metrics.momentum_score,
        },
        "recommended_action": opportunity.recommended_action,
        "conviction_level": float(opportunity.conviction_level),
    }
    
    if opportunity.ai_insights:
        data["ai_insights"] = {
            "executive_summary": opportunity.ai_insights.executive_summary,
            "key_bullish_points": opportunity.ai_insights.key_bullish_points,
            "key_bearish_points": opportunity.ai_insights.key_bearish_points,
            "investment_thesis": opportunity.ai_insights.investment_thesis,
            "confidence": float(opportunity.ai_insights.analysis_confidence),
        }
    
    # Save to file
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    console.print(f"[green]Analysis saved to {filepath}[/green]")


def save_analysis_result_to_file(analysis_result, filepath: str) -> None:
    """Save analysis result to JSON file."""
    # Convert opportunities to simplified format
    opportunities_data = []
    for opp in analysis_result.top_opportunities[:50]:  # Limit to top 50
        opp_data = {
            "ticker_symbol": opp.ticker_symbol,
            "overall_score": float(opp.opportunity_score.overall_score),
            "grade": opp.opportunity_score.opportunity_grade.value,
            "risk_level": opp.risk_assessment.risk_level.value,
            "total_mentions": opp.reddit_metrics.total_mentions,
            "recommended_action": opp.recommended_action,
            "conviction_level": float(opp.conviction_level),
        }
        opportunities_data.append(opp_data)
    
    data = {
        "analysis_run_id": analysis_result.analysis_run_id,
        "start_time": analysis_result.start_time.isoformat(),
        "end_time": analysis_result.end_time.isoformat(),
        "duration_seconds": analysis_result.duration_seconds,
        "opportunities_found": analysis_result.opportunities_found,
        "high_grade_opportunities": analysis_result.high_grade_opportunities,
        "processing_rate": analysis_result.processing_rate_posts_per_second,
        "data_quality": analysis_result.overall_data_quality,
        "top_opportunities": opportunities_data,
        "config": analysis_result.analysis_config,
    }
    
    # Save to file
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    console.print(f"[green]Scan results saved to {filepath}[/green]")


@app.command()
def debug(
    ticker: str = typer.Argument(..., help="Ticker to debug"),
    subreddit: str = typer.Option("pennystocks", "--subreddit", "-s", help="Subreddit to analyze"),
    limit: int = typer.Option(10, "--limit", "-l", help="Number of posts to show"),
) -> None:
    """Debug sentiment analysis for a specific ticker."""
    console.print(f"[bold blue]Debugging sentiment analysis for {ticker} in r/{subreddit}[/bold blue]")
    
    async def run_debug():
        services = get_services()
        
        analyses = await services['reddit'].analyze_subreddit_activity(
            subreddit_name=subreddit,
            hours_back=24,
            limit=100,
        )
        
        # Filter for specific ticker
        ticker_analyses = [a for a in analyses if a.ticker_symbol.upper() == ticker.upper()]
        
        if not ticker_analyses:
            console.print(f"[yellow]No mentions of {ticker} found in r/{subreddit}[/yellow]")
            return
        
        console.print(f"[green]Found {len(ticker_analyses)} mentions of {ticker}[/green]\n")
        
        for i, analysis in enumerate(ticker_analyses[:limit]):
            console.print(f"[bold cyan]Mention {i+1}:[/bold cyan]")
            console.print(f"Text: {analysis.analyzed_text[:200]}...")
            console.print(f"Sentiment Label: [bold]{analysis.sentiment.label.value}[/bold]")
            console.print(f"Polarity: {analysis.sentiment.polarity:.3f}")
            console.print(f"Confidence: {analysis.sentiment.confidence:.3f}")
            console.print(f"Quality Score: {analysis.content_quality_score:.3f}")
            console.print(f"Reliability: {analysis.reliability_score:.3f}")
            console.print("---")
    
    asyncio.run(run_debug())


@app.command()
def fast(
    ticker: str = typer.Argument(..., help="Ticker to analyze quickly"),
    enable_ai: bool = typer.Option(False, "--with-ai", help="Include AI analysis"),
) -> None:
    """Fast analysis mode - analyze only 1 subreddit with limited posts."""
    console.print(f"[bold blue]Fast analyzing {ticker} (pennystocks only)[/bold blue]")
    
    async def run_fast_analysis():
        services = get_services()
        # Force AI enabled for now (Typer flag parsing has issues)
        ai_enabled = True
        console.print(f"[yellow]AI Analysis: Enabled[/yellow]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Fast analyzing...", total=None)
            
            # Analyze only pennystocks with limited posts
            analyses = await services['reddit'].analyze_subreddit_activity(
                subreddit_name="pennystocks",
                hours_back=24,
                limit=20,  # Much smaller limit
            )
            
            # Filter for specific ticker
            ticker_analyses = [a for a in analyses if a.ticker_symbol.upper() == ticker.upper()]
            
            if not ticker_analyses:
                console.print(f"[yellow]No mentions of {ticker} found in r/pennystocks[/yellow]")
                return
            
            # Get market data
            ticker_info = await services['market'].get_ticker_info(ticker)
            market_data = await services['market'].get_current_market_data(ticker)
            
            # Create minimal reddit metrics
            reddit_metrics = services['ticker']._calculate_reddit_metrics([], ticker_analyses)
            
            # Calculate scores
            opportunity_score = services['scoring'].calculate_opportunity_score(
                sentiment_analyses=ticker_analyses,
                reddit_metrics=reddit_metrics,
                market_data=market_data,
            )
            
            # AI analysis if requested
            ai_insights = None
            if ai_enabled and services['ai']:
                console.print(f"[blue]Starting AI analysis...[/blue]")
                try:
                    ai_insights = await services['ai'].generate_comprehensive_analysis(
                        ticker_symbol=ticker,
                        ticker_info=ticker_info,
                        market_data=market_data,
                        sentiment_analyses=ticker_analyses,
                        reddit_mentions=[],
                    )
                    console.print(f"[green]AI Analysis Generated![/green]")
                except Exception as e:
                    console.print(f"[red]AI Analysis Failed: {e}[/red]")
            elif ai_enabled and not services['ai']:
                console.print(f"[red]AI requested but service not available[/red]")
            
            progress.update(task, description="Analysis complete!")
        
        # Display results
        console.print(f"\n[bold green]Fast Analysis Results for {ticker}:[/bold green]")
        console.print(f"Reddit Mentions: {len(ticker_analyses)}")
        console.print(f"Overall Score: {opportunity_score.overall_score:.3f}")
        console.print(f"Sentiment Score: {opportunity_score.sentiment_score:.3f}")
        console.print(f"Grade: {opportunity_score.opportunity_grade.value}")
        
        if ai_insights:
            display_comprehensive_ai_analysis(ai_insights)
        else:
            console.print(f"\n[yellow]No AI analysis available[/yellow]")
    
    asyncio.run(run_fast_analysis())


if __name__ == "__main__":
    app()
