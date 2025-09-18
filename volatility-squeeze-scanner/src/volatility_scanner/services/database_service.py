"""Database service for storing and retrieving volatility squeeze signals."""

import os
import time
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal
import asyncio
from dataclasses import asdict
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client
from loguru import logger

from volatility_scanner.models.analysis import AnalysisResult, SqueezeSignal
from volatility_scanner.config.settings import Settings


class DatabaseService:
    """Service for storing volatility squeeze signals in Supabase."""
    
    def __init__(self, settings: Settings):
        """Initialize the database service."""
        self.settings = settings
        self.client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client with environment variables."""
        try:
            # Load environment variables from parent directory if available
            parent_env = Path.cwd().parent / '.env'
            if parent_env.exists():
                load_dotenv(parent_env)
            
            # Try to get Supabase credentials from environment
            supabase_url = (
                os.getenv('NEXT_PUBLIC_SUPABASE_URL') or 
                os.getenv('SUPABASE_URL')
            )
            supabase_key = (
                os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or
                os.getenv('SUPABASE_ANON_KEY')
            )
            
            if not supabase_url or not supabase_key:
                logger.warning(
                    "Supabase credentials not found in environment. "
                    "Database service will be disabled."
                )
                return
            
            self.client = create_client(supabase_url, supabase_key)
            logger.info("✅ Database service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database service: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if database service is available."""
        return self.client is not None
    
    async def store_signal(self, analysis_result: AnalysisResult) -> Optional[str]:
        """
        Store or update a single volatility squeeze signal in the database.
        Uses upsert logic to prevent duplicates for the same symbol on the same date.
        
        Args:
            analysis_result: The analysis result to store
            
        Returns:
            The ID of the stored/updated signal, or None if failed
        """
        if not self.is_available():
            logger.warning("Database service not available")
            return None
        
        try:
            signal_data = self._prepare_signal_data(analysis_result)
            
            # Use upsert to prevent duplicates (INSERT or UPDATE)
            response = self.client.table('volatility_squeeze_signals').upsert(
                signal_data,
                on_conflict='symbol,scan_date'  # Match on symbol and scan_date
            ).execute()
            
            if response.data:
                signal_id = response.data[0]['id']
                logger.debug(f"Stored/updated signal for {analysis_result.symbol}: {signal_id}")
                return signal_id
            else:
                logger.error(f"Failed to store signal for {analysis_result.symbol}")
                return None
                
        except Exception as e:
            logger.error(f"Error storing signal for {analysis_result.symbol}: {e}")
            return None
    
    async def store_signals_batch(self, analysis_results: List[AnalysisResult]) -> int:
        """
        Store multiple signals in a batch operation with retry logic.
        
        Args:
            analysis_results: List of analysis results to store
            
        Returns:
            Number of successfully stored signals
        """
        if not self.is_available():
            logger.warning("Database service not available")
            return 0
        
        if not analysis_results:
            return 0
        
        # Use smaller batch sizes to avoid SSL timeout issues
        batch_size = 10  # Reduced from potentially larger batches
        total_stored = 0
        
        # Process in smaller batches
        for i in range(0, len(analysis_results), batch_size):
            batch = analysis_results[i:i + batch_size]
            batch_stored = await self._store_batch_with_retry(batch, batch_num=i//batch_size + 1)
            total_stored += batch_stored
            
            # Small delay between batches to avoid overwhelming the connection
            if i + batch_size < len(analysis_results):
                await asyncio.sleep(0.1)
        
        logger.info(f"✅ Stored {total_stored}/{len(analysis_results)} signals in database")
        return total_stored
    
    async def _store_batch_with_retry(self, batch: List[AnalysisResult], batch_num: int, max_retries: int = 3) -> int:
        """Store a batch with retry logic for SSL/network issues."""
        for attempt in range(max_retries):
            try:
                # Prepare signal data
                signals_data = [
                    self._prepare_signal_data(result) 
                    for result in batch
                ]
                
                # Use upsert for batch operations to prevent duplicates
                response = self.client.table('volatility_squeeze_signals').upsert(
                    signals_data,
                    on_conflict='symbol,scan_date'  # Match on symbol and scan_date
                ).execute()
                
                stored_count = len(response.data) if response.data else 0
                logger.debug(f"✅ Batch {batch_num}: Stored/updated {stored_count}/{len(batch)} signals")
                
                return stored_count
                
            except Exception as e:
                logger.warning(f"Batch {batch_num} attempt {attempt + 1} failed: {e}")
                
                if attempt < max_retries - 1:
                    # Exponential backoff: wait longer between retries
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying batch {batch_num} in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Batch {batch_num} failed after {max_retries} attempts: {e}")
                    
                    # Try to store individual signals as fallback
                    return await self._store_individual_fallback(batch, batch_num)
        
        return 0
    
    async def _store_individual_fallback(self, batch: List[AnalysisResult], batch_num: int) -> int:
        """Fallback: try to store signals individually if batch fails."""
        logger.info(f"Using individual storage fallback for batch {batch_num}")
        stored_count = 0
        
        for result in batch:
            try:
                signal_id = await self.store_signal(result)
                if signal_id:
                    stored_count += 1
                await asyncio.sleep(0.05)  # Small delay between individual inserts
            except Exception as e:
                logger.debug(f"Individual storage failed for {result.symbol}: {e}")
        
        logger.info(f"Fallback stored {stored_count}/{len(batch)} signals from batch {batch_num}")
        return stored_count
    
    def _prepare_signal_data(self, analysis_result: AnalysisResult) -> Dict[str, Any]:
        """Prepare analysis result data for database storage."""
        squeeze_signal = analysis_result.squeeze_signal
        
        # Convert to database format
        data = {
            'symbol': analysis_result.symbol,
            'scan_date': date.today().isoformat(),  # Add scan_date for unique constraint
            'scan_timestamp': datetime.now().isoformat(),
            
            # Price data
            'close_price': float(squeeze_signal.close_price),
            'open_price': float(squeeze_signal.open_price),
            'high_price': float(squeeze_signal.high_price),  
            'low_price': float(squeeze_signal.low_price),
            'volume': int(squeeze_signal.volume) if squeeze_signal.volume else None,
            
            # Position analysis
            'price_vs_20d_high': float(squeeze_signal.price_vs_20d_high) if squeeze_signal.price_vs_20d_high else None,
            'price_vs_20d_low': float(squeeze_signal.price_vs_20d_low) if squeeze_signal.price_vs_20d_low else None,
            
            # Volatility squeeze metrics
            'bb_width': float(squeeze_signal.bb_width),
            'bb_width_percentile': float(squeeze_signal.bb_width_percentile),
            'bb_width_change': float(squeeze_signal.bb_width_change) if squeeze_signal.bb_width_change else None,
            'is_squeeze': squeeze_signal.is_squeeze,
            'is_expansion': squeeze_signal.is_expansion,
            
            # Bollinger Bands
            'bb_upper': float(squeeze_signal.bb_upper) if squeeze_signal.bb_upper else None,
            'bb_middle': float(squeeze_signal.bb_middle) if squeeze_signal.bb_middle else None,
            'bb_lower': float(squeeze_signal.bb_lower) if squeeze_signal.bb_lower else None,
            
            # Keltner Channels
            'kc_upper': float(squeeze_signal.kc_upper) if squeeze_signal.kc_upper else None,
            'kc_middle': float(squeeze_signal.kc_middle) if squeeze_signal.kc_middle else None,
            'kc_lower': float(squeeze_signal.kc_lower) if squeeze_signal.kc_lower else None,
            
            # Range & volatility
            'true_range': float(squeeze_signal.true_range) if squeeze_signal.true_range else None,
            'atr_20': float(squeeze_signal.atr_20) if squeeze_signal.atr_20 else None,
            'range_vs_atr': float(squeeze_signal.range_vs_atr) if squeeze_signal.range_vs_atr else None,
            
            # Trend analysis
            'trend_direction': squeeze_signal.trend_direction.value if squeeze_signal.trend_direction else None,
            'ema_short': float(squeeze_signal.ema_short) if squeeze_signal.ema_short else None,
            'ema_long': float(squeeze_signal.ema_long) if squeeze_signal.ema_long else None,
            
            # Volume analysis
            'volume_ratio': float(squeeze_signal.volume_ratio) if squeeze_signal.volume_ratio else None,
            'avg_volume': int(squeeze_signal.avg_volume) if squeeze_signal.avg_volume else None,
            
            # Technical indicators
            'rsi': float(squeeze_signal.rsi) if squeeze_signal.rsi else None,
            'macd': float(squeeze_signal.macd) if squeeze_signal.macd else None,
            'macd_signal': float(squeeze_signal.macd_signal) if squeeze_signal.macd_signal else None,
            'adx': float(squeeze_signal.adx) if squeeze_signal.adx else None,
            'di_plus': float(squeeze_signal.di_plus) if squeeze_signal.di_plus else None,
            'di_minus': float(squeeze_signal.di_minus) if squeeze_signal.di_minus else None,
            
            # Market regime and volatility
            'market_regime': None,  # Will be populated below
            'market_volatility': None,  # Will be populated below
            
            # Signal scoring
            'signal_strength': float(squeeze_signal.signal_strength),
            'technical_score': float(analysis_result.overall_score),  # Use overall_score as technical_score
            'overall_score': float(analysis_result.overall_score),
            'opportunity_rank': analysis_result.opportunity_rank.value if analysis_result.opportunity_rank else None,
            
            # Recommendations
            'recommendation': analysis_result.recommendation if analysis_result.recommendation else None,
            
            # Risk management
            'stop_loss_price': float(analysis_result.stop_loss_level) if analysis_result.stop_loss_level else None,
            'position_size_pct': float(analysis_result.position_size_pct) if analysis_result.position_size_pct else None,
            
            # AI analysis
            'ai_analysis': analysis_result.ai_analysis.rationale if analysis_result.ai_analysis else None,
            'ai_confidence': float(analysis_result.ai_analysis.confidence) if analysis_result.ai_analysis else None,
            
            # Signal continuity tracking
            'signal_status': squeeze_signal.signal_status.value if squeeze_signal.signal_status else 'NEW',
            'days_in_squeeze': squeeze_signal.days_in_squeeze if squeeze_signal.days_in_squeeze else 1,
            'first_detected_date': squeeze_signal.first_detected_date.isoformat() if squeeze_signal.first_detected_date else None,
            'last_active_date': squeeze_signal.last_active_date.isoformat() if squeeze_signal.last_active_date else None,
            
            # Metadata
            'is_actionable': hasattr(analysis_result, 'is_actionable') and (
                analysis_result.is_actionable() if callable(analysis_result.is_actionable) 
                else analysis_result.is_actionable
            )
        }
        
        # Extract technical indicators from the latest indicators (if available)
        if hasattr(analysis_result, 'market_conditions') and analysis_result.market_conditions:
            # Get market regime data
            market_regime = analysis_result.market_conditions.get('market_regime', {})
            if market_regime:
                data['market_regime'] = market_regime.get('regime')
                data['market_volatility'] = float(market_regime.get('volatility', 0.0))
        
        # Try to get technical indicators from the squeeze signal's latest indicators
        # This requires finding the most recent indicators in the market data
        try:
            # Check if we can access the market data through some path
            # For now, we'll leave these as None until we can properly access the indicators
            pass
        except Exception:
            pass
        
        # Remove None values to avoid database issues
        return {k: v for k, v in data.items() if v is not None}
    
    async def get_latest_signals(
        self, 
        limit: int = 100,
        min_score: Optional[float] = None,
        recommendation: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get the latest signals from the database.
        
        Args:
            limit: Maximum number of signals to return
            min_score: Minimum overall score filter
            recommendation: Filter by recommendation type
            
        Returns:
            List of signal dictionaries
        """
        if not self.is_available():
            return []
        
        try:
            query = self.client.table('volatility_squeeze_signals').select('*')
            
            if min_score is not None:
                query = query.gte('overall_score', min_score)
            
            if recommendation:
                query = query.eq('recommendation', recommendation)
            
            response = query.order('scan_timestamp', desc=True).limit(limit).execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error retrieving signals: {e}")
            return []
    
    async def get_signals_by_date(self, target_date: date) -> List[Dict[str, Any]]:
        """Get all signals for a specific date."""
        if not self.is_available():
            return []
        
        try:
            response = self.client.table('volatility_squeeze_signals').select('*').eq(
                'scan_date', target_date.isoformat()
            ).order('overall_score', desc=True).execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error retrieving signals for {target_date}: {e}")
            return []
    
    async def cleanup_duplicate_signals(self, target_date: date = None) -> int:
        """
        Clean up duplicate signals for a specific date.
        Keeps the most recent record for each symbol/date combination.
        
        Args:
            target_date: Date to clean up (defaults to today)
            
        Returns:
            Number of duplicate records removed
        """
        if not self.is_available():
            logger.warning("Database service not available")
            return 0
        
        if target_date is None:
            target_date = date.today()
        
        try:
            logger.info(f"Cleaning up duplicate signals for {target_date}")
            
            # Get all signals for the target date, ordered by creation time
            response = self.client.table('volatility_squeeze_signals').select(
                'id, symbol, scan_date, created_at'
            ).eq(
                'scan_date', target_date.isoformat()
            ).order('symbol', desc=False).order('created_at', desc=True).execute()
            
            if not response.data:
                logger.info(f"No signals found for {target_date}")
                return 0
            
            signals = response.data
            
            # Group by symbol and identify duplicates
            seen_symbols = set()
            duplicates_to_remove = []
            
            for signal in signals:
                symbol = signal['symbol']
                if symbol in seen_symbols:
                    # This is a duplicate - mark for removal
                    duplicates_to_remove.append(signal['id'])
                else:
                    seen_symbols.add(symbol)
            
            if not duplicates_to_remove:
                logger.info(f"No duplicate signals found for {target_date}")
                return 0
            
            # Remove duplicates in batches
            batch_size = 50
            removed_count = 0
            
            for i in range(0, len(duplicates_to_remove), batch_size):
                batch_ids = duplicates_to_remove[i:i + batch_size]
                
                try:
                    delete_response = self.client.table('volatility_squeeze_signals').delete().in_(
                        'id', batch_ids
                    ).execute()
                    
                    batch_removed = len(delete_response.data) if delete_response.data else 0
                    removed_count += batch_removed
                    
                    logger.debug(f"Removed {batch_removed} duplicate signals in batch {i//batch_size + 1}")
                    
                except Exception as e:
                    logger.error(f"Error removing duplicate batch: {e}")
            
            logger.info(f"✅ Removed {removed_count} duplicate signals for {target_date}")
            return removed_count
            
        except Exception as e:
            logger.error(f"Error during duplicate cleanup: {e}")
            return 0
    
    async def get_duplicate_signals_count(self, target_date: date = None) -> Dict[str, int]:
        """
        Get count of duplicate signals for analysis.
        
        Args:
            target_date: Date to analyze (defaults to today)
            
        Returns:
            Dictionary with duplicate statistics
        """
        if not self.is_available():
            return {}
        
        if target_date is None:
            target_date = date.today()
        
        try:
            # Get signal counts by symbol for the target date
            response = self.client.table('volatility_squeeze_signals').select(
                'symbol'
            ).eq(
                'scan_date', target_date.isoformat()
            ).execute()
            
            if not response.data:
                return {'total_signals': 0, 'unique_symbols': 0, 'duplicates': 0}
            
            symbols = [signal['symbol'] for signal in response.data]
            unique_symbols = set(symbols)
            
            stats = {
                'total_signals': len(symbols),
                'unique_symbols': len(unique_symbols),
                'duplicates': len(symbols) - len(unique_symbols)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting duplicate statistics: {e}")
            return {}