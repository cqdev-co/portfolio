#!/usr/bin/env python3
"""
Analyze KLG signal continuity to understand the database efficiency issue.
"""

import asyncio
import os
from datetime import datetime, date
from typing import List, Dict, Any

# Add the src directory to the path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from volatility_scanner.services.database_service import DatabaseService
from volatility_scanner.config.settings import Settings


async def analyze_klg_continuity():
    """Analyze KLG signal continuity and database efficiency."""
    
    # Initialize settings and database service
    settings = Settings()
    db_service = DatabaseService(settings)
    
    try:
        print("🔍 Analyzing KLG Signal Continuity\n")
        
        # Query KLG signals from the last week
        response = db_service.client.table('volatility_squeeze_signals').select(
            'id, symbol, scan_date, scan_timestamp, signal_status, days_in_squeeze, '
            'first_detected_date, last_active_date, overall_score, recommendation, '
            'close_price, created_at, updated_at'
        ).eq('symbol', 'KLG').gte('scan_date', '2025-10-18').order('scan_date', desc=True).order('scan_timestamp', desc=True).execute()
        
        if response.data:
            signals = response.data
            print(f"📊 Found {len(signals)} KLG signals in the database:\n")
            
            for i, signal in enumerate(signals, 1):
                print(f"Signal #{i}:")
                print(f"  📅 Scan Date: {signal['scan_date']}")
                print(f"  🔄 Status: {signal['signal_status']}")
                print(f"  📈 Days in Squeeze: {signal['days_in_squeeze']}")
                print(f"  🎯 First Detected: {signal['first_detected_date']}")
                print(f"  ⏰ Last Active: {signal['last_active_date']}")
                print(f"  💰 Price: ${signal['close_price']}")
                print(f"  📊 Score: {signal['overall_score']}")
                print(f"  🎯 Recommendation: {signal['recommendation']}")
                print(f"  🆔 ID: {signal['id']}")
                print(f"  ⏱️  Created: {signal['created_at']}")
                print(f"  ⏱️  Updated: {signal['updated_at']}")
                print()
            
            # Analyze the continuity logic
            print("🧠 Continuity Analysis:")
            print("=" * 50)
            
            if len(signals) > 1:
                # Check if these are truly continuing signals or separate entries
                first_detected_dates = set(s['first_detected_date'] for s in signals)
                print(f"📍 Unique first_detected_date values: {first_detected_dates}")
                
                if len(first_detected_dates) == 1:
                    print("✅ All signals share the same first_detected_date - this is a CONTINUING signal")
                    print("❌ EFFICIENCY ISSUE: We're storing separate database rows for the same continuing signal!")
                else:
                    print("ℹ️  Different first_detected_date values - these are separate signal periods")
                
                # Check days_in_squeeze progression
                print("\n📈 Days in Squeeze Progression:")
                for signal in reversed(signals):  # Show chronologically
                    days_since_first = None
                    if signal['first_detected_date'] and signal['scan_date']:
                        first_date = datetime.strptime(signal['first_detected_date'], '%Y-%m-%d').date()
                        scan_date = datetime.strptime(signal['scan_date'], '%Y-%m-%d').date()
                        days_since_first = (scan_date - first_date).days + 1
                    
                    print(f"  {signal['scan_date']}: days_in_squeeze={signal['days_in_squeeze']}, "
                          f"calculated_days={days_since_first}")
            
            # Database efficiency analysis
            print("\n💾 Database Efficiency Analysis:")
            print("=" * 50)
            
            total_rows = len(signals)
            if total_rows > 1:
                print(f"❌ INEFFICIENT: {total_rows} separate database rows for one continuing signal")
                print(f"💡 BETTER APPROACH: Store 1 row, update daily with latest data")
                print(f"💾 Storage Waste: {total_rows - 1} unnecessary rows ({((total_rows - 1) / total_rows * 100):.1f}% waste)")
                
                # Calculate what the efficient approach would look like
                latest_signal = signals[0]  # Most recent
                print(f"\n✅ EFFICIENT APPROACH would store:")
                print(f"  📅 scan_date: {latest_signal['scan_date']} (latest)")
                print(f"  🔄 signal_status: CONTINUING")
                print(f"  📈 days_in_squeeze: {latest_signal['days_in_squeeze']}")
                print(f"  🎯 first_detected_date: {latest_signal['first_detected_date']}")
                print(f"  ⏰ last_active_date: {latest_signal['scan_date']}")
                print(f"  💰 close_price: {latest_signal['close_price']} (latest)")
                print(f"  📊 overall_score: {latest_signal['overall_score']} (latest)")
            else:
                print("✅ EFFICIENT: Only 1 database row for this signal")
        
        else:
            print("❌ No KLG signals found in the database")
            
    except Exception as e:
        print(f"❌ Error analyzing KLG continuity: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Close database connection if needed
        pass


if __name__ == "__main__":
    asyncio.run(analyze_klg_continuity())
