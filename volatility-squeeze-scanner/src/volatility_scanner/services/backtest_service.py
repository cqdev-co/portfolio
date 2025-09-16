"""Backtesting service for volatility squeeze strategies."""

import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import asyncio
from loguru import logger
import numpy as np

from volatility_scanner.models.backtest import (
    BacktestConfig,
    BacktestResult,
    Trade,
    TradeDirection,
    TradeStatus,
    ExitReason,
    PerformanceMetrics,
)
from volatility_scanner.models.analysis import AnalysisResult, TrendDirection
from volatility_scanner.services.data_service import DataService
from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.core.exceptions import BacktestError
from volatility_scanner.config.settings import Settings


class BacktestService:
    """Service for backtesting volatility squeeze strategies."""
    
    def __init__(
        self,
        settings: Settings,
        data_service: DataService,
        analysis_service: AnalysisService
    ) -> None:
        """Initialize the backtest service."""
        self.settings = settings
        self.data_service = data_service
        self.analysis_service = analysis_service
    
    async def run_backtest(self, config: BacktestConfig) -> BacktestResult:
        """
        Run a complete backtest based on the configuration.
        
        Args:
            config: Backtesting configuration
            
        Returns:
            Complete backtest results
            
        Raises:
            BacktestError: If backtesting fails
        """
        try:
            start_time = datetime.now()
            backtest_id = str(uuid.uuid4())
            
            logger.info(
                f"Starting backtest {backtest_id}: "
                f"{len(config.symbols)} symbols, "
                f"{config.start_date.date()} to {config.end_date.date()}"
            )
            
            # Fetch historical data for all symbols
            symbol_data = await self._fetch_backtest_data(config)
            
            # Run simulation
            trades, equity_curve = await self._run_simulation(config, symbol_data)
            
            # Calculate performance metrics
            performance = self._calculate_performance_metrics(
                trades,
                config.initial_capital,
                equity_curve
            )
            
            # Generate additional analysis
            monthly_returns = self._calculate_monthly_returns(equity_curve)
            symbol_performance = self._calculate_symbol_performance(trades)
            
            # Create result
            end_time = datetime.now()
            execution_duration = (end_time - start_time).total_seconds()
            
            result = BacktestResult(
                config=config,
                backtest_id=backtest_id,
                execution_timestamp=start_time,
                execution_duration_seconds=execution_duration,
                trades=trades,
                performance=performance,
                equity_curve=equity_curve,
                monthly_returns=monthly_returns,
                symbol_performance=symbol_performance,
                data_quality_issues=[]  # TODO: Track data quality issues
            )
            
            logger.info(
                f"Backtest {backtest_id} completed: "
                f"{len(trades)} trades, "
                f"{performance.total_return:.1f}% return, "
                f"{performance.win_rate:.1%} win rate"
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Backtest failed: {str(e)}"
            logger.error(error_msg)
            raise BacktestError(error_msg) from e
    
    async def _fetch_backtest_data(
        self,
        config: BacktestConfig
    ) -> Dict[str, Any]:
        """Fetch historical data for backtesting."""
        
        # Calculate required data period (add buffer for indicators)
        buffer_days = 200  # Buffer for technical indicators
        data_start = config.start_date - timedelta(days=buffer_days)
        
        # Determine yfinance period
        total_days = (config.end_date - data_start).days
        if total_days <= 365:
            period = "1y"
        elif total_days <= 730:
            period = "2y"
        else:
            period = "5y"
        
        # Fetch data for all symbols
        symbol_data = await self.data_service.get_multiple_symbols(
            config.symbols,
            period=period
        )
        
        # Calculate technical indicators for each symbol
        for symbol, market_data in symbol_data.items():
            symbol_data[symbol] = (
                self.analysis_service.indicator_calculator
                .calculate_all_indicators(market_data)
            )
        
        logger.info(
            f"Fetched data for {len(symbol_data)}/{len(config.symbols)} symbols"
        )
        
        return symbol_data
    
    async def _run_simulation(
        self,
        config: BacktestConfig,
        symbol_data: Dict[str, Any]
    ) -> Tuple[List[Trade], List[Dict[str, Any]]]:
        """Run the trading simulation."""
        
        trades = []
        open_positions = {}
        capital = config.initial_capital
        equity_curve = []
        
        # Generate date range for simulation
        current_date = config.start_date
        
        while current_date <= config.end_date:
            daily_pnl = 0.0
            
            # Process each symbol for this date
            for symbol, market_data in symbol_data.items():
                
                # Find data for current date
                ohlcv_data = [
                    ohlcv for ohlcv in market_data.ohlcv_data
                    if ohlcv.timestamp.date() == current_date.date()
                ]
                
                if not ohlcv_data:
                    continue
                
                current_ohlcv = ohlcv_data[0]
                
                # Check for exit conditions on open positions
                if symbol in open_positions:
                    trade = open_positions[symbol]
                    exit_info = self._check_exit_conditions(
                        trade,
                        current_ohlcv,
                        current_date,
                        config
                    )
                    
                    if exit_info:
                        # Close position
                        exit_price, exit_reason = exit_info
                        closed_trade = self._close_trade(
                            trade,
                            exit_price,
                            current_date,
                            exit_reason
                        )
                        
                        trades.append(closed_trade)
                        daily_pnl += closed_trade.pnl_absolute or 0.0
                        capital += closed_trade.pnl_absolute or 0.0
                        
                        del open_positions[symbol]
                
                # Check for new entry signals (if not already in position)
                if symbol not in open_positions:
                    # Create a subset of market data up to current date
                    historical_data = self._get_historical_subset(
                        market_data,
                        current_date
                    )
                    
                    if historical_data:
                        # Analyze for signals
                        analysis = await self.analysis_service.analyze_symbol(
                            historical_data,
                            include_ai_analysis=False  # Skip AI for backtesting speed
                        )
                        
                        if analysis and self._should_enter_trade(analysis, config):
                            # Enter new position
                            trade = self._enter_trade(
                                analysis,
                                current_ohlcv,
                                current_date,
                                capital,
                                config
                            )
                            
                            if trade:
                                open_positions[symbol] = trade
                                capital -= trade.entry_price * trade.quantity
            
            # Record equity curve point
            total_position_value = sum(
                pos.entry_price * pos.quantity 
                for pos in open_positions.values()
            )
            
            equity_curve.append({
                'date': current_date,
                'capital': capital,
                'positions_value': total_position_value,
                'total_equity': capital + total_position_value,
                'daily_pnl': daily_pnl
            })
            
            # Move to next trading day
            current_date += timedelta(days=1)
        
        # Close any remaining open positions
        for symbol, trade in open_positions.items():
            if symbol in symbol_data:
                # Use last available price
                last_ohlcv = symbol_data[symbol].ohlcv_data[-1]
                closed_trade = self._close_trade(
                    trade,
                    last_ohlcv.close,
                    config.end_date,
                    ExitReason.TIME_LIMIT
                )
                trades.append(closed_trade)
        
        return trades, equity_curve
    
    def _get_historical_subset(self, market_data, current_date):
        """Get historical data subset up to current date."""
        
        # Filter OHLCV data
        historical_ohlcv = [
            ohlcv for ohlcv in market_data.ohlcv_data
            if ohlcv.timestamp.date() <= current_date.date()
        ]
        
        # Filter indicators
        historical_indicators = [
            ind for ind in market_data.indicators
            if ind.timestamp.date() <= current_date.date()
        ]
        
        if len(historical_ohlcv) < 50:  # Need minimum data for analysis
            return None
        
        # Create subset market data
        subset_data = market_data.copy()
        subset_data.ohlcv_data = historical_ohlcv
        subset_data.indicators = historical_indicators
        
        return subset_data
    
    def _should_enter_trade(
        self,
        analysis: AnalysisResult,
        config: BacktestConfig
    ) -> bool:
        """Determine if we should enter a trade based on analysis."""
        
        # Check minimum signal strength
        if analysis.overall_score < config.min_signal_strength:
            return False
        
        # Check volume requirement
        if analysis.squeeze_signal.volume_ratio < config.min_volume_ratio:
            return False
        
        # Must have actionable recommendation
        if analysis.recommendation not in ["BUY", "SELL"]:
            return False
        
        return True
    
    def _enter_trade(
        self,
        analysis: AnalysisResult,
        ohlcv,
        entry_date: datetime,
        available_capital: float,
        config: BacktestConfig
    ) -> Optional[Trade]:
        """Enter a new trade position."""
        
        # Determine trade direction
        if analysis.recommendation == "BUY":
            direction = TradeDirection.LONG
        elif analysis.recommendation == "SELL":
            direction = TradeDirection.SHORT
        else:
            return None
        
        # Calculate position size
        position_value = available_capital * config.max_position_size
        
        # Apply slippage
        entry_price = ohlcv.close * (1 + config.slippage_pct)
        if direction == TradeDirection.SHORT:
            entry_price = ohlcv.close * (1 - config.slippage_pct)
        
        # Calculate quantity
        quantity = int(position_value / entry_price)
        if quantity <= 0:
            return None
        
        # Calculate stop loss and profit target
        stop_loss_price = None
        profit_target_price = None
        
        if config.stop_loss_pct:
            if direction == TradeDirection.LONG:
                stop_loss_price = entry_price * (1 - config.stop_loss_pct)
            else:
                stop_loss_price = entry_price * (1 + config.stop_loss_pct)
        
        if config.profit_target_pct:
            if direction == TradeDirection.LONG:
                profit_target_price = entry_price * (1 + config.profit_target_pct)
            else:
                profit_target_price = entry_price * (1 - config.profit_target_pct)
        
        return Trade(
            trade_id=str(uuid.uuid4()),
            symbol=analysis.symbol,
            entry_timestamp=entry_date,
            entry_price=entry_price,
            direction=direction,
            quantity=quantity,
            stop_loss_price=stop_loss_price,
            profit_target_price=profit_target_price,
            signal_strength=analysis.overall_score,
            market_conditions=analysis.market_conditions,
            status=TradeStatus.OPEN
        )
    
    def _check_exit_conditions(
        self,
        trade: Trade,
        current_ohlcv,
        current_date: datetime,
        config: BacktestConfig
    ) -> Optional[Tuple[float, ExitReason]]:
        """Check if trade should be exited."""
        
        # Time limit check
        if config.max_hold_days:
            days_held = (current_date - trade.entry_timestamp).days
            if days_held >= config.max_hold_days:
                return current_ohlcv.close, ExitReason.TIME_LIMIT
        
        # Stop loss check
        if trade.stop_loss_price:
            if trade.direction == TradeDirection.LONG:
                if current_ohlcv.low <= trade.stop_loss_price:
                    return trade.stop_loss_price, ExitReason.STOP_LOSS
            else:  # SHORT
                if current_ohlcv.high >= trade.stop_loss_price:
                    return trade.stop_loss_price, ExitReason.STOP_LOSS
        
        # Profit target check
        if trade.profit_target_price:
            if trade.direction == TradeDirection.LONG:
                if current_ohlcv.high >= trade.profit_target_price:
                    return trade.profit_target_price, ExitReason.PROFIT_TARGET
            else:  # SHORT
                if current_ohlcv.low <= trade.profit_target_price:
                    return trade.profit_target_price, ExitReason.PROFIT_TARGET
        
        return None
    
    def _close_trade(
        self,
        trade: Trade,
        exit_price: float,
        exit_date: datetime,
        exit_reason: ExitReason
    ) -> Trade:
        """Close a trade and calculate P&L."""
        
        # Apply slippage
        if trade.direction == TradeDirection.LONG:
            exit_price *= (1 - self.settings.backtest_batch_size / 10000)  # Small slippage
        else:
            exit_price *= (1 + self.settings.backtest_batch_size / 10000)
        
        # Calculate P&L
        if trade.direction == TradeDirection.LONG:
            pnl_absolute = (exit_price - trade.entry_price) * trade.quantity
        else:  # SHORT
            pnl_absolute = (trade.entry_price - exit_price) * trade.quantity
        
        # Subtract commission
        pnl_absolute -= (2 * 1.0)  # Entry + exit commission
        
        pnl_percentage = pnl_absolute / (trade.entry_price * trade.quantity)
        
        # Update trade
        trade.exit_timestamp = exit_date
        trade.exit_price = exit_price
        trade.exit_reason = exit_reason
        trade.pnl_absolute = pnl_absolute
        trade.pnl_percentage = pnl_percentage
        trade.status = TradeStatus.CLOSED
        
        return trade
    
    def _calculate_performance_metrics(
        self,
        trades: List[Trade],
        initial_capital: float,
        equity_curve: List[Dict[str, Any]]
    ) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics."""
        
        if not trades:
            return PerformanceMetrics(
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                total_return=0.0,
                average_return=0.0,
                best_trade=0.0,
                worst_trade=0.0,
                win_rate=0.0,
                average_win=0.0,
                average_loss=0.0,
                profit_factor=0.0,
                max_drawdown=0.0,
                average_trade_duration=0.0,
                trades_per_month=0.0,
                expectancy=0.0
            )
        
        # Basic metrics
        total_trades = len(trades)
        winning_trades = len([t for t in trades if (t.pnl_absolute or 0) > 0])
        losing_trades = len([t for t in trades if (t.pnl_absolute or 0) < 0])
        
        # Return metrics
        total_pnl = sum(t.pnl_absolute or 0 for t in trades)
        total_return = (total_pnl / initial_capital) * 100
        
        returns = [t.pnl_percentage or 0 for t in trades]
        average_return = np.mean(returns) * 100
        best_trade = max(returns) * 100
        worst_trade = min(returns) * 100
        
        # Win/Loss metrics
        win_rate = winning_trades / total_trades if total_trades > 0 else 0
        
        winning_returns = [r for r in returns if r > 0]
        losing_returns = [r for r in returns if r < 0]
        
        average_win = np.mean(winning_returns) * 100 if winning_returns else 0
        average_loss = np.mean(losing_returns) * 100 if losing_returns else 0
        
        gross_profit = sum(t.pnl_absolute for t in trades if (t.pnl_absolute or 0) > 0)
        gross_loss = abs(sum(t.pnl_absolute for t in trades if (t.pnl_absolute or 0) < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        # Risk metrics
        max_drawdown = self._calculate_max_drawdown(equity_curve)
        
        # Time-based metrics
        durations = []
        for trade in trades:
            if trade.exit_timestamp:
                duration = (trade.exit_timestamp - trade.entry_timestamp).days
                durations.append(duration)
        
        average_trade_duration = np.mean(durations) if durations else 0
        
        # Calculate trades per month
        if equity_curve:
            total_days = (equity_curve[-1]['date'] - equity_curve[0]['date']).days
            total_months = total_days / 30.44  # Average days per month
            trades_per_month = total_trades / total_months if total_months > 0 else 0
        else:
            trades_per_month = 0
        
        # Expectancy
        expectancy = (win_rate * average_win) + ((1 - win_rate) * average_loss)
        
        return PerformanceMetrics(
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            total_return=total_return,
            average_return=average_return,
            best_trade=best_trade,
            worst_trade=worst_trade,
            win_rate=win_rate,
            average_win=average_win,
            average_loss=average_loss,
            profit_factor=profit_factor,
            max_drawdown=max_drawdown,
            average_trade_duration=average_trade_duration,
            trades_per_month=trades_per_month,
            expectancy=expectancy
        )
    
    def _calculate_max_drawdown(
        self,
        equity_curve: List[Dict[str, Any]]
    ) -> float:
        """Calculate maximum drawdown from equity curve."""
        
        if not equity_curve:
            return 0.0
        
        equity_values = [point['total_equity'] for point in equity_curve]
        peak = equity_values[0]
        max_dd = 0.0
        
        for equity in equity_values:
            if equity > peak:
                peak = equity
            
            drawdown = (peak - equity) / peak
            if drawdown > max_dd:
                max_dd = drawdown
        
        return max_dd * 100  # Return as percentage
    
    def _calculate_monthly_returns(
        self,
        equity_curve: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate monthly returns breakdown."""
        
        monthly_returns = {}
        
        if not equity_curve:
            return monthly_returns
        
        # Group by month
        monthly_equity = {}
        for point in equity_curve:
            month_key = point['date'].strftime('%Y-%m')
            if month_key not in monthly_equity:
                monthly_equity[month_key] = []
            monthly_equity[month_key].append(point['total_equity'])
        
        # Calculate monthly returns
        prev_month_end = None
        for month, equity_values in sorted(monthly_equity.items()):
            month_start = equity_values[0]
            month_end = equity_values[-1]
            
            if prev_month_end is not None:
                monthly_return = ((month_end - prev_month_end) / prev_month_end) * 100
                monthly_returns[month] = monthly_return
            
            prev_month_end = month_end
        
        return monthly_returns
    
    def _calculate_symbol_performance(
        self,
        trades: List[Trade]
    ) -> Dict[str, PerformanceMetrics]:
        """Calculate per-symbol performance breakdown."""
        
        symbol_trades = {}
        for trade in trades:
            if trade.symbol not in symbol_trades:
                symbol_trades[trade.symbol] = []
            symbol_trades[trade.symbol].append(trade)
        
        symbol_performance = {}
        for symbol, symbol_trade_list in symbol_trades.items():
            # Create a dummy equity curve for this symbol
            symbol_equity = [{'total_equity': 10000}]  # Dummy initial capital
            
            performance = self._calculate_performance_metrics(
                symbol_trade_list,
                10000,  # Dummy initial capital
                symbol_equity
            )
            symbol_performance[symbol] = performance
        
        return symbol_performance
