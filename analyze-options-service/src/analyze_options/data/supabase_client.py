"""Supabase client for fetching signals."""

from typing import List, Optional
from datetime import date, datetime, timedelta
from supabase import create_client, Client
from loguru import logger

from ..config import Settings
from ..models.signal import EnrichedSignal, Sentiment


class SupabaseClient:
    """Database client for unusual options signals."""
    
    def __init__(self, config: Settings):
        self.client: Client = create_client(
            config.supabase_url,
            config.supabase_key
        )
        self.config = config
    
    def get_signals(
        self,
        min_grade: str = "A",
        lookback_days: int = 7,
        min_premium_flow: float = 100000,
        min_dte: int = 7,
        max_dte: int = 60,
        limit: int = 1000
    ) -> List[EnrichedSignal]:
        """
        Query signals from unusual_options_signals table.
        
        Args:
            min_grade: Minimum signal grade (S, A, B, C, D, F)
            lookback_days: How many days back to scan
            min_premium_flow: Minimum premium flow in dollars
            min_dte: Minimum days to expiration
            max_dte: Maximum days to expiration
            limit: Max number of signals to return
            
        Returns:
            List of EnrichedSignal objects
        """
        # Grade ordering for filtering
        grade_order = {'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
        min_grade_value = grade_order.get(min_grade, 5)
        valid_grades = [
            g for g, v in grade_order.items() 
            if v >= min_grade_value
        ]
        
        # Date range
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=lookback_days)
        
        logger.info(
            f"Fetching signals: grade={valid_grades}, "
            f"dates={start_date} to {end_date}, "
            f"dte={min_dte}-{max_dte}"
        )
        
        try:
            # Query with filters
            response = (
                self.client.table("unusual_options_signals")
                .select("*")
                .in_("grade", valid_grades)
                .gte("detection_timestamp", start_date.isoformat())
                .lte("detection_timestamp", end_date.isoformat())
                .gte("premium_flow", min_premium_flow)
                .gte("days_to_expiry", min_dte)
                .lte("days_to_expiry", max_dte)
                .eq("is_active", True)
                .order("overall_score", desc=True)
                .limit(limit)
                .execute()
            )
            
            signals = []
            for row in response.data:
                try:
                    # Parse signal data
                    signal = EnrichedSignal(
                        signal_id=row["signal_id"],
                        ticker=row["ticker"],
                        option_symbol=row["option_symbol"],
                        strike=float(row["strike"]),
                        expiry=date.fromisoformat(row["expiry"]),
                        option_type=row["option_type"],
                        days_to_expiry=row["days_to_expiry"],
                        grade=row["grade"],
                        sentiment=Sentiment(row["sentiment"]),
                        overall_score=float(row["overall_score"]),
                        premium_flow=float(row["premium_flow"]),
                        underlying_price=float(row["underlying_price"]),
                        # Will be enriched with fresh data
                        current_price=float(row["underlying_price"]),
                        current_iv=float(row.get("implied_volatility", 0.30)),
                        time_to_expiry=row["days_to_expiry"] / 365.0,
                        moneyness=row.get("moneyness", "OTM"),
                        days_to_earnings=row.get("days_to_earnings"),
                        current_volume=row.get("current_volume"),
                        average_volume=row.get("average_volume"),
                        market_cap=row.get("market_cap")
                    )
                    signals.append(signal)
                except Exception as e:
                    logger.warning(f"Error parsing signal {row.get('signal_id')}: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(signals)} signals")
            return signals
            
        except Exception as e:
            logger.error(f"Error fetching signals from Supabase: {e}")
            return []
    
    def get_unique_tickers(
        self,
        min_grade: str = "A",
        lookback_days: int = 7
    ) -> List[str]:
        """
        Get unique list of tickers with signals.
        Used for batch fetching market data.
        
        Args:
            min_grade: Minimum signal grade
            lookback_days: How many days back
            
        Returns:
            List of unique ticker symbols
        """
        grade_order = {'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
        min_grade_value = grade_order.get(min_grade, 5)
        valid_grades = [
            g for g, v in grade_order.items() 
            if v >= min_grade_value
        ]
        
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=lookback_days)
        
        try:
            response = (
                self.client.table("unusual_options_signals")
                .select("ticker")
                .in_("grade", valid_grades)
                .gte("detection_timestamp", start_date.isoformat())
                .eq("is_active", True)
                .execute()
            )
            
            tickers = list(set(row["ticker"] for row in response.data))
            logger.info(f"Found {len(tickers)} unique tickers with signals")
            return tickers
            
        except Exception as e:
            logger.error(f"Error fetching tickers: {e}")
            return []

