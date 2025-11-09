"""Feature engineering for ML models."""

from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from loguru import logger
from sklearn.preprocessing import LabelEncoder, StandardScaler


class FeatureEngineer:
    """Extract and engineer features from signal data."""

    def __init__(self):
        """Initialize feature engineer."""
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.feature_names: Optional[List[str]] = None
        self._market_data_cache = {}  # Cache market data to avoid repeated API calls

    def _encode_grade(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode grade as numeric (S=4, A=3, B=2, C=1, D/F=0)."""
        grade_map = {"S": 4, "A": 3, "B": 2, "C": 1, "D": 0, "F": 0}
        df["grade_numeric"] = df["grade"].map(grade_map).fillna(0)
        return df

    def _encode_sentiment(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode sentiment (BULLISH=1, NEUTRAL=0, BEARISH=-1)."""
        sentiment_map = {"BULLISH": 1, "NEUTRAL": 0, "BEARISH": -1}
        df["sentiment_numeric"] = df["sentiment"].map(sentiment_map).fillna(0)
        return df

    def _encode_moneyness(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode moneyness as numeric (ITM=1, ATM=0, OTM=-1)."""
        moneyness_map = {"ITM": 1, "ATM": 0, "OTM": -1}
        df["moneyness_numeric"] = df["moneyness"].map(moneyness_map).fillna(0)
        return df

    def _encode_option_type(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode option type (call=1, put=0)."""
        df["is_call"] = (df["option_type"].str.lower() == "call").astype(int)
        return df

    def _get_market_data(self, date: Optional[datetime] = None) -> dict:
        """
        Get market context data for a specific date.
        
        Args:
            date: Date to get market data for. If None, uses today.
            
        Returns:
            Dictionary with market metrics
        """
        if date is None:
            date = datetime.now()
        
        # Round to date (ignore time)
        date_key = date.date().isoformat()
        
        # Check cache
        if date_key in self._market_data_cache:
            return self._market_data_cache[date_key]
        
        try:
            # If date is in the future, use today's date for market data
            today = datetime.now()
            fetch_date = date if date <= today else today
            
            # Fetch SPY (market proxy)
            spy = yf.Ticker("SPY")
            spy_hist = spy.history(
                start=fetch_date - timedelta(days=60), 
                end=fetch_date + timedelta(days=1)
            )
            
            # Fetch VIX (volatility index)
            vix = yf.Ticker("^VIX")
            vix_hist = vix.history(
                start=fetch_date - timedelta(days=60), 
                end=fetch_date + timedelta(days=1)
            )
            
            if spy_hist.empty or vix_hist.empty:
                logger.warning(f"No market data for {date_key}, using defaults")
                market_data = {
                    'spy_return_1d': 0.0,
                    'spy_return_5d': 0.0,
                    'spy_return_20d': 0.0,
                    'spy_trend': 0,
                    'vix_level': 20.0,
                    'vix_change': 0.0,
                    'is_high_vix': 0,
                    'market_regime': 'neutral'
                }
            else:
                # SPY metrics
                spy_current = spy_hist['Close'].iloc[-1]
                spy_1d_ago = spy_hist['Close'].iloc[-2] if len(spy_hist) >= 2 else spy_current
                spy_5d_ago = spy_hist['Close'].iloc[-6] if len(spy_hist) >= 6 else spy_current
                spy_20d_ago = spy_hist['Close'].iloc[-21] if len(spy_hist) >= 21 else spy_current
                spy_50d_sma = spy_hist['Close'].rolling(50).mean().iloc[-1] if len(spy_hist) >= 50 else spy_current
                
                # VIX metrics
                vix_current = vix_hist['Close'].iloc[-1]
                vix_1d_ago = vix_hist['Close'].iloc[-2] if len(vix_hist) >= 2 else vix_current
                
                # Calculate returns
                spy_return_1d = (spy_current - spy_1d_ago) / spy_1d_ago if spy_1d_ago > 0 else 0
                spy_return_5d = (spy_current - spy_5d_ago) / spy_5d_ago if spy_5d_ago > 0 else 0
                spy_return_20d = (spy_current - spy_20d_ago) / spy_20d_ago if spy_20d_ago > 0 else 0
                
                # SPY trend (1 = bull, 0 = neutral, -1 = bear)
                if spy_current > spy_50d_sma * 1.02:
                    spy_trend = 1
                elif spy_current < spy_50d_sma * 0.98:
                    spy_trend = -1
                else:
                    spy_trend = 0
                
                # Market regime
                if spy_return_20d > 0.05 and vix_current < 20:
                    market_regime = 'bull_low_vol'
                elif spy_return_20d > 0.05 and vix_current >= 20:
                    market_regime = 'bull_high_vol'
                elif spy_return_20d < -0.05 and vix_current >= 25:
                    market_regime = 'bear_high_vol'
                elif spy_return_20d < -0.05:
                    market_regime = 'bear_low_vol'
                else:
                    market_regime = 'neutral'
                
                market_data = {
                    'spy_return_1d': spy_return_1d * 100,  # Convert to percentage
                    'spy_return_5d': spy_return_5d * 100,
                    'spy_return_20d': spy_return_20d * 100,
                    'spy_trend': spy_trend,
                    'vix_level': vix_current,
                    'vix_change': ((vix_current - vix_1d_ago) / vix_1d_ago * 100) if vix_1d_ago > 0 else 0,
                    'is_high_vix': 1 if vix_current > 20 else 0,
                    'market_regime': market_regime
                }
            
            # Cache the result
            self._market_data_cache[date_key] = market_data
            return market_data
            
        except Exception as e:
            logger.warning(f"Error fetching market data for {date_key}: {e}")
            # Return default values
            return {
                'spy_return_1d': 0.0,
                'spy_return_5d': 0.0,
                'spy_return_20d': 0.0,
                'spy_trend': 0,
                'vix_level': 20.0,
                'vix_change': 0.0,
                'is_high_vix': 0,
                'market_regime': 'neutral'
            }
    
    def _add_market_context_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add market context features (VIX, SPY, regime)."""
        logger.info("Adding market context features...")
        
        # Get unique dates in the data
        if 'detected_at' in df.columns:
            # Use detection date if available
            df['_date'] = pd.to_datetime(df['detected_at']).dt.date
        elif 'expiry' in df.columns:
            # Fallback to expiry date
            df['_date'] = pd.to_datetime(df['expiry']).dt.date
        else:
            # Use today for all
            df['_date'] = datetime.now().date()
        
        # Get market data for each unique date
        unique_dates = df['_date'].unique()
        market_data_by_date = {}
        
        for date in unique_dates:
            if isinstance(date, str):
                date = datetime.strptime(date, '%Y-%m-%d').date()
            market_data_by_date[date] = self._get_market_data(datetime.combine(date, datetime.min.time()))
        
        # Add market features to dataframe
        df['spy_return_1d'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('spy_return_1d', 0))
        df['spy_return_5d'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('spy_return_5d', 0))
        df['spy_return_20d'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('spy_return_20d', 0))
        df['spy_trend'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('spy_trend', 0))
        df['vix_level'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('vix_level', 20))
        df['vix_change'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('vix_change', 0))
        df['is_high_vix'] = df['_date'].map(lambda d: market_data_by_date.get(d, {}).get('is_high_vix', 0))
        
        # Encode market regime
        regime_map = {
            'bull_low_vol': 2,
            'bull_high_vol': 1,
            'neutral': 0,
            'bear_low_vol': -1,
            'bear_high_vol': -2
        }
        df['market_regime'] = df['_date'].map(
            lambda d: regime_map.get(market_data_by_date.get(d, {}).get('market_regime', 'neutral'), 0)
        )
        
        # Clean up temporary column
        df = df.drop(columns=['_date'])
        
        logger.info(f"Added 8 market context features")
        return df

    def _create_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create derived features from base features."""
        
        # Premium flow per volume ratio
        df["premium_flow_per_volume"] = np.where(
            df["volume_ratio"] > 0,
            df["premium_flow"] / df["volume_ratio"],
            0,
        )

        # Score * confidence interaction
        df["score_confidence_interaction"] = (
            df["overall_score"] * df["confidence"]
        )

        # Strike distance percentage
        df["strike_distance_pct"] = np.where(
            df["underlying_price"] > 0,
            ((df["strike"] - df["underlying_price"]) / df["underlying_price"]) * 100,
            0,
        )

        # IV * time interaction
        df["iv_time_interaction"] = (
            df["implied_volatility"] * df["days_to_expiry"]
        )

        # Time decay risk (higher for short DTE)
        df["time_decay_risk"] = np.where(
            df["days_to_expiry"] > 0,
            1 / np.sqrt(df["days_to_expiry"]),
            1.0,
        )

        # Premium flow strength (log scale)
        df["premium_flow_log"] = np.log1p(df["premium_flow"])

        # Volume anomaly score
        df["volume_anomaly_score"] = (
            df["has_volume_anomaly"].astype(int) * df["volume_ratio"]
        )

        # Catalyst proximity (days to earnings)
        df["has_near_catalyst"] = (
            (df["days_to_earnings"] > 0) & (df["days_to_earnings"] <= 14)
        ).astype(int)

        # Detect flag count (how many detection flags are true)
        flag_cols = [
            "has_volume_anomaly",
            "has_oi_spike",
            "has_premium_flow",
            "has_sweep",
            "has_block_trade",
        ]
        df["detection_flag_count"] = df[flag_cols].astype(int).sum(axis=1)
        
        # Quick-win features (simple but powerful)
        
        # 1. Is Friday expiry (options expiring on Fridays behave differently)
        if 'expiry' in df.columns:
            expiry_dates = pd.to_datetime(df['expiry'])
            df['is_friday_expiry'] = (expiry_dates.dt.weekday == 4).astype(int)
        else:
            df['is_friday_expiry'] = 0
        
        # 2. Signal freshness (newer signals may be more reliable)
        if 'detected_at' in df.columns and 'expiry' in df.columns:
            detected_dates = pd.to_datetime(df['detected_at'])
            expiry_dates = pd.to_datetime(df['expiry'])
            df['signal_age_days'] = (expiry_dates - detected_dates).dt.days
            df['signal_freshness'] = np.where(
                df['signal_age_days'] > 0,
                1.0 / (1.0 + df['signal_age_days'] / 30.0),  # Decay over 30 days
                0.5
            )
        else:
            df['signal_age_days'] = 30
            df['signal_freshness'] = 0.5
        
        # 3. Strikes out of the money (how far OTM affects success)
        df['strikes_otm'] = np.abs(df['strike_distance_pct']) / 100.0
        
        # 4. Volume surprise (10x normal volume is very unusual)
        if 'current_volume' in df.columns:
            avg_volume = df.groupby('ticker')['current_volume'].transform('mean')
            df['volume_surprise'] = np.where(
                avg_volume > 0,
                df['current_volume'] / avg_volume,
                1.0
            )
        else:
            df['volume_surprise'] = 1.0
        
        # 5. Liquidity indicator (tight bid-ask spread = liquid)
        if 'bid' in df.columns and 'ask' in df.columns:
            mid_price = (df['bid'] + df['ask']) / 2.0
            df['bid_ask_spread_pct'] = np.where(
                mid_price > 0,
                ((df['ask'] - df['bid']) / mid_price) * 100,
                10.0  # Default to 10% for missing data
            )
            df['is_liquid'] = (df['bid_ask_spread_pct'] < 5.0).astype(int)
        else:
            df['bid_ask_spread_pct'] = 5.0
            df['is_liquid'] = 1

        return df

    def extract_features(
        self,
        df: pd.DataFrame,
        is_training: bool = True,
    ) -> pd.DataFrame:
        """
        Extract and engineer features from raw signal data.

        Args:
            df: Raw signal DataFrame
            is_training: If True, fit encoders/scalers

        Returns:
            DataFrame with engineered features
        """
        logger.info(f"Engineering features for {len(df)} signals...")

        # Make a copy to avoid modifying original
        df = df.copy()

        # Handle missing values
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0)

        # Encode categorical features
        df = self._encode_grade(df)
        df = self._encode_sentiment(df)
        df = self._encode_moneyness(df)
        df = self._encode_option_type(df)

        # Add market context features
        df = self._add_market_context_features(df)

        # Create derived features
        df = self._create_derived_features(df)

        # Select feature columns
        feature_cols = [
            # Signal quality
            "grade_numeric",
            "overall_score",
            "confidence",
            # Volume metrics
            "volume_ratio",
            "current_volume",
            # Premium metrics
            "premium_flow",
            "premium_flow_log",
            "aggressive_order_pct",
            "premium_flow_per_volume",
            # Detection flags
            "has_volume_anomaly",
            "has_oi_spike",
            "has_premium_flow",
            "has_sweep",
            "has_block_trade",
            "detection_flag_count",
            "volume_anomaly_score",
            # Greeks/Volatility
            "implied_volatility",
            "iv_rank",
            "iv_time_interaction",
            # Moneyness
            "moneyness_numeric",
            "strike_distance_pct",
            # Time factors
            "days_to_expiry",
            "time_decay_risk",
            "days_to_earnings",
            "has_near_catalyst",
            # Market context
            "sentiment_numeric",
            "is_call",
            "put_call_ratio",
            # OI metrics
            "current_oi",
            "oi_change_pct",
            # Interactions
            "score_confidence_interaction",
            # Market context features (8 new)
            "spy_return_1d",
            "spy_return_5d",
            "spy_return_20d",
            "spy_trend",
            "vix_level",
            "vix_change",
            "is_high_vix",
            "market_regime",
            # Quick-win features (10 new)
            "is_friday_expiry",
            "signal_age_days",
            "signal_freshness",
            "strikes_otm",
            "volume_surprise",
            "bid_ask_spread_pct",
            "is_liquid",
        ]

        # Filter to available columns
        available_features = [col for col in feature_cols if col in df.columns]
        
        # Handle any remaining NaN values (convert to numeric first to avoid deprecation warning)
        for col in available_features:
            if df[col].dtype == 'object':
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df[available_features] = df[available_features].fillna(0)

        # Replace inf values with large finite numbers
        df[available_features] = df[available_features].replace(
            [np.inf, -np.inf], [1e10, -1e10]
        )

        if is_training:
            self.feature_names = available_features

        logger.info(f"Extracted {len(available_features)} features")

        return df[available_features]

    def prepare_training_data(
        self,
        labeled_df: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
        """
        Prepare features and labels for training.

        Args:
            labeled_df: DataFrame with labels

        Returns:
            Tuple of (features_df, is_winner_labels, return_pct_labels)
        """
        # Extract features
        X = self.extract_features(labeled_df, is_training=True)

        # Extract labels
        y_classification = labeled_df["is_winner"].astype(int)
        y_regression = labeled_df["return_pct"].fillna(0)

        logger.info(
            f"Prepared training data: "
            f"{len(X)} samples, {X.shape[1]} features"
        )
        logger.info(
            f"Win rate: {y_classification.mean():.2%}"
        )

        return X, y_classification, y_regression

    def prepare_prediction_data(
        self,
        signals_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Prepare features for prediction.

        Args:
            signals_df: Raw signal DataFrame

        Returns:
            Features DataFrame
        """
        X = self.extract_features(signals_df, is_training=False)

        # Ensure same features as training
        if self.feature_names is not None:
            # Add missing features as zeros
            for col in self.feature_names:
                if col not in X.columns:
                    X[col] = 0

            # Reorder to match training
            X = X[self.feature_names]

        return X

    def get_feature_names(self) -> List[str]:
        """Get list of feature names."""
        return self.feature_names if self.feature_names else []

