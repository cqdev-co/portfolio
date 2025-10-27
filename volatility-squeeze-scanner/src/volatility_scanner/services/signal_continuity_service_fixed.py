"""Fixed Signal continuity tracking service for volatility squeeze scanner."""

from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Optional, Set, Tuple
from loguru import logger

from volatility_scanner.models.analysis import AnalysisResult, SignalStatus
from volatility_scanner.services.database_service import DatabaseService


class SignalContinuityService:
    """Service for tracking signal continuity across daily scans."""
    
    def __init__(self, database_service: DatabaseService, performance_tracking_service=None):
        """Initialize the signal continuity service."""
        self.database_service = database_service
        self.performance_tracking_service = performance_tracking_service
    
    async def process_signals_with_continuity(
        self,
        new_signals: List[AnalysisResult],
        scan_date: date = None
    ) -> List[AnalysisResult]:
        """
        Process new signals and determine their continuity status.
        
        FIXED LOGIC:
        1. Check if each signal exists in the database for today's scan_date
        2. If exists for today, update it (don't create duplicate)
        3. If doesn't exist for today, check if it existed recently (within 3 days)
        4. If existed recently, mark as CONTINUING with proper days calculation
        5. If never existed or gap too large, mark as NEW
        6. Mark signals that were active recently but not in current scan as ENDED
        
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
        
        # Get existing signals for today (to avoid duplicates)
        today_signals = await self._get_signals_for_date(scan_date)
        today_signals_by_symbol = {s['symbol']: s for s in today_signals}
        
        # Get recent active signals (excluding today to avoid confusion)
        previous_signals = await self._get_recent_active_signals(
            days_back=7,
            end_date=scan_date - timedelta(days=1)  # Exclude today
        )
        
        # Group previous signals by symbol (get most recent for each symbol)
        previous_by_symbol = {}
        for signal in previous_signals:
            symbol = signal['symbol']
            signal_date = signal['last_active_date']
            
            # Convert string date to date object if needed
            if isinstance(signal_date, str):
                signal_date = datetime.fromisoformat(signal_date).date()
            
            # Keep the most recent signal for each symbol
            if symbol not in previous_by_symbol:
                previous_by_symbol[symbol] = signal
            else:
                existing_date = previous_by_symbol[symbol]['last_active_date']
                if isinstance(existing_date, str):
                    existing_date = datetime.fromisoformat(existing_date).date()
                
                if signal_date > existing_date:
                    previous_by_symbol[symbol] = signal
        
        # Mark signals that have ended (were active recently but not in current scan)
        ended_symbols = await self._mark_ended_signals(
            previous_by_symbol,
            new_signal_symbols,
            scan_date
        )
        
        # Process new signals for continuity
        processed_signals = []
        for signal in new_signals:
            # Check if this signal already exists for today
            existing_today = today_signals_by_symbol.get(signal.symbol)
            previous_signal = previous_by_symbol.get(signal.symbol)
            
            if existing_today:
                # Update existing signal for today
                processed_signal = await self._update_existing_signal_with_continuity(
                    signal,
                    existing_today,
                    previous_signal,
                    scan_date
                )
            else:
                # Determine status for new database entry
                processed_signal = await self._determine_signal_status(
                    signal,
                    previous_signal,
                    scan_date
                )
            
            processed_signals.append(processed_signal)
        
        # Track performance for new and ended signals
        if self.performance_tracking_service:
            try:
                # Track new signals for performance
                new_signals_list = [s for s in processed_signals if s.squeeze_signal.signal_status == SignalStatus.NEW]
                if new_signals_list:
                    await self.performance_tracking_service.track_new_signals(new_signals_list, scan_date)
                
                # Close performance tracking for ended signals
                if ended_symbols:
                    await self.performance_tracking_service.close_ended_signals(ended_symbols, scan_date)
                    
            except Exception as e:
                logger.warning(f"Performance tracking failed: {e}")
        
        logger.info(
            f"Continuity processing complete: "
            f"{len([s for s in processed_signals if s.squeeze_signal.signal_status == SignalStatus.NEW])} new, "
            f"{len([s for s in processed_signals if s.squeeze_signal.signal_status == SignalStatus.CONTINUING])} continuing"
        )
        
        return processed_signals
    
    async def _get_signals_for_date(self, target_date: date) -> List[Dict]:
        """Get all signals for a specific date."""
        if not self.database_service.is_available():
            return []
        
        try:
            response = self.database_service.client.table('volatility_squeeze_signals').select(
                'id, symbol, signal_status, days_in_squeeze, first_detected_date, '
                'last_active_date, scan_date, overall_score, created_at, updated_at'
            ).eq(
                'scan_date', target_date.isoformat()
            ).execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error retrieving signals for date {target_date}: {e}")
            return []
    
    async def _update_existing_signal_with_continuity(
        self,
        current_signal: AnalysisResult,
        existing_signal: Dict,
        previous_signal: Optional[Dict],
        scan_date: date
    ) -> AnalysisResult:
        """
        Update an existing signal for today, determining the correct status based on continuity logic.
        FIXED: Properly handle status transitions and days_in_squeeze calculations.
        """
        symbol = current_signal.symbol
        squeeze_signal = current_signal.squeeze_signal
        
        # Check if the existing signal is from a previous run (different created_at time)
        existing_created_at = existing_signal.get('created_at')
        existing_updated_at = existing_signal.get('updated_at')
        
        # If updated_at is different from created_at, this signal has been seen in multiple runs
        is_from_previous_run = existing_updated_at != existing_created_at
        
        # FIXED LOGIC: Determine proper status based on whether this is truly the first occurrence
        if previous_signal and not is_from_previous_run:
            # This signal has a history and this is the first time we're seeing it today
            # Calculate proper days_in_squeeze based on date progression
            previous_last_active = previous_signal['last_active_date']
            if isinstance(previous_last_active, str):
                previous_last_active = datetime.fromisoformat(previous_last_active).date()
            
            days_gap = (scan_date - previous_last_active).days
            
            if days_gap <= 3:  # Allow up to 3 day gap for weekends/holidays
                # This is a continuation
                squeeze_signal.signal_status = SignalStatus.CONTINUING
                
                # FIXED: Calculate days_in_squeeze based on first_detected_date, not previous days
                first_detected = previous_signal.get('first_detected_date')
                if first_detected:
                    if isinstance(first_detected, str):
                        first_detected = datetime.fromisoformat(first_detected).date()
                    # Calculate total days from first detection to current scan
                    squeeze_signal.days_in_squeeze = (scan_date - first_detected).days + 1
                    squeeze_signal.first_detected_date = first_detected
                else:
                    # Fallback if no first_detected_date
                    squeeze_signal.days_in_squeeze = days_gap + 1
                    squeeze_signal.first_detected_date = previous_last_active
                
                squeeze_signal.last_active_date = scan_date
                
                logger.debug(
                    f"Updating signal for {symbol} - CONTINUING "
                    f"(day {squeeze_signal.days_in_squeeze}, {days_gap} day gap from {previous_last_active})"
                )
            else:
                # Gap too large, treat as new
                squeeze_signal.signal_status = SignalStatus.NEW
                squeeze_signal.days_in_squeeze = 1
                squeeze_signal.first_detected_date = scan_date
                squeeze_signal.last_active_date = scan_date
                
                logger.debug(f"Gap too large for {symbol} ({days_gap} days), treating as new signal")
        else:
            # This is either a brand new signal or same-day update
            existing_status = existing_signal.get('signal_status', 'NEW')
            
            if existing_status == 'NEW':
                # Preserve NEW status for same-day updates
                squeeze_signal.signal_status = SignalStatus.NEW
                squeeze_signal.days_in_squeeze = 1
                squeeze_signal.first_detected_date = scan_date
            else:
                # Preserve existing status for same-day updates
                squeeze_signal.signal_status = SignalStatus(existing_status)
                squeeze_signal.days_in_squeeze = existing_signal.get('days_in_squeeze', 1)
                
                # Preserve first detected date
                first_detected = existing_signal.get('first_detected_date')
                if first_detected:
                    if isinstance(first_detected, str):
                        first_detected = datetime.fromisoformat(first_detected).date()
                    squeeze_signal.first_detected_date = first_detected
            
            squeeze_signal.last_active_date = scan_date
            
            logger.debug(f"Updating existing signal for {symbol} (preserving status: {existing_status})")
        
        # Mark this signal for database update rather than insert
        current_signal._existing_db_id = existing_signal.get('id')
        
        return current_signal
    
    async def _get_recent_active_signals(
        self,
        days_back: int = 7,
        end_date: date = None
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
                'last_active_date, scan_date, overall_score, created_at, updated_at'
            ).gte(
                'scan_date', start_date.isoformat()
            ).lte(
                'scan_date', end_date.isoformat()
            ).in_(
                'signal_status', ['NEW', 'CONTINUING']
            ).order('last_active_date', desc=True)
            
            response = query.execute()
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error retrieving recent active signals: {e}")
            return []
    
    async def _mark_ended_signals(
        self,
        previous_by_symbol: Dict,
        current_symbols: Set[str],
        scan_date: date
    ) -> List[str]:
        """Mark signals as ended if they were active recently but not in current scan."""
        ended_symbols = set(previous_by_symbol.keys()) - current_symbols
        
        if not ended_symbols:
            return []
        
        logger.info(f"Marking {len(ended_symbols)} signals as ended: {list(ended_symbols)}")
        
        try:
            # Update ended signals in database
            for symbol in ended_symbols:
                previous_signal = previous_by_symbol[symbol]
                
                # Only mark as ended if it was active recently (within last 3 days)
                last_active = previous_signal['last_active_date']
                if isinstance(last_active, str):
                    last_active = datetime.fromisoformat(last_active).date()
                
                days_since_active = (scan_date - last_active).days
                
                # If signal was active within the last 3 days, mark as ended
                if days_since_active <= 3:
                    update_data = {
                        'signal_status': SignalStatus.ENDED.value,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Update the most recent active signal for this symbol
                    # Use scan_date to target the specific entry
                    scan_date_str = previous_signal.get('scan_date')
                    if isinstance(scan_date_str, str):
                        result = self.database_service.client.table('volatility_squeeze_signals').update(
                            update_data
                        ).eq('symbol', symbol).eq(
                            'scan_date', scan_date_str
                        ).in_('signal_status', ['NEW', 'CONTINUING']).execute()
                        
                        if result.data:
                            logger.debug(f"Marked {symbol} as ENDED (last active: {last_active})")
            
        except Exception as e:
            logger.error(f"Error marking ended signals: {e}")
        
        return list(ended_symbols)
    
    async def _determine_signal_status(
        self,
        current_signal: AnalysisResult,
        previous_signal: Optional[Dict],
        scan_date: date
    ) -> AnalysisResult:
        """
        Determine the continuity status of a signal.
        
        FIXED LOGIC:
        - If no previous signal exists, mark as NEW
        - If previous signal exists and gap <= 3 days, mark as CONTINUING with proper days calculation
        - If previous signal exists but gap > 3 days, mark as NEW (fresh start)
        """
        symbol = current_signal.symbol
        squeeze_signal = current_signal.squeeze_signal
        
        if previous_signal is None:
            # This is a brand new signal - never seen before
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
            
            # Calculate gap from last active date to current scan date
            days_gap = (scan_date - previous_last_active).days
            
            if days_gap <= 3:  # Allow up to 3 day gap for weekends/holidays
                # This is a continuation of the previous signal
                squeeze_signal.signal_status = SignalStatus.CONTINUING
                
                # FIXED: Calculate days_in_squeeze based on first_detected_date, not adding to previous
                first_detected = previous_signal.get('first_detected_date')
                if first_detected:
                    if isinstance(first_detected, str):
                        first_detected = datetime.fromisoformat(first_detected).date()
                    # Calculate total days from first detection to current scan
                    squeeze_signal.days_in_squeeze = (scan_date - first_detected).days + 1
                    squeeze_signal.first_detected_date = first_detected
                else:
                    # Fallback if no first_detected_date in previous signal
                    squeeze_signal.days_in_squeeze = days_gap + 1
                    squeeze_signal.first_detected_date = previous_last_active
                
                squeeze_signal.last_active_date = scan_date
                
                logger.debug(
                    f"Continuing signal for {symbol} "
                    f"(day {squeeze_signal.days_in_squeeze}, {days_gap} day gap, first detected: {squeeze_signal.first_detected_date})"
                )
            else:
                # Gap is too large, treat as a completely new signal
                squeeze_signal.signal_status = SignalStatus.NEW
                squeeze_signal.days_in_squeeze = 1
                squeeze_signal.first_detected_date = scan_date
                squeeze_signal.last_active_date = scan_date
                
                logger.debug(f"Gap too large for {symbol} ({days_gap} days), treating as new signal")
        
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
