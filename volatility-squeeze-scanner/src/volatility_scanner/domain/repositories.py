"""
Repository interfaces defining contracts for data access.
These are abstract base classes that define the domain's data access needs.
"""

from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal

from .entities import Symbol, MarketData, VolatilitySqueezeSignal, OHLCV, TechnicalIndicators


class IMarketDataRepository(ABC):
    """Interface for market data access."""
    
    @abstractmethod
    async def get_market_data(
        self, 
        symbol: Symbol, 
        start_date: date, 
        end_date: date
    ) -> Optional[MarketData]:
        """Retrieve market data for a symbol within date range."""
        pass
    
    @abstractmethod
    async def get_latest_price(self, symbol: Symbol) -> Optional[OHLCV]:
        """Get the latest OHLCV data for a symbol."""
        pass
    
    @abstractmethod
    async def cache_market_data(self, market_data: MarketData) -> None:
        """Cache market data for performance."""
        pass
    
    @abstractmethod
    async def invalidate_cache(self, symbol: Symbol) -> None:
        """Invalidate cached data for a symbol."""
        pass


class ISignalRepository(ABC):
    """Interface for signal storage and retrieval."""
    
    @abstractmethod
    async def save_signal(self, signal: VolatilitySqueezeSignal) -> None:
        """Save a volatility squeeze signal."""
        pass
    
    @abstractmethod
    async def get_signals_by_symbol(
        self, 
        symbol: Symbol, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[VolatilitySqueezeSignal]:
        """Retrieve signals for a symbol within date range."""
        pass
    
    @abstractmethod
    async def get_active_signals(self) -> List[VolatilitySqueezeSignal]:
        """Get all currently active signals."""
        pass
    
    @abstractmethod
    async def update_signal_status(
        self, 
        signal_id: str, 
        status: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update signal status and metadata."""
        pass


class IIndicatorRepository(ABC):
    """Interface for technical indicator storage."""
    
    @abstractmethod
    async def save_indicators(self, indicators: TechnicalIndicators) -> None:
        """Save technical indicators."""
        pass
    
    @abstractmethod
    async def get_indicators_history(
        self, 
        symbol: Symbol, 
        periods: int
    ) -> List[TechnicalIndicators]:
        """Get historical indicators for analysis."""
        pass
    
    @abstractmethod
    async def calculate_percentiles(
        self, 
        symbol: Symbol, 
        indicator_name: str, 
        periods: int
    ) -> Dict[int, Decimal]:
        """Calculate percentiles for an indicator over specified periods."""
        pass


class IBacktestRepository(ABC):
    """Interface for backtest data storage."""
    
    @abstractmethod
    async def save_backtest_result(
        self, 
        strategy_name: str, 
        parameters: Dict[str, Any],
        results: Dict[str, Any]
    ) -> str:
        """Save backtest results and return result ID."""
        pass
    
    @abstractmethod
    async def get_backtest_results(
        self, 
        strategy_name: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieve backtest results with optional filtering."""
        pass
    
    @abstractmethod
    async def compare_strategies(
        self, 
        strategy_names: List[str],
        metric: str = "total_return"
    ) -> Dict[str, Any]:
        """Compare performance of different strategies."""
        pass
