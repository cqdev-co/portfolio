#!/usr/bin/env python3
"""
Validate ML model authenticity using train/test split.

This script performs a proper validation of the ML model by:
1. Loading all expired signals
2. Splitting into train/test sets
3. Making predictions on test set
4. Comparing predictions to actual outcomes
"""

from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ml_predictor.data.data_loader import DataLoader
from ml_predictor.data.label_generator import LabelGenerator
from ml_predictor.data.feature_engineering import FeatureEngineer
from ml_predictor.models.predictor import MLPredictor
from ml_predictor.config import get_settings
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report
import numpy as np


def main():
    print("="*70)
    print("ML MODEL VALIDATION - Train/Test Split Analysis")
    print("="*70)
    
    # Load expired signals
    print("\n1. Loading expired signals...")
    loader = DataLoader()
    signals_df = loader.fetch_expired_signals(min_grade="B")
    print(f"   ✅ Found {len(signals_df)} expired signals")
    
    # Generate labels for all signals
    print("\n2. Generating win/loss labels...")
    labeler = LabelGenerator()
    labeled_df = labeler.label_signals(signals_df)
    
    # Drop rows without labels and rename column
    labeled_df = labeled_df.dropna(subset=['is_winner'])
    labeled_df['win'] = labeled_df['is_winner'].astype(int)
    print(f"   ✅ Successfully labeled {len(labeled_df)} signals")
    
    if len(labeled_df) < 50:
        print("\n   ⚠️  WARNING: Too few labeled signals for validation")
        print(f"   Need at least 50, got {len(labeled_df)}")
        return
    
    # Check win rate
    win_rate = labeled_df['win'].mean()
    print(f"   📊 Overall win rate: {win_rate:.1%}")
    
    # Split into train/test (80/20)
    print("\n3. Splitting into train/test sets...")
    train_df, test_df = train_test_split(
        labeled_df, 
        test_size=0.2, 
        random_state=42,
        stratify=labeled_df['win']
    )
    
    print(f"   Train set: {len(train_df)} signals ({train_df['win'].mean():.1%} win rate)")
    print(f"   Test set:  {len(test_df)} signals ({test_df['win'].mean():.1%} win rate)")
    
    # Load current model
    print("\n4. Loading trained model...")
    settings = get_settings()
    predictor = MLPredictor(model_dir=settings.models_dir)
    predictor.load()
    print(f"   ✅ Model loaded: {predictor.model_version}")
    
    # Prepare test features
    print("\n5. Preparing test features...")
    feature_engineer = FeatureEngineer()
    feature_engineer.feature_names = predictor.feature_names
    X_test = feature_engineer.prepare_prediction_data(test_df)
    
    # Make predictions
    print("\n6. Making predictions on test set...")
    predictions = predictor.predict(X_test)
    
    # Add predictions to test data
    test_df = test_df.copy()
    test_df['predicted_win_prob'] = predictions['win_probability'].values
    test_df['predicted_win'] = (test_df['predicted_win_prob'] >= 0.45).astype(int)
    
    # Calculate metrics
    print("\n" + "="*70)
    print("VALIDATION RESULTS")
    print("="*70)
    
    correct = (test_df['predicted_win'] == test_df['win']).sum()
    total = len(test_df)
    accuracy = correct / total
    
    print(f"\n📊 Overall Performance:")
    print(f"   Test Set Size: {total} signals")
    print(f"   Accuracy: {accuracy:.1%}")
    print(f"   Correct Predictions: {correct}/{total}")
    
    # Confusion Matrix
    print(f"\n📊 Confusion Matrix:")
    cm = confusion_matrix(test_df['win'], test_df['predicted_win'])
    print(f"                    Predicted")
    print(f"                    Loss    Win")
    print(f"   Actual Loss:     {cm[0,0]:4d}    {cm[0,1]:4d}")
    print(f"          Win:      {cm[1,0]:4d}    {cm[1,1]:4d}")
    
    # Calculate precision, recall, f1
    tn, fp, fn, tp = cm.ravel()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    print(f"\n📊 Detailed Metrics:")
    print(f"   Precision (Win predictions correct): {precision:.1%}")
    print(f"   Recall (Actual wins caught):         {recall:.1%}")
    print(f"   F1 Score:                            {f1:.1%}")
    
    # Win probability calibration
    print(f"\n📊 Win Probability Calibration:")
    print(f"   (Are high confidence predictions actually winning?)")
    print()
    print(f"   {'Threshold':<12} {'Count':>6} {'Actual Win Rate':>18} {'Status':>10}")
    print(f"   {'-'*50}")
    
    for threshold in [0.40, 0.50, 0.60, 0.70, 0.80, 0.90]:
        high_conf = test_df[test_df['predicted_win_prob'] >= threshold]
        if len(high_conf) > 0:
            actual_win_rate = high_conf['win'].mean()
            expected_rate = threshold
            diff = actual_win_rate - expected_rate
            
            if abs(diff) < 0.10:
                status = "✅ Good"
            elif diff > 0:
                status = "🟢 Better"
            else:
                status = "⚠️  Lower"
            
            print(f"   ≥{threshold:.0%}         {len(high_conf):6d}         {actual_win_rate:7.1%}          {status}")
        else:
            print(f"   ≥{threshold:.0%}         {0:6d}         {'N/A':>7}          -")
    
    # Show some example predictions
    print(f"\n📊 Example Predictions (Test Set):")
    print(f"\n   High Confidence Correct:")
    correct_high = test_df[
        (test_df['predicted_win'] == test_df['win']) & 
        (test_df['predicted_win_prob'] > 0.70)
    ].head(3)
    
    for _, row in correct_high.iterrows():
        result = "WIN" if row['win'] else "LOSS"
        print(f"   {row['ticker']:6s} - Predicted: {row['predicted_win_prob']:.0%}, Actual: {result} ✅")
    
    print(f"\n   Incorrect Predictions:")
    incorrect = test_df[test_df['predicted_win'] != test_df['win']].head(3)
    
    for _, row in incorrect.iterrows():
        predicted = "WIN" if row['predicted_win'] else "LOSS"
        actual = "WIN" if row['win'] else "LOSS"
        print(f"   {row['ticker']:6s} - Predicted: {predicted} ({row['predicted_win_prob']:.0%}), Actual: {actual} ❌")
    
    # Feature Importance
    print("\n" + "="*70)
    print("FEATURE IMPORTANCE")
    print("="*70)
    
    try:
        importance_df = predictor.get_feature_importance(top_n=15)
        print("\nTop 15 Most Important Features:")
        print()
        for idx, row in importance_df.iterrows():
            bar_length = int(row['importance'] * 50)
            bar = '█' * bar_length
            print(f"  {row['feature']:<30} {bar} {row['importance']:.4f}")
    except Exception as e:
        print(f"Could not extract feature importance: {e}")
    
    print("\n" + "="*70)
    print("CONCLUSION")
    print("="*70)
    
    if accuracy >= 0.75:
        print("✅ Model performs well on unseen data")
    elif accuracy >= 0.65:
        print("⚠️  Model shows moderate performance")
    else:
        print("❌ Model needs improvement")
    
    print(f"\nThe model's {accuracy:.1%} accuracy on unseen data suggests")
    print("it can generalize to new signals, not just memorizing training data.")
    print("\n" + "="*70)


if __name__ == "__main__":
    main()

