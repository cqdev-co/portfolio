"""Model evaluation utilities."""

from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


class ModelEvaluator:
    """Evaluate ML model performance."""

    @staticmethod
    def evaluate_classification(
        y_true: pd.Series,
        y_pred_proba: np.ndarray,
        threshold: float = 0.5,
    ) -> Dict:
        """
        Evaluate binary classification model.

        Args:
            y_true: True labels
            y_pred_proba: Predicted probabilities
            threshold: Classification threshold

        Returns:
            Dictionary of metrics
        """
        y_pred = (y_pred_proba > threshold).astype(int)

        metrics = {
            "auc": roc_auc_score(y_true, y_pred_proba),
            "accuracy": accuracy_score(y_true, y_pred),
            "precision": precision_score(y_true, y_pred, zero_division=0),
            "recall": recall_score(y_true, y_pred, zero_division=0),
            "f1": f1_score(y_true, y_pred, zero_division=0),
        }

        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()

        if len(cm) == 2:
            tn, fp, fn, tp = cm.ravel()
            metrics["true_negatives"] = int(tn)
            metrics["false_positives"] = int(fp)
            metrics["false_negatives"] = int(fn)
            metrics["true_positives"] = int(tp)

        return metrics

    @staticmethod
    def evaluate_regression(
        y_true: pd.Series,
        y_pred: np.ndarray,
    ) -> Dict:
        """
        Evaluate regression model.

        Args:
            y_true: True values
            y_pred: Predicted values

        Returns:
            Dictionary of metrics
        """
        metrics = {
            "mae": mean_absolute_error(y_true, y_pred),
            "rmse": np.sqrt(mean_squared_error(y_true, y_pred)),
            "r2": r2_score(y_true, y_pred),
            "mean_error": np.mean(y_pred - y_true),
        }

        return metrics

    @staticmethod
    def calculate_expected_value_accuracy(
        y_true_class: pd.Series,
        y_true_return: pd.Series,
        y_pred_class_proba: np.ndarray,
        y_pred_return: np.ndarray,
    ) -> Dict:
        """
        Calculate expected value prediction accuracy.

        Args:
            y_true_class: True win/loss labels
            y_true_return: True return %
            y_pred_class_proba: Predicted win probability
            y_pred_return: Predicted return %

        Returns:
            Expected value metrics
        """
        # Calculate true expected value
        true_ev = np.where(y_true_class == 1, y_true_return, -100)  # -100% for losses

        # Calculate predicted expected value
        pred_ev = y_pred_class_proba * y_pred_return

        # Metrics
        metrics = {
            "ev_mae": mean_absolute_error(true_ev, pred_ev),
            "ev_correlation": np.corrcoef(true_ev, pred_ev)[0, 1],
        }

        return metrics

    @staticmethod
    def analyze_predictions_by_grade(
        predictions_df: pd.DataFrame,
        actual_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Analyze prediction performance by signal grade.

        Args:
            predictions_df: Predictions with signal_id
            actual_df: Actual outcomes with signal_id and grade

        Returns:
            DataFrame with performance by grade
        """
        merged = predictions_df.merge(
            actual_df[["signal_id", "grade", "is_winner"]], 
            on="signal_id"
        )

        results = []
        for grade in ["S", "A", "B", "C"]:
            grade_data = merged[merged["grade"] == grade]
            if len(grade_data) > 0:
                results.append(
                    {
                        "grade": grade,
                        "count": len(grade_data),
                        "actual_win_rate": grade_data["is_winner"].mean(),
                        "avg_predicted_prob": grade_data["win_probability"].mean(),
                        "correlation": np.corrcoef(
                            grade_data["is_winner"], 
                            grade_data["win_probability"]
                        )[0, 1],
                    }
                )

        return pd.DataFrame(results)

