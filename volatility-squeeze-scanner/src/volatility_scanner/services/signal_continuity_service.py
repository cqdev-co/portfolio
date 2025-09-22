"""Signal continuity tracking service for volatility squeeze scanner."""

from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Optional, Set
from loguru import logger

from volatility_scanner.models.analysis import AnalysisResult, SignalStatus
from volatility_scanner.services.database_service import DatabaseService


class SignalContinuityService:
    """Service for tracking signal continuity across daily scans."""
    
    def __init__(self, database_service: DatabaseService):
        """Initialize the signal continuity service."""
        self.database_service = database_service
    
    async def process_signals_with_continuity(
        self,
        new_signals: List[AnalysisResult],
        scan_date: date = None
    ) -> List[AnalysisResult]:
        """
        Process new signals and determine their continuity status.
        
        Args:
            new_signals: List of newly detected signals
            scan_date: Date of the current scan (defaults to today)
            
        Returns:
            List of signals with updated continuity status
        """
        if not self.database_service.is_available():
            logger.warning("Database service not available, skipping continuity tracking")
            return new_signals
        
        if scan_date is None:
            scan_date = date.today()
        
        logger.info(f"Processing {len(new_signals)} signals for continuity tracking on {scan_date}")
        
        # Get symbols from new signals
        new_signal_symbols = {signal.symbol for signal in new_signals}
        
        # Get active signals from previous scans (within last 7 days including today)
        previous_signals = await self._get_recent_active_signals(
            days_back=7,
            end_date=scan_date,  # Include today to check for same-day continuation
            exclude_recent_hours=2  # Exclude very recent signals (within 2 hours)
        )
        
        # Group previous signals by symbol (get most recent for each symbol)
        previous_by_symbol = {}
        for signal in previous_signals:
            symbol = signal['symbol']
            signal_date = signal['last_active_date']
            
            # Convert string date to date object if needed
            if isinstance(signal_date, str):
                signal_date = datetime.fromisoformat(signal_date).date()
            
            # Also convert the comparison date to ensure consistent types
            existing_date = previous_by_symbol[symbol]['last_active_date'] if symbol in previous_by_symbol else None
            if existing_date and isinstance(existing_date, str):
                existing_date = datetime.fromisoformat(existing_date).date()
            
            if symbol not in previous_by_symbol or signal_date > existing_date:
                previous_by_symbol[symbol] = signal
        
        # Mark signals that have ended (were active yesterday but not today)
        await self._mark_ended_signals(
            previous_by_symbol,
            new_signal_symbols,
            scan_date
        )
        
        # Process new signals for continuity
        processed_signals = []
        for signal in new_signals:
            processed_signal = await self._determine_signal_status(
                signal,
                previous_by_symbol.get(signal.symbol),
                scan_date
            )
            processed_signals.append(processed_signal)
        
        logger.info(
            f"Continuity processing complete: "
            f"{len([s for s in processed_signals if s.squeeze_signal.signal_status == SignalStatus.NEW])} new, "
            f"{len([s for s in processed_signals if s.squeeze_signal.signal_status == SignalStatus.CONTINUING])} continuing"
        )
        
        return processed_signals
    
    async def _get_recent_active_signals(
        self,
        days_back: int = 7,
        end_date: date = None,
        exclude_recent_hours: int = 0
    ) -> List[Dict]:
        """Get active signals from recent days."""
        if not self.database_service.is_available():
            return []
        
        if end_date is None:
            end_date = date.today() - timedelta(days=1)
        
        start_date = end_date - timedelta(days=days_back)
        
        try:
            # Query for active signals in the date range
            query = self.database_service.client.table('volatility_squeeze_signals').select(
                'symbol, signal_status, days_in_squeeze, first_detected_date, '
                'last_active_date, scan_date, overall_score, created_at'
            ).gte(
                'scan_date', start_date.isoformat()
            ).lte(
                'scan_date', end_date.isoformat()
            ).in_(
                'signal_status', ['NEW', 'CONTINUING']
            ).order('created_at', desc=True)
            
            response = query.execute()
            signals = response.data if response.data else []
            
            # Filter out very recent signals if requested
            if exclude_recent_hours > 0:
                cutoff_time = datetime.now(timezone.utc) - timedelta(hours=exclude_recent_hours)
                filtered_signals = []
                for signal in signals:
                    created_at = datetime.fromisoformat(signal['created_at'].replace('Z', '+00:00'))
                    if created_at < cutoff_time:
                        filtered_signals.append(signal)
                signals = filtered_signals
            
            return signals
            
        except Exception as e:
            logger.error(f"Error retrieving recent active signals: {e}")
            return []
    
    async def _mark_ended_signals(
        self,
        previous_by_symbol: Dict,
        current_symbols: Set[str],
        scan_date: date
    ) -> None:
        """Mark signals as ended if they were active yesterday but not today."""
        ended_symbols = set(previous_by_symbol.keys()) - current_symbols
        
        if not ended_symbols:
            return
        
        logger.info(f"Marking {len(ended_symbols)} signals as ended: {list(ended_symbols)}")
        
        try:
            # Update ended signals in database
            for symbol in ended_symbols:
                previous_signal = previous_by_symbol[symbol]
                
                # Only mark as ended if it was active yesterday
                last_active = previous_signal['last_active_date']
                if isinstance(last_active, str):
                    last_active = datetime.fromisoformat(last_active).date()
                
                # If signal was active within the last 2 days, mark as ended
                if (scan_date - last_active).days <= 2:
                    update_data = {
                        'signal_status': SignalStatus.ENDED.value,
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    # Update the most recent signal for this symbol
                    self.database_service.client.table('volatility_squeeze_signals').update(
                        update_data
                    ).eq('symbol', symbol).eq(
                        'last_active_date', last_active.isoformat()
                    ).execute()
            
        except Exception as e:
            logger.error(f"Error marking ended signals: {e}")
    
    async def _determine_signal_status(
        self,
        current_signal: AnalysisResult,
        previous_signal: Optional[Dict],
        scan_date: date
    ) -> AnalysisResult:
        """Determine the continuity status of a signal."""
        symbol = current_signal.symbol
        squeeze_signal = current_signal.squeeze_signal
        
        if previous_signal is None:
            # This is a brand new signal
            squeeze_signal.signal_status = SignalStatus.NEW
            squeeze_signal.days_in_squeeze = 1
            squeeze_signal.first_detected_date = scan_date
            squeeze_signal.last_active_date = scan_date
            
            logger.debug(f"New signal detected for {symbol}")
            
        else:
            # This symbol had a previous signal - determine if it's continuing
            previous_last_active = previous_signal['last_active_date']
            if isinstance(previous_last_active, str):
                previous_last_active = datetime.fromisoformat(previous_last_active).date()
            
            previous_scan_date = previous_signal['scan_date']
            if isinstance(previous_scan_date, str):
                previous_scan_date = datetime.fromisoformat(previous_scan_date).date()
            
            # Calculate gaps based on scan dates (more accurate for same-day detection)
            days_gap = (scan_date - previous_scan_date).days
            
            # More permissive continuation logic
            if days_gap == 0:
                # Same day - this is definitely continuing
                squeeze_signal.signal_status = SignalStatus.CONTINUING
                squeeze_signal.days_in_squeeze = previous_signal.get('days_in_squeeze', 1)
                continuation_reason = "same day"
            elif days_gap <= 3:  # Allow up to 3 day gap for weekends/holidays
                # Multi-day continuation
                squeeze_signal.signal_status = SignalStatus.CONTINUING
                squeeze_signal.days_in_squeeze = previous_signal.get('days_in_squeeze', 1) + days_gap
                continuation_reason = f"{days_gap} day gap"
            else:
                # Gap is too large, treat as new signal
                squeeze_signal.signal_status = SignalStatus.NEW
                squeeze_signal.days_in_squeeze = 1
                squeeze_signal.first_detected_date = scan_date
                squeeze_signal.last_active_date = scan_date
                
                logger.debug(f"Gap too large for {symbol} ({days_gap} days), treating as new signal")
                return current_signal
            
            # For continuing signals, preserve first detected date
            first_detected = previous_signal.get('first_detected_date')
            if isinstance(first_detected, str):
                first_detected = datetime.fromisoformat(first_detected).date()
            squeeze_signal.first_detected_date = first_detected
            
            squeeze_signal.last_active_date = scan_date
            
            logger.debug(
                f"Continuing signal for {symbol} "
                f"(day {squeeze_signal.days_in_squeeze}, {continuation_reason})"
            )
        
        return current_signal
    
    async def get_signal_history(
        self,
        symbol: str,
        days_back: int = 30
    ) -> List[Dict]:
        """Get signal history for a specific symbol."""
        if not self.database_service.is_available():
            return []
        
        try:
            end_date = date.today()
            start_date = end_date - timedelta(days=days_back)
            
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                '*'
            ).eq(
                'symbol', symbol
            ).gte(
                'scan_date', start_date.isoformat()
            ).order('scan_date', desc=True).execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error retrieving signal history for {symbol}: {e}")
            return []
    
    async def get_continuity_summary(self, scan_date: date = None) -> Dict:
        """Get a summary of signal continuity for a given date."""
        if not self.database_service.is_available():
            return {}
        
        if scan_date is None:
            scan_date = date.today()
        
        try:
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'signal_status, symbol, days_in_squeeze, overall_score'
            ).eq(
                'scan_date', scan_date.isoformat()
            ).execute()
            
            if not response.data:
                return {}
            
            signals = response.data
            
            summary = {
                'scan_date': scan_date.isoformat(),
                'total_signals': len(signals),
                'new_signals': len([s for s in signals if s['signal_status'] == 'NEW']),
                'continuing_signals': len([s for s in signals if s['signal_status'] == 'CONTINUING']),
                'avg_days_in_squeeze': sum(s.get('days_in_squeeze', 1) for s in signals) / len(signals),
                'longest_squeeze': max(s.get('days_in_squeeze', 1) for s in signals) if signals else 0,
                'avg_score': sum(s.get('overall_score', 0) for s in signals) / len(signals) if signals else 0
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting continuity summary: {e}")
            return {}
