"""
Paper Trading API routes for Volatility Squeeze Scanner.
Provides endpoints for portfolio management, trade execution, and performance tracking.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ...config.settings import get_settings, Settings
from ...services.paper_trading_service import PaperTradingService
from ...models.paper_trading import PaperPortfolio, Position, PaperTrade, SignalAlert


# Global service instance
_paper_trading_service: Optional[PaperTradingService] = None


def get_paper_trading_service(settings: Settings = Depends(get_settings)) -> PaperTradingService:
    """Get or create paper trading service instance."""
    global _paper_trading_service
    if _paper_trading_service is None:
        _paper_trading_service = PaperTradingService(settings)
    return _paper_trading_service


# Request/Response Models
class CreatePortfolioRequest(BaseModel):
    """Request model for creating a new portfolio."""
    name: str = Field(..., min_length=1, max_length=100)
    initial_capital: float = Field(default=100000.0, gt=0)
    max_position_size_pct: float = Field(default=0.08, gt=0, le=1)
    max_total_exposure_pct: float = Field(default=0.80, gt=0, le=1)
    max_positions: int = Field(default=15, gt=0)


class ExecuteTradeRequest(BaseModel):
    """Request model for executing a trade."""
    portfolio_id: UUID
    symbol: str = Field(..., min_length=1, max_length=10)
    position_size_pct: Optional[float] = Field(None, gt=0, le=1)


class ScanSignalsRequest(BaseModel):
    """Request model for scanning signals."""
    symbols: List[str] = Field(..., min_items=1)
    min_score: float = Field(default=0.6, ge=0, le=1)


class AutoTradeRequest(BaseModel):
    """Request model for automated trading."""
    portfolio_id: UUID
    scan_symbols: List[str] = Field(..., min_items=1)
    min_score: float = Field(default=0.7, ge=0, le=1)


class PortfolioSummaryResponse(BaseModel):
    """Response model for portfolio summary."""
    portfolio_id: str
    name: str
    created_at: str
    initial_capital: float
    current_cash: float
    total_market_value: float
    total_invested: float
    cash_utilization_pct: float
    exposure_pct: float
    open_positions_count: int
    total_trades: int
    performance: Dict
    positions: List[Dict]


# Create router
router = APIRouter(prefix="/paper-trading", tags=["Paper Trading"])


@router.post("/portfolios", response_model=Dict)
async def create_portfolio(
    request: CreatePortfolioRequest,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Create a new paper trading portfolio."""
    try:
        portfolio = await service.create_portfolio(
            name=request.name,
            initial_capital=request.initial_capital,
            max_position_size_pct=request.max_position_size_pct,
            max_total_exposure_pct=request.max_total_exposure_pct,
            max_positions=request.max_positions
        )
        
        return {
            "success": True,
            "portfolio_id": str(portfolio.id),
            "name": portfolio.name,
            "initial_capital": float(portfolio.initial_capital),
            "message": f"Created portfolio '{portfolio.name}' with ${request.initial_capital:,.2f}"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create portfolio: {str(e)}")


@router.get("/portfolios", response_model=List[Dict])
async def list_portfolios(
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """List all paper trading portfolios."""
    portfolios = []
    
    for portfolio_id, portfolio in service.portfolios.items():
        portfolios.append({
            "portfolio_id": str(portfolio_id),
            "name": portfolio.name,
            "created_at": portfolio.created_at.isoformat(),
            "initial_capital": float(portfolio.initial_capital),
            "current_cash": float(portfolio.current_cash),
            "total_market_value": float(portfolio.total_market_value),
            "is_active": portfolio.is_active,
            "open_positions": len(portfolio.get_open_positions()),
            "total_trades": len(portfolio.trades)
        })
    
    return portfolios


@router.get("/portfolios/{portfolio_id}", response_model=PortfolioSummaryResponse)
async def get_portfolio(
    portfolio_id: UUID,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Get detailed portfolio information."""
    summary = service.get_portfolio_summary(portfolio_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return PortfolioSummaryResponse(**summary)


@router.post("/portfolios/{portfolio_id}/update-prices")
async def update_portfolio_prices(
    portfolio_id: UUID,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Update current prices for all positions in portfolio."""
    success = await service.update_portfolio_prices(portfolio_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found or update failed")
    
    return {"success": True, "message": "Portfolio prices updated"}


@router.post("/scan-signals", response_model=List[Dict])
async def scan_signals(
    request: ScanSignalsRequest,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Scan symbols for trading signals."""
    try:
        signals = await service.scan_for_signals(
            symbols=request.symbols,
            min_score=request.min_score
        )
        
        return [
            {
                "symbol": signal.symbol,
                "signal_score": signal.signal_score,
                "recommendation": signal.recommendation,
                "current_price": float(signal.current_price),
                "stop_loss": float(signal.stop_loss) if signal.stop_loss else None,
                "position_size_pct": signal.position_size_pct,
                "is_actionable": signal.is_actionable,
                "timestamp": signal.timestamp.isoformat()
            }
            for signal in signals
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan signals: {str(e)}")


@router.post("/execute-trade", response_model=Dict)
async def execute_trade(
    request: ExecuteTradeRequest,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Execute a trade based on current signal for a symbol."""
    try:
        # First scan for signal on this specific symbol
        signals = await service.scan_for_signals(
            symbols=[request.symbol],
            min_score=0.4  # Lower threshold for manual execution
        )
        
        if not signals:
            raise HTTPException(
                status_code=400, 
                detail=f"No actionable signal found for {request.symbol}"
            )
        
        signal = signals[0]  # Take the first (and only) signal
        
        # Create mock result for trade execution
        mock_result = type('MockResult', (), {
            'squeeze_signal': type('MockSignal', (), {'symbol': signal.symbol})(),
            'overall_score': signal.signal_score,
            'position_size_pct': request.position_size_pct or signal.position_size_pct,
            'stop_loss_level': float(signal.stop_loss) if signal.stop_loss else None,
            'recommendation': signal.recommendation,
            'is_actionable': lambda self=None: signal.is_actionable,
            'get_risk_level': lambda self=None: 'LOW'
        })()
        
        trade = await service.execute_trade_from_signal(request.portfolio_id, mock_result)
        
        if not trade:
            raise HTTPException(
                status_code=400,
                detail="Failed to execute trade - check portfolio limits and existing positions"
            )
        
        return {
            "success": True,
            "trade_id": str(trade.id),
            "symbol": trade.symbol,
            "shares": trade.shares,
            "price": float(trade.price),
            "total_cost": float(trade.total_cost),
            "signal_score": trade.signal_score,
            "message": f"Executed BUY {trade.shares} shares of {trade.symbol} at ${trade.price:.2f}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute trade: {str(e)}")


@router.post("/close-position", response_model=Dict)
async def close_position(
    portfolio_id: UUID,
    symbol: str,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Close an open position."""
    try:
        trade = await service.close_position(portfolio_id, symbol)
        
        if not trade:
            raise HTTPException(
                status_code=404,
                detail=f"No open position found for {symbol}"
            )
        
        # Calculate P&L
        portfolio = service.get_portfolio(portfolio_id)
        position = None
        for pos in portfolio.positions:
            if pos.symbol == symbol and pos.exit_trade_id == trade.id:
                position = pos
                break
        
        pnl = 0
        pnl_pct = 0
        if position:
            pnl = float((trade.price - position.entry_price) * position.shares)
            pnl_pct = float((trade.price - position.entry_price) / position.entry_price * 100)
        
        return {
            "success": True,
            "trade_id": str(trade.id),
            "symbol": trade.symbol,
            "shares": trade.shares,
            "exit_price": float(trade.price),
            "pnl_dollars": pnl,
            "pnl_percent": pnl_pct,
            "message": f"Closed {trade.shares} shares of {trade.symbol} at ${trade.price:.2f} (P&L: ${pnl:+.2f})"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close position: {str(e)}")


@router.post("/auto-trade", response_model=Dict)
async def auto_trade(
    request: AutoTradeRequest,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Automatically scan and execute trades for high-quality signals."""
    try:
        # Scan for signals
        signals = await service.scan_for_signals(
            symbols=request.scan_symbols,
            min_score=request.min_score
        )
        
        if not signals:
            return {
                "success": True,
                "signals_found": 0,
                "trades_executed": 0,
                "message": "No signals met criteria for automated execution"
            }
        
        # Execute trades
        trades = await service.auto_trade_signals(request.portfolio_id, signals)
        
        return {
            "success": True,
            "signals_found": len(signals),
            "trades_executed": len(trades),
            "trades": [
                {
                    "symbol": trade.symbol,
                    "shares": trade.shares,
                    "price": float(trade.price),
                    "signal_score": trade.signal_score
                }
                for trade in trades
            ],
            "message": f"Executed {len(trades)} trades from {len(signals)} signals"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-trade failed: {str(e)}")


@router.post("/check-stops", response_model=Dict)
async def check_stop_losses(
    portfolio_id: UUID,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Check and execute stop losses for open positions."""
    try:
        stop_trades = await service.check_stop_losses(portfolio_id)
        
        return {
            "success": True,
            "stops_executed": len(stop_trades),
            "trades": [
                {
                    "symbol": trade.symbol,
                    "shares": trade.shares,
                    "price": float(trade.price),
                    "reason": trade.reason.value
                }
                for trade in stop_trades
            ],
            "message": f"Executed {len(stop_trades)} stop loss trades" if stop_trades else "No stop losses triggered"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stop loss check failed: {str(e)}")


@router.get("/positions/{portfolio_id}", response_model=List[Dict])
async def get_positions(
    portfolio_id: UUID,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Get all open positions for a portfolio."""
    portfolio = service.get_portfolio(portfolio_id)
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Update prices first
    await service.update_portfolio_prices(portfolio_id)
    
    positions = []
    for pos in portfolio.get_open_positions():
        positions.append({
            "symbol": pos.symbol,
            "shares": pos.shares,
            "entry_price": float(pos.entry_price),
            "entry_date": pos.entry_date.isoformat(),
            "current_price": float(pos.current_price) if pos.current_price else None,
            "market_value": float(pos.market_value) if pos.market_value else None,
            "unrealized_pnl": float(pos.unrealized_pnl) if pos.unrealized_pnl else None,
            "unrealized_pnl_pct": pos.unrealized_pnl_pct,
            "days_held": pos.days_held,
            "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
            "signal_score": pos.signal_score,
            "risk_level": pos.risk_level.value
        })
    
    return positions


@router.get("/trades/{portfolio_id}", response_model=List[Dict])
async def get_trade_history(
    portfolio_id: UUID,
    limit: int = 50,
    service: PaperTradingService = Depends(get_paper_trading_service)
):
    """Get trade history for a portfolio."""
    portfolio = service.get_portfolio(portfolio_id)
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get recent trades (sorted by timestamp, most recent first)
    recent_trades = sorted(portfolio.trades, key=lambda t: t.timestamp, reverse=True)[:limit]
    
    trades = []
    for trade in recent_trades:
        trades.append({
            "trade_id": str(trade.id),
            "symbol": trade.symbol,
            "side": trade.side.value,
            "shares": trade.shares,
            "price": float(trade.price),
            "timestamp": trade.timestamp.isoformat(),
            "reason": trade.reason.value,
            "signal_score": trade.signal_score,
            "commission": float(trade.commission),
            "net_amount": float(trade.net_amount)
        })
    
    return trades
