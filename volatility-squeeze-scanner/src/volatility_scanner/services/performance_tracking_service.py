"""Performance tracking service for volatility squeeze signals."""

from datetime import datetime, date, timezone
from typing import List, Dict, Optional
from loguru import logger
from decimal import Decimal

from volatility_scanner.models.analysis import AnalysisResult, SignalStatus
from volatility_scanner.services.database_service import DatabaseService


class PerformanceTrackingService:
    """Service for tracking real-world performance of volatility squeeze signals."""
    
    def __init__(self, database_service: DatabaseService):
        """Initialize the performance tracking service."""
        self.database_service = database_service
    
    async def track_new_signals(self, signals: List[AnalysisResult], scan_date: date = None) -> int:
        """
        Track new signals in the performance tracking system.
        
        Args:
            signals: List of signals to track
            scan_date: Date of the scan (defaults to today)
            
        Returns:
            Number of signals added to performance tracking
        """
        if not self.database_service.is_available():
            logger.warning("Database service not available, skipping performance tracking")
            return 0
        
        if scan_date is None:
            scan_date = date.today()
        
        tracked_count = 0
        
        for signal in signals:
            try:
                # Only track actionable signals with valid recommendations
                if not self._should_track_signal(signal):
                    continue
                
                # Check if signal is NEW (not continuing)
                if signal.squeeze_signal.signal_status != SignalStatus.NEW:
                    continue
                
                # Get the signal ID from the database (should exist after storage)
                signal_id = await self._get_signal_id(signal.symbol, scan_date)
                if not signal_id:
                    logger.warning(f"Could not find signal ID for {signal.symbol} on {scan_date}")
                    continue
                
                # Create performance tracking record
                performance_data = self._prepare_performance_data(signal, signal_id, scan_date)
                
                # Insert into signal_performance table
                response = self.database_service.client.table('signal_performance').insert(
                    performance_data
                ).execute()
                
                if response.data:
                    tracked_count += 1
                    logger.debug(f"Started tracking performance for {signal.symbol}")
                else:
                    logger.warning(f"Failed to create performance tracking for {signal.symbol}")
                    
            except Exception as e:
                logger.error(f"Error tracking signal {signal.symbol}: {e}")
        
        if tracked_count > 0:
            logger.info(f"Started performance tracking for {tracked_count} new signals")
        
        return tracked_count
    
    async def close_ended_signals(self, ended_symbols: List[str], scan_date: date = None) -> int:
        """
        Close performance tracking for signals that have ended.
        
        Args:
            ended_symbols: List of symbols that have ended
            scan_date: Date when signals ended (defaults to today)
            
        Returns:
            Number of performance records closed
        """
        if not self.database_service.is_available() or not ended_symbols:
            return 0
        
        if scan_date is None:
            scan_date = date.today()
        
        closed_count = 0
        
        for symbol in ended_symbols:
            try:
                # Get current price for the symbol
                current_price = await self._get_current_price(symbol, scan_date)
                if not current_price:
                    logger.warning(f"Could not get current price for {symbol}")
                    continue
                
                # Update performance tracking record
                update_data = {
                    'exit_date': scan_date.isoformat(),
                    'exit_price': float(current_price),
                    'exit_reason': 'EXPANSION',
                    'status': 'CLOSED',
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                # Calculate return percentage and other metrics
                # This will be done by the database trigger or we can calculate here
                response = self.database_service.client.table('signal_performance').update(
                    update_data
                ).eq('symbol', symbol).eq('status', 'ACTIVE').execute()
                
                if response.data:
                    # Calculate performance metrics
                    for record in response.data:
                        entry_price = float(record.get('entry_price', 0))
                        exit_price = float(current_price)
                        entry_date = date.fromisoformat(record['entry_date'])
                        days_held = (scan_date - entry_date).days
                        
                        if entry_price > 0:
                            return_pct = (exit_price - entry_price) / entry_price * 100
                            return_absolute = (exit_price - entry_price) * 10  # Assuming $1000 position
                            is_winner = exit_price > entry_price
                            
                            # Filter out meaningless trades (short hold + minimal price change)
                            is_short_hold = days_held <= 1  # 0 or 1 day
                            is_minimal_change = abs(return_pct) < 0.1  # Less than 0.1% change
                            
                            if is_short_hold and is_minimal_change:
                                # Delete this performance record instead of closing it
                                self.database_service.client.table('signal_performance').delete().eq('id', record['id']).execute()
                                logger.debug(f"Deleted meaningless performance record for {symbol} (same day, no price change)")
                                continue
                            
                            # Update with calculated metrics for meaningful trades
                            final_update = {
                                'return_pct': round(return_pct, 4),
                                'return_absolute': round(return_absolute, 4),
                                'days_held': days_held,
                                'is_winner': is_winner
                            }
                            
                            self.database_service.client.table('signal_performance').update(
                                final_update
                            ).eq('id', record['id']).execute()
                            
                            logger.debug(f"Closed performance tracking for {symbol}: {return_pct:.2f}% return in {days_held} days")
                    
                    closed_count += 1
                else:
                    logger.debug(f"No active performance tracking found for {symbol}")
                    
            except Exception as e:
                logger.error(f"Error closing performance tracking for {symbol}: {e}")
        
        if closed_count > 0:
            logger.info(f"Closed performance tracking for {closed_count} ended signals")
        
        return closed_count
    
    async def cleanup_meaningless_trades(self) -> int:
        """Clean up existing meaningless trades (same day, no price change)."""
        if not self.database_service.is_available():
            return 0
        
        try:
            # Get all closed performance records
            response = self.database_service.client.table('signal_performance').select(
                'id, symbol, entry_date, exit_date, return_pct, days_held'
            ).eq('status', 'CLOSED').execute()
            
            deleted_count = 0
            
            for record in response.data:
                days_held = record.get('days_held', 0)
                return_pct = record.get('return_pct', 0)
                
                # Check if this is a meaningless trade
                is_short_hold = days_held <= 1  # 0 or 1 day
                is_minimal_change = abs(return_pct) < 0.1  # Less than 0.1% change
                
                if is_short_hold and is_minimal_change:
                    # Delete this meaningless record
                    delete_response = self.database_service.client.table('signal_performance').delete().eq(
                        'id', record['id']
                    ).execute()
                    
                    if delete_response.data:
                        deleted_count += 1
                        logger.debug(f"Deleted meaningless trade record for {record['symbol']}")
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} meaningless trade records")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up meaningless trades: {e}")
            return 0
    
    def _should_track_signal(self, signal: AnalysisResult) -> bool:
        """Determine if a signal should be tracked for performance."""
        # Check if signal has minimum score threshold (main criteria)
        if signal.overall_score < 0.6:  # Only track higher quality signals
            return False
        
        # Check if signal has a valid recommendation (from squeeze_signal)
        valid_recommendations = ['STRONG_BUY', 'BUY', 'WATCH']
        recommendation = getattr(signal.squeeze_signal, 'recommendation', None)
        if recommendation and recommendation not in valid_recommendations:
            return False
        
        # Always track signals that meet the score threshold
        return True
    
    async def _get_signal_id(self, symbol: str, scan_date: date) -> Optional[str]:
        """Get the database ID for a signal."""
        try:
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'id'
            ).eq('symbol', symbol).eq('scan_date', scan_date.isoformat()).order(
                'created_at', desc=True
            ).limit(1).execute()
            
            if response.data:
                return response.data[0]['id']
        except Exception as e:
            logger.error(f"Error getting signal ID for {symbol}: {e}")
        
        return None
    
    async def _get_current_price(self, symbol: str, scan_date: date) -> Optional[Decimal]:
        """Get the current/exit price for a symbol."""
        try:
            # Get the most recent price from the signals table
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'close_price'
            ).eq('symbol', symbol).eq('scan_date', scan_date.isoformat()).order(
                'updated_at', desc=True
            ).limit(1).execute()
            
            if response.data:
                return Decimal(str(response.data[0]['close_price']))
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
        
        return None
    
    def _prepare_performance_data(self, signal: AnalysisResult, signal_id: str, scan_date: date) -> Dict:
        """Prepare performance tracking data for database insertion."""
        squeeze_signal = signal.squeeze_signal
        
        # Get entry price - ensure it's valid
        entry_price = None
        if hasattr(squeeze_signal, 'close_price') and squeeze_signal.close_price:
            entry_price = float(squeeze_signal.close_price)
        elif hasattr(signal, 'current_price') and signal.current_price:
            entry_price = float(signal.current_price)
        
        if not entry_price or entry_price <= 0:
            logger.warning(f"Invalid entry price for {signal.symbol}: {entry_price}")
            entry_price = 1.0  # Fallback to avoid null values
        
        # Calculate profit target (simple 10% above entry)
        profit_target = entry_price * 1.1 if entry_price > 0 else None
        
        # Calculate initial risk percentage
        stop_loss_price = None
        if hasattr(signal, 'stop_loss_level') and signal.stop_loss_level:
            stop_loss_price = float(signal.stop_loss_level)
        
        initial_risk_pct = None
        if stop_loss_price and entry_price > stop_loss_price:
            initial_risk_pct = (entry_price - stop_loss_price) / entry_price * 100
        
        # Get recommendation
        recommendation = getattr(signal, 'recommendation', 'WATCH')
        
        return {
            'signal_id': signal_id,
            'symbol': signal.symbol,
            'entry_date': scan_date.isoformat(),
            'entry_price': entry_price,
            'entry_score': float(signal.overall_score),
            'entry_recommendation': recommendation,
            'stop_loss_price': stop_loss_price,
            'profit_target_price': profit_target,
            'initial_risk_pct': initial_risk_pct,
            'bb_width_percentile': float(squeeze_signal.bb_width_percentile) if squeeze_signal.bb_width_percentile else None,
            'squeeze_category': self._categorize_squeeze(squeeze_signal.bb_width_percentile) if squeeze_signal.bb_width_percentile else 'Normal',
            'trend_direction': getattr(squeeze_signal, 'trend_direction', 'unknown'),
            'market_regime': getattr(signal, 'market_regime', 'unknown'),
            'status': 'ACTIVE'
        }
    
    def _categorize_squeeze(self, bb_width_percentile: float) -> str:
        """Categorize squeeze tightness."""
        if bb_width_percentile <= 5:
            return 'Extremely Tight'
        elif bb_width_percentile <= 15:
            return 'Very Tight'
        elif bb_width_percentile <= 30:
            return 'Tight'
        else:
            return 'Normal'
    
    async def get_performance_summary(self) -> Dict:
        """Get a summary of current performance tracking."""
        if not self.database_service.is_available():
            return {}
        
        try:
            # Get performance dashboard view
            response = self.database_service.client.table('performance_dashboard').select('*').execute()
            
            if response.data:
                return response.data[0]
            else:
                # Fallback: calculate basic metrics
                return await self._calculate_basic_metrics()
                
        except Exception as e:
            logger.error(f"Error getting performance summary: {e}")
            return {}
    
    async def _calculate_basic_metrics(self) -> Dict:
        """Calculate basic performance metrics as fallback."""
        try:
            # Get all performance records
            response = self.database_service.client.table('signal_performance').select(
                'status, return_pct, is_winner, days_held'
            ).execute()
            
            if not response.data:
                return {'total_signals': 0, 'active_signals': 0, 'closed_signals': 0}
            
            records = response.data
            total_signals = len(records)
            active_signals = len([r for r in records if r.get('status') == 'ACTIVE'])
            closed_signals = len([r for r in records if r.get('status') == 'CLOSED'])
            
            # Calculate metrics for closed signals only
            closed_records = [r for r in records if r.get('status') == 'CLOSED' and r.get('return_pct') is not None]
            
            if closed_records:
                avg_return = sum(float(r['return_pct']) for r in closed_records) / len(closed_records)
                win_rate = sum(1 for r in closed_records if r.get('is_winner')) / len(closed_records) * 100
                avg_days_held = sum(int(r.get('days_held', 0)) for r in closed_records) / len(closed_records)
            else:
                avg_return = 0
                win_rate = 0
                avg_days_held = 0
            
            return {
                'total_signals': total_signals,
                'active_signals': active_signals,
                'closed_signals': closed_signals,
                'avg_return_all': round(avg_return, 2),
                'win_rate_all': round(win_rate, 1),
                'avg_days_held': round(avg_days_held, 1)
            }
            
        except Exception as e:
            logger.error(f"Error calculating basic metrics: {e}")
            return {}
