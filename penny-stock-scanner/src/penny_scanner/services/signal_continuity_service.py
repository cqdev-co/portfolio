"""Signal continuity service for tracking penny stock signals across multiple scans."""

from datetime import date, timedelta
from typing import List, Dict, Optional
from loguru import logger

from penny_scanner.models.analysis import AnalysisResult, SignalStatus
from penny_scanner.services.database_service import DatabaseService


class SignalContinuityService:
    """
    Service for tracking signal continuity across multiple scan dates.
    Determines if signals are NEW, CONTINUING, or ENDED.
    """
    
    def __init__(self, database_service: DatabaseService):
        """Initialize signal continuity service."""
        self.database_service = database_service
    
    async def process_signals_with_continuity(
        self,
        current_signals: List[AnalysisResult],
        scan_date: date
    ) -> List[AnalysisResult]:
        """
        Process signals and determine continuity status.
        
        Compares today's signals with yesterday's to determine:
        - NEW: First time appearing
        - CONTINUING: Appeared yesterday and today
        - Days tracking: How many consecutive days signal has been active
        
        Args:
            current_signals: Today's analysis results
            scan_date: Date of current scan
            
        Returns:
            Analysis results with updated continuity status
        """
        if not self.database_service.is_available():
            logger.warning("Database unavailable, skipping continuity tracking")
            return current_signals
        
        try:
            # Get yesterday's signals
            yesterday = scan_date - timedelta(days=1)
            yesterday_signals = await self.database_service.get_signals_by_date(
                yesterday
            )
            
            # Build lookup dictionary for yesterday's signals
            yesterday_lookup = {
                signal['symbol']: signal 
                for signal in yesterday_signals
            }
            
            logger.info(
                f"Processing continuity: {len(current_signals)} current, "
                f"{len(yesterday_signals)} from yesterday"
            )
            
            # Update each signal's continuity status
            updated_signals = []
            new_count = 0
            continuing_count = 0
            
            for result in current_signals:
                symbol = result.symbol
                
                if symbol in yesterday_lookup:
                    # Signal was present yesterday - CONTINUING
                    yesterday_signal = yesterday_lookup[symbol]
                    yesterday_days = yesterday_signal.get('days_active', 0)
                    
                    result.explosion_signal.signal_status = SignalStatus.CONTINUING
                    result.explosion_signal.days_active = yesterday_days + 1
                    
                    continuing_count += 1
                    
                    logger.debug(
                        f"{symbol}: CONTINUING (day {result.explosion_signal.days_active})"
                    )
                else:
                    # Signal is new today - NEW
                    result.explosion_signal.signal_status = SignalStatus.NEW
                    result.explosion_signal.days_active = 1
                    
                    new_count += 1
                    
                    logger.debug(f"{symbol}: NEW signal")
                
                updated_signals.append(result)
            
            logger.info(
                f"Continuity tracking complete: {new_count} NEW, "
                f"{continuing_count} CONTINUING"
            )
            
            # Track ended signals (present yesterday but not today)
            await self._track_ended_signals(
                current_signals,
                yesterday_signals,
                scan_date
            )
            
            return updated_signals
            
        except Exception as e:
            logger.error(f"Error processing signal continuity: {e}")
            # Return original signals if continuity processing fails
            return current_signals
    
    async def _track_ended_signals(
        self,
        current_signals: List[AnalysisResult],
        yesterday_signals: List[Dict],
        scan_date: date
    ) -> None:
        """
        Track signals that have ended (present yesterday but not today).
        
        Note: For penny stocks, we don't store ENDED signals as separate records.
        The absence of a signal on a given date indicates it has ended.
        This is tracked implicitly through the database.
        
        Args:
            current_signals: Today's signals
            yesterday_signals: Yesterday's signals
            scan_date: Current scan date
        """
        current_symbols = {signal.symbol for signal in current_signals}
        yesterday_symbols = {signal['symbol'] for signal in yesterday_signals}
        
        ended_symbols = yesterday_symbols - current_symbols
        
        if ended_symbols:
            logger.info(
                f"Signals ended today: {len(ended_symbols)} symbols no longer "
                f"meeting criteria"
            )
            logger.debug(f"Ended signals: {', '.join(sorted(ended_symbols)[:10])}")
    
    async def get_signal_history(
        self,
        symbol: str,
        days_back: int = 7
    ) -> List[Dict]:
        """
        Get historical signals for a specific symbol.
        
        Args:
            symbol: Stock symbol
            days_back: Number of days to look back
            
        Returns:
            List of historical signals (most recent first)
        """
        if not self.database_service.is_available():
            return []
        
        try:
            # Get signals for the last N days
            history = []
            today = date.today()
            
            for i in range(days_back):
                check_date = today - timedelta(days=i)
                signal = await self.database_service.get_signal_by_symbol_date(
                    symbol,
                    check_date
                )
                
                if signal:
                    history.append(signal)
            
            return history
            
        except Exception as e:
            logger.error(f"Error fetching signal history for {symbol}: {e}")
            return []
    
    async def get_longest_running_signals(
        self,
        scan_date: date,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get signals with the most consecutive days active.
        
        Args:
            scan_date: Date to query
            limit: Maximum number of signals to return
            
        Returns:
            List of signals ordered by days_active (descending)
        """
        if not self.database_service.is_available():
            return []
        
        try:
            signals = await self.database_service.get_signals_by_date(scan_date)
            
            # Sort by days_active descending
            signals.sort(key=lambda x: x.get('days_active', 0), reverse=True)
            
            return signals[:limit]
            
        except Exception as e:
            logger.error(f"Error fetching longest running signals: {e}")
            return []
    
    async def get_continuity_stats(
        self,
        scan_date: date
    ) -> Dict[str, int]:
        """
        Get continuity statistics for a scan date.
        
        Args:
            scan_date: Date to analyze
            
        Returns:
            Dictionary with continuity statistics
        """
        if not self.database_service.is_available():
            return {}
        
        try:
            signals = await self.database_service.get_signals_by_date(scan_date)
            
            stats = {
                'total_signals': len(signals),
                'new_signals': len([
                    s for s in signals 
                    if s.get('signal_status') == 'NEW'
                ]),
                'continuing_signals': len([
                    s for s in signals 
                    if s.get('signal_status') == 'CONTINUING'
                ]),
                'avg_days_active': 0,
                'max_days_active': 0
            }
            
            if signals:
                days_active_list = [
                    s.get('days_active', 0) for s in signals
                ]
                stats['avg_days_active'] = (
                    sum(days_active_list) / len(days_active_list)
                )
                stats['max_days_active'] = max(days_active_list)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating continuity stats: {e}")
            return {}

