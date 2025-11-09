"""CLI interface for ML predictor service."""

from datetime import date
from typing import Optional

import typer
from loguru import logger
from rich.console import Console
from rich.table import Table

from ml_predictor.config import get_settings
from ml_predictor.models.predictor import MLPredictor
from ml_predictor.models.versioning import ModelVersionManager
from ml_predictor.training.trainer import ModelTrainer

# Initialize Typer app
app = typer.Typer(
    name="ml-predict",
    help="ML Options Predictor CLI",
)

console = Console()


@app.command()
def train(
    min_grade: str = typer.Option(
        "B",
        "--min-grade",
        help="Minimum signal grade (S, A, B, C)",
    ),
    limit: Optional[int] = typer.Option(
        None,
        "--limit",
        help="Maximum number of signals to train on",
    ),
    retrain: bool = typer.Option(
        False,
        "--retrain",
        help="Retrain with new data instead of from scratch",
    ),
):
    """Train ML models on expired signals."""
    console.print("[bold blue]ML Options Predictor - Training[/bold blue]")
    console.print()

    try:
        trainer = ModelTrainer()

        if retrain:
            console.print("[yellow]Retraining with new expired signals...[/yellow]")
            predictor = trainer.retrain_with_new_data()

            if predictor:
                console.print(
                    f"[green]✅ Retraining complete! "
                    f"Model version: {predictor.model_version}[/green]"
                )
            else:
                console.print(
                    "[yellow]⚠️  No retraining performed "
                    "(not enough new data)[/yellow]"
                )

        else:
            console.print("[yellow]Training from scratch...[/yellow]")
            predictor = trainer.train_from_scratch(
                min_grade=min_grade,
                limit=limit,
            )
            console.print(
                f"[green]✅ Training complete! "
                f"Model version: {predictor.model_version}[/green]"
            )

    except Exception as e:
        console.print(f"[red]❌ Training failed: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def serve(
    host: str = typer.Option(
        "0.0.0.0",
        "--host",
        help="Server host",
    ),
    port: int = typer.Option(
        8001,
        "--port",
        help="Server port",
    ),
    reload: bool = typer.Option(
        False,
        "--reload",
        help="Enable auto-reload for development",
    ),
):
    """Start the API server."""
    import uvicorn

    console.print("[bold blue]Starting ML Predictor API Server[/bold blue]")
    console.print(f"Server: http://{host}:{port}")
    console.print(f"Docs: http://{host}:{port}/docs")
    console.print()

    uvicorn.run(
        "ml_predictor.api.server:app",
        host=host,
        port=port,
        reload=reload,
    )


@app.command()
def analyze(
    min_grade: str = typer.Option(
        "B",
        "--min-grade",
        help="Minimum signal grade (S, A, B, C)",
    ),
    min_score: float = typer.Option(
        0.70,
        "--min-score",
        help="Minimum overall score",
    ),
    limit: Optional[int] = typer.Option(
        None,
        "--limit",
        help="Maximum number of signals to analyze",
    ),
    min_win_prob: float = typer.Option(
        0.45,
        "--min-win-prob",
        help="Minimum win probability for TRADE recommendation",
    ),
    output_format: str = typer.Option(
        "table",
        "--format",
        help="Output format: table, csv, json",
    ),
):
    """Analyze active signals from database with ML predictions."""
    import pandas as pd
    from ml_predictor.data.data_loader import DataLoader
    from ml_predictor.data.feature_engineering import FeatureEngineer

    console.print(
        "[bold blue]ML Options Predictor - Analyze Active Signals[/bold blue]"
    )
    console.print()

    try:
        settings = get_settings()

        # Load model
        console.print("[yellow]Loading model...[/yellow]")
        predictor = MLPredictor(model_dir=settings.models_dir)
        predictor.load()
        console.print(
            f"[green]✅ Model loaded: {predictor.model_version}[/green]"
        )
        console.print()

        # Fetch active signals
        console.print("[yellow]Fetching active signals from database...[/yellow]")
        data_loader = DataLoader()
        
        # Query active signals
        query = (
            data_loader.client.table("unusual_options_signals")
            .select("*")
            .eq("is_active", True)
            .gte("overall_score", min_score)
        )
        
        # Apply grade filter
        grade_map = {"S": 4, "A": 3, "B": 2, "C": 1}
        min_grade_val = grade_map.get(min_grade, 2)
        valid_grades = [g for g, v in grade_map.items() if v >= min_grade_val]
        query = query.in_("grade", valid_grades)
        
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        
        if not response.data:
            console.print("[yellow]No active signals found matching criteria[/yellow]")
            return
        
        signals_df = pd.DataFrame(response.data)
        console.print(
            f"[green]✅ Found {len(signals_df)} signals[/green]"
        )
        console.print()

        # Prepare features
        console.print("[yellow]Making predictions...[/yellow]")
        feature_engineer = FeatureEngineer()
        feature_engineer.feature_names = predictor.feature_names
        X = feature_engineer.prepare_prediction_data(signals_df)

        # Make predictions
        predictions_df = predictor.predict(X)

        # Combine results
        results_df = signals_df.copy()
        results_df["win_probability"] = predictions_df["win_probability"].values
        results_df["expected_return_pct"] = (
            predictions_df["expected_return_pct"].values
        )
        results_df["expected_value"] = predictions_df["expected_value"].values
        results_df["ml_recommendation"] = results_df["win_probability"].apply(
            lambda x: "TRADE" if x >= min_win_prob else "SKIP"
        )

        # Filter to TRADE recommendations
        trade_signals = results_df[
            results_df["ml_recommendation"] == "TRADE"
        ].copy()
        
        # Sort by expected value (best opportunities first)
        trade_signals = trade_signals.sort_values(
            "expected_value", ascending=False
        )

        console.print()
        console.print("[bold green]RESULTS[/bold green]")
        console.print(
            f"Total Analyzed: {len(results_df)} | "
            f"TRADE: {len(trade_signals)} | "
            f"SKIP: {len(results_df) - len(trade_signals)}"
        )
        console.print()

        if len(trade_signals) == 0:
            console.print(
                "[yellow]No signals meet TRADE criteria. "
                f"Try lowering --min-win-prob (current: {min_win_prob})[/yellow]"
            )
            return

        # Output based on format
        if output_format == "json":
            import json
            output = trade_signals[
                [
                    "ticker",
                    "option_type",
                    "strike",
                    "expiry",
                    "grade",
                    "overall_score",
                    "premium_flow",
                    "win_probability",
                    "expected_return_pct",
                    "expected_value",
                    "ml_recommendation",
                ]
            ].to_dict(orient="records")
            console.print(json.dumps(output, indent=2, default=str))
        
        elif output_format == "csv":
            csv_output = trade_signals[
                [
                    "ticker",
                    "option_type",
                    "strike",
                    "expiry",
                    "grade",
                    "overall_score",
                    "premium_flow",
                    "win_probability",
                    "expected_return_pct",
                    "expected_value",
                ]
            ].to_csv(index=False)
            console.print(csv_output)
        
        else:  # table
            table = Table(title="🎯 TRADE Recommendations")
            table.add_column("Ticker", style="cyan", no_wrap=True)
            table.add_column("Type", style="magenta")
            table.add_column("Strike", style="yellow", justify="right")
            table.add_column("Grade", style="green")
            table.add_column("Win %", style="green", justify="right")
            table.add_column("Exp Ret", style="green", justify="right")
            table.add_column("EV", style="bold green", justify="right")
            table.add_column("Premium", style="blue", justify="right")

            for _, row in trade_signals.head(20).iterrows():
                win_prob_color = (
                    "bright_green" if row["win_probability"] > 0.60
                    else "green" if row["win_probability"] > 0.50
                    else "yellow"
                )
                
                table.add_row(
                    row["ticker"],
                    row["option_type"][:1].upper(),
                    f"${row['strike']:.0f}",
                    row["grade"],
                    f"[{win_prob_color}]{row['win_probability']:.1%}[/{win_prob_color}]",
                    f"{row['expected_return_pct']:.1f}%",
                    f"{row['expected_value']:.1f}%",
                    f"${row['premium_flow']:,.0f}",
                )

            console.print(table)
            
            if len(trade_signals) > 20:
                console.print(
                    f"\n[dim]Showing top 20 of {len(trade_signals)} "
                    f"TRADE signals. Use --format csv or --format json "
                    f"to see all.[/dim]"
                )

    except Exception as e:
        logger.exception("Analysis failed")
        console.print(f"[red]❌ Analysis failed: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def predict(
    ticker: str = typer.Argument(..., help="Stock ticker"),
    strike: float = typer.Argument(..., help="Strike price"),
    expiry: str = typer.Argument(..., help="Expiry date (YYYY-MM-DD)"),
    option_type: str = typer.Option(
        "call",
        "--type",
        help="Option type (call or put)",
    ),
    grade: str = typer.Option("A", "--grade", help="Signal grade"),
    score: float = typer.Option(0.8, "--score", help="Overall score"),
    confidence: float = typer.Option(0.85, "--confidence", help="Confidence"),
    premium_flow: float = typer.Option(
        100000, "--premium-flow", help="Premium flow"
    ),
    underlying_price: Optional[float] = typer.Option(
        None, "--underlying", help="Underlying stock price"
    ),
):
    """Make a prediction for a single signal (manual entry)."""
    from ml_predictor.api.schemas import SignalPredictionRequest
    from ml_predictor.data.feature_engineering import FeatureEngineer
    from datetime import datetime

    console.print("[bold blue]ML Prediction[/bold blue]")
    console.print()

    try:
        settings = get_settings()

        # Load model
        predictor = MLPredictor(model_dir=settings.models_dir)
        predictor.load()

        # Calculate days to expiry
        expiry_date = date.fromisoformat(expiry)
        days_to_expiry = (expiry_date - date.today()).days

        # Create signal request
        signal = SignalPredictionRequest(
            ticker=ticker,
            strike=strike,
            expiry=expiry_date,
            option_type=option_type,
            days_to_expiry=days_to_expiry,
            grade=grade,
            overall_score=score,
            confidence=confidence,
            premium_flow=premium_flow,
            underlying_price=underlying_price or strike,
        )

        # Prepare features
        import pandas as pd

        signal_df = pd.DataFrame([signal.model_dump()])
        feature_engineer = FeatureEngineer()
        feature_engineer.feature_names = predictor.feature_names
        X = feature_engineer.prepare_prediction_data(signal_df)

        # Make prediction
        predictions = predictor.predict(X)

        # Display results
        table = Table(title=f"{ticker} {option_type.upper()} ${strike}")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        win_prob = predictions.iloc[0]['win_probability']
        exp_ret = predictions.iloc[0]['expected_return_pct']
        exp_val = predictions.iloc[0]['expected_value']

        table.add_row("Win Probability", f"{win_prob:.1%}")
        table.add_row("Expected Return", f"{exp_ret:.1f}%")
        table.add_row("Expected Value", f"{exp_val:.1f}%")
        table.add_row("Days to Expiry", str(days_to_expiry))
        table.add_row("Grade", grade)
        table.add_row("Premium Flow", f"${premium_flow:,.0f}")

        console.print(table)
        console.print()

        # Recommendation with reasoning
        if win_prob >= 0.60:
            console.print("[bold green]✅ Recommendation: STRONG BUY[/bold green]")
            console.print("[green]High win probability (>60%)[/green]")
        elif win_prob >= 0.45:
            console.print("[green]✅ Recommendation: TRADE[/green]")
            console.print("[green]Acceptable win probability[/green]")
        else:
            console.print("[red]❌ Recommendation: SKIP[/red]")
            console.print(f"[red]Low win probability ({win_prob:.1%} < 45%)[/red]")
        
        if grade in ["S", "A"]:
            console.print("[green]• High-quality signal[/green]")
        
        if premium_flow > 500000:
            console.print("[green]• Strong premium flow[/green]")

    except Exception as e:
        console.print(f"[red]❌ Prediction failed: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def status():
    """Show service status and model information."""
    console.print("[bold blue]ML Predictor Status[/bold blue]")
    console.print()

    try:
        settings = get_settings()

        # Model status
        try:
            predictor = MLPredictor(model_dir=settings.models_dir)
            predictor.load()

            console.print(f"[green]✅ Model loaded: {predictor.model_version}[/green]")

            # Metrics table
            if predictor.metrics:
                table = Table(title="Model Performance")
                table.add_column("Metric", style="cyan")
                table.add_column("Value", style="green")

                class_metrics = predictor.metrics.get("classification", {})
                if class_metrics:
                    table.add_row(
                        "Classification AUC",
                        f"{class_metrics.get('val_auc', 0):.3f}",
                    )
                    table.add_row(
                        "Accuracy",
                        f"{class_metrics.get('val_accuracy', 0):.3f}",
                    )

                reg_metrics = predictor.metrics.get("regression", {})
                if reg_metrics:
                    table.add_row(
                        "Regression MAE",
                        f"{reg_metrics.get('val_mae', 0):.2f}%",
                    )
                    table.add_row(
                        "Regression R²",
                        f"{reg_metrics.get('val_r2', 0):.3f}",
                    )

                console.print(table)

        except Exception as e:
            console.print(f"[red]❌ No model loaded: {e}[/red]")

        # Version manager
        version_manager = ModelVersionManager(settings.models_dir)
        versions = version_manager.list_versions()

        if versions:
            console.print(f"\n[cyan]Available versions: {len(versions)}[/cyan]")
            for v in versions[-3:]:  # Show last 3
                console.print(f"  • {v['version']} ({v['created']})")

    except Exception as e:
        console.print(f"[red]❌ Status check failed: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def versions():
    """List all model versions."""
    console.print("[bold blue]Model Versions[/bold blue]")
    console.print()

    try:
        settings = get_settings()
        version_manager = ModelVersionManager(settings.models_dir)
        version_list = version_manager.list_versions()

        if not version_list:
            console.print("[yellow]No models found[/yellow]")
            return

        table = Table(title="Available Models")
        table.add_column("Version", style="cyan")
        table.add_column("Created", style="green")
        table.add_column("Size (MB)", style="yellow")
        table.add_column("AUC", style="magenta")

        for v in version_list:
            auc = (
                v.get("metrics", {})
                .get("classification", {})
                .get("val_auc", 0)
            )
            table.add_row(
                v["version"],
                v["created"],
                f"{v['size_mb']:.2f}",
                f"{auc:.3f}" if auc else "N/A",
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]❌ Failed to list versions: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def rollback(
    version: str = typer.Argument(..., help="Version to rollback to"),
):
    """Rollback to a previous model version."""
    console.print(f"[yellow]Rolling back to version {version}...[/yellow]")

    try:
        settings = get_settings()
        predictor = MLPredictor(model_dir=settings.models_dir)
        predictor.load(version=version)

        console.print(f"[green]✅ Rolled back to {version}[/green]")
        console.print(
            "[yellow]Note: Restart the API server to use this version[/yellow]"
        )

    except Exception as e:
        console.print(f"[red]❌ Rollback failed: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def cleanup(
    keep: int = typer.Option(5, "--keep", help="Number of versions to keep"),
):
    """Clean up old model versions."""
    console.print("[yellow]Cleaning up old model versions...[/yellow]")

    try:
        settings = get_settings()
        version_manager = ModelVersionManager(settings.models_dir)
        deleted = version_manager.delete_old_versions(keep_last_n=keep)

        console.print(f"[green]✅ Deleted {deleted} old versions[/green]")

    except Exception as e:
        console.print(f"[red]❌ Cleanup failed: {e}[/red]")
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()

