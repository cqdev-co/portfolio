"""Database service for storing and retrieving penny stock signals."""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from supabase import create_client, Client

from penny_scanner.models.analysis import AnalysisResult
from penny_scanner.config.settings import Settings
from penny_scanner.core.exceptions import DatabaseError


class DatabaseService:
    """Service for database operations with Supabase."""
    
    def __init__(self, settings: Settings):
        """Initialize database service."""
        self.settings = settings
        self.client: Optional[Client] = None
        
        if settings.is_database_enabled():
            try:
                self.client = create_client(
                    settings.supabase_url,
                    settings.supabase_service_role_key
                )
                logger.info("Database service connected to Supabase")
            except Exception as e:
                logger.error(f"Failed to connect to database: {e}")
    
    def is_available(self) -> bool:
        """Check if database service is available."""
        return self.client is not None
    
    async def store_signal(
        self,
        result: AnalysisResult,
        scan_date: date
    ) -> bool:
        """
        Store a penny stock signal in the database.
        
        Args:
            result: Analysis result to store
            scan_date: Date of the scan
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            logger.warning("Database not available, skipping storage")
            return False
        
        try:
            signal_data = self._convert_to_db_format(result, scan_date)
            
            # Upsert (insert or update if exists)
            response = self.client.table('penny_stock_signals').upsert(
                signal_data,
                on_conflict='symbol,scan_date'
            ).execute()
            
            logger.debug(
                f"Stored signal for {result.symbol} on {scan_date}"
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Error storing signal for {result.symbol}: {e}"
            )
            return False
    
    async def store_signals_batch(
        self,
        results: List[AnalysisResult],
        scan_date: date
    ) -> int:
        """
        Store multiple signals in batch.
        
        Args:
            results: List of analysis results
            scan_date: Date of the scan
            
        Returns:
            Number of successfully stored signals
        """
        if not self.is_available():
            logger.warning("Database not available, skipping storage")
            return 0
        
        if not results:
            return 0
        
        try:
            # Convert all results to database format
            signal_data_list = [
                self._convert_to_db_format(result, scan_date)
                for result in results
            ]
            
            # Batch upsert
            response = self.client.table('penny_stock_signals').upsert(
                signal_data_list,
                on_conflict='symbol,scan_date'
            ).execute()
            
            count = len(response.data) if response.data else 0
            logger.info(
                f"Stored {count} signals in batch for {scan_date}"
            )
            return count
            
        except Exception as e:
            logger.error(f"Error storing signals batch: {e}")
            return 0
    
    async def get_signals_by_date(
        self,
        scan_date: date
    ) -> List[Dict[str, Any]]:
        """
        Get all signals for a specific date.
        
        Args:
            scan_date: Date to query
            
        Returns:
            List of signal dictionaries
        """
        if not self.is_available():
            return []
        
        try:
            response = self.client.table('penny_stock_signals').select(
                '*'
            ).eq('scan_date', scan_date.isoformat()).order(
                'overall_score', desc=True
            ).execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Error fetching signals by date: {e}")
            return []
    
    async def get_latest_signals(
        self,
        limit: int = 50,
        min_score: Optional[float] = None,
        recommendation: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get latest signals with optional filters.
        
        Args:
            limit: Maximum number of signals
            min_score: Minimum overall score filter
            recommendation: Filter by recommendation
            
        Returns:
            List of signal dictionaries
        """
        if not self.is_available():
            return []
        
        try:
            query = self.client.table('penny_stock_signals').select('*')
            
            if min_score is not None:
                query = query.gte('overall_score', min_score)
            
            if recommendation:
                query = query.eq('recommendation', recommendation.upper())
            
            query = query.order('scan_date', desc=True).order(
                'overall_score', desc=True
            ).limit(limit)
            
            response = query.execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Error fetching latest signals: {e}")
            return []
    
    async def get_signal_by_symbol_date(
        self,
        symbol: str,
        scan_date: date
    ) -> Optional[Dict[str, Any]]:
        """
        Get signal for a specific symbol and date.
        
        Args:
            symbol: Stock symbol
            scan_date: Scan date
            
        Returns:
            Signal dictionary or None
        """
        if not self.is_available():
            return None
        
        try:
            response = self.client.table('penny_stock_signals').select(
                '*'
            ).eq('symbol', symbol.upper()).eq(
                'scan_date', scan_date.isoformat()
            ).execute()
            
            if response.data:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(
                f"Error fetching signal for {symbol} on {scan_date}: {e}"
            )
            return None
    
    async def get_actionable_signals(
        self,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get actionable signals (high quality, recent).
        
        Args:
            limit: Maximum number of signals
            
        Returns:
            List of actionable signal dictionaries
        """
        if not self.is_available():
            return []
        
        try:
            # Query the actionable_penny_signals view
            response = self.client.from_('actionable_penny_signals').select(
                '*'
            ).limit(limit).execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Error fetching actionable signals: {e}")
            return []
    
    def _convert_to_db_format(
        self,
        result: AnalysisResult,
        scan_date: date
    ) -> Dict[str, Any]:
        """Convert AnalysisResult to database format."""
        signal = result.explosion_signal
        
        return {
            'symbol': result.symbol,
            'scan_date': scan_date.isoformat(),
            'close_price': signal.close_price,
            
            # Overall assessment
            'overall_score': result.overall_score,
            'opportunity_rank': result.opportunity_rank.value,
            'recommendation': result.recommendation,
            
            # Component scores
            'volume_score': signal.volume_score,
            'momentum_score': signal.momentum_score,
            'relative_strength_score': signal.relative_strength_score,
            'risk_score': signal.risk_score,
            
            # Volume metrics
            'volume': signal.volume,
            'avg_volume_20d': signal.avg_volume_20d,
            'volume_ratio': signal.volume_ratio,
            'volume_spike_factor': signal.volume_spike_factor,
            'volume_acceleration_2d': signal.volume_acceleration_2d,
            'volume_acceleration_5d': signal.volume_acceleration_5d,
            'volume_consistency_score': signal.volume_consistency_score,
            'dollar_volume': signal.dollar_volume,
            
            # Momentum metrics
            'is_consolidating': signal.is_consolidating,
            'consolidation_days': signal.consolidation_days,
            'consolidation_range_pct': signal.consolidation_range_pct,
            'is_breakout': signal.is_breakout,
            'price_change_5d': signal.price_change_5d,
            'price_change_10d': signal.price_change_10d,
            'price_change_20d': signal.price_change_20d,
            'higher_lows_detected': signal.higher_lows_detected,
            'consecutive_green_days': signal.consecutive_green_days,
            
            # Moving averages
            'ema_20': signal.ema_20,
            'ema_50': signal.ema_50,
            'price_vs_ema20': signal.price_vs_ema20,
            'price_vs_ema50': signal.price_vs_ema50,
            'ema_crossover_signal': signal.ema_crossover_signal,
            
            # Relative strength
            'market_outperformance': signal.market_outperformance,
            'sector_outperformance': signal.sector_outperformance,
            'distance_from_52w_low': signal.distance_from_52w_low,
            'distance_from_52w_high': signal.distance_from_52w_high,
            'breaking_resistance': signal.breaking_resistance,
            
            # Risk metrics
            'bid_ask_spread_pct': signal.bid_ask_spread_pct,
            'avg_spread_5d': signal.avg_spread_5d,
            'float_shares': signal.float_shares,
            'is_low_float': signal.is_low_float,
            'daily_volatility': signal.daily_volatility,
            'atr_20': signal.atr_20,
            'pump_dump_risk': signal.pump_dump_risk.value,
            
            # Trend
            'trend_direction': signal.trend_direction.value,
            
            # Signal metadata
            'signal_status': signal.signal_status.value,
            'days_active': signal.days_active,
            
            # Risk management
            'stop_loss_level': result.stop_loss_level,
            'position_size_pct': result.position_size_pct,
            
            # Data quality
            'data_quality_score': result.data_quality_score,
        }

