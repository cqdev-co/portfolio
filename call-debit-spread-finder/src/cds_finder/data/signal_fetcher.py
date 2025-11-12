"""Fetch signals from Supabase database."""

from typing import List, Optional
from datetime import date, datetime, timedelta
from loguru import logger
from supabase import create_client, Client

from ..models.signal import Signal
from ..config import Config


class SignalFetcher:
    """Fetch bullish call signals from Supabase."""
    
    def __init__(self, config: Config):
        """Initialize signal fetcher with configuration."""
        self.config = config
        self._client: Optional[Client] = None
    
    def _get_client(self) -> Client:
        """Get or create Supabase client."""
        if self._client is None:
            try:
                self._client = create_client(
                    self.config.supabase_url,
                    self.config.supabase_key
                )
                logger.debug("Connected to Supabase")
            except Exception as e:
                logger.error(f"Failed to create Supabase client: {e}")
                raise
        
        return self._client
    
    def fetch_bullish_signals(
        self,
        min_grade: Optional[str] = None,
        days_back: Optional[int] = None,
        min_dte: Optional[int] = None,
        max_dte: Optional[int] = None,
    ) -> List[Signal]:
        """
        Fetch bullish call signals from database.
        
        Args:
            min_grade: Minimum grade (default: from config)
            days_back: Days to look back (default: from config)
            min_dte: Minimum days to expiry (default: from config)
            max_dte: Maximum days to expiry (default: from config)
            
        Returns:
            List of Signal objects
        """
        min_grade = min_grade or self.config.min_grade
        days_back = days_back or self.config.days_back
        min_dte = min_dte or self.config.min_dte
        max_dte = max_dte or self.config.max_dte
        
        # Grade order for filtering
        grade_order = {'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
        min_grade_value = grade_order.get(min_grade.upper(), 1)
        
        # Get valid grades >= min_grade
        valid_grades = [
            grade for grade, value in grade_order.items()
            if value >= min_grade_value
        ]
        
        # Calculate date range
        end_date = datetime.now().date() + timedelta(days=1)  # Include today
        start_date = end_date - timedelta(days=days_back + 1)
        
        logger.info(
            f"Fetching bullish call signals: "
            f"grades={valid_grades}, days_back={days_back}, "
            f"dte={min_dte}-{max_dte}"
        )
        
        try:
            client = self._get_client()
            
            # Build query
            query = (
                client.table("unusual_options_signals")
                .select("*")
                .eq("option_type", "call")
                .eq("sentiment", "BULLISH")
                .eq("is_active", True)
                .in_("grade", valid_grades)
                .gte("days_to_expiry", min_dte)
                .lte("days_to_expiry", max_dte)
                .gte("detection_timestamp", start_date.isoformat())
                .lte("detection_timestamp", end_date.isoformat())
                .order("overall_score", desc=True)
            )
            
            result = query.execute()
            
            if not result.data:
                logger.warning("No signals found matching criteria")
                return []
            
            # Convert to Signal objects
            signals = []
            for row in result.data:
                try:
                    signal = Signal.from_db_row(row)
                    signals.append(signal)
                except Exception as e:
                    logger.warning(f"Failed to parse signal row: {e}")
                    continue
            
            logger.info(f"Fetched {len(signals)} bullish call signals")
            return signals
            
        except Exception as e:
            logger.error(f"Error fetching signals: {e}")
            raise

