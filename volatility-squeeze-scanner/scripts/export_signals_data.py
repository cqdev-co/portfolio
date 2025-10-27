#!/usr/bin/env python3
"""
Data Export Helper Script for Volatility Squeeze Scanner

This script fetches unusual options signals and signal performance data 
from the database and exports them to JSON files with date filtering capabilities.

Usage:
    python export_signals_data.py --days 7                    # Last 7 days
    python export_signals_data.py --days 30 --output ./data   # Last 30 days, custom output dir
    python export_signals_data.py --start-date 2024-01-01 --end-date 2024-01-31  # Date range
    python export_signals_data.py --all                       # All data (use with caution)

Features:
    - Filter by days from current date (e.g., --days 7 for last 7 days)
    - Filter by specific date range (--start-date and --end-date)
    - Export to JSON files with proper formatting
    - Separate files for unusual options signals and signal performance
    - Progress indicators and summary statistics
    - Error handling and validation
"""

import os
import sys
import json
import asyncio
import argparse
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

# Add the src directory to the Python path
script_dir = Path(__file__).parent
src_dir = script_dir.parent / "src"
sys.path.insert(0, str(src_dir))

try:
    from dotenv import load_dotenv
    from supabase import create_client, Client
    from loguru import logger
except ImportError as e:
    print(f"❌ Missing required dependencies: {e}")
    print("Please install dependencies: pip install supabase python-dotenv loguru")
    sys.exit(1)


class DataExporter:
    """Service for exporting signals and performance data from the database."""
    
    def __init__(self):
        """Initialize the data exporter."""
        self.client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client with environment variables."""
        try:
            # Load environment variables from multiple possible locations
            env_paths = [
                Path.cwd() / '.env',
                Path.cwd().parent / '.env',
                script_dir.parent / '.env',
                script_dir.parent.parent / '.env'
            ]
            
            for env_path in env_paths:
                if env_path.exists():
                    load_dotenv(env_path)
                    logger.info(f"Loaded environment from: {env_path}")
                    break
            
            # Try to get Supabase credentials from environment
            supabase_url = (
                os.getenv('NEXT_PUBLIC_SUPABASE_URL') or 
                os.getenv('SUPABASE_URL')
            )
            supabase_key = (
                os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or
                os.getenv('SUPABASE_ANON_KEY')
            )
            
            if not supabase_url or not supabase_key:
                logger.error(
                    "❌ Supabase credentials not found in environment variables.\n"
                    "Required variables:\n"
                    "  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL\n"
                    "  - NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY\n"
                    "Please check your .env file."
                )
                return
            
            self.client = create_client(supabase_url, supabase_key)
            logger.info("✅ Database connection initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize database connection: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if database service is available."""
        return self.client is not None
    
    async def fetch_unusual_options_signals(
        self, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch unusual options signals from the database.
        
        Args:
            start_date: Start date for filtering (inclusive)
            end_date: End date for filtering (inclusive)
            days_back: Number of days back from today (alternative to date range)
            
        Returns:
            List of unusual options signal records
        """
        if not self.is_available():
            logger.error("❌ Database service not available")
            return []
        
        try:
            # Determine date range
            if days_back is not None:
                end_date = date.today()
                start_date = end_date - timedelta(days=days_back)
            elif start_date is None and end_date is None:
                # Default to last 30 days if no filter specified
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
            
            logger.info(f"📊 Fetching unusual options signals from {start_date} to {end_date}")
            
            # Build query
            query = self.client.table('unusual_options_signals').select('*')
            
            if start_date:
                query = query.gte('detection_timestamp', start_date.isoformat())
            if end_date:
                # Add one day to make end_date inclusive
                next_day = end_date + timedelta(days=1)
                query = query.lt('detection_timestamp', next_day.isoformat())
            
            # Execute query with ordering
            response = query.order('detection_timestamp', desc=True).execute()
            
            signals = response.data if response.data else []
            logger.info(f"✅ Retrieved {len(signals)} unusual options signals")
            
            return signals
            
        except Exception as e:
            logger.error(f"❌ Error fetching unusual options signals: {e}")
            return []
    
    async def fetch_signal_performance(
        self, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch signal performance data from the database.
        
        Args:
            start_date: Start date for filtering (inclusive)
            end_date: End date for filtering (inclusive)
            days_back: Number of days back from today (alternative to date range)
            
        Returns:
            List of signal performance records
        """
        if not self.is_available():
            logger.error("❌ Database service not available")
            return []
        
        try:
            # Determine date range
            if days_back is not None:
                end_date = date.today()
                start_date = end_date - timedelta(days=days_back)
            elif start_date is None and end_date is None:
                # Default to last 30 days if no filter specified
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
            
            logger.info(f"📈 Fetching signal performance data from {start_date} to {end_date}")
            
            # Build query - filter by entry_date for signal performance
            query = self.client.table('signal_performance').select('*')
            
            if start_date:
                query = query.gte('entry_date', start_date.isoformat())
            if end_date:
                query = query.lte('entry_date', end_date.isoformat())
            
            # Execute query with ordering
            response = query.order('entry_date', desc=True).execute()
            
            performance_data = response.data if response.data else []
            logger.info(f"✅ Retrieved {len(performance_data)} signal performance records")
            
            return performance_data
            
        except Exception as e:
            logger.error(f"❌ Error fetching signal performance data: {e}")
            return []
    
    async def fetch_volatility_squeeze_signals(
        self, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        days_back: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch volatility squeeze signals from the database.
        
        Args:
            start_date: Start date for filtering (inclusive)
            end_date: End date for filtering (inclusive)
            days_back: Number of days back from today (alternative to date range)
            
        Returns:
            List of volatility squeeze signal records
        """
        if not self.is_available():
            logger.error("❌ Database service not available")
            return []
        
        try:
            # Determine date range
            if days_back is not None:
                end_date = date.today()
                start_date = end_date - timedelta(days=days_back)
            elif start_date is None and end_date is None:
                # Default to last 30 days if no filter specified
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
            
            logger.info(f"🔍 Fetching volatility squeeze signals from {start_date} to {end_date}")
            
            # Build query - filter by scan_date for volatility squeeze signals
            query = self.client.table('volatility_squeeze_signals').select('*')
            
            if start_date:
                query = query.gte('scan_date', start_date.isoformat())
            if end_date:
                query = query.lte('scan_date', end_date.isoformat())
            
            # Execute query with ordering
            response = query.order('scan_date', desc=True).execute()
            
            squeeze_signals = response.data if response.data else []
            logger.info(f"✅ Retrieved {len(squeeze_signals)} volatility squeeze signals")
            
            return squeeze_signals
            
        except Exception as e:
            logger.error(f"❌ Error fetching volatility squeeze signals: {e}")
            return []


def export_to_json(data: List[Dict[str, Any]], filename: str, output_dir: Path) -> bool:
    """
    Export data to a JSON file with proper formatting.
    
    Args:
        data: Data to export
        filename: Output filename
        output_dir: Output directory
        
    Returns:
        True if successful, False otherwise
    """
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename
        
        # Custom JSON encoder for date/datetime objects
        def json_serializer(obj):
            if isinstance(obj, (date, datetime)):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                data, 
                f, 
                indent=2, 
                ensure_ascii=False,
                default=json_serializer
            )
        
        file_size = output_path.stat().st_size
        logger.info(f"✅ Exported {len(data)} records to {output_path} ({file_size:,} bytes)")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to export data to {filename}: {e}")
        return False


def print_summary(
    unusual_options_count: int,
    signal_performance_count: int,
    volatility_squeeze_count: int,
    start_date: Optional[date],
    end_date: Optional[date],
    days_back: Optional[int]
):
    """Print a summary of the export operation."""
    print("\n" + "="*60)
    print("📊 DATA EXPORT SUMMARY")
    print("="*60)
    
    # Date range info
    if days_back:
        print(f"📅 Date Range: Last {days_back} days (from {date.today()})")
    elif start_date and end_date:
        print(f"📅 Date Range: {start_date} to {end_date}")
    else:
        print("📅 Date Range: All available data")
    
    print(f"🔍 Unusual Options Signals: {unusual_options_count:,} records")
    print(f"📈 Signal Performance Data: {signal_performance_count:,} records")
    print(f"🎯 Volatility Squeeze Signals: {volatility_squeeze_count:,} records")
    print(f"📊 Total Records Exported: {unusual_options_count + signal_performance_count + volatility_squeeze_count:,}")
    print("="*60)


async def main():
    """Main function to handle command-line arguments and execute export."""
    parser = argparse.ArgumentParser(
        description="Export unusual options signals and signal performance data to JSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python export_signals_data.py --days 7
  python export_signals_data.py --days 30 --output ./exports
  python export_signals_data.py --start-date 2024-01-01 --end-date 2024-01-31
  python export_signals_data.py --all --output /path/to/exports
        """
    )
    
    # Date filtering options (mutually exclusive)
    date_group = parser.add_mutually_exclusive_group()
    date_group.add_argument(
        '--days', 
        type=int, 
        help='Number of days back from today (e.g., 7 for last 7 days)'
    )
    date_group.add_argument(
        '--all', 
        action='store_true', 
        help='Export all available data (use with caution for large datasets)'
    )
    
    # Specific date range options
    parser.add_argument(
        '--start-date', 
        type=str, 
        help='Start date in YYYY-MM-DD format (inclusive)'
    )
    parser.add_argument(
        '--end-date', 
        type=str, 
        help='End date in YYYY-MM-DD format (inclusive)'
    )
    
    # Output options
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./exports',
        help='Output directory for JSON files (default: ./exports)'
    )
    
    # Data selection options
    parser.add_argument(
        '--unusual-options-only',
        action='store_true',
        help='Export only unusual options signals'
    )
    parser.add_argument(
        '--performance-only',
        action='store_true',
        help='Export only signal performance data'
    )
    parser.add_argument(
        '--volatility-squeeze-only',
        action='store_true',
        help='Export only volatility squeeze signals'
    )
    
    # Utility options
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Configure logging
    if args.verbose:
        logger.remove()
        logger.add(sys.stderr, level="DEBUG")
    else:
        logger.remove()
        logger.add(sys.stderr, level="INFO")
    
    # Validate arguments
    if args.start_date and not args.end_date:
        parser.error("--start-date requires --end-date")
    if args.end_date and not args.start_date:
        parser.error("--end-date requires --start-date")
    
    # Parse dates
    start_date = None
    end_date = None
    days_back = None
    
    if args.start_date and args.end_date:
        try:
            start_date = datetime.strptime(args.start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(args.end_date, '%Y-%m-%d').date()
            if start_date > end_date:
                parser.error("start-date must be before or equal to end-date")
        except ValueError as e:
            parser.error(f"Invalid date format: {e}")
    elif args.days:
        days_back = args.days
    elif not args.all:
        # Default to last 7 days if no filter specified
        days_back = 7
        logger.info("No date filter specified, defaulting to last 7 days")
    
    # Create output directory
    output_dir = Path(args.output)
    
    # Initialize exporter
    exporter = DataExporter()
    if not exporter.is_available():
        logger.error("❌ Cannot connect to database. Please check your configuration.")
        sys.exit(1)
    
    # Determine what to export
    export_unusual_options = not (args.performance_only or args.volatility_squeeze_only)
    export_performance = not (args.unusual_options_only or args.volatility_squeeze_only)
    export_volatility_squeeze = not (args.unusual_options_only or args.performance_only)
    
    # Export data
    unusual_options_count = 0
    signal_performance_count = 0
    volatility_squeeze_count = 0
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    try:
        # Export unusual options signals
        if export_unusual_options:
            unusual_options_data = await exporter.fetch_unusual_options_signals(
                start_date=start_date,
                end_date=end_date,
                days_back=days_back
            )
            
            if unusual_options_data:
                filename = f"unusual_options_signals_{timestamp}.json"
                if export_to_json(unusual_options_data, filename, output_dir):
                    unusual_options_count = len(unusual_options_data)
        
        # Export signal performance data
        if export_performance:
            performance_data = await exporter.fetch_signal_performance(
                start_date=start_date,
                end_date=end_date,
                days_back=days_back
            )
            
            if performance_data:
                filename = f"signal_performance_{timestamp}.json"
                if export_to_json(performance_data, filename, output_dir):
                    signal_performance_count = len(performance_data)
        
        # Export volatility squeeze signals
        if export_volatility_squeeze:
            volatility_squeeze_data = await exporter.fetch_volatility_squeeze_signals(
                start_date=start_date,
                end_date=end_date,
                days_back=days_back
            )
            
            if volatility_squeeze_data:
                filename = f"volatility_squeeze_signals_{timestamp}.json"
                if export_to_json(volatility_squeeze_data, filename, output_dir):
                    volatility_squeeze_count = len(volatility_squeeze_data)
        
        # Print summary
        print_summary(
            unusual_options_count,
            signal_performance_count,
            volatility_squeeze_count,
            start_date,
            end_date,
            days_back
        )
        
        if unusual_options_count + signal_performance_count + volatility_squeeze_count > 0:
            print(f"📁 Files exported to: {output_dir.absolute()}")
            logger.info("🎉 Export completed successfully!")
        else:
            logger.warning("⚠️  No data found for the specified criteria")
    
    except KeyboardInterrupt:
        logger.info("❌ Export cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unexpected error during export: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
