"""
Paper Trading Models for Volatility Squeeze Scanner.
Defines data structures for portfolio management, trade execution, and performance tracking.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, computed_field


class TradeStatus(str, Enum):
    """Trade execution status."""
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class TradeSide(str, Enum):
    """Trade side (buy/sell)."""
    BUY = "buy"
    SELL = "sell"


class TradeReason(str, Enum):
    """Reason for trade execution."""
    SIGNAL = "signal"
    STOP_LOSS = "stop_loss"
    PROFIT_TARGET = "profit_target"
    TIME_EXIT = "time_exit"
    RISK_MANAGEMENT = "risk_management"


class PositionStatus(str, Enum):
    """Position status."""
    OPEN = "open"
    CLOSED = "closed"


class RiskLevel(str, Enum):
    """Risk level classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PaperTrade(BaseModel):
    """Represents a paper trade execution."""
    
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    symbol: str = Field(..., min_length=1, max_length=10)
    side: TradeSide
    shares: int = Field(..., gt=0)
    price: Decimal = Field(..., gt=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    signal_score: Optional[float] = Field(None, ge=0, le=1)
    reason: TradeReason
    commission: Decimal = Field(default=Decimal("1.0"), ge=0)
    slippage: Decimal = Field(default=Decimal("0.0"), ge=0)
    status: TradeStatus = Field(default=TradeStatus.FILLED)
    
    @computed_field
    @property
    def total_cost(self) -> Decimal:
        """Calculate total trade cost including commission and slippage."""
        base_cost = self.price * self.shares
        return base_cost + self.commission + self.slippage
    
    @computed_field
    @property
    def net_amount(self) -> Decimal:
        """Calculate net amount (positive for sells, negative for buys)."""
        base_amount = self.price * self.shares
        total_fees = self.commission + self.slippage
        
        if self.side == TradeSide.BUY:
            return -(base_amount + total_fees)
        else:
            return base_amount - total_fees


class Position(BaseModel):
    """Represents a position in the paper trading portfolio."""
    
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    symbol: str = Field(..., min_length=1, max_length=10)
    shares: int = Field(..., gt=0)
    entry_price: Decimal = Field(..., gt=0)
    entry_date: datetime = Field(default_factory=datetime.utcnow)
    entry_trade_id: UUID
    stop_loss: Optional[Decimal] = Field(None, gt=0)
    profit_target: Optional[Decimal] = Field(None, gt=0)
    signal_score: Optional[float] = Field(None, ge=0, le=1)
    risk_level: RiskLevel = Field(default=RiskLevel.MEDIUM)
    status: PositionStatus = Field(default=PositionStatus.OPEN)
    exit_date: Optional[datetime] = None
    exit_trade_id: Optional[UUID] = None
    current_price: Optional[Decimal] = None
    
    @computed_field
    @property
    def market_value(self) -> Optional[Decimal]:
        """Calculate current market value of position."""
        if self.current_price is None:
            return None
        return self.current_price * self.shares
    
    @computed_field
    @property
    def cost_basis(self) -> Decimal:
        """Calculate cost basis of position."""
        return self.entry_price * self.shares
    
    @computed_field
    @property
    def unrealized_pnl(self) -> Optional[Decimal]:
        """Calculate unrealized P&L."""
        if self.current_price is None:
            return None
        return (self.current_price - self.entry_price) * self.shares
    
    @computed_field
    @property
    def unrealized_pnl_pct(self) -> Optional[float]:
        """Calculate unrealized P&L percentage."""
        if self.current_price is None:
            return None
        return float((self.current_price - self.entry_price) / self.entry_price)
    
    @computed_field
    @property
    def days_held(self) -> int:
        """Calculate days position has been held."""
        end_date = self.exit_date or datetime.utcnow()
        return (end_date - self.entry_date).days
    
    def should_stop_out(self) -> bool:
        """Check if position should be stopped out."""
        if self.stop_loss is None or self.current_price is None:
            return False
        return self.current_price <= self.stop_loss
    
    def should_take_profit(self) -> bool:
        """Check if position should take profit."""
        if self.profit_target is None or self.current_price is None:
            return False
        return self.current_price >= self.profit_target


class PerformanceMetrics(BaseModel):
    """Portfolio performance metrics."""
    
    total_return_dollars: Decimal = Field(default=Decimal("0"))
    total_return_pct: float = Field(default=0.0)
    win_rate: float = Field(default=0.0, ge=0, le=1)
    avg_return_per_trade: float = Field(default=0.0)
    best_trade_pct: float = Field(default=0.0)
    worst_trade_pct: float = Field(default=0.0)
    max_drawdown_pct: float = Field(default=0.0)
    sharpe_ratio: float = Field(default=0.0)
    profit_factor: float = Field(default=0.0)
    total_trades: int = Field(default=0, ge=0)
    winning_trades: int = Field(default=0, ge=0)
    losing_trades: int = Field(default=0, ge=0)
    current_positions: int = Field(default=0, ge=0)
    avg_days_held: float = Field(default=0.0)
    
    @computed_field
    @property
    def win_loss_ratio(self) -> float:
        """Calculate win/loss ratio."""
        if self.losing_trades == 0:
            return float('inf') if self.winning_trades > 0 else 0.0
        return self.winning_trades / self.losing_trades


class PaperPortfolio(BaseModel):
    """Paper trading portfolio."""
    
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=1, max_length=100)
    initial_capital: Decimal = Field(..., gt=0)
    current_cash: Decimal = Field(..., ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    
    # Configuration
    max_position_size_pct: float = Field(default=0.08, gt=0, le=1)  # 8% max
    max_total_exposure_pct: float = Field(default=0.80, gt=0, le=1)  # 80% max
    max_positions: int = Field(default=15, gt=0)
    commission_per_trade: Decimal = Field(default=Decimal("0.0"), ge=0)  # Zero commission (like Robinhood/Public)
    slippage_bps: int = Field(default=1, ge=0)  # 1 basis point = 0.01%
    
    # Current state (computed from positions and trades)
    positions: List[Position] = Field(default_factory=list)
    trades: List[PaperTrade] = Field(default_factory=list)
    performance: PerformanceMetrics = Field(default_factory=PerformanceMetrics)
    
    @computed_field
    @property
    def total_market_value(self) -> Decimal:
        """Calculate total portfolio market value."""
        positions_value = sum(
            pos.market_value or pos.cost_basis 
            for pos in self.positions 
            if pos.status == PositionStatus.OPEN
        )
        return self.current_cash + positions_value
    
    @computed_field
    @property
    def total_invested(self) -> Decimal:
        """Calculate total amount currently invested."""
        return sum(
            pos.market_value or pos.cost_basis 
            for pos in self.positions 
            if pos.status == PositionStatus.OPEN
        )
    
    @computed_field
    @property
    def cash_utilization_pct(self) -> float:
        """Calculate percentage of cash utilized."""
        if self.initial_capital == 0:
            return 0.0
        return float((self.initial_capital - self.current_cash) / self.initial_capital)
    
    @computed_field
    @property
    def exposure_pct(self) -> float:
        """Calculate current market exposure percentage."""
        if self.total_market_value == 0:
            return 0.0
        return float(self.total_invested / self.total_market_value)
    
    def can_open_position(self, position_value: Decimal) -> bool:
        """Check if a new position can be opened."""
        # Check cash availability
        if position_value > self.current_cash:
            return False
        
        # Check position size limit
        max_position_value = self.total_market_value * Decimal(str(self.max_position_size_pct))
        if position_value > max_position_value:
            return False
        
        # Check total exposure limit
        new_total_invested = self.total_invested + position_value
        max_total_invested = self.total_market_value * Decimal(str(self.max_total_exposure_pct))
        if new_total_invested > max_total_invested:
            return False
        
        # Check position count limit
        open_positions = len([p for p in self.positions if p.status == PositionStatus.OPEN])
        if open_positions >= self.max_positions:
            return False
        
        return True
    
    def get_open_positions(self) -> List[Position]:
        """Get all open positions."""
        return [pos for pos in self.positions if pos.status == PositionStatus.OPEN]
    
    def get_position_by_symbol(self, symbol: str) -> Optional[Position]:
        """Get open position for a specific symbol."""
        for pos in self.positions:
            if pos.symbol == symbol and pos.status == PositionStatus.OPEN:
                return pos
        return None
    
    def update_performance(self):
        """Update portfolio performance metrics."""
        closed_positions = [pos for pos in self.positions if pos.status == PositionStatus.CLOSED]
        
        if not closed_positions:
            return
        
        # Calculate basic metrics
        returns = []
        for pos in closed_positions:
            if pos.current_price:
                pnl_pct = float((pos.current_price - pos.entry_price) / pos.entry_price)
                returns.append(pnl_pct)
        
        if returns:
            winning_returns = [r for r in returns if r > 0]
            losing_returns = [r for r in returns if r < 0]
            
            self.performance.total_trades = len(returns)
            self.performance.winning_trades = len(winning_returns)
            self.performance.losing_trades = len(losing_returns)
            self.performance.win_rate = len(winning_returns) / len(returns)
            self.performance.avg_return_per_trade = sum(returns) / len(returns)
            self.performance.best_trade_pct = max(returns) if returns else 0.0
            self.performance.worst_trade_pct = min(returns) if returns else 0.0
            
            # Calculate profit factor
            gross_profit = sum(winning_returns) if winning_returns else 0
            gross_loss = abs(sum(losing_returns)) if losing_returns else 1
            self.performance.profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
            
            # Calculate total return
            total_return_dollars = self.total_market_value - self.initial_capital
            self.performance.total_return_dollars = total_return_dollars
            self.performance.total_return_pct = float(total_return_dollars / self.initial_capital)
        
        # Update current positions count
        self.performance.current_positions = len(self.get_open_positions())
        
        # Update timestamp
        self.updated_at = datetime.utcnow()


class SignalAlert(BaseModel):
    """Alert for new trading signals."""
    
    id: UUID = Field(default_factory=uuid4)
    symbol: str
    signal_score: float = Field(..., ge=0, le=1)
    recommendation: str
    current_price: Decimal
    stop_loss: Optional[Decimal] = None
    position_size_pct: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_actionable: bool
    alert_sent: bool = Field(default=False)


class RiskAlert(BaseModel):
    """Risk management alert."""
    
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    alert_type: str  # STOP_LOSS, DRAWDOWN, EXPOSURE, etc.
    symbol: Optional[str] = None
    message: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    acknowledged: bool = Field(default=False)
