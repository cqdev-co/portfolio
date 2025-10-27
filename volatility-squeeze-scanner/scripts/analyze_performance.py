#!/usr/bin/env python3
"""
Performance analysis script for the volatility squeeze scanner.
Analyzes exported data to identify issues and performance metrics.
"""

import json
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict, Counter
import numpy as np
from pathlib import Path

class ScannerPerformanceAnalyzer:
    """Analyzes volatility squeeze scanner performance over time."""
    
    def __init__(self, exports_dir: str = "exports"):
        self.exports_dir = Path(exports_dir)
        self.signals_data = None
        self.performance_data = None
        
    def load_data(self) -> None:
        """Load the exported data files."""
        # Find the most recent export files
        signal_files = list(self.exports_dir.glob("volatility_squeeze_signals_*.json"))
        performance_files = list(self.exports_dir.glob("signal_performance_*.json"))
        
        if not signal_files or not performance_files:
            raise FileNotFoundError("No export files found in exports directory")
        
        # Get the most recent files
        latest_signal_file = max(signal_files, key=lambda x: x.stat().st_mtime)
        latest_performance_file = max(performance_files, key=lambda x: x.stat().st_mtime)
        
        print(f"Loading signals from: {latest_signal_file}")
        print(f"Loading performance from: {latest_performance_file}")
        
        with open(latest_signal_file, 'r') as f:
            self.signals_data = json.load(f)
        
        with open(latest_performance_file, 'r') as f:
            self.performance_data = json.load(f)
    
    def analyze_duplicates(self) -> Dict[str, Any]:
        """Analyze duplicate signals in the dataset."""
        print("\n=== DUPLICATE ANALYSIS ===")
        
        # Group signals by symbol and scan_date
        symbol_date_groups = defaultdict(list)
        
        for signal in self.signals_data:
            key = (signal['symbol'], signal['scan_date'])
            symbol_date_groups[key].append(signal)
        
        # Find duplicates
        duplicates = {k: v for k, v in symbol_date_groups.items() if len(v) > 1}
        
        print(f"Total unique symbol-date combinations: {len(symbol_date_groups)}")
        print(f"Duplicate symbol-date combinations: {len(duplicates)}")
        
        if duplicates:
            print("\nDuplicate Details:")
            for (symbol, scan_date), signals in duplicates.items():
                print(f"\n{symbol} on {scan_date}: {len(signals)} duplicates")
                for i, signal in enumerate(signals):
                    created_at = signal.get('created_at', 'N/A')
                    updated_at = signal.get('updated_at', 'N/A')
                    signal_status = signal.get('signal_status', 'N/A')
                    days_in_squeeze = signal.get('days_in_squeeze', 'N/A')
                    print(f"  {i+1}. ID: {signal['id'][:8]}... Status: {signal_status}, "
                          f"Days: {days_in_squeeze}, Created: {created_at}, Updated: {updated_at}")
        
        # Analyze KLG specifically
        klg_signals = [s for s in self.signals_data if s['symbol'] == 'KLG']
        klg_by_date = defaultdict(list)
        for signal in klg_signals:
            klg_by_date[signal['scan_date']].append(signal)
        
        print(f"\n=== KLG SPECIFIC ANALYSIS ===")
        print(f"Total KLG signals: {len(klg_signals)}")
        print(f"KLG signals by date:")
        for scan_date, signals in sorted(klg_by_date.items()):
            print(f"  {scan_date}: {len(signals)} signals")
            if len(signals) > 1:
                print("    DUPLICATE DETECTED!")
                for signal in signals:
                    print(f"    - ID: {signal['id'][:8]}..., Status: {signal.get('signal_status')}, "
                          f"Created: {signal.get('created_at')}")
        
        return {
            'total_combinations': len(symbol_date_groups),
            'duplicate_combinations': len(duplicates),
            'duplicate_details': duplicates,
            'klg_analysis': {
                'total_signals': len(klg_signals),
                'signals_by_date': dict(klg_by_date)
            }
        }
    
    def analyze_signal_continuity(self) -> Dict[str, Any]:
        """Analyze signal continuity patterns."""
        print("\n=== SIGNAL CONTINUITY ANALYSIS ===")
        
        # Group signals by symbol
        signals_by_symbol = defaultdict(list)
        for signal in self.signals_data:
            signals_by_symbol[signal['symbol']].append(signal)
        
        # Sort each symbol's signals by scan_date
        for symbol in signals_by_symbol:
            signals_by_symbol[symbol].sort(key=lambda x: x['scan_date'])
        
        continuity_stats = {
            'total_symbols': len(signals_by_symbol),
            'single_day_signals': 0,
            'multi_day_signals': 0,
            'max_consecutive_days': 0,
            'avg_days_in_squeeze': 0,
            'status_distribution': Counter(),
            'problematic_patterns': []
        }
        
        total_days = 0
        total_signals = 0
        
        for symbol, signals in signals_by_symbol.items():
            if len(signals) == 1:
                continuity_stats['single_day_signals'] += 1
            else:
                continuity_stats['multi_day_signals'] += 1
            
            # Analyze consecutive days
            dates = [datetime.fromisoformat(s['scan_date']).date() for s in signals]
            consecutive_days = self._find_consecutive_days(dates)
            continuity_stats['max_consecutive_days'] = max(
                continuity_stats['max_consecutive_days'], 
                consecutive_days
            )
            
            # Check for status inconsistencies
            statuses = [s.get('signal_status', 'UNKNOWN') for s in signals]
            days_in_squeeze = [s.get('days_in_squeeze', 1) for s in signals]
            
            for status in statuses:
                continuity_stats['status_distribution'][status] += 1
            
            total_days += sum(days_in_squeeze)
            total_signals += len(signals)
            
            # Check for problematic patterns
            if len(signals) > 1:
                # Check if first signal is not NEW
                if signals[0].get('signal_status') != 'NEW':
                    continuity_stats['problematic_patterns'].append({
                        'symbol': symbol,
                        'issue': 'First signal not NEW',
                        'first_status': signals[0].get('signal_status')
                    })
                
                # Check for decreasing days_in_squeeze
                for i in range(1, len(signals)):
                    prev_days = signals[i-1].get('days_in_squeeze', 1)
                    curr_days = signals[i].get('days_in_squeeze', 1)
                    if curr_days < prev_days:
                        continuity_stats['problematic_patterns'].append({
                            'symbol': symbol,
                            'issue': 'Days in squeeze decreased',
                            'prev_days': prev_days,
                            'curr_days': curr_days,
                            'dates': [signals[i-1]['scan_date'], signals[i]['scan_date']]
                        })
        
        continuity_stats['avg_days_in_squeeze'] = total_days / total_signals if total_signals > 0 else 0
        
        print(f"Total symbols tracked: {continuity_stats['total_symbols']}")
        print(f"Single-day signals: {continuity_stats['single_day_signals']}")
        print(f"Multi-day signals: {continuity_stats['multi_day_signals']}")
        print(f"Max consecutive days: {continuity_stats['max_consecutive_days']}")
        print(f"Average days in squeeze: {continuity_stats['avg_days_in_squeeze']:.2f}")
        print(f"Status distribution: {dict(continuity_stats['status_distribution'])}")
        
        if continuity_stats['problematic_patterns']:
            print(f"\nProblematic patterns found: {len(continuity_stats['problematic_patterns'])}")
            for pattern in continuity_stats['problematic_patterns'][:10]:  # Show first 10
                print(f"  - {pattern}")
        
        return continuity_stats
    
    def analyze_performance_tracking(self) -> Dict[str, Any]:
        """Analyze performance tracking data."""
        print("\n=== PERFORMANCE TRACKING ANALYSIS ===")
        
        if not self.performance_data:
            print("No performance data available")
            return {}
        
        # Basic statistics
        total_trades = len(self.performance_data)
        closed_trades = [t for t in self.performance_data if t.get('status') == 'CLOSED']
        active_trades = [t for t in self.performance_data if t.get('status') == 'ACTIVE']
        
        print(f"Total tracked trades: {total_trades}")
        print(f"Closed trades: {len(closed_trades)}")
        print(f"Active trades: {len(active_trades)}")
        
        if not closed_trades:
            print("No closed trades to analyze")
            return {'total_trades': total_trades, 'closed_trades': 0, 'active_trades': len(active_trades)}
        
        # Performance metrics for closed trades
        returns = [float(t['return_pct']) for t in closed_trades if t.get('return_pct') is not None]
        winners = [r for r in returns if r > 0]
        losers = [r for r in returns if r < 0]
        
        win_rate = len(winners) / len(returns) * 100 if returns else 0
        avg_return = np.mean(returns) if returns else 0
        avg_winner = np.mean(winners) if winners else 0
        avg_loser = np.mean(losers) if losers else 0
        
        # Days held analysis
        days_held = [t['days_held'] for t in closed_trades if t.get('days_held') is not None]
        avg_days_held = np.mean(days_held) if days_held else 0
        
        # Exit reasons
        exit_reasons = Counter([t.get('exit_reason', 'UNKNOWN') for t in closed_trades])
        
        # Recommendation performance
        recommendation_performance = defaultdict(list)
        for trade in closed_trades:
            if trade.get('return_pct') is not None:
                rec = trade.get('entry_recommendation', 'UNKNOWN')
                recommendation_performance[rec].append(float(trade['return_pct']))
        
        print(f"\nPerformance Metrics:")
        print(f"Win Rate: {win_rate:.1f}%")
        print(f"Average Return: {avg_return:.2f}%")
        print(f"Average Winner: {avg_winner:.2f}%")
        print(f"Average Loser: {avg_loser:.2f}%")
        print(f"Average Days Held: {avg_days_held:.1f}")
        print(f"Exit Reasons: {dict(exit_reasons)}")
        
        print(f"\nRecommendation Performance:")
        for rec, rets in recommendation_performance.items():
            if rets:
                win_rate_rec = len([r for r in rets if r > 0]) / len(rets) * 100
                avg_ret_rec = np.mean(rets)
                print(f"  {rec}: {len(rets)} trades, {win_rate_rec:.1f}% win rate, {avg_ret_rec:.2f}% avg return")
        
        return {
            'total_trades': total_trades,
            'closed_trades': len(closed_trades),
            'active_trades': len(active_trades),
            'win_rate': win_rate,
            'avg_return': avg_return,
            'avg_winner': avg_winner,
            'avg_loser': avg_loser,
            'avg_days_held': avg_days_held,
            'exit_reasons': dict(exit_reasons),
            'recommendation_performance': {k: {'count': len(v), 'avg_return': np.mean(v), 
                                             'win_rate': len([r for r in v if r > 0]) / len(v) * 100}
                                           for k, v in recommendation_performance.items() if v}
        }
    
    def analyze_signal_quality(self) -> Dict[str, Any]:
        """Analyze signal quality metrics."""
        print("\n=== SIGNAL QUALITY ANALYSIS ===")
        
        # Score distribution
        scores = [s.get('overall_score', 0) for s in self.signals_data]
        score_stats = {
            'count': len(scores),
            'mean': np.mean(scores),
            'median': np.median(scores),
            'std': np.std(scores),
            'min': np.min(scores),
            'max': np.max(scores)
        }
        
        # Recommendation distribution
        recommendations = Counter([s.get('recommendation', 'UNKNOWN') for s in self.signals_data])
        
        # Opportunity rank distribution
        ranks = Counter([s.get('opportunity_rank', 'UNKNOWN') for s in self.signals_data])
        
        # Squeeze category analysis
        squeeze_categories = Counter([s.get('squeeze_category', 'UNKNOWN') for s in self.signals_data])
        
        # Market regime analysis
        market_regimes = Counter([s.get('market_regime', 'UNKNOWN') for s in self.signals_data])
        
        print(f"Signal Quality Metrics:")
        print(f"Total signals: {score_stats['count']}")
        print(f"Score statistics: Mean={score_stats['mean']:.3f}, Median={score_stats['median']:.3f}, "
              f"Std={score_stats['std']:.3f}")
        print(f"Score range: {score_stats['min']:.3f} - {score_stats['max']:.3f}")
        print(f"Recommendations: {dict(recommendations)}")
        print(f"Opportunity ranks: {dict(ranks)}")
        print(f"Squeeze categories: {dict(squeeze_categories)}")
        print(f"Market regimes: {dict(market_regimes)}")
        
        return {
            'score_stats': score_stats,
            'recommendations': dict(recommendations),
            'opportunity_ranks': dict(ranks),
            'squeeze_categories': dict(squeeze_categories),
            'market_regimes': dict(market_regimes)
        }
    
    def _find_consecutive_days(self, dates: List[date]) -> int:
        """Find the maximum number of consecutive days in a list of dates."""
        if not dates:
            return 0
        
        dates = sorted(set(dates))  # Remove duplicates and sort
        max_consecutive = 1
        current_consecutive = 1
        
        for i in range(1, len(dates)):
            if (dates[i] - dates[i-1]).days == 1:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 1
        
        return max_consecutive
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on the analysis."""
        recommendations = []
        
        # Load data if not already loaded
        if self.signals_data is None or self.performance_data is None:
            self.load_data()
        
        # Run all analyses
        duplicate_analysis = self.analyze_duplicates()
        continuity_analysis = self.analyze_signal_continuity()
        performance_analysis = self.analyze_performance_tracking()
        quality_analysis = self.analyze_signal_quality()
        
        # Generate recommendations based on findings
        if duplicate_analysis['duplicate_combinations'] > 0:
            recommendations.append(
                f"🚨 CRITICAL: Found {duplicate_analysis['duplicate_combinations']} duplicate signal combinations. "
                "This indicates a bug in the signal continuity logic that needs immediate fixing."
            )
        
        if continuity_analysis['problematic_patterns']:
            recommendations.append(
                f"⚠️  Found {len(continuity_analysis['problematic_patterns'])} problematic continuity patterns. "
                "Review signal status transitions and days_in_squeeze calculations."
            )
        
        if performance_analysis.get('win_rate', 0) < 50:
            recommendations.append(
                f"📉 Win rate is {performance_analysis.get('win_rate', 0):.1f}%, which is below 50%. "
                "Consider tightening signal quality filters or adjusting entry criteria."
            )
        
        if quality_analysis['score_stats']['mean'] < 0.7:
            recommendations.append(
                f"📊 Average signal score is {quality_analysis['score_stats']['mean']:.3f}, which is relatively low. "
                "Consider raising the minimum score threshold for signal generation."
            )
        
        # Specific KLG recommendation
        klg_duplicates = sum(1 for signals in duplicate_analysis['klg_analysis']['signals_by_date'].values() if len(signals) > 1)
        if klg_duplicates > 0:
            recommendations.append(
                f"🔍 KLG has {klg_duplicates} duplicate date(s). This suggests the signal continuity service "
                "is not properly handling existing signals when updating scan_date."
            )
        
        return recommendations
    
    def run_full_analysis(self) -> Dict[str, Any]:
        """Run the complete performance analysis."""
        print("🔍 Starting Volatility Squeeze Scanner Performance Analysis")
        print("=" * 60)
        
        try:
            self.load_data()
        except FileNotFoundError as e:
            print(f"❌ Error: {e}")
            return {}
        
        # Run all analyses
        results = {
            'duplicate_analysis': self.analyze_duplicates(),
            'continuity_analysis': self.analyze_signal_continuity(),
            'performance_analysis': self.analyze_performance_tracking(),
            'quality_analysis': self.analyze_signal_quality()
        }
        
        # Generate recommendations
        recommendations = self.generate_recommendations()
        results['recommendations'] = recommendations
        
        print("\n" + "=" * 60)
        print("📋 RECOMMENDATIONS")
        print("=" * 60)
        
        if recommendations:
            for i, rec in enumerate(recommendations, 1):
                print(f"{i}. {rec}")
        else:
            print("✅ No major issues found. Scanner appears to be performing well!")
        
        return results

def main():
    """Main function to run the performance analysis."""
    analyzer = ScannerPerformanceAnalyzer()
    results = analyzer.run_full_analysis()
    
    # Save results to file
    output_file = Path("exports") / f"performance_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Analysis results saved to: {output_file}")

if __name__ == "__main__":
    main()
