"""Backtesting models for penny stock scanner."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BacktestConfig(BaseModel):
    """Configuration for backtesting."""
    
    start_date: datetime = Field(description="Backtest start date")
    end_date: datetime = Field(description="Backtest end date")
    symbols: List[str] = Field(description="Symbols to backtest")
    initial_capital: float = Field(
        default=100000.0, description="Starting capital"
    )
    max_position_size: float = Field(
        default=0.08, description="Max position size as % of capital"
    )
    stop_loss_pct: float = Field(
        default=0.10, description="Stop loss percentage"
    )
    profit_target_pct: float = Field(
        default=0.25, description="Profit target percentage"
    )
    min_score_threshold: float = Field(
        default=0.70, description="Minimum signal score to trade"
    )


class Trade(BaseModel):
    """Individual trade record."""
    
    trade_id: str = Field(description="Unique trade identifier")
    symbol: str = Field(description="Stock symbol")
    entry_date: datetime = Field(description="Entry date")
    entry_price: float = Field(description="Entry price")
    exit_date: Optional[datetime] = Field(None, description="Exit date")
    exit_price: Optional[float] = Field(None, description="Exit price")
    shares: int = Field(description="Number of shares")
    position_size: float = Field(description="Position size ($)")
    signal_score: float = Field(description="Signal score at entry")
    stop_loss: float = Field(description="Stop loss price")
    profit_target: float = Field(description="Profit target price")
    exit_reason: Optional[str] = Field(None, description="Exit reason")
    pnl: Optional[float] = Field(None, description="Profit/loss ($)")
    pnl_pct: Optional[float] = Field(None, description="Profit/loss (%)")
    days_held: Optional[int] = Field(None, description="Days held")


class BacktestPerformance(BaseModel):
    """Performance metrics from backtest."""
    
    total_trades: int = Field(description="Total number of trades")
    winning_trades: int = Field(description="Number of winning trades")
    losing_trades: int = Field(description="Number of losing trades")
    win_rate: float = Field(description="Win rate (0-1)")
    
    total_return: float = Field(description="Total return (%)")
    average_return: float = Field(description="Average return per trade (%)")
    best_trade: float = Field(description="Best trade return (%)")
    worst_trade: float = Field(description="Worst trade return (%)")
    
    profit_factor: float = Field(
        description="Gross profit / gross loss"
    )
    sharpe_ratio: Optional[float] = Field(
        None, description="Sharpe ratio"
    )
    max_drawdown: float = Field(description="Maximum drawdown (%)")
    
    average_trade_duration: float = Field(
        description="Average days per trade"
    )
    
    final_capital: float = Field(description="Final capital")
    total_pnl: float = Field(description="Total profit/loss ($)")


class BacktestResult(BaseModel):
    """Complete backtest result."""
    
    backtest_id: str = Field(description="Unique backtest identifier")
    config: BacktestConfig = Field(description="Backtest configuration")
    trades: List[Trade] = Field(description="All trades executed")
    performance: BacktestPerformance = Field(
        description="Performance metrics"
    )
    execution_time: float = Field(description="Execution time (seconds)")
    timestamp: datetime = Field(description="Backtest timestamp")

