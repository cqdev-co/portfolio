"""Training pipeline for ML models."""

from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from loguru import logger

from ml_predictor.config import get_settings
from ml_predictor.data.data_loader import DataLoader
from ml_predictor.data.feature_engineering import FeatureEngineer
from ml_predictor.data.label_generator import LabelGenerator
from ml_predictor.models.predictor import MLPredictor


class ModelTrainer:
    """Orchestrate the training pipeline."""

    def __init__(self):
        """Initialize trainer."""
        self.settings = get_settings()
        self.label_generator = LabelGenerator()
        self.feature_engineer = FeatureEngineer()
        self.data_loader = DataLoader()

    def train_from_scratch(
        self,
        min_grade: str = "B",
        limit: Optional[int] = None,
        save_model: bool = True,
    ) -> MLPredictor:
        """
        Train models from scratch using expired signals.

        Args:
            min_grade: Minimum signal grade
            limit: Maximum number of signals
            save_model: Whether to save trained model

        Returns:
            Trained MLPredictor
        """
        logger.info("Starting training pipeline from scratch...")

        # Step 1: Generate labels for expired signals
        logger.info("Step 1/4: Labeling expired signals...")
        labeled_df = self.label_generator.generate_and_save_labels(
            min_grade=min_grade,
            limit=limit,
        )

        if labeled_df.empty or len(labeled_df) < 50:
            raise ValueError(
                f"Insufficient training data: {len(labeled_df)} samples. "
                "Need at least 50 labeled signals."
            )

        # Step 2: Feature engineering
        logger.info("Step 2/4: Engineering features...")
        X, y_class, y_reg = self.feature_engineer.prepare_training_data(labeled_df)

        # Step 3: Train models
        logger.info("Step 3/4: Training ML models...")
        predictor = MLPredictor(model_dir=self.settings.models_dir)
        metrics = predictor.train(X, y_class, y_reg)

        # Step 4: Save model
        if save_model:
            logger.info("Step 4/4: Saving model...")
            version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            model_path = predictor.save(version=version)
            logger.info(f"Model saved to {model_path}")
        else:
            logger.info("Step 4/4: Skipping model save")

        # Log summary
        logger.info("=" * 60)
        logger.info("Training Complete!")
        logger.info("=" * 60)
        logger.info(f"Training samples: {len(X)}")
        logger.info(f"Features: {len(X.columns)}")

        if "classification" in metrics:
            logger.info(
                f"Win Probability AUC: "
                f"{metrics['classification'].get('val_auc', 0):.3f}"
            )
            logger.info(
                f"Win Probability Accuracy: "
                f"{metrics['classification'].get('val_accuracy', 0):.3f}"
            )

        if "regression" in metrics and metrics["regression"]:
            logger.info(
                f"Return Prediction MAE: "
                f"{metrics['regression'].get('val_mae', 0):.2f}%"
            )
            logger.info(
                f"Return Prediction R²: "
                f"{metrics['regression'].get('val_r2', 0):.3f}"
            )

        logger.info("=" * 60)

        return predictor

    def retrain_with_new_data(
        self,
        min_new_signals: Optional[int] = None,
    ) -> Optional[MLPredictor]:
        """
        Retrain models with newly expired signals.

        Args:
            min_new_signals: Minimum new signals required to trigger retrain

        Returns:
            Newly trained predictor, or None if skipped
        """
        if min_new_signals is None:
            min_new_signals = self.settings.min_signals_for_retrain

        logger.info("Checking for newly expired signals...")

        # Load existing labeled data
        existing_labeled = self.data_loader.load_labeled_data()

        # Fetch all expired signals
        all_expired = self.data_loader.fetch_expired_signals(min_grade="B")

        if all_expired.empty:
            logger.info("No expired signals found")
            return None

        # Find new signals (not in existing labeled data)
        if not existing_labeled.empty:
            existing_ids = set(existing_labeled["signal_id"])
            new_signals = all_expired[
                ~all_expired["signal_id"].isin(existing_ids)
            ]
        else:
            new_signals = all_expired

        logger.info(
            f"Found {len(new_signals)} new expired signals "
            f"(threshold: {min_new_signals})"
        )

        if len(new_signals) < min_new_signals:
            logger.info(
                f"Not enough new signals to retrain "
                f"({len(new_signals)} < {min_new_signals})"
            )
            return None

        # Label new signals
        logger.info("Labeling new signals...")
        newly_labeled = self.label_generator.label_signals(new_signals)

        if newly_labeled.empty:
            logger.warning("Failed to label new signals")
            return None

        # Combine with existing labeled data
        if not existing_labeled.empty:
            combined_labeled = pd.concat(
                [existing_labeled, newly_labeled], 
                ignore_index=True
            )
            # Remove duplicates
            combined_labeled = combined_labeled.drop_duplicates(
                subset=["signal_id"], 
                keep="last"
            )
        else:
            combined_labeled = newly_labeled

        logger.info(f"Total labeled signals: {len(combined_labeled)}")

        # Save combined labeled data
        self.data_loader.save_labeled_data(combined_labeled)

        # Train new model
        logger.info("Retraining models with updated data...")
        X, y_class, y_reg = self.feature_engineer.prepare_training_data(
            combined_labeled
        )

        predictor = MLPredictor(model_dir=self.settings.models_dir)
        metrics = predictor.train(X, y_class, y_reg)

        # Check if new model is better
        try:
            old_predictor = MLPredictor(model_dir=self.settings.models_dir)
            old_predictor.load()

            old_auc = old_predictor.metrics.get("classification", {}).get("val_auc", 0)
            new_auc = metrics.get("classification", {}).get("val_auc", 0)

            logger.info(f"Old model AUC: {old_auc:.3f}")
            logger.info(f"New model AUC: {new_auc:.3f}")

            if new_auc > old_auc:
                logger.info("✅ New model is better! Saving...")
                version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                predictor.save(version=version)
                return predictor
            else:
                logger.info("❌ New model is not better. Keeping old model.")
                return None

        except Exception as e:
            logger.warning(f"Could not compare with old model: {e}")
            # Save anyway if it's the first model
            version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            predictor.save(version=version)
            return predictor

