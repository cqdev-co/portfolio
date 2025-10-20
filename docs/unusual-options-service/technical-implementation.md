# Unusual Options Activity Scanner - Technical Implementation Guide

## 🏗 Project Setup

### Directory Structure

```
unusual-options-service/
├── pyproject.toml              # Poetry dependencies
├── .env.example                # Environment template
├── README.md                   # User-facing documentation
├── src/
│   └── unusual_options/
│       ├── __init__.py
│       ├── cli.py              # Click CLI interface
│       ├── config.py           # Configuration management
│       │
│       ├── scanner/            # Core scanning logic
│       │   ├── __init__.py
│       │   ├── orchestrator.py # Main scan coordinator
│       │   ├── detector.py     # Anomaly detection algorithms
│       │   ├── analyzer.py     # Signal analysis
│       │   └── filters.py      # Data validation & filtering
│       │
│       ├── data/               # Data acquisition
│       │   ├── __init__.py
│       │   ├── providers/
│       │   │   ├── __init__.py
│       │   │   ├── base.py     # Abstract provider interface
│       │   │   ├── polygon.py  # Polygon.io implementation
│       │   │   ├── tradier.py  # Tradier implementation
│       │   │   └── yfinance.py # YFinance implementation
│       │   ├── models.py       # Data models (options chains, contracts)
│       │   └── cache.py        # Caching layer
│       │
│       ├── scoring/            # Signal scoring
│       │   ├── __init__.py
│       │   ├── grader.py       # Grade calculation
│       │   ├── risk.py         # Risk assessment
│       │   └── performance.py  # Historical performance tracking
│       │
│       ├── storage/            # Database layer
│       │   ├── __init__.py
│       │   ├── supabase.py     # Supabase client
│       │   └── models.py       # Database models
│       │
│       ├── alerts/             # Notification system
│       │   ├── __init__.py
│       │   ├── discord.py      # Discord webhooks
│       │   └── formatters.py   # Alert message formatting
│       │
│       └── utils/              # Shared utilities
│           ├── __init__.py
│           ├── logger.py       # Logging configuration
│           ├── indicators.py   # Technical indicators
│           └── helpers.py      # Common helper functions
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures
│   ├── unit/                   # Unit tests
│   │   ├── test_detector.py
│   │   ├── test_grader.py
│   │   └── test_risk.py
│   └── integration/            # Integration tests
│       ├── test_scanner.py
│       └── test_providers.py
│
├── db/                         # Database schemas
│   └── unusual_options_schema.sql
│
└── docs/                       # Documentation
    └── unusual-options-service/
```

### Poetry Configuration

```toml
# pyproject.toml
[tool.poetry]
name = "unusual-options-service"
version = "0.1.0"
description = "Unusual options activity detection for trading signals"
authors = ["Your Name <your.email@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
click = "^8.1.7"              # CLI framework
rich = "^13.7.0"              # Terminal formatting
supabase = "^2.0.0"           # Database client
httpx = "^0.25.0"             # Async HTTP client
pydantic = "^2.5.0"           # Data validation
pandas = "^2.1.0"             # Data analysis
numpy = "^1.26.0"             # Numerical computing
yfinance = "^0.2.32"          # Market data (free tier)
python-dotenv = "^1.0.0"      # Environment management
loguru = "^0.7.2"             # Logging
redis = "^5.0.0"              # Caching (optional)

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
pytest-asyncio = "^0.21.0"
pytest-cov = "^4.1.0"
black = "^23.12.0"
ruff = "^0.1.0"
mypy = "^1.7.0"

[tool.poetry.scripts]
unusual-options = "unusual_options.cli:cli"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

## 🔧 Core Implementation

### 1. CLI Interface

```python
# src/unusual_options/cli.py
import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress
from typing import Optional
from .scanner.orchestrator import ScanOrchestrator
from .config import load_config

console = Console()

@click.group()
@click.version_option(version="0.1.0")
def cli():
    """Unusual Options Activity Scanner CLI"""
    pass

@cli.command()
@click.argument('tickers', nargs=-1, required=True)
@click.option('--watch', is_flag=True, help='Continuously monitor')
@click.option('--interval', default=300, help='Watch interval in seconds')
@click.option('--min-grade', default='C', help='Minimum signal grade')
@click.option('--output', type=click.Path(), help='Output file path')
@click.option('--include-backtest', is_flag=True, help='Include historical performance')
def scan(
    tickers: tuple,
    watch: bool,
    interval: int,
    min_grade: str,
    output: Optional[str],
    include_backtest: bool
):
    """Scan tickers for unusual options activity"""
    config = load_config()
    orchestrator = ScanOrchestrator(config)
    
    if watch:
        console.print(f"[yellow]Monitoring {', '.join(tickers)} every {interval}s[/yellow]")
        console.print("[dim]Press Ctrl+C to stop[/dim]\n")
        
        import time
        try:
            while True:
                _run_scan(
                    orchestrator, 
                    list(tickers), 
                    min_grade, 
                    output, 
                    include_backtest
                )
                time.sleep(interval)
        except KeyboardInterrupt:
            console.print("\n[yellow]Stopping monitor...[/yellow]")
    else:
        _run_scan(orchestrator, list(tickers), min_grade, output, include_backtest)

def _run_scan(
    orchestrator: ScanOrchestrator,
    tickers: list,
    min_grade: str,
    output: Optional[str],
    include_backtest: bool
):
    """Execute a single scan"""
    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Scanning tickers...", 
            total=len(tickers)
        )
        
        results = []
        for ticker in tickers:
            try:
                signals = orchestrator.scan_ticker(
                    ticker,
                    include_backtest=include_backtest
                )
                
                # Filter by minimum grade
                filtered = [s for s in signals if s.grade >= min_grade]
                results.extend(filtered)
                
            except Exception as e:
                console.print(f"[red]Error scanning {ticker}: {e}[/red]")
            
            progress.advance(task)
    
    # Display results
    if results:
        _display_results_table(results)
        
        if output:
            _export_results(results, output)
            console.print(f"\n[green]Results exported to {output}[/green]")
    else:
        console.print("[yellow]No unusual activity detected[/yellow]")

def _display_results_table(signals):
    """Display signals in formatted table"""
    table = Table(title="Unusual Options Activity")
    
    table.add_column("Ticker", style="cyan", no_wrap=True)
    table.add_column("Grade", justify="center")
    table.add_column("Contract", style="magenta")
    table.add_column("Volume", justify="right")
    table.add_column("OI Change", justify="right")
    table.add_column("Premium", justify="right")
    table.add_column("Sentiment", justify="center")
    
    for signal in sorted(signals, key=lambda s: s.overall_score, reverse=True):
        grade_color = {
            'S': 'bold bright_magenta',
            'A': 'bold green',
            'B': 'green',
            'C': 'yellow',
            'D': 'red',
            'F': 'dim red'
        }.get(signal.grade, 'white')
        
        sentiment_emoji = {
            'BULLISH': '🟢',
            'BEARISH': '🔴',
            'NEUTRAL': '⚪'
        }.get(signal.sentiment, '')
        
        table.add_row(
            signal.ticker,
            f"[{grade_color}]{signal.grade}[/{grade_color}]",
            signal.option_symbol,
            f"{signal.current_volume:,}",
            f"+{signal.oi_change_pct:.1%}",
            f"${signal.premium_flow:,.0f}",
            f"{sentiment_emoji} {signal.sentiment}"
        )
    
    console.print(table)

@cli.command()
@click.option('--days', default=7, help='Number of days to look back')
@click.option('--min-grade', default='C', help='Minimum signal grade')
def signals_list(days: int, min_grade: str):
    """List recent signals"""
    from .storage.supabase import SupabaseClient
    
    client = SupabaseClient()
    signals = client.get_recent_signals(days=days, min_grade=min_grade)
    
    if signals:
        _display_results_table(signals)
    else:
        console.print("[yellow]No signals found[/yellow]")

@cli.command()
@click.argument('signal_id')
@click.option('--days', default=30, help='Days to track performance')
def track(signal_id: str, days: int):
    """Track signal performance over time"""
    from .storage.supabase import SupabaseClient
    from .scoring.performance import PerformanceTracker
    
    client = SupabaseClient()
    tracker = PerformanceTracker(client)
    
    performance = tracker.track_signal(signal_id, days=days)
    
    # Display performance metrics
    console.print(f"\n[bold]Signal Performance: {signal_id}[/bold]\n")
    console.print(f"Ticker: {performance.ticker}")
    console.print(f"Entry Price: ${performance.entry_price:.2f}")
    console.print(f"Current Price: ${performance.current_price:.2f}")
    console.print(f"Return: {performance.return_pct:+.2%}")
    console.print(f"Status: {performance.status}")

@cli.command()
def status():
    """Check system status and connectivity"""
    from .storage.supabase import SupabaseClient
    from .data.providers import get_provider
    
    console.print("[bold]System Status Check[/bold]\n")
    
    # Check Supabase
    try:
        client = SupabaseClient()
        client.health_check()
        console.print("✓ Supabase: [green]Connected[/green]")
    except Exception as e:
        console.print(f"✗ Supabase: [red]Error - {e}[/red]")
    
    # Check data provider
    try:
        provider = get_provider()
        provider.test_connection()
        console.print(f"✓ Data Provider ({provider.name}): [green]Connected[/green]")
    except Exception as e:
        console.print(f"✗ Data Provider: [red]Error - {e}[/red]")
    
    console.print("\n[green]System operational[/green]")

@cli.command()
@click.option('--start', required=True, help='Start date (YYYY-MM-DD)')
@click.option('--end', required=True, help='End date (YYYY-MM-DD)')
@click.option('--tickers', help='Comma-separated ticker list')
def backtest(start: str, end: str, tickers: Optional[str]):
    """Run historical backtest of detection algorithm"""
    from .scoring.performance import BacktestEngine
    
    ticker_list = tickers.split(',') if tickers else None
    
    console.print(f"[yellow]Running backtest from {start} to {end}...[/yellow]\n")
    
    engine = BacktestEngine()
    results = engine.run(start_date=start, end_date=end, tickers=ticker_list)
    
    # Display backtest results
    console.print("[bold]Backtest Results[/bold]\n")
    console.print(f"Total Signals: {results.total_signals}")
    console.print(f"Win Rate: {results.win_rate:.1%}")
    console.print(f"Average Winner: {results.avg_winner:+.2%}")
    console.print(f"Average Loser: {results.avg_loser:+.2%}")
    console.print(f"Sharpe Ratio: {results.sharpe_ratio:.2f}")
    
    # Grade breakdown
    console.print("\n[bold]Performance by Grade:[/bold]")
    for grade, metrics in results.grade_breakdown.items():
        console.print(f"  {grade}: {metrics.win_rate:.1%} win rate")

if __name__ == '__main__':
    cli()
```

### 2. Scanner Orchestrator

```python
# src/unusual_options/scanner/orchestrator.py
from typing import List, Optional
from datetime import datetime
from loguru import logger
from ..data.providers import get_provider
from ..data.models import OptionsChain
from .detector import AnomalyDetector
from .analyzer import SignalAnalyzer
from ..scoring.grader import SignalGrader
from ..scoring.risk import RiskAssessor
from ..storage.supabase import SupabaseClient
from ..storage.models import UnusualOptionsSignal

class ScanOrchestrator:
    """
    Main coordinator for scanning operations.
    Manages data fetching, detection, scoring, and storage.
    """
    
    def __init__(self, config: dict):
        self.config = config
        self.provider = get_provider(config)
        self.detector = AnomalyDetector(config)
        self.analyzer = SignalAnalyzer(config)
        self.grader = SignalGrader(config)
        self.risk_assessor = RiskAssessor(config)
        self.storage = SupabaseClient(config)
    
    def scan_ticker(
        self, 
        ticker: str, 
        include_backtest: bool = False
    ) -> List[UnusualOptionsSignal]:
        """
        Scan a single ticker for unusual options activity.
        
        Args:
            ticker: Stock ticker symbol
            include_backtest: Include historical performance data
            
        Returns:
            List of detected signals with grades
        """
        logger.info(f"Scanning {ticker}")
        
        try:
            # 1. Fetch current options chain
            options_chain = self.provider.get_options_chain(ticker)
            
            if not options_chain or not options_chain.contracts:
                logger.warning(f"No options data available for {ticker}")
                return []
            
            # 2. Fetch historical context (20-day lookback)
            historical_data = self.provider.get_historical_options(
                ticker, 
                days=20
            )
            
            # 3. Run detection algorithms
            detections = self.detector.detect_anomalies(
                options_chain, 
                historical_data
            )
            
            if not detections:
                logger.info(f"No anomalies detected for {ticker}")
                return []
            
            # 4. Analyze and score each detection
            signals = []
            for detection in detections:
                # Create signal object
                signal = self.analyzer.analyze_detection(
                    detection, 
                    options_chain,
                    historical_data
                )
                
                # Calculate score and grade
                signal.overall_score = self.grader.calculate_score(signal)
                signal.grade = self.grader.assign_grade(signal.overall_score)
                signal.confidence = self.grader.calculate_confidence(signal)
                
                # Assess risks
                risk_assessment = self.risk_assessor.assess(signal, options_chain)
                signal.risk_level = risk_assessment.risk_level
                signal.risk_factors = risk_assessment.risk_factors
                
                # Add historical performance if requested
                if include_backtest:
                    signal.historical_performance = (
                        self.storage.get_similar_signal_performance(signal)
                    )
                
                signals.append(signal)
            
            # 5. Store signals in database
            for signal in signals:
                self.storage.insert_signal(signal)
                logger.info(
                    f"Signal created: {signal.ticker} {signal.option_symbol} "
                    f"Grade: {signal.grade}"
                )
            
            return signals
            
        except Exception as e:
            logger.error(f"Error scanning {ticker}: {e}")
            raise
    
    def scan_multiple(
        self, 
        tickers: List[str],
        max_concurrent: int = 5
    ) -> List[UnusualOptionsSignal]:
        """
        Scan multiple tickers with rate limiting.
        
        Args:
            tickers: List of ticker symbols
            max_concurrent: Maximum concurrent requests
            
        Returns:
            Combined list of all signals
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        all_signals = []
        
        with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            futures = [
                executor.submit(self.scan_ticker, ticker) 
                for ticker in tickers
            ]
            
            for future in futures:
                try:
                    signals = future.result(timeout=30)
                    all_signals.extend(signals)
                except Exception as e:
                    logger.error(f"Error in concurrent scan: {e}")
        
        return all_signals
    
    def market_scan(
        self, 
        min_market_cap: float = 1_000_000_000,
        min_avg_volume: int = 1_000_000,
        limit: int = 500
    ) -> List[UnusualOptionsSignal]:
        """
        Scan broad market for unusual activity.
        
        Args:
            min_market_cap: Minimum market cap filter
            min_avg_volume: Minimum average volume filter
            limit: Maximum number of tickers to scan
            
        Returns:
            All detected signals across market
        """
        logger.info(f"Running market-wide scan (limit: {limit})")
        
        # Get list of liquid, optionable tickers
        tickers = self._get_liquid_tickers(
            min_market_cap=min_market_cap,
            min_avg_volume=min_avg_volume,
            limit=limit
        )
        
        logger.info(f"Scanning {len(tickers)} tickers")
        
        # Scan in batches
        all_signals = self.scan_multiple(tickers)
        
        logger.info(f"Market scan complete. Found {len(all_signals)} signals")
        
        return all_signals
    
    def _get_liquid_tickers(
        self,
        min_market_cap: float,
        min_avg_volume: int,
        limit: int
    ) -> List[str]:
        """Get list of liquid, optionable tickers"""
        # This would query a ticker database or use a predefined list
        # For now, return common liquid tickers
        from ..utils.tickers import get_liquid_tickers
        return get_liquid_tickers(
            min_market_cap=min_market_cap,
            min_avg_volume=min_avg_volume,
            limit=limit
        )
```

### 3. Anomaly Detector

```python
# src/unusual_options/scanner/detector.py
from typing import List, Optional, Dict
from dataclasses import dataclass
from datetime import datetime
from loguru import logger
from ..data.models import OptionsChain, OptionsContract, HistoricalData

@dataclass
class Detection:
    """Single anomaly detection result"""
    detection_type: str  # VOLUME_ANOMALY, OI_SPIKE, PREMIUM_FLOW, etc.
    contract: OptionsContract
    metrics: Dict[str, float]
    confidence: float
    timestamp: datetime

class AnomalyDetector:
    """
    Detects unusual options activity across multiple dimensions.
    """
    
    def __init__(self, config: dict):
        self.config = config
        self.volume_threshold = config.get('VOLUME_MULTIPLIER_THRESHOLD', 3.0)
        self.oi_change_threshold = config.get('OI_CHANGE_THRESHOLD', 0.20)
        self.min_premium_flow = config.get('MIN_PREMIUM_FLOW', 100000)
    
    def detect_anomalies(
        self,
        options_chain: OptionsChain,
        historical_data: HistoricalData
    ) -> List[Detection]:
        """
        Run all detection algorithms on options chain.
        
        Returns list of detected anomalies.
        """
        detections = []
        
        for contract in options_chain.contracts:
            # 1. Check volume anomalies
            volume_detection = self._detect_volume_anomaly(
                contract, 
                historical_data
            )
            if volume_detection:
                detections.append(volume_detection)
            
            # 2. Check open interest spikes
            oi_detection = self._detect_oi_spike(
                contract,
                historical_data
            )
            if oi_detection:
                detections.append(oi_detection)
            
            # 3. Check premium flow
            premium_detection = self._detect_premium_flow(
                contract,
                historical_data
            )
            if premium_detection:
                detections.append(premium_detection)
            
            # 4. Check for sweep orders
            sweep_detection = self._detect_sweep_order(
                contract,
                historical_data
            )
            if sweep_detection:
                detections.append(sweep_detection)
        
        logger.info(f"Found {len(detections)} anomalies")
        return detections
    
    def _detect_volume_anomaly(
        self,
        contract: OptionsContract,
        historical: HistoricalData
    ) -> Optional[Detection]:
        """Detect unusual volume vs historical average"""
        
        current_volume = contract.volume
        if current_volume == 0:
            return None
        
        # Get average volume from historical data
        avg_volume = historical.get_avg_volume(
            contract.symbol,
            days=20
        )
        
        if avg_volume < 100:  # Filter low liquidity
            return None
        
        volume_ratio = current_volume / avg_volume
        
        if volume_ratio >= self.volume_threshold:
            confidence = min(volume_ratio / 10.0, 1.0)
            
            return Detection(
                detection_type='VOLUME_ANOMALY',
                contract=contract,
                metrics={
                    'current_volume': current_volume,
                    'average_volume': avg_volume,
                    'volume_ratio': volume_ratio
                },
                confidence=confidence,
                timestamp=datetime.now()
            )
        
        return None
    
    def _detect_oi_spike(
        self,
        contract: OptionsContract,
        historical: HistoricalData
    ) -> Optional[Detection]:
        """Detect significant open interest changes"""
        
        current_oi = contract.open_interest
        previous_oi = historical.get_previous_oi(
            contract.symbol,
            days_ago=1
        )
        
        if previous_oi == 0:
            return None  # New contract
        
        oi_change_pct = (current_oi - previous_oi) / previous_oi
        
        if oi_change_pct >= self.oi_change_threshold:
            confidence = min(oi_change_pct / 0.5, 1.0)
            
            return Detection(
                detection_type='OI_SPIKE',
                contract=contract,
                metrics={
                    'current_oi': current_oi,
                    'previous_oi': previous_oi,
                    'oi_change_pct': oi_change_pct,
                    'absolute_change': current_oi - previous_oi
                },
                confidence=confidence,
                timestamp=datetime.now()
            )
        
        return None
    
    def _detect_premium_flow(
        self,
        contract: OptionsContract,
        historical: HistoricalData
    ) -> Optional[Detection]:
        """Detect large premium expenditures"""
        
        # Calculate total premium flow
        premium = contract.last_price * contract.volume * 100
        
        if premium < self.min_premium_flow:
            return None
        
        # Check if orders were aggressive (at ask or above)
        time_sales = historical.get_time_and_sales(contract.symbol)
        if not time_sales:
            return None
        
        aggressive_orders = sum(
            1 for trade in time_sales 
            if trade.price >= trade.ask
        )
        aggressive_pct = aggressive_orders / len(time_sales)
        
        if aggressive_pct >= 0.7:  # 70% aggressive
            confidence = (premium / 1_000_000) * aggressive_pct
            confidence = min(confidence, 1.0)
            
            return Detection(
                detection_type='PREMIUM_FLOW',
                contract=contract,
                metrics={
                    'total_premium': premium,
                    'aggressive_pct': aggressive_pct,
                    'trade_count': len(time_sales),
                    'avg_trade_size': contract.volume / len(time_sales)
                },
                confidence=confidence,
                timestamp=datetime.now()
            )
        
        return None
    
    def _detect_sweep_order(
        self,
        contract: OptionsContract,
        historical: HistoricalData
    ) -> Optional[Detection]:
        """Detect sweep orders across exchanges"""
        
        time_sales = historical.get_time_and_sales_with_exchanges(
            contract.symbol,
            window_seconds=5
        )
        
        if not time_sales:
            return None
        
        # Group trades by timestamp
        trade_groups = self._group_trades_by_time(
            time_sales,
            tolerance_seconds=1.0
        )
        
        for group in trade_groups:
            unique_exchanges = set(t.exchange for t in group)
            total_volume = sum(t.size for t in group)
            
            # Sweep criteria: 3+ exchanges, 100+ contracts
            if len(unique_exchanges) >= 3 and total_volume >= 100:
                total_premium = sum(
                    t.price * t.size * 100 
                    for t in group
                )
                
                return Detection(
                    detection_type='SWEEP_ORDER',
                    contract=contract,
                    metrics={
                        'exchanges_hit': len(unique_exchanges),
                        'total_contracts': total_volume,
                        'total_premium': total_premium,
                        'avg_price': sum(t.price for t in group) / len(group)
                    },
                    confidence=0.9,  # Sweeps are high conviction
                    timestamp=group[0].timestamp
                )
        
        return None
    
    def _group_trades_by_time(
        self,
        trades: List,
        tolerance_seconds: float
    ) -> List[List]:
        """Group trades that occurred within time tolerance"""
        if not trades:
            return []
        
        sorted_trades = sorted(trades, key=lambda t: t.timestamp)
        groups = []
        current_group = [sorted_trades[0]]
        
        for trade in sorted_trades[1:]:
            time_diff = (
                trade.timestamp - current_group[-1].timestamp
            ).total_seconds()
            
            if time_diff <= tolerance_seconds:
                current_group.append(trade)
            else:
                groups.append(current_group)
                current_group = [trade]
        
        groups.append(current_group)
        return groups
```

### 4. Signal Grader

```python
# src/unusual_options/scoring/grader.py
from typing import Dict
from ..storage.models import UnusualOptionsSignal
from ..data.models import OptionsChain

class SignalGrader:
    """
    Multi-factor scoring system for signal quality.
    """
    
    # Weight allocations
    WEIGHTS = {
        'volume': 0.30,
        'premium': 0.25,
        'oi': 0.20,
        'historical': 0.15,
        'technical': 0.10
    }
    
    def __init__(self, config: dict):
        self.config = config
    
    def calculate_score(self, signal: UnusualOptionsSignal) -> float:
        """
        Calculate overall signal score (0.0 - 1.0).
        
        Combines multiple factors with weighted average.
        """
        scores = {
            'volume': self._calculate_volume_score(signal),
            'premium': self._calculate_premium_score(signal),
            'oi': self._calculate_oi_score(signal),
            'historical': self._calculate_historical_score(signal),
            'technical': self._calculate_technical_score(signal)
        }
        
        # Weighted sum
        overall = sum(
            scores[factor] * weight 
            for factor, weight in self.WEIGHTS.items()
        )
        
        # Bonus for sweep detection
        if signal.has_sweep:
            overall = min(overall + 0.15, 1.0)
        
        return overall
    
    def assign_grade(self, score: float) -> str:
        """Convert numerical score to letter grade"""
        if score >= 0.90:
            return 'S'
        elif score >= 0.80:
            return 'A'
        elif score >= 0.70:
            return 'B'
        elif score >= 0.60:
            return 'C'
        elif score >= 0.50:
            return 'D'
        else:
            return 'F'
    
    def calculate_confidence(self, signal: UnusualOptionsSignal) -> float:
        """Calculate confidence level (0.0 - 1.0)"""
        factors = []
        
        # Volume confidence
        if signal.volume_ratio >= 10:
            factors.append(1.0)
        elif signal.volume_ratio >= 5:
            factors.append(0.8)
        elif signal.volume_ratio >= 3:
            factors.append(0.6)
        
        # Premium confidence
        if signal.premium_flow >= 1_000_000:
            factors.append(1.0)
        elif signal.premium_flow >= 500_000:
            factors.append(0.8)
        elif signal.premium_flow >= 100_000:
            factors.append(0.6)
        
        # Sweep confidence
        if signal.has_sweep:
            factors.append(0.9)
        
        # OI confidence
        if signal.oi_change_pct >= 0.50:
            factors.append(0.9)
        elif signal.oi_change_pct >= 0.20:
            factors.append(0.7)
        
        return sum(factors) / len(factors) if factors else 0.5
    
    def _calculate_volume_score(self, signal: UnusualOptionsSignal) -> float:
        """Score based on volume anomaly"""
        ratio = signal.volume_ratio
        
        if ratio >= 10:
            return 1.0
        elif ratio >= 5:
            return 0.8
        elif ratio >= 3:
            return 0.6
        elif ratio >= 2:
            return 0.4
        else:
            return 0.2
    
    def _calculate_premium_score(self, signal: UnusualOptionsSignal) -> float:
        """Score based on premium flow"""
        premium = signal.premium_flow
        aggressive_pct = signal.aggressive_order_pct
        
        # Base score from premium size
        if premium >= 1_000_000:
            base = 1.0
        elif premium >= 500_000:
            base = 0.8
        elif premium >= 250_000:
            base = 0.6
        elif premium >= 100_000:
            base = 0.4
        else:
            base = 0.2
        
        # Adjust for aggressiveness
        return base * (0.5 + 0.5 * aggressive_pct)
    
    def _calculate_oi_score(self, signal: UnusualOptionsSignal) -> float:
        """Score based on OI changes"""
        change_pct = signal.oi_change_pct
        
        if change_pct >= 0.50:
            return 1.0
        elif change_pct >= 0.35:
            return 0.8
        elif change_pct >= 0.20:
            return 0.6
        else:
            return 0.3
    
    def _calculate_historical_score(self, signal: UnusualOptionsSignal) -> float:
        """Score based on historical performance of similar signals"""
        # This would query the database for similar past signals
        # and their win rates
        # Placeholder for now
        return 0.6
    
    def _calculate_technical_score(self, signal: UnusualOptionsSignal) -> float:
        """Score based on technical alignment"""
        # Check if option direction aligns with technical indicators
        # - RSI, MACD, moving averages, etc.
        # Placeholder for now
        return 0.5
```

## 📊 Database Schema (Continued in next message)

```sql
-- See db/unusual_options_schema.sql for complete schema
```

## 🧪 Testing Strategy

### Unit Tests

```python
# tests/unit/test_detector.py
import pytest
from unusual_options.scanner.detector import AnomalyDetector
from unusual_options.data.models import OptionsContract, HistoricalData

def test_volume_anomaly_detection():
    """Test volume anomaly detection logic"""
    detector = AnomalyDetector(config={})
    
    contract = OptionsContract(
        symbol='AAPL250117C00180000',
        volume=5000,
        open_interest=1000,
        last_price=5.50
    )
    
    historical = HistoricalData(
        avg_volumes={'AAPL250117C00180000': 1000}
    )
    
    detection = detector._detect_volume_anomaly(contract, historical)
    
    assert detection is not None
    assert detection.detection_type == 'VOLUME_ANOMALY'
    assert detection.metrics['volume_ratio'] == 5.0

def test_no_detection_on_low_liquidity():
    """Should not detect on low liquidity contracts"""
    detector = AnomalyDetector(config={})
    
    contract = OptionsContract(
        symbol='LOWVOL250117C00100000',
        volume=300,
        open_interest=50,
        last_price=2.00
    )
    
    historical = HistoricalData(
        avg_volumes={'LOWVOL250117C00100000': 50}
    )
    
    detection = detector._detect_volume_anomaly(contract, historical)
    
    assert detection is None  # Below 100 volume threshold
```

### Integration Tests

```python
# tests/integration/test_scanner.py
import pytest
from unusual_options.scanner.orchestrator import ScanOrchestrator

@pytest.mark.integration
def test_full_scan_workflow(mock_config):
    """Test end-to-end scan workflow"""
    orchestrator = ScanOrchestrator(mock_config)
    
    signals = orchestrator.scan_ticker('AAPL')
    
    assert isinstance(signals, list)
    for signal in signals:
        assert signal.ticker == 'AAPL'
        assert signal.grade in ['S', 'A', 'B', 'C', 'D', 'F']
        assert 0.0 <= signal.overall_score <= 1.0
```

## 📝 Next Steps

1. **Implement Base Data Provider Interface**: Create abstract base class for data providers
2. **Add Polygon.io Provider**: Implement first concrete provider
3. **Build Database Schema**: Create Supabase tables
4. **Implement Core Detection Logic**: Volume, OI, premium flow
5. **Add Scoring System**: Multi-factor grading
6. **Create CLI Commands**: scan, list, track, backtest
7. **Add Tests**: Unit and integration test coverage
8. **Documentation**: Complete all remaining docs

---

**Next Document**: [Database Schema](database-schema.md)

