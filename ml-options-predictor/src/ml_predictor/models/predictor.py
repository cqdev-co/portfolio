"""ML prediction models."""

from pathlib import Path
from typing import Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from loguru import logger
from sklearn.model_selection import train_test_split


class MLPredictor:
    """XGBoost-based predictor for win probability and expected return."""

    def __init__(self, model_dir: Optional[Path] = None):
        """
        Initialize predictor.

        Args:
            model_dir: Directory to save/load models
        """
        self.model_dir = model_dir
        self.classification_model: Optional[xgb.XGBClassifier] = None
        self.regression_model: Optional[xgb.XGBRegressor] = None
        self.feature_names: Optional[list] = None
        self.model_version: str = "v1"
        self.metrics: Dict = {}

    def train_classification_model(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        params: Optional[Dict] = None,
    ) -> Dict:
        """
        Train win probability classification model.

        Args:
            X_train: Training features
            y_train: Training labels (binary: 0/1)
            X_val: Validation features
            y_val: Validation labels
            params: Model hyperparameters

        Returns:
            Training metrics
        """
        logger.info("Training classification model (win probability)...")

        # Default parameters
        if params is None:
            params = {
                "max_depth": 7,
                "learning_rate": 0.03,
                "n_estimators": 500,
                "min_child_weight": 5,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "objective": "binary:logistic",
                "eval_metric": "auc",
                "random_state": 42,
            }

        # Calculate class weights for imbalanced data
        n_pos = y_train.sum()
        n_neg = len(y_train) - n_pos
        if n_pos > 0:
            scale_pos_weight = n_neg / n_pos
            params["scale_pos_weight"] = scale_pos_weight
            logger.info(
                f"Class balance: {n_pos} winners, {n_neg} losers "
                f"(scale_pos_weight={scale_pos_weight:.2f})"
            )

        # Initialize model
        self.classification_model = xgb.XGBClassifier(**params)

        # Train with early stopping
        self.classification_model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        # Calculate metrics
        train_pred = self.classification_model.predict_proba(X_train)[:, 1]
        val_pred = self.classification_model.predict_proba(X_val)[:, 1]

        from sklearn.metrics import roc_auc_score, accuracy_score, f1_score

        metrics = {
            "train_auc": roc_auc_score(y_train, train_pred),
            "val_auc": roc_auc_score(y_val, val_pred),
            "train_accuracy": accuracy_score(
                y_train, (train_pred > 0.5).astype(int)
            ),
            "val_accuracy": accuracy_score(y_val, (val_pred > 0.5).astype(int)),
            "train_f1": f1_score(y_train, (train_pred > 0.5).astype(int)),
            "val_f1": f1_score(y_val, (val_pred > 0.5).astype(int)),
        }

        logger.info(f"Classification metrics: {metrics}")

        self.metrics["classification"] = metrics
        return metrics

    def train_regression_model(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        params: Optional[Dict] = None,
    ) -> Dict:
        """
        Train expected return regression model.

        Args:
            X_train: Training features
            y_train: Training labels (return %)
            X_val: Validation features
            y_val: Validation labels
            params: Model hyperparameters

        Returns:
            Training metrics
        """
        logger.info("Training regression model (expected return)...")

        # Default parameters
        if params is None:
            params = {
                "max_depth": 6,
                "learning_rate": 0.05,
                "n_estimators": 300,
                "min_child_weight": 3,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "objective": "reg:squarederror",
                "random_state": 42,
            }

        # Initialize model
        self.regression_model = xgb.XGBRegressor(**params)

        # Train with early stopping
        self.regression_model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        # Calculate metrics
        train_pred = self.regression_model.predict(X_train)
        val_pred = self.regression_model.predict(X_val)

        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        metrics = {
            "train_mae": mean_absolute_error(y_train, train_pred),
            "val_mae": mean_absolute_error(y_val, val_pred),
            "train_rmse": np.sqrt(mean_squared_error(y_train, train_pred)),
            "val_rmse": np.sqrt(mean_squared_error(y_val, val_pred)),
            "train_r2": r2_score(y_train, train_pred),
            "val_r2": r2_score(y_val, val_pred),
        }

        logger.info(f"Regression metrics: {metrics}")

        self.metrics["regression"] = metrics
        return metrics

    def train(
        self,
        X: pd.DataFrame,
        y_classification: pd.Series,
        y_regression: pd.Series,
        test_size: float = 0.3,
        val_size: float = 0.5,
        stratify_col: Optional[str] = None,
        time_aware: bool = True,
    ) -> Dict:
        """
        Train both classification and regression models.

        Args:
            X: Features
            y_classification: Win/loss labels
            y_regression: Return % labels
            test_size: Test set proportion
            val_size: Validation set proportion (of test set)
            stratify_col: Column name to stratify split (only for random split)
            time_aware: If True, use chronological split (train on oldest, test on newest)

        Returns:
            Combined metrics
        """
        logger.info(f"Training models on {len(X)} samples...")

        # Store feature names
        self.feature_names = list(X.columns)

        if time_aware:
            logger.info("Using time-aware validation (train on oldest data, test on newest)")
            
            # Assume data is already sorted by date (from data loading)
            # Calculate split points
            n = len(X)
            train_end = int(n * (1 - test_size))
            val_end = int(train_end + (n - train_end) * (1 - val_size))
            
            # Split chronologically
            X_train = X.iloc[:train_end]
            y_class_train = y_classification.iloc[:train_end]
            y_reg_train = y_regression.iloc[:train_end]
            
            X_val = X.iloc[train_end:val_end]
            y_class_val = y_classification.iloc[train_end:val_end]
            y_reg_val = y_regression.iloc[train_end:val_end]
            
            X_test = X.iloc[val_end:]
            y_class_test = y_classification.iloc[val_end:]
            y_reg_test = y_regression.iloc[val_end:]
            
            logger.info(
                f"Time-aware split: train={len(X_train)} (oldest), "
                f"val={len(X_val)}, test={len(X_test)} (newest)"
            )
            
        else:
            logger.info("Using random validation split")
            
            # Random split (original behavior)
            stratify = None
            if stratify_col and stratify_col in X.columns:
                stratify = X[stratify_col]

            X_train, X_temp, y_class_train, y_class_temp, y_reg_train, y_reg_temp = (
                train_test_split(
                    X,
                    y_classification,
                    y_regression,
                    test_size=test_size,
                    stratify=stratify,
                    random_state=42,
                )
            )

            # Split temp into val and test
            X_val, X_test, y_class_val, y_class_test, y_reg_val, y_reg_test = (
                train_test_split(
                    X_temp,
                    y_class_temp,
                    y_reg_temp,
                    test_size=val_size,
                    random_state=42,
                )
            )

            logger.info(
                f"Random split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}"
            )

        # Train classification model
        class_metrics = self.train_classification_model(
            X_train, y_class_train, X_val, y_class_val
        )

        # Train regression model (only on winners for positive returns)
        winner_mask_train = y_class_train == 1
        winner_mask_val = y_class_val == 1

        if winner_mask_train.sum() > 10:  # Need minimum samples
            reg_metrics = self.train_regression_model(
                X_train[winner_mask_train],
                y_reg_train[winner_mask_train],
                X_val[winner_mask_val],
                y_reg_val[winner_mask_val],
            )
        else:
            logger.warning("Not enough winners to train regression model")
            reg_metrics = {}

        # Combine metrics
        all_metrics = {
            "classification": class_metrics,
            "regression": reg_metrics,
            "test_auc": None,  # Will calculate on demand
        }

        self.metrics = all_metrics

        return all_metrics

    def get_feature_importance(self, top_n: int = 20) -> pd.DataFrame:
        """
        Get feature importance from classification model.
        
        Args:
            top_n: Number of top features to return
            
        Returns:
            DataFrame with feature importance sorted by importance
        """
        if self.classification_model is None:
            raise ValueError("Model not trained")
        
        if not hasattr(self.classification_model, 'feature_importances_'):
            raise ValueError("Model does not support feature importance")
        
        importance_df = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.classification_model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        return importance_df.head(top_n)
    
    def predict(
        self,
        X: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Make predictions.

        Args:
            X: Features

        Returns:
            DataFrame with predictions
        """
        if self.classification_model is None:
            raise ValueError("Classification model not trained")

        # Ensure features match training
        if self.feature_names:
            for col in self.feature_names:
                if col not in X.columns:
                    X[col] = 0
            X = X[self.feature_names]

        # Predict win probability
        win_prob = self.classification_model.predict_proba(X)[:, 1]

        # Predict expected return (only if model trained)
        if self.regression_model is not None:
            expected_return = self.regression_model.predict(X)
        else:
            expected_return = np.zeros(len(X))

        # Calculate expected value
        expected_value = win_prob * expected_return

        # Create predictions DataFrame
        predictions = pd.DataFrame(
            {
                "win_probability": win_prob,
                "expected_return_pct": expected_return,
                "expected_value": expected_value,
            }
        )

        return predictions

    def save(self, version: Optional[str] = None) -> Path:
        """
        Save models to disk.

        Args:
            version: Model version

        Returns:
            Path to saved model
        """
        if self.model_dir is None:
            raise ValueError("model_dir not set")

        if version:
            self.model_version = version

        model_path = self.model_dir / f"model_{self.model_version}.pkl"

        model_data = {
            "classification_model": self.classification_model,
            "regression_model": self.regression_model,
            "feature_names": self.feature_names,
            "metrics": self.metrics,
            "version": self.model_version,
        }

        joblib.dump(model_data, model_path)
        logger.info(f"Saved model to {model_path}")

        return model_path

    def load(self, version: Optional[str] = None) -> None:
        """
        Load models from disk.

        Args:
            version: Model version to load
        """
        if self.model_dir is None:
            raise ValueError("model_dir not set")

        if version:
            model_path = self.model_dir / f"model_{version}.pkl"
        else:
            # Load latest version
            model_files = sorted(self.model_dir.glob("model_*.pkl"))
            if not model_files:
                raise FileNotFoundError("No models found")
            model_path = model_files[-1]

        logger.info(f"Loading model from {model_path}")

        model_data = joblib.load(model_path)

        self.classification_model = model_data["classification_model"]
        self.regression_model = model_data["regression_model"]
        self.feature_names = model_data["feature_names"]
        self.metrics = model_data.get("metrics", {})
        self.model_version = model_data.get("version", "unknown")

        logger.info(f"Loaded model version {self.model_version}")

    def get_feature_importance(self, top_n: int = 20) -> pd.DataFrame:
        """
        Get feature importance from classification model.

        Args:
            top_n: Number of top features to return

        Returns:
            DataFrame with feature importance
        """
        if self.classification_model is None:
            raise ValueError("Model not trained")

        importance = self.classification_model.feature_importances_
        feature_importance = pd.DataFrame(
            {
                "feature": self.feature_names,
                "importance": importance,
            }
        ).sort_values("importance", ascending=False)

        return feature_importance.head(top_n)

