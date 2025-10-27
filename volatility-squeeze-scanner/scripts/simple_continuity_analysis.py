#!/usr/bin/env python3
"""
Simple script to analyze signal continuity issues using the exported data.
This doesn't require database access and works with the JSON exports.
"""

import json
from datetime import datetime, date, timedelta
from typing import Dict, List, Any
from pathlib import Path
from collections import defaultdict

class SimpleContinuityAnalyzer:
    """Analyzes signal continuity using exported JSON data."""
    
    def __init__(self, exports_dir: str = "exports"):
        self.exports_dir = Path(exports_dir)
        self.signals_data = None
        
    def load_data(self) -> None:
        """Load the exported signals data."""
        signal_files = list(self.exports_dir.glob("volatility_squeeze_signals_*.json"))
        
        if not signal_files:
            raise FileNotFoundError("No signal export files found")
        
        # Get the most recent file
        latest_file = max(signal_files, key=lambda x: x.stat().st_mtime)
        print(f"Loading signals from: {latest_file}")
        
        with open(latest_file, 'r') as f:
            self.signals_data = json.load(f)
    
    def analyze_klg_issue(self) -> Dict[str, Any]:
        """Specifically analyze the KLG duplicate/continuity issue."""
        print("\n=== KLG CONTINUITY ANALYSIS ===")
        
        # Filter KLG signals
        klg_signals = [s for s in self.signals_data if s['symbol'] == 'KLG']
        
        if not klg_signals:
            print("No KLG signals found")
            return {}
        
        # Sort by scan_date
        klg_signals.sort(key=lambda x: x['scan_date'])
        
        print(f"Found {len(klg_signals)} KLG signals:")
        
        issues = []
        
        for i, signal in enumerate(klg_signals):
            print(f"\n{i+1}. Date: {signal['scan_date']}")
            print(f"   ID: {signal['id']}")
            print(f"   Status: {signal.get('signal_status', 'N/A')}")
            print(f"   Days in squeeze: {signal.get('days_in_squeeze', 'N/A')}")
            print(f"   First detected: {signal.get('first_detected_date', 'N/A')}")
            print(f"   Last active: {signal.get('last_active_date', 'N/A')}")
            print(f"   Created: {signal.get('created_at', 'N/A')}")
            print(f"   Updated: {signal.get('updated_at', 'N/A')}")
            
            # Check for issues
            if i == 0 and signal.get('signal_status') != 'NEW':
                issues.append({
                    'type': 'first_signal_not_new',
                    'signal': signal,
                    'description': f"First KLG signal has status '{signal.get('signal_status')}' instead of 'NEW'"
                })
            
            # Check days_in_squeeze progression
            expected_days = i + 1
            actual_days = signal.get('days_in_squeeze', 1)
            
            if actual_days != expected_days and i < len(klg_signals) - 1:  # Allow flexibility for last signal
                issues.append({
                    'type': 'incorrect_days_in_squeeze',
                    'signal': signal,
                    'expected': expected_days,
                    'actual': actual_days,
                    'description': f"Expected {expected_days} days in squeeze, got {actual_days}"
                })
        
        print(f"\nFound {len(issues)} issues with KLG signals:")
        for issue in issues:
            print(f"  - {issue['description']}")
        
        return {
            'klg_signals': klg_signals,
            'issues': issues
        }
    
    def analyze_all_continuity_issues(self) -> Dict[str, Any]:
        """Analyze continuity issues across all symbols."""
        print("\n=== FULL CONTINUITY ANALYSIS ===")
        
        # Group signals by symbol
        signals_by_symbol = defaultdict(list)
        for signal in self.signals_data:
            signals_by_symbol[signal['symbol']].append(signal)
        
        # Sort each symbol's signals by scan_date
        for symbol in signals_by_symbol:
            signals_by_symbol[symbol].sort(key=lambda x: x['scan_date'])
        
        all_issues = []
        symbol_summaries = {}
        
        for symbol, signals in signals_by_symbol.items():
            symbol_issues = self._analyze_symbol_sequence(symbol, signals)
            all_issues.extend(symbol_issues)
            
            symbol_summaries[symbol] = {
                'total_signals': len(signals),
                'issues_count': len(symbol_issues),
                'date_range': f"{signals[0]['scan_date']} to {signals[-1]['scan_date']}",
                'status_sequence': [s.get('signal_status', 'N/A') for s in signals],
                'days_sequence': [s.get('days_in_squeeze', 'N/A') for s in signals]
            }
        
        # Categorize issues
        issue_types = defaultdict(list)
        for issue in all_issues:
            issue_types[issue['type']].append(issue)
        
        print(f"Analyzed {len(signals_by_symbol)} symbols")
        print(f"Found {len(all_issues)} total issues")
        
        print("\nIssue breakdown:")
        for issue_type, issues in issue_types.items():
            print(f"  {issue_type}: {len(issues)} issues")
        
        print("\nSymbols with issues:")
        for symbol, summary in symbol_summaries.items():
            if summary['issues_count'] > 0:
                print(f"  {symbol}: {summary['issues_count']} issues")
                print(f"    Status sequence: {summary['status_sequence']}")
                print(f"    Days sequence: {summary['days_sequence']}")
        
        return {
            'total_symbols': len(signals_by_symbol),
            'total_issues': len(all_issues),
            'issue_types': dict(issue_types),
            'symbol_summaries': symbol_summaries
        }
    
    def _analyze_symbol_sequence(self, symbol: str, signals: List[Dict]) -> List[Dict]:
        """Analyze continuity issues for a specific symbol."""
        issues = []
        
        if not signals:
            return issues
        
        # Check first signal
        first_signal = signals[0]
        if first_signal.get('signal_status') != 'NEW':
            issues.append({
                'type': 'first_signal_not_new',
                'symbol': symbol,
                'signal_id': first_signal['id'],
                'scan_date': first_signal['scan_date'],
                'current_status': first_signal.get('signal_status'),
                'description': f"First signal for {symbol} has status '{first_signal.get('signal_status')}' instead of 'NEW'"
            })
        
        # Check sequence logic
        for i, signal in enumerate(signals):
            # Check days_in_squeeze progression
            actual_days = signal.get('days_in_squeeze', 1)
            
            # For continuing signals, days should generally increase
            if i > 0:
                prev_signal = signals[i-1]
                prev_days = prev_signal.get('days_in_squeeze', 1)
                curr_status = signal.get('signal_status')
                
                # If status is CONTINUING, days should be higher than previous
                if curr_status == 'CONTINUING' and actual_days <= prev_days:
                    issues.append({
                        'type': 'continuing_days_not_increasing',
                        'symbol': symbol,
                        'signal_id': signal['id'],
                        'scan_date': signal['scan_date'],
                        'actual_days': actual_days,
                        'prev_days': prev_days,
                        'description': f"CONTINUING signal days ({actual_days}) not greater than previous ({prev_days})"
                    })
                
                # Check for unrealistic jumps in days_in_squeeze
                if actual_days > prev_days + 10:  # Arbitrary threshold
                    issues.append({
                        'type': 'unrealistic_days_jump',
                        'symbol': symbol,
                        'signal_id': signal['id'],
                        'scan_date': signal['scan_date'],
                        'actual_days': actual_days,
                        'prev_days': prev_days,
                        'description': f"Unrealistic jump in days_in_squeeze: {prev_days} → {actual_days}"
                    })
        
        return issues
    
    def generate_fix_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for fixing the identified issues."""
        recommendations = []
        
        issue_types = analysis.get('issue_types', {})
        
        if 'first_signal_not_new' in issue_types:
            count = len(issue_types['first_signal_not_new'])
            recommendations.append(
                f"🔧 Fix {count} 'first_signal_not_new' issues: "
                "Set the first signal for each symbol to status='NEW' and days_in_squeeze=1"
            )
        
        if 'continuing_days_not_increasing' in issue_types:
            count = len(issue_types['continuing_days_not_increasing'])
            recommendations.append(
                f"🔧 Fix {count} 'continuing_days_not_increasing' issues: "
                "Recalculate days_in_squeeze to ensure proper progression"
            )
        
        if 'unrealistic_days_jump' in issue_types:
            count = len(issue_types['unrealistic_days_jump'])
            recommendations.append(
                f"🔧 Fix {count} 'unrealistic_days_jump' issues: "
                "Review and correct days_in_squeeze calculations"
            )
        
        # Specific KLG recommendation
        klg_issues = [issue for issues in issue_types.values() for issue in issues if issue.get('symbol') == 'KLG']
        if klg_issues:
            recommendations.append(
                f"🎯 KLG specific: Found {len(klg_issues)} issues. "
                "This suggests the signal continuity service needs debugging for proper status transitions."
            )
        
        # Root cause analysis
        recommendations.append(
            "🔍 Root cause investigation needed: "
            "The signal continuity service logic in _determine_signal_status() and "
            "_update_existing_signal_with_continuity() may have bugs in status determination."
        )
        
        return recommendations
    
    def run_analysis(self) -> Dict[str, Any]:
        """Run the complete continuity analysis."""
        print("🔍 Starting Simple Signal Continuity Analysis")
        print("=" * 60)
        
        try:
            self.load_data()
        except FileNotFoundError as e:
            print(f"❌ Error: {e}")
            return {}
        
        # Run KLG-specific analysis
        klg_analysis = self.analyze_klg_issue()
        
        # Run full analysis
        full_analysis = self.analyze_all_continuity_issues()
        
        # Generate recommendations
        recommendations = self.generate_fix_recommendations(full_analysis)
        
        print("\n" + "=" * 60)
        print("📋 RECOMMENDATIONS")
        print("=" * 60)
        
        for i, rec in enumerate(recommendations, 1):
            print(f"{i}. {rec}")
        
        return {
            'klg_analysis': klg_analysis,
            'full_analysis': full_analysis,
            'recommendations': recommendations
        }

def main():
    """Main function."""
    analyzer = SimpleContinuityAnalyzer()
    results = analyzer.run_analysis()
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = Path("exports") / f"simple_continuity_analysis_{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Analysis results saved to: {output_file}")

if __name__ == "__main__":
    main()
