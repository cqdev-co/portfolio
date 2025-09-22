"""Main CLI application for Reddit Source."""

import asyncio
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from ..config.settings import get_settings
from ..ingest.reddit_client import RedditClient
from ..storage.simple_storage import get_admin_simple_storage_client
from ..processing.processor import RedditProcessor

# Initialize Rich console
console = Console()
app = typer.Typer(
    name="reddit-source",
    help="Enterprise-grade Reddit data source for financial sentiment analysis",
    rich_markup_mode="rich"
)

# Configure logging
def setup_logging(debug: bool = False) -> None:
    """Setup logging configuration."""
    settings = get_settings()
    
    level = logging.DEBUG if debug else getattr(logging, settings.logging.level.upper())
    
    # Create logs directory if it doesn't exist
    if settings.logging.file:
        settings.logging.file.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            RichHandler(console=console, rich_tracebacks=True),
            logging.FileHandler(settings.logging.file) if settings.logging.file else logging.NullHandler()
        ]
    )
    
    # Reduce noise from external libraries - be more aggressive
    logging.getLogger("httpx").setLevel(logging.ERROR)
    logging.getLogger("httpcore").setLevel(logging.ERROR)
    logging.getLogger("supabase").setLevel(logging.WARNING)
    logging.getLogger("postgrest").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.ERROR)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("hpack").setLevel(logging.ERROR)  # Suppress HTTP/2 frame debugging
    logging.getLogger("h2").setLevel(logging.ERROR)     # Suppress HTTP/2 debugging


@app.command()
def ingest(
    subreddits: Optional[str] = typer.Option(None, "--subreddits", help="Comma-separated list of subreddits"),
    limit: int = typer.Option(100, "--limit", help="Maximum posts per poll cycle"),
    once: bool = typer.Option(False, "--once", is_flag=True, help="Run once instead of continuous polling"),
    watch: bool = typer.Option(False, "--watch", is_flag=True, help="Run in continuous polling mode"),
    debug: bool = typer.Option(False, "--debug", is_flag=True, help="Enable debug logging")
) -> None:
    """Ingest Reddit posts from configured subreddits."""
    setup_logging(debug)
    
    # For now, just assume --once means single run, otherwise continuous
    # TODO: Fix Typer boolean flag parsing issue
    import sys
    actual_once = "--once" in sys.argv
    actual_watch = "--watch" in sys.argv or not actual_once
    
    if actual_once and actual_watch and "--watch" in sys.argv:
        console.print("[red]Error: Cannot use both --once and --watch flags[/red]")
        raise typer.Exit(1)
    
    asyncio.run(_ingest_posts(actual_once, subreddits, limit))


async def _ingest_posts(once: bool, subreddits: Optional[str], limit: int) -> None:
    """Internal async function for ingesting posts."""
    settings = get_settings()
    storage = get_admin_simple_storage_client()
    
    # Override subreddits if provided
    target_subreddits = (
        [s.strip() for s in subreddits.split(",")] 
        if subreddits 
        else settings.data.subreddits
    )
    
    console.print(f"[green]Starting Reddit ingestion...[/green]")
    console.print(f"Subreddits: {', '.join(target_subreddits)}")
    console.print(f"Mode: {'Single run' if once else 'Continuous polling'}")
    
    # Check Supabase connection
    if not await storage.health_check():
        console.print("[red]Error: Cannot connect to Supabase[/red]")
        return
    
    async with RedditClient() as reddit:
        while True:
            try:
                # Process posts with progress indicator
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    console=console
                ) as progress:
                    task = progress.add_task("Fetching posts...", total=None)
                    
                    # Get recent posts (all posts, not time-filtered for testing)
                    posts = await reddit.get_posts_from_multiple_subreddits(
                        subreddits=target_subreddits,
                        sort="new",
                        time_filter="day",  # Get posts from last 24 hours
                        limit_per_sub=min(limit // len(target_subreddits), 25)  # Distribute limit across subreddits
                    )
                    
                    progress.update(task, description=f"Processing {len(posts)} posts...")
                    
                    if posts:
                        # Image downloading temporarily disabled due to path encoding issues
                        # The core Reddit ingestion works perfectly, images can be added later
                        image_posts = [p for p in posts if p.is_image and p.url]
                        downloaded_count = 0
                        
                        # Insert posts into database
                        inserted_count = await storage.insert_posts_batch(posts)
                        
                        progress.update(
                            task, 
                            description=f"Inserted {inserted_count}/{len(posts)} posts"
                        )
                
                # Progress context is now closed, show results
                if posts:
                       console.print(
                           f"[green]✓[/green] Processed {len(posts)} posts, "
                           f"inserted {inserted_count}, "
                           f"found {len(image_posts)} images (downloads disabled)"
                       )
                else:
                    console.print("[yellow]No new posts found[/yellow]")
                
                # Exit immediately if running once (Progress context is fully closed)
                if once:
                    console.print("[green]Single run completed[/green]")
                    return
                
                # Only reach here in continuous mode
                console.print(f"Waiting {settings.data.poll_interval_seconds} seconds...")
                await asyncio.sleep(settings.data.poll_interval_seconds)
                
            except KeyboardInterrupt:
                console.print("\n[yellow]Stopping ingestion...[/yellow]")
                break
            except Exception as e:
                console.print(f"[red]Error during ingestion: {e}[/red]")
                if once:
                    break
                await asyncio.sleep(30)  # Wait before retrying


@app.command()
def export(
    date: str = typer.Option(..., "--date", help="Date to export (YYYY-MM-DD)"),
    output_dir: str = typer.Option("./data/exports", "--output", help="Output directory"),
    format: str = typer.Option("parquet", "--format", help="Export format (parquet, csv, json)"),
    ticker: Optional[str] = typer.Option(None, "--ticker", help="Filter by ticker symbol"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging")
) -> None:
    """Export processed Reddit data for a specific date."""
    setup_logging(debug)
    
    try:
        export_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        console.print("[red]Error: Invalid date format. Use YYYY-MM-DD[/red]")
        raise typer.Exit(1)
    
    asyncio.run(_export_data(export_date, Path(output_dir), format, ticker))


async def _export_data(
    export_date: datetime, 
    output_dir: Path, 
    format: str, 
    ticker: Optional[str]
) -> None:
    """Internal async function for exporting data."""
    storage = get_admin_simple_storage_client()
    
    console.print(f"[green]Exporting data for {export_date.strftime('%Y-%m-%d')}...[/green]")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get scanner-ready signals
    signals = await storage.get_scanner_ready_signals(
        ticker=ticker,
        min_buzz_z=0.0,  # Get all signals for export
        quality_tiers=["valuable", "soft_quarantine"]
    )
    
    if not signals:
        console.print("[yellow]No signals found for the specified criteria[/yellow]")
        return
    
    # Filter by date
    date_filtered = []
    for signal in signals:
        signal_date = datetime.fromisoformat(signal["created_datetime"].replace("Z", "+00:00"))
        if signal_date.date() == export_date.date():
            date_filtered.append(signal)
    
    if not date_filtered:
        console.print(f"[yellow]No signals found for {export_date.strftime('%Y-%m-%d')}[/yellow]")
        return
    
    # Generate filename
    filename_parts = ["reddit_signals", export_date.strftime("%Y%m%d")]
    if ticker:
        filename_parts.append(ticker.lower())
    
    filename = "_".join(filename_parts)
    
    # Export based on format
    if format.lower() == "parquet":
        import pandas as pd
        df = pd.DataFrame(date_filtered)
        output_path = output_dir / f"{filename}.parquet"
        df.to_parquet(output_path, index=False)
    elif format.lower() == "csv":
        import pandas as pd
        df = pd.DataFrame(date_filtered)
        output_path = output_dir / f"{filename}.csv"
        df.to_csv(output_path, index=False)
    elif format.lower() == "json":
        import json
        output_path = output_dir / f"{filename}.json"
        with open(output_path, "w") as f:
            json.dump(date_filtered, f, indent=2, default=str)
    else:
        console.print(f"[red]Error: Unsupported format '{format}'[/red]")
        return
    
    console.print(f"[green]✓[/green] Exported {len(date_filtered)} signals to {output_path}")


@app.command()
def join(
    scanner_file: str = typer.Option(..., "--scanner", help="Path to scanner signals parquet file"),
    output_file: str = typer.Option("./data/joined_signals.parquet", "--output", help="Output file path"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging")
) -> None:
    """Join Reddit features with scanner signals."""
    setup_logging(debug)
    
    scanner_path = Path(scanner_file)
    if not scanner_path.exists():
        console.print(f"[red]Error: Scanner file not found: {scanner_path}[/red]")
        raise typer.Exit(1)
    
    asyncio.run(_join_signals(scanner_path, Path(output_file)))


async def _join_signals(scanner_path: Path, output_path: Path) -> None:
    """Internal async function for joining signals."""
    try:
        import pandas as pd
    except ImportError:
        console.print("[red]Error: pandas is required for join operations[/red]")
        return
    
    storage = get_admin_simple_storage_client()
    
    console.print(f"[green]Loading scanner signals from {scanner_path}...[/green]")
    
    # Load scanner signals
    scanner_df = pd.read_parquet(scanner_path)
    console.print(f"Loaded {len(scanner_df)} scanner signals")
    
    # Get Reddit features
    console.print("Fetching Reddit features...")
    reddit_signals = await storage.get_scanner_ready_signals(
        min_buzz_z=1.0,
        quality_tiers=["valuable"]
    )
    
    if not reddit_signals:
        console.print("[yellow]No Reddit signals found[/yellow]")
        return
    
    reddit_df = pd.DataFrame(reddit_signals)
    console.print(f"Loaded {len(reddit_df)} Reddit signals")
    
    # Perform join based on ticker and time proximity
    if "signal_ts" in scanner_df.columns and "primary_ticker" in reddit_df.columns:
        # Convert timestamps
        scanner_df["signal_ts"] = pd.to_datetime(scanner_df["signal_ts"])
        reddit_df["created_datetime"] = pd.to_datetime(reddit_df["created_datetime"])
        
        # Create 2-hour buckets for joining
        scanner_df["bucket_2h"] = scanner_df["signal_ts"].dt.floor("2H")
        reddit_df["bucket_2h"] = reddit_df["created_datetime"].dt.floor("2H")
        
        # Join on ticker and time bucket
        joined_df = scanner_df.merge(
            reddit_df,
            left_on=["ticker", "bucket_2h"],
            right_on=["primary_ticker", "bucket_2h"],
            how="left",
            suffixes=("_scanner", "_reddit")
        )
        
        # Add Reddit confirmation flag
        joined_df["reddit_confirmed"] = (
            (joined_df["buzz_z"] >= 2.0) & 
            (joined_df["bull_pct"] >= 0.6)
        ).fillna(False)
        
        # Sort by signal time and buzz score
        joined_df = joined_df.sort_values(
            ["signal_ts", "buzz_z"], 
            ascending=[True, False]
        )
        
        console.print(f"[green]✓[/green] Joined {len(joined_df)} signals")
        
        # Save result
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joined_df.to_parquet(output_path, index=False)
        
        console.print(f"[green]✓[/green] Saved joined signals to {output_path}")
        
        # Show summary
        confirmed_count = joined_df["reddit_confirmed"].sum()
        console.print(f"Reddit-confirmed signals: {confirmed_count}/{len(joined_df)}")
        
    else:
        console.print("[red]Error: Required columns not found in scanner data[/red]")


@app.command()
def audit() -> None:
    """Launch Streamlit audit interface."""
    import subprocess
    import sys
    
    console.print("[green]Launching Streamlit audit interface...[/green]")
    
    try:
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", 
            "src/ui/audit_app.py",
            "--server.port", "8501"
        ])
    except KeyboardInterrupt:
        console.print("\n[yellow]Audit interface stopped[/yellow]")


@app.command()
def status(
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging")
) -> None:
    """Show system status and statistics."""
    setup_logging(debug)
    asyncio.run(_show_status())


async def _show_status() -> None:
    """Internal async function for showing status."""
    storage = get_admin_simple_storage_client()
    
    console.print("[green]Reddit Source System Status[/green]")
    console.print("=" * 50)
    
    # Check Supabase connection
    health_ok = await storage.health_check()
    status_color = "green" if health_ok else "red"
    status_text = "✓ Connected" if health_ok else "✗ Disconnected"
    console.print(f"Supabase: [{status_color}]{status_text}[/{status_color}]")
    
    if not health_ok:
        return
    
    # Get processing statistics
    stats = await storage.get_processing_stats()
    
    if stats:
        # Create status table
        table = Table(title="Processing Statistics")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        # Posts by status
        if "posts_by_status" in stats:
            for status_info in stats["posts_by_status"]:
                table.add_row(
                    f"Posts ({status_info.get('processing_status', 'unknown')})",
                    str(status_info.get("count", 0))
                )
        
        # Quality distribution
        if "quality_distribution" in stats:
            for quality_info in stats["quality_distribution"]:
                table.add_row(
                    f"Quality ({quality_info.get('quality_tier', 'unknown')})",
                    str(quality_info.get("count", 0))
                )
        
        # Today's posts
        table.add_row("Posts Today", str(stats.get("posts_today", 0)))
        
        console.print(table)
    
    console.print(f"\nLast updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


@app.command()
def process(
    limit: int = typer.Option(100, "--limit", help="Maximum posts to process"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging")
) -> None:
    """Process pending Reddit posts with ticker extraction and sentiment analysis."""
    setup_logging(debug)
    console.print(f"[green]Processing up to {limit} pending posts...[/green]")
    asyncio.run(_process_posts(limit))


async def _process_posts(limit: int) -> None:
    """Internal async function for processing posts."""
    processor = RedditProcessor()
    
    # Check database connection
    if not await processor.storage.health_check():
        console.print("[red]Error: Cannot connect to database[/red]")
        return
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Processing posts...", total=None)
        
        try:
            # Process the posts
            results = await processor.process_pending_posts(limit)
            
            progress.update(
                task, 
                description=f"Processed {results['processed']} posts"
            )
        
        except Exception as e:
            progress.update(task, description=f"[red]Error: {e}[/red]")
            console.print(f"[red]Processing failed: {e}[/red]")
            return
    
    # Show results
    console.print(f"[green]✓[/green] Processing completed!")
    console.print(f"  • Processed: {results['processed']}")
    console.print(f"  • Errors: {results['errors']}")
    console.print(f"  • Skipped: {results['skipped']}")
    console.print(f"  • Total found: {results['total_found']}")


@app.command()
def init(
    force: bool = typer.Option(False, "--force", help="Force initialization even if already configured")
) -> None:
    """Initialize the Reddit Source system."""
    console.print("[green]Initializing Reddit Source system...[/green]")
    
    settings = get_settings()
    
    # Create necessary directories
    directories = [
        settings.storage.data_dir,
        settings.storage.image_storage_path,
        settings.storage.cache_dir,
        Path("./logs"),
        Path("./data/exports")
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        console.print(f"✓ Created directory: {directory}")
    
    # Check .env file
    env_file = Path(".env")
    if not env_file.exists() or force:
        import shutil
        shutil.copy(".env.example", ".env")
        console.print("✓ Created .env file from template")
        console.print("[yellow]Please configure your .env file with API credentials[/yellow]")
    
    console.print("[green]✓ Initialization complete![/green]")
    console.print("\nNext steps:")
    console.print("1. Configure your .env file with Reddit and Supabase credentials")
    console.print("2. Run the database schema: Execute db/reddit_source_schema.sql in Supabase")
    console.print("3. Test the connection: reddit-source status")
    console.print("4. Start ingesting: reddit-source ingest --once")


if __name__ == "__main__":
    app()
