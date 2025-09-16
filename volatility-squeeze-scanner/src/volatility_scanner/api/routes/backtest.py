"""Backtesting endpoints."""

from typing import List, Dict, Any
from datetime import datetime, date

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator

from volatility_scanner.models.backtest import (
    BacktestConfig,
    BacktestResult,
    PerformanceMetrics,
)
from volatility_scanner.core.exceptions import BacktestError

router = APIRouter()


class BacktestRequest(BaseModel):
    """Request model for backtesting."""
    
    # Time period
    start_date: date = Field(description="Backtest start date")
    end_date: date = Field(description="Backtest end date")
    
    # Universe
    symbols: List[str] = Field(description="List of symbols to test")
    
    # Capital management
    initial_capital: float = Field(
        default=100000.0,
        gt=0,
        description="Initial capital amount"
    )
    max_position_size: float = Field(
        default=0.1,
        ge=0.01,
        le=1.0,
        description="Maximum position size as % of capital"
    )
    
    # Risk management
    stop_loss_pct: float = Field(
        default=0.05,
        ge=0.01,
        le=0.5,
        description="Stop loss as % of entry price"
    )
    profit_target_pct: float = Field(
        default=0.15,
        ge=0.01,
        description="Profit target as % of entry price"
    )
    max_hold_days: int = Field(
        default=30,
        ge=1,
        description="Maximum days to hold position"
    )
    
    # Signal filtering
    min_signal_strength: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Minimum signal strength to trade"
    )
    min_volume_ratio: float = Field(
        default=1.0,
        ge=0.1,
        description="Minimum volume ratio vs average"
    )
    
    @validator("end_date")
    def validate_date_range(cls, v: date, values: dict) -> date:
        """Validate end date is after start date."""
        if "start_date" in values and v <= values["start_date"]:
            raise ValueError("End date must be after start date")
        return v
    
    @validator("symbols")
    def validate_symbols(cls, v: List[str]) -> List[str]:
        """Validate and normalize symbols."""
        if not v:
            raise ValueError("At least one symbol is required")
        return [symbol.upper().strip() for symbol in v]


class BacktestSummary(BaseModel):
    """Summary of backtest results."""
    backtest_id: str
    execution_timestamp: datetime
    config_summary: Dict[str, Any]
    performance_summary: Dict[str, Any]
    total_trades: int
    execution_duration_seconds: float


@router.post("/run", response_model=BacktestResult)
async def run_backtest(
    request: Request,
    backtest_request: BacktestRequest
) -> BacktestResult:
    """
    Run a complete backtest of the volatility squeeze strategy.
    
    This endpoint executes a full backtest simulation using historical data,
    applying the volatility squeeze detection logic and calculating
    comprehensive performance metrics.
    """
    try:
        backtest_service = request.app.state.backtest_service
        
        # Convert request to BacktestConfig
        config = BacktestConfig(
            start_date=datetime.combine(backtest_request.start_date, datetime.min.time()),
            end_date=datetime.combine(backtest_request.end_date, datetime.min.time()),
            symbols=backtest_request.symbols,
            initial_capital=backtest_request.initial_capital,
            max_position_size=backtest_request.max_position_size,
            stop_loss_pct=backtest_request.stop_loss_pct,
            profit_target_pct=backtest_request.profit_target_pct,
            max_hold_days=backtest_request.max_hold_days,
            min_signal_strength=backtest_request.min_signal_strength,
            min_volume_ratio=backtest_request.min_volume_ratio
        )
        
        # Run backtest
        result = await backtest_service.run_backtest(config)
        
        return result
        
    except BacktestError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Backtest execution failed: {str(e)}"
        )


@router.post("/quick", response_model=BacktestSummary)
async def quick_backtest(
    request: Request,
    backtest_request: BacktestRequest
) -> BacktestSummary:
    """
    Run a quick backtest and return summary results only.
    
    This endpoint runs the same backtest as /run but returns only
    summary information for faster response times.
    """
    try:
        # Run full backtest
        full_result = await run_backtest(request, backtest_request)
        
        # Return summary only
        return BacktestSummary(
            backtest_id=full_result.backtest_id,
            execution_timestamp=full_result.execution_timestamp,
            config_summary={
                'symbols': len(full_result.config.symbols),
                'start_date': full_result.config.start_date.date(),
                'end_date': full_result.config.end_date.date(),
                'initial_capital': full_result.config.initial_capital,
            },
            performance_summary=full_result.get_summary(),
            total_trades=full_result.performance.total_trades,
            execution_duration_seconds=full_result.execution_duration_seconds
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Quick backtest failed: {str(e)}"
        )


@router.get("/templates/conservative")
async def get_conservative_template() -> BacktestRequest:
    """Get a conservative backtesting template."""
    return BacktestRequest(
        start_date=date(2023, 1, 1),
        end_date=date(2023, 12, 31),
        symbols=["SPY", "QQQ", "IWM"],
        initial_capital=100000.0,
        max_position_size=0.05,  # 5% max position
        stop_loss_pct=0.03,      # 3% stop loss
        profit_target_pct=0.10,  # 10% profit target
        max_hold_days=20,
        min_signal_strength=0.7,  # Higher threshold
        min_volume_ratio=1.5
    )


@router.get("/templates/aggressive")
async def get_aggressive_template() -> BacktestRequest:
    """Get an aggressive backtesting template."""
    return BacktestRequest(
        start_date=date(2023, 1, 1),
        end_date=date(2023, 12, 31),
        symbols=["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
        initial_capital=100000.0,
        max_position_size=0.15,  # 15% max position
        stop_loss_pct=0.08,      # 8% stop loss
        profit_target_pct=0.25,  # 25% profit target
        max_hold_days=45,
        min_signal_strength=0.5,  # Lower threshold
        min_volume_ratio=1.0
    )


@router.get("/templates/etf-focused")
async def get_etf_template() -> BacktestRequest:
    """Get an ETF-focused backtesting template."""
    return BacktestRequest(
        start_date=date(2023, 1, 1),
        end_date=date(2023, 12, 31),
        symbols=["SPY", "QQQ", "IWM", "XLF", "XLK", "XLE", "XLV", "XLI"],
        initial_capital=100000.0,
        max_position_size=0.08,  # 8% max position
        stop_loss_pct=0.05,      # 5% stop loss
        profit_target_pct=0.15,  # 15% profit target
        max_hold_days=30,
        min_signal_strength=0.6,
        min_volume_ratio=1.2
    )
