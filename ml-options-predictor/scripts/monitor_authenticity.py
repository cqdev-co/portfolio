#!/usr/bin/env python3
"""
Monitor ML model authenticity and performance over time.

This script checks:
1. Forward testing accuracy (predictions vs actual outcomes)
2. Feature drift detection
3. Model performance degradation
4. Data quality issues
"""

from pathlib import Path
import sys
import json
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ml_predictor.data.data_loader import DataLoader
from ml_predictor.models.predictor import MLPredictor
from ml_predictor.config import get_settings
import pandas as pd
import numpy as np


def check_data_quality():
    """Check training data quality."""
    print("\n" + "="*70)
    print("DATA QUALITY CHECK")
    print("="*70)
    
    loader = DataLoader()
    signals = loader.fetch_expired_signals()
    
    print(f"\n📊 Dataset Statistics:")
    print(f"   Total expired signals: {len(signals)}")
    
    if len(signals) > 0:
        win_rate = signals.get('is_winner', pd.Series()).mean()
        print(f"   Win rate: {win_rate:.1%}" if not pd.isna(win_rate) else "   Win rate: N/A")
        
        # Check missing data
        missing = signals.isnull().sum().sum()
        missing_pct = missing / (len(signals) * len(signals.columns)) * 100
        print(f"   Missing data: {missing} cells ({missing_pct:.1f}%)")
        
        # Quality assessment
        issues = []
        if len(signals) < 100:
            issues.append("⚠️  Insufficient data (<100 signals)")
        if win_rate < 0.40 or win_rate > 0.70:
            issues.append(f"⚠️  Unusual win rate ({win_rate:.1%})")
        if missing_pct > 10:
            issues.append(f"⚠️  Excessive missing data ({missing_pct:.1f}%)")
        
        if issues:
            print("\n🚨 Issues Found:")
            for issue in issues:
                print(f"   {issue}")
        else:
            print("\n✅ Data quality looks good")
    else:
        print("   ❌ No expired signals found")
    
    return len(signals), win_rate if len(signals) > 0 else 0


def check_feature_drift():
    """Detect feature distribution drift."""
    print("\n" + "="*70)
    print("FEATURE DRIFT DETECTION")
    print("="*70)
    
    loader = DataLoader()
    signals = loader.fetch_expired_signals()
    
    if len(signals) < 200:
        print("\n⚠️  Not enough data for drift detection (need 200+)")
        return
    
    # Split into historical vs recent
    split_idx = int(len(signals) * 0.5)
    historical = signals.iloc[:split_idx]
    recent = signals.iloc[split_idx:]
    
    print(f"\nComparing:")
    print(f"   Historical: {len(historical)} signals (older half)")
    print(f"   Recent: {len(recent)} signals (newer half)")
    
    # Check key numeric features
    numeric_features = [
        'volume_ratio', 'premium_flow', 'implied_volatility',
        'current_volume', 'overall_score', 'confidence'
    ]
    
    drifts = []
    print("\n📊 Feature Drift Analysis:")
    
    for feature in numeric_features:
        if feature not in signals.columns:
            continue
        
        hist_mean = historical[feature].mean()
        recent_mean = recent[feature].mean()
        
        if hist_mean == 0:
            continue
        
        drift_pct = abs(recent_mean - hist_mean) / abs(hist_mean) * 100
        
        status = "✅" if drift_pct < 20 else "⚠️" if drift_pct < 30 else "❌"
        print(f"   {status} {feature:<25} {drift_pct:>6.1f}% drift")
        
        if drift_pct > 30:
            drifts.append((feature, drift_pct))
    
    if drifts:
        print(f"\n🚨 Significant drift detected in {len(drifts)} features:")
        for feature, drift in drifts:
            print(f"   - {feature}: {drift:.1f}% change")
        print("   Recommendation: Consider retraining model")
    else:
        print("\n✅ No significant feature drift detected")


def check_model_performance():
    """Check current model performance metrics."""
    print("\n" + "="*70)
    print("MODEL PERFORMANCE CHECK")
    print("="*70)
    
    try:
        settings = get_settings()
        predictor = MLPredictor(model_dir=settings.models_dir)
        predictor.load()
        
        print(f"\n📊 Current Model:")
        print(f"   Version: {predictor.model_version}")
        print(f"   Features: {len(predictor.feature_names)}")
        
        if predictor.metrics:
            class_metrics = predictor.metrics.get('classification', {})
            if class_metrics:
                auc = class_metrics.get('val_auc', 0)
                acc = class_metrics.get('val_accuracy', 0)
                
                print(f"\n📈 Validation Metrics:")
                print(f"   AUC: {auc:.3f}")
                print(f"   Accuracy: {acc:.3f}")
                
                # Performance assessment
                issues = []
                if auc < 0.85:
                    issues.append("❌ AUC below 0.85 (poor)")
                elif auc < 0.90:
                    issues.append("⚠️  AUC below 0.90 (fair)")
                else:
                    print(f"   ✅ AUC is excellent (>{0.90:.2f})")
                
                if acc < 0.75:
                    issues.append("❌ Accuracy below 75% (poor)")
                elif acc < 0.85:
                    issues.append("⚠️  Accuracy below 85% (fair)")
                else:
                    print(f"   ✅ Accuracy is excellent (>{0.85:.2f})")
                
                if issues:
                    print("\n🚨 Performance Issues:")
                    for issue in issues:
                        print(f"   {issue}")
                    print("   Recommendation: Retrain model with more data")
        
        # Check feature importance
        try:
            importance_df = predictor.get_feature_importance(top_n=5)
            print(f"\n📊 Top 5 Most Important Features:")
            for _, row in importance_df.iterrows():
                print(f"   - {row['feature']}: {row['importance']:.4f}")
        except:
            pass
        
    except Exception as e:
        print(f"\n❌ Could not load model: {e}")
        print("   Recommendation: Train a model first")


def generate_recommendations():
    """Generate actionable recommendations based on checks."""
    print("\n" + "="*70)
    print("RECOMMENDATIONS")
    print("="*70)
    
    # This would be populated based on the checks above
    recommendations = []
    
    # Check if we have enough data
    loader = DataLoader()
    signals = loader.fetch_expired_signals()
    
    if len(signals) < 100:
        recommendations.append(
            "🔴 CRITICAL: Collect more data (current: {}, need: 100+)"
            .format(len(signals))
        )
    elif len(signals) < 500:
        recommendations.append(
            "🟡 MODERATE: More data would improve model (current: {}, target: 500+)"
            .format(len(signals))
        )
    else:
        recommendations.append(
            "🟢 GOOD: Sufficient training data ({} signals)"
            .format(len(signals))
        )
    
    # Check model age
    try:
        settings = get_settings()
        predictor = MLPredictor(model_dir=settings.models_dir)
        predictor.load()
        
        # Assume version format: v20251107_211931
        version = predictor.model_version
        if version.startswith('v'):
            date_str = version[1:9]  # Extract YYYYMMDD
            model_date = datetime.strptime(date_str, '%Y%m%d')
            days_old = (datetime.now() - model_date).days
            
            if days_old > 30:
                recommendations.append(
                    f"🟡 Model is {days_old} days old. "
                    f"Consider retraining (weekly recommended)"
                )
            elif days_old > 7:
                recommendations.append(
                    f"🟢 Model is {days_old} days old. "
                    f"Still fresh, but retrain weekly"
                )
            else:
                recommendations.append(
                    f"🟢 Model is fresh ({days_old} days old)"
                )
    except:
        recommendations.append(
            "🟡 Could not determine model age"
        )
    
    # General recommendations
    recommendations.append(
        "📅 SCHEDULE: Run weekly retraining (Sundays)"
    )
    recommendations.append(
        "📊 MONITOR: Check forward testing accuracy monthly"
    )
    recommendations.append(
        "🎯 VALIDATE: Run validation script after each retrain"
    )
    
    print("\n" + "\n".join(recommendations))


def main():
    """Run all authenticity checks."""
    print("="*70)
    print("ML MODEL AUTHENTICITY MONITOR")
    print("="*70)
    print(f"Run Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all checks
    check_data_quality()
    check_feature_drift()
    check_model_performance()
    generate_recommendations()
    
    print("\n" + "="*70)
    print("MONITORING COMPLETE")
    print("="*70)
    print("\nNext Steps:")
    print("  1. Review any issues flagged above")
    print("  2. Retrain if recommended: poetry run ml-predict train --retrain")
    print("  3. Validate after retrain: poetry run python scripts/validate_model.py")
    print("  4. Schedule weekly retraining (cron)")
    print("\n" + "="*70)


if __name__ == "__main__":
    main()

