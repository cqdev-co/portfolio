"""Backtesting models and schemas."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field, validator


class TradeDirection(str, Enum):
    """Trade direction enumeration."""
    LONG = "long"
    SHORT = "short"


class TradeStatus(str, Enum):
    """Trade status enumeration."""
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ExitReason(str, Enum):
    """Trade exit reason enumeration."""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    TIME_LIMIT = "time_limit"
    SIGNAL_REVERSAL = "signal_reversal"
    MANUAL = "manual"


class Trade(BaseModel):
    """Individual trade record."""
    
    trade_id: str = Field(description="Unique trade identifier")
    symbol: str = Field(description="Stock/ETF symbol")
    
    # Entry details
    entry_timestamp: datetime = Field(description="Trade entry timestamp")
    entry_price: float = Field(gt=0, description="Entry price")
    direction: TradeDirection = Field(description="Trade direction")
    quantity: int = Field(gt=0, description="Number of shares/units")
    
    # Exit details
    exit_timestamp: Optional[datetime] = Field(
        None,
        description="Trade exit timestamp"
    )
    exit_price: Optional[float] = Field(
        None,
        gt=0,
        description="Exit price"
    )
    exit_reason: Optional[ExitReason] = Field(
        None,
        description="Reason for trade exit"
    )
    
    # Risk management
    stop_loss_price: Optional[float] = Field(
        None,
        description="Stop loss price level"
    )
    profit_target_price: Optional[float] = Field(
        None,
        description="Profit target price level"
    )
    
    # Performance metrics
    pnl_absolute: Optional[float] = Field(
        None,
        description="Absolute P&L in currency units"
    )
    pnl_percentage: Optional[float] = Field(
        None,
        description="P&L as percentage of entry value"
    )
    
    # Trade context
    signal_strength: float = Field(
        ge=0.0,
        le=1.0,
        description="Signal strength at entry"
    )
    market_conditions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Market conditions at entry"
    )
    
    # Status
    status: TradeStatus = Field(description="Current trade status")
    
    @validator("exit_price")
    def validate_exit_price(cls, v: Optional[float], values: dict) -> Optional[float]:
        """Validate exit price is reasonable."""
        if v is not None and "entry_price" in values:
            entry_price = values["entry_price"]
            # Check for unrealistic price movements (>90% change)
            if abs(v - entry_price) / entry_price > 0.9:
                raise ValueError("Exit price shows unrealistic movement")
        return v
    
    def calculate_pnl(self) -> tuple[Optional[float], Optional[float]]:
        """Calculate P&L if trade is closed."""
        if self.exit_price is None or self.status != TradeStatus.CLOSED:
            return None, None
        
        if self.direction == TradeDirection.LONG:
            pnl_abs = (self.exit_price - self.entry_price) * self.quantity
        else:  # SHORT
            pnl_abs = (self.entry_price - self.exit_price) * self.quantity
        
        pnl_pct = pnl_abs / (self.entry_price * self.quantity)
        
        return pnl_abs, pnl_pct
    
    def get_duration_days(self) -> Optional[float]:
        """Get trade duration in days."""
        if self.exit_timestamp is None:
            return None
        
        duration = self.exit_timestamp - self.entry_timestamp
        return duration.total_seconds() / 86400  # Convert to days


class PerformanceMetrics(BaseModel):
    """Backtesting performance metrics."""
    
    # Basic metrics
    total_trades: int = Field(ge=0, description="Total number of trades")
    winning_trades: int = Field(ge=0, description="Number of winning trades")
    losing_trades: int = Field(ge=0, description="Number of losing trades")
    
    # Returns
    total_return: float = Field(description="Total return (%)")
    average_return: float = Field(description="Average return per trade (%)")
    best_trade: float = Field(description="Best single trade return (%)")
    worst_trade: float = Field(description="Worst single trade return (%)")
    
    # Win/Loss metrics
    win_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="Win rate (0-1)"
    )
    average_win: float = Field(description="Average winning trade return (%)")
    average_loss: float = Field(description="Average losing trade return (%)")
    profit_factor: float = Field(
        description="Gross profit / Gross loss"
    )
    
    # Risk metrics
    max_drawdown: float = Field(description="Maximum drawdown (%)")
    sharpe_ratio: Optional[float] = Field(
        None,
        description="Sharpe ratio (if risk-free rate available)"
    )
    sortino_ratio: Optional[float] = Field(
        None,
        description="Sortino ratio"
    )
    
    # Time-based metrics
    average_trade_duration: float = Field(
        description="Average trade duration in days"
    )
    trades_per_month: float = Field(
        description="Average trades per month"
    )
    
    # Additional metrics
    expectancy: float = Field(
        description="Expected value per trade"
    )
    kelly_criterion: Optional[float] = Field(
        None,
        description="Kelly criterion optimal position size"
    )
    
    @validator("win_rate")
    def validate_win_rate(cls, v: float, values: dict) -> float:
        """Validate win rate consistency."""
        if "total_trades" in values and "winning_trades" in values:
            total = values["total_trades"]
            wins = values["winning_trades"]
            if total > 0:
                expected_rate = wins / total
                if abs(v - expected_rate) > 0.001:  # Allow small rounding errors
                    raise ValueError("Win rate inconsistent with trade counts")
        return v


class BacktestConfig(BaseModel):
    """Backtesting configuration parameters."""
    
    # Time period
    start_date: datetime = Field(description="Backtest start date")
    end_date: datetime = Field(description="Backtest end date")
    
    # Universe
    symbols: List[str] = Field(description="List of symbols to test")
    
    # Capital management
    initial_capital: float = Field(
        gt=0,
        description="Initial capital amount"
    )
    position_size_method: str = Field(
        default="fixed_percent",
        description="Position sizing method"
    )
    max_position_size: float = Field(
        default=0.1,
        ge=0.01,
        le=1.0,
        description="Maximum position size as % of capital"
    )
    
    # Risk management
    stop_loss_pct: Optional[float] = Field(
        None,
        ge=0.01,
        le=0.5,
        description="Stop loss as % of entry price"
    )
    profit_target_pct: Optional[float] = Field(
        None,
        ge=0.01,
        description="Profit target as % of entry price"
    )
    max_hold_days: Optional[int] = Field(
        None,
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
    
    # Execution
    slippage_pct: float = Field(
        default=0.001,
        ge=0.0,
        le=0.1,
        description="Slippage as % of price"
    )
    commission_per_trade: float = Field(
        default=1.0,
        ge=0.0,
        description="Commission per trade"
    )
    
    @validator("end_date")
    def validate_date_range(cls, v: datetime, values: dict) -> datetime:
        """Validate end date is after start date."""
        if "start_date" in values and v <= values["start_date"]:
            raise ValueError("End date must be after start date")
        return v


class BacktestResult(BaseModel):
    """Complete backtesting result."""
    
    # Configuration
    config: BacktestConfig = Field(description="Backtest configuration")
    
    # Execution metadata
    backtest_id: str = Field(description="Unique backtest identifier")
    execution_timestamp: datetime = Field(
        description="When backtest was executed"
    )
    execution_duration_seconds: float = Field(
        description="Backtest execution time"
    )
    
    # Results
    trades: List[Trade] = Field(description="All trades executed")
    performance: PerformanceMetrics = Field(
        description="Performance metrics"
    )
    
    # Equity curve data
    equity_curve: List[Dict[str, Any]] = Field(
        description="Daily equity curve data"
    )
    
    # Additional analysis
    monthly_returns: Dict[str, float] = Field(
        description="Monthly return breakdown"
    )
    symbol_performance: Dict[str, PerformanceMetrics] = Field(
        description="Per-symbol performance breakdown"
    )
    
    # Validation
    data_quality_issues: List[str] = Field(
        default_factory=list,
        description="Data quality issues encountered"
    )
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of key backtest results."""
        return {
            "total_trades": self.performance.total_trades,
            "win_rate": f"{self.performance.win_rate:.1%}",
            "total_return": f"{self.performance.total_return:.1%}",
            "max_drawdown": f"{self.performance.max_drawdown:.1%}",
            "sharpe_ratio": self.performance.sharpe_ratio,
            "profit_factor": f"{self.performance.profit_factor:.2f}",
            "best_trade": f"{self.performance.best_trade:.1%}",
            "worst_trade": f"{self.performance.worst_trade:.1%}",
        }
