"""Data loading from Supabase."""

from datetime import date, datetime
from typing import List, Optional

import pandas as pd
from loguru import logger
from supabase import Client, create_client

from ml_predictor.config import get_settings


class DataLoader:
    """Load unusual options signals from Supabase."""

    def __init__(self):
        """Initialize data loader."""
        self.settings = get_settings()
        try:
            # Try new Supabase client API (v2.7+)
            self.client: Client = create_client(
                self.settings.supabase_url, 
                self.settings.supabase_key
            )
        except TypeError:
            # Fallback for older Supabase versions
            from supabase import Client as SupabaseClient
            self.client = SupabaseClient(
                self.settings.supabase_url,
                self.settings.supabase_key
            )

    def fetch_expired_signals(
        self, 
        min_grade: str = "B",
        limit: Optional[int] = None,
        unlabeled_only: bool = False
    ) -> pd.DataFrame:
        """
        Fetch expired signals from database.

        Args:
            min_grade: Minimum signal grade (S, A, B, C)
            limit: Maximum number of signals to fetch
            unlabeled_only: Only fetch signals without labels
        
        Returns:
            DataFrame with expired signals
        """
        logger.info(f"Fetching expired signals (min_grade={min_grade})")

        # Build query
        query = self.client.table("unusual_options_signals").select("*")

        # Filter by is_active=false (signals marked as expired by the service)
        # Note: The unusual-options-service marks signals as inactive when expired
        query = query.eq("is_active", False)

        # Filter by grade if specified
        if min_grade:
            grade_order = {"S": 4, "A": 3, "B": 2, "C": 1, "D": 0, "F": 0}
            min_grade_val = grade_order.get(min_grade, 0)
            valid_grades = [g for g, v in grade_order.items() if v >= min_grade_val]
            query = query.in_("grade", valid_grades)

        # Apply limit if specified
        if limit:
            query = query.limit(limit)

        # Execute query
        response = query.execute()

        if not response.data:
            logger.warning("No expired signals found")
            return pd.DataFrame()

        df = pd.DataFrame(response.data)
        logger.info(f"Fetched {len(df)} expired signals")

        return df

    def fetch_active_signals(
        self, 
        min_grade: str = "B",
        limit: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Fetch active signals for prediction.

        Args:
            min_grade: Minimum signal grade
            limit: Maximum number of signals
        
        Returns:
            DataFrame with active signals
        """
        logger.info(f"Fetching active signals (min_grade={min_grade})")

        query = self.client.table("unusual_options_signals").select("*")

        # Filter by active status
        query = query.eq("is_active", True)

        # Filter by grade
        if min_grade:
            grade_order = {"S": 4, "A": 3, "B": 2, "C": 1, "D": 0, "F": 0}
            min_grade_val = grade_order.get(min_grade, 0)
            valid_grades = [g for g, v in grade_order.items() if v >= min_grade_val]
            query = query.in_("grade", valid_grades)

        if limit:
            query = query.limit(limit)

        response = query.execute()

        if not response.data:
            logger.warning("No active signals found")
            return pd.DataFrame()

        df = pd.DataFrame(response.data)
        logger.info(f"Fetched {len(df)} active signals")

        return df

    def save_labeled_data(
        self, 
        labeled_df: pd.DataFrame, 
        filename: str = "labeled_signals.parquet"
    ) -> None:
        """
        Save labeled data to disk.

        Args:
            labeled_df: DataFrame with labels
            filename: Output filename
        """
        output_path = self.settings.labeled_data_dir / filename
        labeled_df.to_parquet(output_path, index=False)
        logger.info(f"Saved {len(labeled_df)} labeled signals to {output_path}")

    def load_labeled_data(
        self, 
        filename: str = "labeled_signals.parquet"
    ) -> pd.DataFrame:
        """
        Load labeled data from disk.

        Args:
            filename: Input filename
        
        Returns:
            DataFrame with labeled data
        """
        input_path = self.settings.labeled_data_dir / filename

        if not input_path.exists():
            logger.warning(f"No labeled data found at {input_path}")
            return pd.DataFrame()

        df = pd.read_parquet(input_path)
        logger.info(f"Loaded {len(df)} labeled signals from {input_path}")

        return df

