"""Database service for storing and retrieving volatility squeeze signals."""

import os
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
        Store a single volatility squeeze signal in the database.
        
        Args:
            analysis_result: The analysis result to store
            
        Returns:
            The ID of the stored signal, or None if failed
        """
        if not self.is_available():
            logger.warning("Database service not available")
            return None
        
        try:
            signal_data = self._prepare_signal_data(analysis_result)
            
            response = self.client.table('volatility_squeeze_signals').insert(signal_data).execute()
            
            if response.data:
                signal_id = response.data[0]['id']
                logger.debug(f"Stored signal for {analysis_result.symbol}: {signal_id}")
                return signal_id
            else:
                logger.error(f"Failed to store signal for {analysis_result.symbol}")
                return None
                
        except Exception as e:
            logger.error(f"Error storing signal for {analysis_result.symbol}: {e}")
            return None
    
    async def store_signals_batch(self, analysis_results: List[AnalysisResult]) -> int:
        """
        Store multiple signals in a batch operation.
        
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
        
        try:
            # Prepare all signal data
            signals_data = [
                self._prepare_signal_data(result) 
                for result in analysis_results
            ]
            
            # Insert in batch
            response = self.client.table('volatility_squeeze_signals').insert(signals_data).execute()
            
            stored_count = len(response.data) if response.data else 0
            logger.info(f"✅ Stored {stored_count}/{len(analysis_results)} signals in database")
            
            return stored_count
            
        except Exception as e:
            logger.error(f"Error storing signals batch: {e}")
            return 0
    
    def _prepare_signal_data(self, analysis_result: AnalysisResult) -> Dict[str, Any]:
        """Prepare analysis result data for database storage."""
        squeeze_signal = analysis_result.squeeze_signal
        
        # Convert to database format
        data = {
            'symbol': analysis_result.symbol,
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
            
            # Recommendations
            'recommendation': analysis_result.recommendation if analysis_result.recommendation else None,
            
            # Risk management
            'stop_loss_price': float(analysis_result.stop_loss_level) if analysis_result.stop_loss_level else None,
            'position_size_pct': float(analysis_result.position_size_pct) if analysis_result.position_size_pct else None,
            
            # AI analysis
            'ai_analysis': analysis_result.ai_analysis.rationale if analysis_result.ai_analysis else None,
            'ai_confidence': float(analysis_result.ai_analysis.confidence) if analysis_result.ai_analysis else None,
            
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