"""Data models for options chains and market data."""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import List, Optional, Dict


@dataclass
class OptionsContract:
    """Single options contract with market data."""
    
    symbol: str
    strike: float
    expiry: date
    option_type: str  # 'call' or 'put'
    
    # Market data
    last_price: float
    bid: float
    ask: float
    volume: int
    open_interest: int
    
    # Greeks (optional)
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    
    # Implied volatility
    implied_volatility: Optional[float] = None
    
    # Metadata
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass
class OptionsChain:
    """Complete options chain for a ticker."""
    
    ticker: str
    underlying_price: float
    contracts: List[OptionsContract]
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    def get_calls(self) -> List[OptionsContract]:
        """Get all call contracts."""
        return [c for c in self.contracts if c.option_type == 'call']
    
    def get_puts(self) -> List[OptionsContract]:
        """Get all put contracts."""
        return [c for c in self.contracts if c.option_type == 'put']
    
    def get_expiry(self, expiry_date: date) -> List[OptionsContract]:
        """Get contracts for specific expiry."""
        return [c for c in self.contracts if c.expiry == expiry_date]


@dataclass
class Trade:
    """Single trade from time & sales data."""
    
    timestamp: datetime
    price: float
    size: int
    exchange: str
    bid: float
    ask: float
    
    @property
    def is_aggressive_buy(self) -> bool:
        """Check if trade was at or above ask."""
        return self.price >= self.ask


@dataclass
class HistoricalData:
    """Historical options data for lookback analysis."""
    
    ticker: str
    avg_volumes: Dict[str, float]  # contract_symbol -> avg_volume
    prev_oi: Dict[str, int]  # contract_symbol -> previous_oi
    time_sales: Dict[str, List[Trade]]  # contract_symbol -> trades
    
    def get_avg_volume(self, contract_symbol: str, days: int = 20) -> float:
        """Get average volume for contract."""
        return self.avg_volumes.get(contract_symbol, 0.0)
    
    def get_previous_oi(self, contract_symbol: str, days_ago: int = 1) -> int:
        """Get previous open interest."""
        return self.prev_oi.get(contract_symbol, 0)
    
    def get_time_and_sales(self, contract_symbol: str) -> List[Trade]:
        """Get time & sales data for contract."""
        return self.time_sales.get(contract_symbol, [])
    
    def get_time_and_sales_with_exchanges(
        self,
        contract_symbol: str,
        window_seconds: int = 5
    ) -> List[Trade]:
        """Get time & sales with exchange information."""
        # TODO: Filter by time window
        return self.get_time_and_sales(contract_symbol)

