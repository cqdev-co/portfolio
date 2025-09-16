"""
Paper Trading Service for Volatility Squeeze Scanner.
Handles portfolio management, trade execution, and performance tracking.
"""

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from loguru import logger

from ..config.settings import Settings
from ..models.analysis import AnalysisResult
from ..models.paper_trading import (
    PaperPortfolio, Position, PaperTrade, PerformanceMetrics,
    TradeSide, TradeReason, PositionStatus, RiskLevel,
    SignalAlert, RiskAlert
)
from .data_service import DataService
from .analysis_service import AnalysisService


class PaperTradingService:
    """Service for managing paper trading operations."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.data_service = DataService(settings)
        self.analysis_service = AnalysisService(settings)
        self.portfolios: Dict[UUID, PaperPortfolio] = {}
        self.active_alerts: List[SignalAlert] = []
        self.risk_alerts: List[RiskAlert] = []
    
    async def create_portfolio(
        self,
        name: str,
        initial_capital: float = 100000.0,
        max_position_size_pct: float = 0.08,
        max_total_exposure_pct: float = 0.80,
        max_positions: int = 15
    ) -> PaperPortfolio:
        """Create a new paper trading portfolio."""
        
        portfolio = PaperPortfolio(
            name=name,
            initial_capital=Decimal(str(initial_capital)),
            current_cash=Decimal(str(initial_capital)),
            max_position_size_pct=max_position_size_pct,
            max_total_exposure_pct=max_total_exposure_pct,
            max_positions=max_positions
        )
        
        self.portfolios[portfolio.id] = portfolio
        
        logger.info(f"Created paper trading portfolio '{name}' with ${initial_capital:,.2f}")
        return portfolio
    
    def get_portfolio(self, portfolio_id: UUID) -> Optional[PaperPortfolio]:
        """Get portfolio by ID."""
        return self.portfolios.get(portfolio_id)
    
    async def execute_trade_from_signal(
        self,
        portfolio_id: UUID,
        signal: AnalysisResult,
        override_position_size: Optional[float] = None
    ) -> Optional[PaperTrade]:
        """Execute a trade based on a volatility squeeze signal."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            logger.error(f"Portfolio {portfolio_id} not found")
            return None
        
        if not signal.is_actionable():
            logger.warning(f"Signal for {signal.squeeze_signal.symbol} is not actionable")
            return None
        
        # Check if we already have a position in this symbol
        existing_position = portfolio.get_position_by_symbol(signal.squeeze_signal.symbol)
        if existing_position:
            logger.info(f"Already have position in {signal.squeeze_signal.symbol}")
            return None
        
        # Calculate position size
        position_size_pct = override_position_size or signal.position_size_pct
        position_value = portfolio.total_market_value * Decimal(str(position_size_pct))
        
        # Check if we can open this position
        if not portfolio.can_open_position(position_value):
            logger.warning(f"Cannot open position in {signal.squeeze_signal.symbol}: risk limits exceeded")
            return None
        
        # Get current market price
        try:
            market_data = await self.data_service.get_market_data(
                signal.squeeze_signal.symbol, 
                period="1d"
            )
            current_price = market_data.ohlcv_data[-1].close
        except Exception as e:
            logger.error(f"Failed to get market data for {signal.squeeze_signal.symbol}: {e}")
            return None
        
        # Apply slippage
        slippage_factor = Decimal(str(portfolio.slippage_bps / 10000))
        entry_price = Decimal(str(current_price)) * (1 + slippage_factor)
        
        # Calculate shares
        shares = int(position_value / entry_price)
        if shares <= 0:
            logger.warning(f"Calculated 0 shares for {signal.squeeze_signal.symbol}")
            return None
        
        # Create trade
        trade = PaperTrade(
            portfolio_id=portfolio_id,
            symbol=signal.squeeze_signal.symbol,
            side=TradeSide.BUY,
            shares=shares,
            price=entry_price,
            signal_score=signal.overall_score,
            reason=TradeReason.SIGNAL,
            commission=portfolio.commission_per_trade,
            slippage=entry_price * shares * slippage_factor
        )
        
        # Create position
        position = Position(
            portfolio_id=portfolio_id,
            symbol=signal.squeeze_signal.symbol,
            shares=shares,
            entry_price=entry_price,
            entry_trade_id=trade.id,
            stop_loss=Decimal(str(signal.stop_loss_level)) if signal.stop_loss_level else None,
            signal_score=signal.overall_score,
            risk_level=RiskLevel(signal.get_risk_level().lower()),
            current_price=entry_price
        )
        
        # Update portfolio
        portfolio.current_cash -= trade.total_cost
        portfolio.positions.append(position)
        portfolio.trades.append(trade)
        portfolio.updated_at = datetime.utcnow()
        
        logger.info(
            f"Executed BUY trade: {shares} shares of {signal.squeeze_signal.symbol} "
            f"at ${entry_price:.2f} (Score: {signal.overall_score:.2f})"
        )
        
        return trade
    
    async def close_position(
        self,
        portfolio_id: UUID,
        symbol: str,
        reason: TradeReason = TradeReason.PROFIT_TARGET
    ) -> Optional[PaperTrade]:
        """Close an open position."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            logger.error(f"Portfolio {portfolio_id} not found")
            return None
        
        position = portfolio.get_position_by_symbol(symbol)
        if not position:
            logger.warning(f"No open position found for {symbol}")
            return None
        
        # Get current market price
        try:
            market_data = await self.data_service.get_market_data(symbol, period="1d")
            current_price = market_data.ohlcv_data[-1].close
        except Exception as e:
            logger.error(f"Failed to get market data for {symbol}: {e}")
            return None
        
        # Apply slippage (negative for sells)
        slippage_factor = Decimal(str(portfolio.slippage_bps / 10000))
        exit_price = Decimal(str(current_price)) * (1 - slippage_factor)
        
        # Create exit trade
        trade = PaperTrade(
            portfolio_id=portfolio_id,
            symbol=symbol,
            side=TradeSide.SELL,
            shares=position.shares,
            price=exit_price,
            reason=reason,
            commission=portfolio.commission_per_trade,
            slippage=exit_price * position.shares * slippage_factor
        )
        
        # Update position
        position.status = PositionStatus.CLOSED
        position.exit_date = datetime.utcnow()
        position.exit_trade_id = trade.id
        position.current_price = exit_price
        
        # Update portfolio cash
        portfolio.current_cash += trade.net_amount
        portfolio.trades.append(trade)
        portfolio.updated_at = datetime.utcnow()
        
        # Update performance metrics
        portfolio.update_performance()
        
        pnl = (exit_price - position.entry_price) * position.shares
        pnl_pct = float((exit_price - position.entry_price) / position.entry_price * 100)
        
        logger.info(
            f"Closed position: {position.shares} shares of {symbol} "
            f"at ${exit_price:.2f} (P&L: ${pnl:.2f}, {pnl_pct:+.1f}%)"
        )
        
        return trade
    
    async def update_portfolio_prices(self, portfolio_id: UUID) -> bool:
        """Update current prices for all open positions."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            return False
        
        open_positions = portfolio.get_open_positions()
        if not open_positions:
            return True
        
        # Get unique symbols
        symbols = list(set(pos.symbol for pos in open_positions))
        
        try:
            # Fetch current prices
            symbol_data = await self.data_service.get_multiple_symbols(symbols, period="1d")
            
            # Update position prices
            for position in open_positions:
                if position.symbol in symbol_data:
                    market_data = symbol_data[position.symbol]
                    current_price = Decimal(str(market_data.ohlcv_data[-1].close))
                    position.current_price = current_price
            
            portfolio.updated_at = datetime.utcnow()
            logger.debug(f"Updated prices for {len(symbols)} positions in portfolio {portfolio_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update portfolio prices: {e}")
            return False
    
    async def check_stop_losses(self, portfolio_id: UUID) -> List[PaperTrade]:
        """Check and execute stop losses for open positions."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            return []
        
        # Update prices first
        await self.update_portfolio_prices(portfolio_id)
        
        stop_trades = []
        open_positions = portfolio.get_open_positions()
        
        for position in open_positions:
            if position.should_stop_out():
                logger.warning(
                    f"Stop loss triggered for {position.symbol}: "
                    f"${position.current_price:.2f} <= ${position.stop_loss:.2f}"
                )
                
                trade = await self.close_position(
                    portfolio_id, 
                    position.symbol, 
                    TradeReason.STOP_LOSS
                )
                
                if trade:
                    stop_trades.append(trade)
        
        return stop_trades
    
    async def scan_for_signals(
        self,
        symbols: List[str],
        min_score: float = 0.6
    ) -> List[SignalAlert]:
        """Scan symbols for new trading signals."""
        
        alerts = []
        
        try:
            # Get market data for all symbols
            symbol_data = await self.data_service.get_multiple_symbols(symbols, period="6mo")
            
            # Analyze each symbol
            for symbol, market_data in symbol_data.items():
                try:
                    result = await self.analysis_service.analyze_symbol(
                        market_data, 
                        include_ai_analysis=False
                    )
                    
                    if result and result.overall_score >= min_score and result.is_actionable():
                        current_price = Decimal(str(market_data.ohlcv_data[-1].close))
                        
                        alert = SignalAlert(
                            symbol=symbol,
                            signal_score=result.overall_score,
                            recommendation=result.recommendation,
                            current_price=current_price,
                            stop_loss=Decimal(str(result.stop_loss_level)) if result.stop_loss_level else None,
                            position_size_pct=result.position_size_pct,
                            is_actionable=result.is_actionable()
                        )
                        
                        alerts.append(alert)
                        
                except Exception as e:
                    logger.error(f"Error analyzing {symbol}: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Error in signal scan: {e}")
        
        # Update active alerts
        self.active_alerts.extend(alerts)
        
        if alerts:
            logger.info(f"Found {len(alerts)} new trading signals")
            for alert in alerts:
                logger.info(
                    f"Signal: {alert.symbol} - Score: {alert.signal_score:.2f} "
                    f"({alert.recommendation}) at ${alert.current_price:.2f}"
                )
        
        return alerts
    
    async def auto_trade_signals(
        self,
        portfolio_id: UUID,
        signals: List[SignalAlert]
    ) -> List[PaperTrade]:
        """Automatically execute trades for high-quality signals."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio or not portfolio.is_active:
            return []
        
        executed_trades = []
        
        # Sort signals by score (best first)
        sorted_signals = sorted(signals, key=lambda x: x.signal_score, reverse=True)
        
        for alert in sorted_signals:
            # Skip if we already have a position
            if portfolio.get_position_by_symbol(alert.symbol):
                continue
            
            # Create a mock AnalysisResult for trade execution
            # In a real implementation, you'd want to store the full analysis result
            mock_result = type('MockResult', (), {
                'squeeze_signal': type('MockSignal', (), {'symbol': alert.symbol})(),
                'overall_score': alert.signal_score,
                'position_size_pct': alert.position_size_pct,
                'stop_loss_level': float(alert.stop_loss) if alert.stop_loss else None,
                'recommendation': alert.recommendation,
                'is_actionable': lambda self=None: alert.is_actionable,
                'get_risk_level': lambda self=None: 'LOW'  # Simplified
            })()
            
            trade = await self.execute_trade_from_signal(portfolio_id, mock_result)
            if trade:
                executed_trades.append(trade)
                alert.alert_sent = True
        
        return executed_trades
    
    def get_portfolio_summary(self, portfolio_id: UUID) -> Optional[Dict]:
        """Get comprehensive portfolio summary."""
        
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            return None
        
        open_positions = portfolio.get_open_positions()
        
        return {
            'portfolio_id': str(portfolio_id),
            'name': portfolio.name,
            'created_at': portfolio.created_at.isoformat(),
            'initial_capital': float(portfolio.initial_capital),
            'current_cash': float(portfolio.current_cash),
            'total_market_value': float(portfolio.total_market_value),
            'total_invested': float(portfolio.total_invested),
            'cash_utilization_pct': portfolio.cash_utilization_pct,
            'exposure_pct': portfolio.exposure_pct,
            'open_positions_count': len(open_positions),
            'total_trades': len(portfolio.trades),
            'performance': {
                'total_return_pct': portfolio.performance.total_return_pct,
                'total_return_dollars': float(portfolio.performance.total_return_dollars),
                'win_rate': portfolio.performance.win_rate,
                'avg_return_per_trade': portfolio.performance.avg_return_per_trade,
                'profit_factor': portfolio.performance.profit_factor,
                'max_drawdown_pct': portfolio.performance.max_drawdown_pct,
                'sharpe_ratio': portfolio.performance.sharpe_ratio
            },
            'positions': [
                {
                    'symbol': pos.symbol,
                    'shares': pos.shares,
                    'entry_price': float(pos.entry_price),
                    'current_price': float(pos.current_price) if pos.current_price else None,
                    'unrealized_pnl': float(pos.unrealized_pnl) if pos.unrealized_pnl else None,
                    'unrealized_pnl_pct': pos.unrealized_pnl_pct,
                    'days_held': pos.days_held,
                    'signal_score': pos.signal_score,
                    'risk_level': pos.risk_level.value
                }
                for pos in open_positions
            ]
        }
    
    async def run_automated_trading(
        self,
        portfolio_id: UUID,
        scan_symbols: List[str],
        scan_interval_minutes: int = 60
    ):
        """Run automated trading loop."""
        
        logger.info(f"Starting automated trading for portfolio {portfolio_id}")
        
        while True:
            try:
                portfolio = self.get_portfolio(portfolio_id)
                if not portfolio or not portfolio.is_active:
                    logger.info(f"Portfolio {portfolio_id} is inactive, stopping automated trading")
                    break
                
                # Update portfolio prices
                await self.update_portfolio_prices(portfolio_id)
                
                # Check stop losses
                stop_trades = await self.check_stop_losses(portfolio_id)
                if stop_trades:
                    logger.info(f"Executed {len(stop_trades)} stop loss trades")
                
                # Scan for new signals
                signals = await self.scan_for_signals(scan_symbols, min_score=0.6)
                
                # Execute trades for high-quality signals
                if signals:
                    new_trades = await self.auto_trade_signals(portfolio_id, signals)
                    if new_trades:
                        logger.info(f"Executed {len(new_trades)} new trades")
                
                # Wait for next scan
                await asyncio.sleep(scan_interval_minutes * 60)
                
            except Exception as e:
                logger.error(f"Error in automated trading loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
