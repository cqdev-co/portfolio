"""
Use cases representing application-specific business workflows.
These orchestrate domain services to fulfill user requirements.
"""

from abc import ABC, abstractmethod
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal
from dataclasses import dataclass
import asyncio
from uuid import UUID

from ..domain.entities import Symbol, MarketData, VolatilitySqueezeSignal, Price
from ..domain.repositories import (
    IMarketDataRepository, ISignalRepository, IIndicatorRepository, IBacktestRepository
)
from ..domain.services import (
    IVolatilitySqueezeDetector, ITechnicalAnalysisService, IMarketRegimeDetector,
    RiskManagementService, SqueezeDetectionConfig, RiskManagementConfig
)


@dataclass
class AnalyzeSymbolRequest:
    """Request object for symbol analysis."""
    symbol: str
    period_days: int = 365
    include_ai_analysis: bool = False
    custom_config: Optional[SqueezeDetectionConfig] = None


@dataclass
class AnalyzeSymbolResponse:
    """Response object for symbol analysis."""
    symbol: Symbol
    signal: Optional[VolatilitySqueezeSignal]
    market_data_quality: Decimal
    analysis_timestamp: datetime
    recommendations: List[str]
    risk_assessment: Dict[str, Any]
    ai_insights: Optional[Dict[str, Any]] = None


@dataclass
class BatchAnalysisRequest:
    """Request object for batch symbol analysis."""
    symbols: List[str]
    period_days: int = 365
    max_concurrent: int = 10
    filter_criteria: Optional[Dict[str, Any]] = None


@dataclass
class BatchAnalysisResponse:
    """Response object for batch analysis."""
    total_symbols: int
    successful_analyses: int
    signals_found: List[AnalyzeSymbolResponse]
    errors: List[Dict[str, str]]
    execution_time_seconds: float


@dataclass
class BacktestRequest:
    """Request object for backtesting."""
    strategy_name: str
    symbols: List[str]
    start_date: date
    end_date: date
    initial_capital: Decimal
    parameters: Dict[str, Any]
    risk_config: Optional[RiskManagementConfig] = None


@dataclass
class BacktestResponse:
    """Response object for backtesting."""
    strategy_name: str
    total_trades: int
    winning_trades: int
    total_return: Decimal
    max_drawdown: Decimal
    sharpe_ratio: Optional[Decimal]
    win_rate: Decimal
    profit_factor: Optional[Decimal]
    trades: List[Dict[str, Any]]
    performance_metrics: Dict[str, Any]


class IAnalyzeSymbolUseCase(ABC):
    """Interface for symbol analysis use case."""
    
    @abstractmethod
    async def execute(self, request: AnalyzeSymbolRequest) -> AnalyzeSymbolResponse:
        """Execute symbol analysis."""
        pass


class IBatchAnalysisUseCase(ABC):
    """Interface for batch analysis use case."""
    
    @abstractmethod
    async def execute(self, request: BatchAnalysisRequest) -> BatchAnalysisResponse:
        """Execute batch symbol analysis."""
        pass


class IBacktestUseCase(ABC):
    """Interface for backtesting use case."""
    
    @abstractmethod
    async def execute(self, request: BacktestRequest) -> BacktestResponse:
        """Execute backtesting."""
        pass


class AnalyzeSymbolUseCase(IAnalyzeSymbolUseCase):
    """
    Use case for analyzing a single symbol for volatility squeeze signals.
    Orchestrates data retrieval, analysis, and risk assessment.
    """
    
    def __init__(
        self,
        market_data_repo: IMarketDataRepository,
        signal_repo: ISignalRepository,
        indicator_repo: IIndicatorRepository,
        squeeze_detector: IVolatilitySqueezeDetector,
        technical_analysis: ITechnicalAnalysisService,
        regime_detector: IMarketRegimeDetector,
        risk_management: RiskManagementService
    ):
        self.market_data_repo = market_data_repo
        self.signal_repo = signal_repo
        self.indicator_repo = indicator_repo
        self.squeeze_detector = squeeze_detector
        self.technical_analysis = technical_analysis
        self.regime_detector = regime_detector
        self.risk_management = risk_management
    
    async def execute(self, request: AnalyzeSymbolRequest) -> AnalyzeSymbolResponse:
        """Execute comprehensive symbol analysis."""
        analysis_start = datetime.utcnow()
        
        try:
            # Parse and validate symbol
            symbol = Symbol(request.symbol)
            
            # Calculate date range
            end_date = date.today()
            start_date = end_date - timedelta(days=request.period_days)
            
            # Retrieve market data
            market_data = await self.market_data_repo.get_market_data(
                symbol, start_date, end_date
            )
            
            if not market_data:
                return self._create_error_response(
                    symbol, analysis_start, "No market data available"
                )
            
            # Calculate technical indicators if not present
            if not market_data.indicators:
                indicators = await self.technical_analysis.calculate_indicators(
                    market_data.ohlcv_data
                )
                for indicator in indicators:
                    market_data.add_indicators(indicator)
            
            # Detect squeeze signal
            config = request.custom_config or SqueezeDetectionConfig()
            signal = await self.squeeze_detector.detect_squeeze(market_data, config)
            
            # Assess market regime
            market_regime = await self.regime_detector.detect_regime(market_data)
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(
                signal, market_data, market_regime
            )
            
            # Perform risk assessment
            risk_assessment = await self._perform_risk_assessment(
                signal, market_data
            )
            
            # Save signal if found
            if signal:
                await self.signal_repo.save_signal(signal)
            
            # Generate AI insights if requested
            ai_insights = None
            if request.include_ai_analysis and signal:
                ai_insights = await self._generate_ai_insights(signal, market_data)
            
            return AnalyzeSymbolResponse(
                symbol=symbol,
                signal=signal,
                market_data_quality=market_data.data_quality_score,
                analysis_timestamp=analysis_start,
                recommendations=recommendations,
                risk_assessment=risk_assessment,
                ai_insights=ai_insights
            )
            
        except Exception as e:
            return self._create_error_response(
                Symbol(request.symbol), analysis_start, str(e)
            )
    
    def _create_error_response(
        self, 
        symbol: Symbol, 
        timestamp: datetime, 
        error: str
    ) -> AnalyzeSymbolResponse:
        """Create error response for failed analysis."""
        return AnalyzeSymbolResponse(
            symbol=symbol,
            signal=None,
            market_data_quality=Decimal('0'),
            analysis_timestamp=timestamp,
            recommendations=[f"Analysis failed: {error}"],
            risk_assessment={"error": error}
        )
    
    async def _generate_recommendations(
        self, 
        signal: Optional[VolatilitySqueezeSignal],
        market_data: MarketData,
        market_regime: str
    ) -> List[str]:
        """Generate actionable recommendations based on analysis."""
        recommendations = []
        
        if not signal:
            recommendations.append("No volatility squeeze detected")
            recommendations.append("Monitor for future compression patterns")
            return recommendations
        
        # Signal-specific recommendations
        if signal.is_expansion:
            recommendations.append(
                f"Active expansion detected ({signal.expansion_magnitude:.1%})"
            )
            recommendations.append("Consider entering position on pullback")
        else:
            recommendations.append("Squeeze detected - monitor for breakout")
            recommendations.append("Set alerts for volume expansion")
        
        # Risk management recommendations
        latest_price = market_data.get_latest_price()
        if latest_price:
            stop_loss = signal.calculate_stop_loss_level(latest_price.close_price)
            profit_target = signal.calculate_profit_target(latest_price.close_price)
            
            recommendations.append(f"Suggested stop loss: ${stop_loss}")
            recommendations.append(f"Profit target: ${profit_target}")
        
        # Market regime considerations
        recommendations.append(f"Market regime: {market_regime}")
        
        return recommendations
    
    async def _perform_risk_assessment(
        self, 
        signal: Optional[VolatilitySqueezeSignal],
        market_data: MarketData
    ) -> Dict[str, Any]:
        """Perform comprehensive risk assessment."""
        assessment = {
            "data_quality": float(market_data.data_quality_score),
            "data_completeness": len(market_data.ohlcv_data),
        }
        
        if signal:
            latest_price = market_data.get_latest_price()
            if latest_price:
                # Validate signal risk
                is_valid, violations = self.risk_management.validate_signal_risk(
                    signal, latest_price.close_price, []  # No existing positions for now
                )
                
                assessment.update({
                    "signal_strength": float(signal.strength_score),
                    "risk_valid": is_valid,
                    "risk_violations": violations,
                    "trend_direction": signal.trend_direction.value,
                    "volume_confirmation": float(signal.volume_ratio),
                })
        
        return assessment
    
    async def _generate_ai_insights(
        self, 
        signal: VolatilitySqueezeSignal,
        market_data: MarketData
    ) -> Dict[str, Any]:
        """Generate AI-powered insights (placeholder for AI service integration)."""
        # This would integrate with AI service
        return {
            "confidence_score": float(signal.strength_score),
            "market_context": "Placeholder for AI analysis",
            "risk_factors": ["Placeholder risk factor"],
            "opportunities": ["Placeholder opportunity"]
        }


class BatchAnalysisUseCase(IBatchAnalysisUseCase):
    """
    Use case for analyzing multiple symbols concurrently.
    Implements efficient batch processing with error handling.
    """
    
    def __init__(self, analyze_symbol_use_case: IAnalyzeSymbolUseCase):
        self.analyze_symbol_use_case = analyze_symbol_use_case
    
    async def execute(self, request: BatchAnalysisRequest) -> BatchAnalysisResponse:
        """Execute batch analysis with concurrency control."""
        start_time = datetime.utcnow()
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(request.max_concurrent)
        
        # Create analysis tasks
        tasks = []
        for symbol in request.symbols:
            task = self._analyze_with_semaphore(
                semaphore, symbol, request.period_days
            )
            tasks.append(task)
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        signals_found = []
        errors = []
        successful_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append({
                    "symbol": request.symbols[i],
                    "error": str(result)
                })
            elif isinstance(result, AnalyzeSymbolResponse):
                successful_count += 1
                if result.signal:
                    signals_found.append(result)
            else:
                errors.append({
                    "symbol": request.symbols[i],
                    "error": "Unknown error occurred"
                })
        
        # Apply filters if specified
        if request.filter_criteria:
            signals_found = self._apply_filters(signals_found, request.filter_criteria)
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BatchAnalysisResponse(
            total_symbols=len(request.symbols),
            successful_analyses=successful_count,
            signals_found=signals_found,
            errors=errors,
            execution_time_seconds=execution_time
        )
    
    async def _analyze_with_semaphore(
        self, 
        semaphore: asyncio.Semaphore, 
        symbol: str, 
        period_days: int
    ) -> AnalyzeSymbolResponse:
        """Analyze symbol with semaphore for concurrency control."""
        async with semaphore:
            request = AnalyzeSymbolRequest(
                symbol=symbol,
                period_days=period_days
            )
            return await self.analyze_symbol_use_case.execute(request)
    
    def _apply_filters(
        self, 
        signals: List[AnalyzeSymbolResponse], 
        criteria: Dict[str, Any]
    ) -> List[AnalyzeSymbolResponse]:
        """Apply filtering criteria to signals."""
        filtered_signals = []
        
        for signal_response in signals:
            if not signal_response.signal:
                continue
            
            # Apply strength filter
            min_strength = criteria.get("min_strength", 0.0)
            if signal_response.signal.strength_score < Decimal(str(min_strength)):
                continue
            
            # Apply trend filter
            required_trend = criteria.get("trend_direction")
            if required_trend and signal_response.signal.trend_direction.value != required_trend:
                continue
            
            # Apply volume filter
            min_volume_ratio = criteria.get("min_volume_ratio", 1.0)
            if signal_response.signal.volume_ratio < Decimal(str(min_volume_ratio)):
                continue
            
            filtered_signals.append(signal_response)
        
        return filtered_signals


class BacktestUseCase(IBacktestUseCase):
    """
    Use case for backtesting volatility squeeze strategies.
    Implements comprehensive backtesting with performance metrics.
    """
    
    def __init__(
        self,
        market_data_repo: IMarketDataRepository,
        backtest_repo: IBacktestRepository,
        squeeze_detector: IVolatilitySqueezeDetector,
        technical_analysis: ITechnicalAnalysisService,
        risk_management: RiskManagementService
    ):
        self.market_data_repo = market_data_repo
        self.backtest_repo = backtest_repo
        self.squeeze_detector = squeeze_detector
        self.technical_analysis = technical_analysis
        self.risk_management = risk_management
    
    async def execute(self, request: BacktestRequest) -> BacktestResponse:
        """Execute comprehensive backtesting."""
        trades = []
        portfolio_value = request.initial_capital
        peak_value = request.initial_capital
        max_drawdown = Decimal('0')
        
        # Process each symbol
        for symbol_str in request.symbols:
            symbol = Symbol(symbol_str)
            
            # Get historical data
            market_data = await self.market_data_repo.get_market_data(
                symbol, request.start_date, request.end_date
            )
            
            if not market_data:
                continue
            
            # Calculate indicators
            indicators = await self.technical_analysis.calculate_indicators(
                market_data.ohlcv_data
            )
            
            for indicator in indicators:
                market_data.add_indicators(indicator)
            
            # Simulate trading
            symbol_trades = await self._simulate_trading(
                market_data, request.parameters, request.risk_config
            )
            
            trades.extend(symbol_trades)
        
        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics(
            trades, request.initial_capital
        )
        
        # Save backtest results
        await self.backtest_repo.save_backtest_result(
            request.strategy_name,
            request.parameters,
            performance_metrics
        )
        
        return BacktestResponse(
            strategy_name=request.strategy_name,
            total_trades=len(trades),
            winning_trades=sum(1 for t in trades if t.get("pnl", 0) > 0),
            total_return=performance_metrics.get("total_return", Decimal('0')),
            max_drawdown=performance_metrics.get("max_drawdown", Decimal('0')),
            sharpe_ratio=performance_metrics.get("sharpe_ratio"),
            win_rate=performance_metrics.get("win_rate", Decimal('0')),
            profit_factor=performance_metrics.get("profit_factor"),
            trades=trades,
            performance_metrics=performance_metrics
        )
    
    async def _simulate_trading(
        self, 
        market_data: MarketData, 
        parameters: Dict[str, Any],
        risk_config: Optional[RiskManagementConfig]
    ) -> List[Dict[str, Any]]:
        """Simulate trading on historical data."""
        trades = []
        config = SqueezeDetectionConfig(**parameters.get("detection", {}))
        
        # Walk through historical data
        for i in range(config.lookback_periods, len(market_data.ohlcv_data)):
            # Create subset of data up to current point
            current_data = MarketData(market_data.symbol)
            for j in range(i + 1):
                current_data.add_ohlcv(market_data.ohlcv_data[j])
                if j < len(market_data.indicators):
                    current_data.add_indicators(market_data.indicators[j])
            
            # Detect signal
            signal = await self.squeeze_detector.detect_squeeze(current_data, config)
            
            if signal and signal.is_expansion:
                # Simulate trade entry
                entry_price = current_data.ohlcv_data[-1].close_price
                stop_loss = signal.calculate_stop_loss_level(entry_price)
                profit_target = signal.calculate_profit_target(entry_price)
                
                # Simulate trade outcome (simplified)
                trade_result = self._simulate_trade_outcome(
                    entry_price, stop_loss, profit_target, 
                    market_data.ohlcv_data[i:i+10]  # Next 10 days
                )
                
                if trade_result:
                    trades.append(trade_result)
        
        return trades
    
    def _simulate_trade_outcome(
        self, 
        entry_price: Price, 
        stop_loss: Price, 
        profit_target: Price,
        future_data: List
    ) -> Optional[Dict[str, Any]]:
        """Simulate individual trade outcome."""
        if not future_data:
            return None
        
        for i, ohlcv in enumerate(future_data):
            # Check if stop loss hit
            if (entry_price.value > stop_loss.value and 
                ohlcv.low_price.value <= stop_loss.value):
                return {
                    "entry_price": float(entry_price.value),
                    "exit_price": float(stop_loss.value),
                    "pnl": float(stop_loss.value - entry_price.value),
                    "days_held": i + 1,
                    "outcome": "stop_loss"
                }
            
            # Check if profit target hit
            if (entry_price.value < profit_target.value and 
                ohlcv.high_price.value >= profit_target.value):
                return {
                    "entry_price": float(entry_price.value),
                    "exit_price": float(profit_target.value),
                    "pnl": float(profit_target.value - entry_price.value),
                    "days_held": i + 1,
                    "outcome": "profit_target"
                }
        
        # Exit at end of period
        final_price = future_data[-1].close_price
        return {
            "entry_price": float(entry_price.value),
            "exit_price": float(final_price.value),
            "pnl": float(final_price.value - entry_price.value),
            "days_held": len(future_data),
            "outcome": "time_exit"
        }
    
    def _calculate_performance_metrics(
        self, 
        trades: List[Dict[str, Any]], 
        initial_capital: Decimal
    ) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics."""
        if not trades:
            return {"total_return": Decimal('0'), "win_rate": Decimal('0')}
        
        total_pnl = sum(trade.get("pnl", 0) for trade in trades)
        winning_trades = sum(1 for trade in trades if trade.get("pnl", 0) > 0)
        
        return {
            "total_return": Decimal(str(total_pnl / float(initial_capital) * 100)),
            "win_rate": Decimal(str(winning_trades / len(trades) * 100)),
            "avg_trade": Decimal(str(total_pnl / len(trades))),
            "total_trades": len(trades),
            "winning_trades": winning_trades
        }
