#!/usr/bin/env python3
"""
Spread Quantitative Analysis System

Tracks Deep ITM Call Debit Spread trades over time and performs
statistical analysis as data accumulates.

Features:
- Parses Robinhood CSV exports
- Fetches market data at entry time via Yahoo Proxy
- Stores trade data in JSON for accumulation
- Calculates correlations, regressions, significance tests
- Updates analysis as n grows toward statistical significance

Usage:
    # Add new trades from CSV
    python spread_quant_analysis.py import pf.csv
    
    # Run analysis on accumulated data
    python spread_quant_analysis.py analyze
    
    # Show current trade database
    python spread_quant_analysis.py show
    
    # Export to CSV for external analysis
    python spread_quant_analysis.py export trades.csv

Requirements:
    - YAHOO_PROXY_URL environment variable set
    - requests library (pip install requests)
"""

import argparse
import csv
import json
import math
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Data file location
DATA_DIR = Path(__file__).parent.parent / "data"
TRADES_FILE = DATA_DIR / "spread_trades.json"


@dataclass
class SpreadTrade:
    """A single spread trade with comprehensive entry conditions."""
    # === IDENTIFIERS ===
    id: str
    ticker: str
    entry_date: str
    exit_date: Optional[str]
    
    # === SPREAD DETAILS ===
    long_strike: float
    short_strike: float
    expiration: str
    
    # === FINANCIALS ===
    debit_paid: float
    exit_credit: Optional[float]
    pnl: Optional[float]
    return_pct: Optional[float]
    
    # === OUTCOME ===
    days_held: Optional[int]
    is_winner: Optional[bool]
    
    # === PRICE & POSITION (at entry) ===
    entry_price: Optional[float] = None
    entry_52w_high: Optional[float] = None
    entry_52w_low: Optional[float] = None
    entry_pct_from_52w_high: Optional[float] = None  # How far below ATH
    entry_pct_from_52w_low: Optional[float] = None   # How far above 52w low
    entry_50dma: Optional[float] = None
    entry_200dma: Optional[float] = None
    entry_pct_from_50dma: Optional[float] = None     # % above/below 50DMA
    entry_pct_from_200dma: Optional[float] = None    # % above/below 200DMA
    
    # === FUNDAMENTALS ===
    entry_pe: Optional[float] = None
    entry_forward_pe: Optional[float] = None
    entry_eps: Optional[float] = None
    entry_market_cap: Optional[float] = None         # In billions
    entry_beta: Optional[float] = None
    entry_dividend_yield: Optional[float] = None
    
    # === TECHNICALS ===
    entry_rsi: Optional[float] = None                # 14-day RSI
    entry_rsi_5d: Optional[float] = None             # 5-day RSI (momentum)
    entry_macd_hist: Optional[float] = None          # MACD histogram
    entry_macd_signal: Optional[str] = None          # 'bullish'/'bearish'
    entry_adx: Optional[float] = None                # Trend strength
    entry_atr: Optional[float] = None                # Volatility (ATR)
    entry_atr_pct: Optional[float] = None            # ATR as % of price
    entry_bb_position: Optional[float] = None        # 0-100 within bands
    entry_volume_ratio: Optional[float] = None       # vs 20-day avg
    
    # === TREND & MOMENTUM ===
    entry_trend_5d: Optional[float] = None           # 5-day return %
    entry_trend_10d: Optional[float] = None          # 10-day return %
    entry_trend_20d: Optional[float] = None          # 20-day return %
    entry_trend_pct: Optional[float] = None          # Overall trend %
    entry_ma_alignment: Optional[str] = None         # 'bullish'/'bearish'/'mixed'
    entry_higher_low: Optional[bool] = None          # Bounce confirmed?
    
    # === SUPPORT/RESISTANCE ===
    entry_support: Optional[float] = None
    entry_resistance: Optional[float] = None
    entry_buffer_pct: Optional[float] = None         # % above support
    
    # === SENTIMENT & FLOW ===
    entry_analyst_pct: Optional[float] = None        # % bullish ratings
    entry_analyst_count: Optional[int] = None        # Total analysts
    entry_short_ratio: Optional[float] = None        # Days to cover
    entry_short_pct: Optional[float] = None          # % of float
    entry_put_call_ratio: Optional[float] = None     # Options sentiment
    entry_institutional_pct: Optional[float] = None  # % held by inst.
    
    # === VOLATILITY ===
    entry_iv: Optional[float] = None                 # ATM Implied Vol
    entry_iv_rank: Optional[float] = None            # IV percentile
    entry_hv_20: Optional[float] = None              # 20-day historical vol
    entry_iv_hv_ratio: Optional[float] = None        # IV/HV premium
    
    # === TIMING ===
    entry_day_of_week: Optional[int] = None          # 0=Mon, 4=Fri
    entry_week_of_month: Optional[int] = None        # 1-5
    entry_days_to_earnings: Optional[int] = None     # Days until earnings
    entry_days_from_earnings: Optional[int] = None   # Days since earnings
    entry_days_to_expiry: Optional[int] = None       # Spread expiration
    
    # === MARKET CONTEXT ===
    entry_spy_trend: Optional[float] = None          # SPY 5-day return
    entry_vix: Optional[float] = None                # VIX level
    entry_sector: Optional[str] = None               # Sector
    
    # === METADATA ===
    created_at: str = ""
    updated_at: str = ""


class TradeDatabase:
    """Persistent storage for trade data."""
    
    def __init__(self, filepath: Path = TRADES_FILE):
        self.filepath = filepath
        self.trades: list[SpreadTrade] = []
        self._load()
    
    def _load(self):
        """Load trades from JSON file (handles missing fields)."""
        if self.filepath.exists():
            with open(self.filepath, 'r') as f:
                data = json.load(f)
                self.trades = []
                for t in data.get('trades', []):
                    # Get default values from dataclass
                    defaults = {
                        f.name: f.default if f.default is not None 
                        else None
                        for f in SpreadTrade.__dataclass_fields__.values()
                    }
                    # Merge with stored data
                    merged = {**defaults, **t}
                    self.trades.append(SpreadTrade(**merged))
    
    def save(self):
        """Save trades to JSON file."""
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(self.filepath, 'w') as f:
            json.dump({
                'trades': [asdict(t) for t in self.trades],
                'updated_at': datetime.now().isoformat(),
                'count': len(self.trades),
            }, f, indent=2)
    
    def add_trade(self, trade: SpreadTrade) -> bool:
        """Add trade if not duplicate."""
        # Check for duplicate
        for t in self.trades:
            if (t.ticker == trade.ticker and 
                t.entry_date == trade.entry_date and
                t.long_strike == trade.long_strike):
                return False
        self.trades.append(trade)
        return True
    
    def get_closed_trades(self) -> list[SpreadTrade]:
        """Get only closed trades with P&L."""
        return [t for t in self.trades if t.pnl is not None]
    
    def get_open_trades(self) -> list[SpreadTrade]:
        """Get open positions."""
        return [t for t in self.trades if t.pnl is None]


class MarketDataFetcher:
    """Fetch comprehensive market data from Yahoo Proxy."""
    
    def __init__(self):
        self.proxy_url = os.environ.get('YAHOO_PROXY_URL')
        if not self.proxy_url:
            print("WARNING: YAHOO_PROXY_URL not set. "
                  "Entry conditions will not be fetched.")
    
    def fetch_entry_conditions(
        self, 
        ticker: str, 
        entry_date: str
    ) -> dict:
        """Fetch comprehensive market conditions at entry time."""
        if not self.proxy_url:
            return {}
        
        try:
            import requests
            resp = requests.get(
                f"{self.proxy_url}/ticker/{ticker}",
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()
            
            quote = data.get('quote', {}) or {}
            chart = data.get('chart', {}) or {}
            analysts = data.get('analysts', {}) or {}
            options = data.get('options', {}) or {}
            earnings = data.get('earnings', {}) or {}
            short_interest = data.get('shortInterest', {}) or {}
            
            # Extract OHLCV arrays from chart
            quotes = chart.get('quotes', [])
            closes = [q.get('close') for q in quotes if q.get('close')]
            highs = [q.get('high') for q in quotes if q.get('high')]
            lows = [q.get('low') for q in quotes if q.get('low')]
            volumes = [q.get('volume') for q in quotes if q.get('volume')]
            
            result = {}
            
            # === PRICE & POSITION ===
            price = quote.get('price')
            result['entry_price'] = price
            result['entry_52w_high'] = quote.get('fiftyTwoWeekHigh')
            result['entry_52w_low'] = quote.get('fiftyTwoWeekLow')
            result['entry_50dma'] = quote.get('fiftyDayAverage')
            result['entry_200dma'] = quote.get('twoHundredDayAverage')
            
            if price and result['entry_52w_high']:
                result['entry_pct_from_52w_high'] = round(
                    (result['entry_52w_high'] - price) / 
                    result['entry_52w_high'] * 100, 2
                )
            if price and result['entry_52w_low']:
                result['entry_pct_from_52w_low'] = round(
                    (price - result['entry_52w_low']) / 
                    result['entry_52w_low'] * 100, 2
                )
            if price and result['entry_50dma']:
                result['entry_pct_from_50dma'] = round(
                    (price - result['entry_50dma']) / 
                    result['entry_50dma'] * 100, 2
                )
            if price and result['entry_200dma']:
                result['entry_pct_from_200dma'] = round(
                    (price - result['entry_200dma']) / 
                    result['entry_200dma'] * 100, 2
                )
            
            # === FUNDAMENTALS ===
            result['entry_pe'] = quote.get('peRatio')
            result['entry_forward_pe'] = quote.get('forwardPE')
            result['entry_eps'] = quote.get('eps')
            mc = quote.get('marketCap')
            result['entry_market_cap'] = round(mc / 1e9, 2) if mc else None
            result['entry_beta'] = quote.get('beta')
            result['entry_dividend_yield'] = quote.get('dividendYield')
            
            # === TECHNICALS (from chart) ===
            if len(closes) >= 14:
                result['entry_rsi'] = self._rsi(closes, 14)
                result['entry_rsi_5d'] = self._rsi(closes, 5)
                
                macd_h, macd_sig = self._macd(closes)
                result['entry_macd_hist'] = macd_h
                result['entry_macd_signal'] = macd_sig
                
                result['entry_adx'] = self._adx(highs, lows, closes)
                result['entry_atr'] = self._atr(highs, lows, closes)
                if price and result['entry_atr']:
                    result['entry_atr_pct'] = round(
                        result['entry_atr'] / price * 100, 2
                    )
                
                result['entry_bb_position'] = self._bb_position(closes)
                
                if volumes and len(volumes) >= 20:
                    avg_vol = sum(volumes[-20:]) / 20
                    if avg_vol > 0:
                        result['entry_volume_ratio'] = round(
                            volumes[-1] / avg_vol, 2
                        )
            
            # === TREND & MOMENTUM ===
            if len(closes) >= 20:
                result['entry_trend_5d'] = self._return(closes, 5)
                result['entry_trend_10d'] = self._return(closes, 10)
                result['entry_trend_20d'] = self._return(closes, 20)
                result['entry_trend_pct'] = result['entry_trend_20d']
                
                # MA alignment
                if price and result['entry_50dma'] and result['entry_200dma']:
                    above_50 = price > result['entry_50dma']
                    above_200 = price > result['entry_200dma']
                    ma50_above_200 = (result['entry_50dma'] > 
                                      result['entry_200dma'])
                    if above_50 and above_200 and ma50_above_200:
                        result['entry_ma_alignment'] = 'bullish'
                    elif not above_50 and not above_200 and not ma50_above_200:
                        result['entry_ma_alignment'] = 'bearish'
                    else:
                        result['entry_ma_alignment'] = 'mixed'
                
                # Higher low (bounce confirmation)
                result['entry_higher_low'] = self._higher_low(closes)
            
            # === SUPPORT/RESISTANCE ===
            if len(lows) >= 20 and len(highs) >= 20:
                result['entry_support'] = round(min(lows[-20:]), 2)
                result['entry_resistance'] = round(max(highs[-20:]), 2)
                if price and result['entry_support']:
                    result['entry_buffer_pct'] = round(
                        (price - result['entry_support']) / price * 100, 2
                    )
            
            # === SENTIMENT & FLOW ===
            result['entry_analyst_pct'] = analysts.get('bullishPct')
            result['entry_analyst_count'] = analysts.get('totalAnalysts')
            result['entry_short_ratio'] = short_interest.get('shortRatio')
            result['entry_short_pct'] = short_interest.get('shortPercentOfFloat')
            result['entry_put_call_ratio'] = options.get('pcRatioVol')
            
            # === VOLATILITY ===
            result['entry_iv'] = options.get('atmIV')
            result['entry_iv_rank'] = options.get('ivRank')
            if len(closes) >= 20:
                result['entry_hv_20'] = self._historical_vol(closes, 20)
                if result['entry_iv'] and result['entry_hv_20']:
                    result['entry_iv_hv_ratio'] = round(
                        result['entry_iv'] / result['entry_hv_20'], 2
                    )
            
            # === TIMING ===
            try:
                entry_dt = datetime.strptime(entry_date, '%m/%d/%Y')
                result['entry_day_of_week'] = entry_dt.weekday()
                result['entry_week_of_month'] = (entry_dt.day - 1) // 7 + 1
            except:
                pass
            
            result['entry_days_to_earnings'] = earnings.get('daysUntil')
            
            # === MARKET CONTEXT (would need SPY/VIX fetch) ===
            # result['entry_spy_trend'] = ...
            # result['entry_vix'] = ...
            
            return result
            
        except Exception as e:
            print(f"  Warning: Failed to fetch data for {ticker}: {e}")
            return {}
    
    # === TECHNICAL INDICATOR CALCULATIONS ===
    
    def _rsi(self, closes: list[float], period: int = 14) -> Optional[float]:
        """Calculate RSI."""
        if len(closes) < period + 1:
            return None
        changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        gains = [c if c > 0 else 0 for c in changes[-period:]]
        losses = [-c if c < 0 else 0 for c in changes[-period:]]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return round(100 - (100 / (1 + rs)), 1)
    
    def _macd(self, closes: list[float]) -> tuple:
        """Calculate MACD histogram and signal."""
        if len(closes) < 26:
            return None, None
        
        ema12 = self._ema(closes, 12)
        ema26 = self._ema(closes, 26)
        if ema12 is None or ema26 is None:
            return None, None
        
        macd_line = ema12 - ema26
        # Simplified signal
        signal = 'bullish' if macd_line > 0 else 'bearish'
        return round(macd_line, 3), signal
    
    def _ema(self, data: list[float], period: int) -> Optional[float]:
        """Calculate EMA."""
        if len(data) < period:
            return None
        multiplier = 2 / (period + 1)
        ema = sum(data[:period]) / period
        for price in data[period:]:
            ema = (price - ema) * multiplier + ema
        return ema
    
    def _adx(self, highs: list, lows: list, closes: list, 
             period: int = 14) -> Optional[float]:
        """Calculate ADX (simplified)."""
        if len(closes) < period + 1:
            return None
        
        # Simplified ADX estimation based on trend consistency
        changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        recent = changes[-period:]
        pos = sum(1 for c in recent if c > 0)
        neg = sum(1 for c in recent if c < 0)
        
        # ADX approximation: how directional is the movement
        directional = abs(pos - neg) / period
        return round(directional * 100, 1)
    
    def _atr(self, highs: list, lows: list, closes: list, 
             period: int = 14) -> Optional[float]:
        """Calculate ATR."""
        if len(closes) < period + 1:
            return None
        
        trs = []
        for i in range(1, min(len(highs), len(lows), len(closes))):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i-1]),
                abs(lows[i] - closes[i-1])
            )
            trs.append(tr)
        
        if len(trs) < period:
            return None
        return round(sum(trs[-period:]) / period, 2)
    
    def _bb_position(self, closes: list, period: int = 20) -> Optional[float]:
        """Position within Bollinger Bands (0-100)."""
        if len(closes) < period:
            return None
        
        recent = closes[-period:]
        sma = sum(recent) / period
        std = (sum((x - sma) ** 2 for x in recent) / period) ** 0.5
        
        if std == 0:
            return 50.0
        
        upper = sma + 2 * std
        lower = sma - 2 * std
        current = closes[-1]
        
        position = (current - lower) / (upper - lower) * 100
        return round(max(0, min(100, position)), 1)
    
    def _return(self, closes: list, days: int) -> Optional[float]:
        """Calculate N-day return."""
        if len(closes) < days + 1:
            return None
        return round((closes[-1] - closes[-days-1]) / closes[-days-1] * 100, 2)
    
    def _higher_low(self, closes: list) -> bool:
        """Check if recent price action shows higher low."""
        if len(closes) < 10:
            return False
        
        # Find lowest point in last 10 days
        recent = closes[-10:]
        min_idx = recent.index(min(recent))
        
        # If min is not at end and price recovered, it's a higher low
        if min_idx < len(recent) - 2:
            recovery = (closes[-1] - recent[min_idx]) / recent[min_idx]
            return recovery > 0.02  # 2% bounce
        return False
    
    def _historical_vol(self, closes: list, period: int = 20) -> Optional[float]:
        """Calculate historical volatility (annualized)."""
        if len(closes) < period + 1:
            return None
        
        returns = [(closes[i] - closes[i-1]) / closes[i-1] 
                   for i in range(1, len(closes))]
        recent = returns[-period:]
        
        mean = sum(recent) / len(recent)
        variance = sum((r - mean) ** 2 for r in recent) / len(recent)
        daily_vol = variance ** 0.5
        
        # Annualize
        annual_vol = daily_vol * (252 ** 0.5)
        return round(annual_vol * 100, 1)


class CSVParser:
    """Parse Robinhood CSV exports into trades."""
    
    def parse_spreads(self, filepath: str) -> list[dict]:
        """Extract spread trades from CSV."""
        trades = []
        
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            option_trades = []
            
            for row in reader:
                if not row.get('Activity Date'):
                    continue
                if row.get('Trans Code') not in ['BTO', 'STO', 'BTC', 'STC']:
                    continue
                    
                desc = row.get('Description', '')
                if 'Call' not in desc and 'Put' not in desc:
                    continue
                
                # Parse option details
                parts = desc.split()
                if len(parts) < 4:
                    continue
                
                ticker = parts[0]
                exp_date = parts[1]
                opt_type = parts[2]
                strike = float(parts[3].replace('$', ''))
                
                # Parse amount
                amt_str = (row.get('Amount', '0')
                           .replace('$', '')
                           .replace(',', '')
                           .replace('(', '-')
                           .replace(')', ''))
                amount = float(amt_str) if amt_str else 0
                
                option_trades.append({
                    'date': row['Activity Date'],
                    'ticker': ticker,
                    'exp': exp_date,
                    'type': opt_type,
                    'strike': strike,
                    'action': row['Trans Code'],
                    'amount': amount,
                })
        
        # Group into spreads
        from collections import defaultdict
        spreads = defaultdict(list)
        for t in option_trades:
            key = (t['ticker'], t['exp'])
            spreads[key].append(t)
        
        # Match entries and exits
        for (ticker, exp), group in spreads.items():
            entries = [t for t in group if t['action'] in ['BTO', 'STO']]
            exits = [t for t in group if t['action'] in ['BTC', 'STC']]
            
            entry_dates = set(t['date'] for t in entries)
            
            for entry_date in entry_dates:
                bto = [t for t in entries 
                       if t['date'] == entry_date and t['action'] == 'BTO']
                sto = [t for t in entries 
                       if t['date'] == entry_date and t['action'] == 'STO']
                
                if not bto or not sto:
                    continue
                
                long_strike = bto[0]['strike']
                short_strike = sto[0]['strike']
                entry_debit = bto[0]['amount'] + sto[0]['amount']
                
                # Find matching exit
                exit_date = None
                exit_credit = None
                pnl = None
                
                for ed in set(t['date'] for t in exits):
                    stc = [t for t in exits 
                           if t['date'] == ed and 
                           t['action'] == 'STC' and 
                           t['strike'] == long_strike]
                    btc = [t for t in exits 
                           if t['date'] == ed and 
                           t['action'] == 'BTC' and 
                           t['strike'] == short_strike]
                    
                    if stc and btc:
                        exit_date = ed
                        exit_credit = stc[0]['amount'] + btc[0]['amount']
                        pnl = entry_debit + exit_credit
                        break
                
                # Calculate days held
                days_held = None
                if exit_date:
                    try:
                        entry_dt = datetime.strptime(entry_date, '%m/%d/%Y')
                        exit_dt = datetime.strptime(exit_date, '%m/%d/%Y')
                        days_held = (exit_dt - entry_dt).days
                    except:
                        pass
                
                trades.append({
                    'ticker': ticker,
                    'entry_date': entry_date,
                    'exit_date': exit_date,
                    'long_strike': long_strike,
                    'short_strike': short_strike,
                    'expiration': exp,
                    'debit_paid': abs(entry_debit),
                    'exit_credit': exit_credit,
                    'pnl': pnl,
                    'return_pct': (
                        round(pnl / abs(entry_debit) * 100, 2) 
                        if pnl and entry_debit else None
                    ),
                    'days_held': days_held,
                    'is_winner': pnl > 0 if pnl else None,
                })
        
        return trades


class QuantAnalyzer:
    """Statistical analysis of trade data."""
    
    def __init__(self, trades: list[SpreadTrade]):
        self.trades = [t for t in trades if t.return_pct is not None]
        self.n = len(self.trades)
    
    def _mean(self, x: list[float]) -> float:
        return sum(x) / len(x) if x else 0
    
    def _std(self, x: list[float]) -> float:
        if not x:
            return 0
        m = self._mean(x)
        return math.sqrt(sum((xi - m) ** 2 for xi in x) / len(x))
    
    def _correlation(self, x: list[float], y: list[float]) -> float:
        """Pearson correlation coefficient."""
        if len(x) != len(y) or len(x) < 2:
            return 0
        mx, my = self._mean(x), self._mean(y)
        sx, sy = self._std(x), self._std(y)
        if sx == 0 or sy == 0:
            return 0
        n = len(x)
        return sum((x[i]-mx)*(y[i]-my) for i in range(n)) / (n * sx * sy)
    
    def _t_stat(self, r: float, n: int) -> float:
        """t-statistic for correlation significance."""
        if abs(r) >= 1 or n <= 2:
            return 0
        return r * math.sqrt(n - 2) / math.sqrt(1 - r ** 2)
    
    def _p_value_approx(self, t: float, df: int) -> float:
        """Approximate p-value from t-statistic (two-tailed)."""
        # Using approximation for t-distribution
        if df <= 0:
            return 1.0
        x = abs(t)
        # Approximation from Abramowitz & Stegun
        a = 0.3193815
        b = -0.3565638
        c = 1.781478
        d = -1.821256
        e = 1.330274
        z = x / math.sqrt(df)
        p = 1 / (1 + a*z + b*z**2 + c*z**3 + d*z**4 + e*z**5)**8
        return min(1.0, 2 * p)  # Two-tailed
    
    def basic_stats(self) -> dict:
        """Calculate basic return statistics."""
        if self.n == 0:
            return {}
        
        returns = [t.return_pct for t in self.trades]
        pnls = [t.pnl for t in self.trades]
        
        winners = sum(1 for r in returns if r > 0)
        win_rate = winners / self.n
        
        # Wilson score interval for win rate
        z = 1.96
        center = (win_rate + z**2/(2*self.n)) / (1 + z**2/self.n)
        margin = (z * math.sqrt(
            (win_rate*(1-win_rate) + z**2/(4*self.n))/self.n
        ) / (1 + z**2/self.n))
        
        std = self._std(returns)
        sharpe = self._mean(returns) / std if std > 0 else 0
        
        # Sortino
        neg_returns = [r for r in returns if r < 0]
        downside = math.sqrt(
            sum(r**2 for r in neg_returns) / len(neg_returns)
        ) if neg_returns else 0
        sortino = self._mean(returns) / downside if downside > 0 else 0
        
        # Profit factor
        gross_win = sum(p for p in pnls if p > 0)
        gross_loss = abs(sum(p for p in pnls if p < 0))
        profit_factor = gross_win / gross_loss if gross_loss > 0 else 0
        
        return {
            'n': self.n,
            'mean_return': round(self._mean(returns), 2),
            'std_return': round(std, 2),
            'mean_pnl': round(self._mean(pnls), 2),
            'win_rate': round(win_rate * 100, 1),
            'win_rate_ci_low': round((center - margin) * 100, 1),
            'win_rate_ci_high': round((center + margin) * 100, 1),
            'sharpe': round(sharpe, 3),
            'sortino': round(sortino, 3),
            'profit_factor': round(profit_factor, 2),
            'max_drawdown': round(min(returns), 2),
            'max_gain': round(max(returns), 2),
        }
    
    def correlation_analysis(self) -> list[dict]:
        """Calculate correlations for ALL factors."""
        if self.n < 3:
            return []
        
        returns = [t.return_pct for t in self.trades]
        
        # === COMPREHENSIVE FACTOR LIST ===
        factors = [
            # Price Position
            ('% from 52w High', [t.entry_pct_from_52w_high for t in self.trades]),
            ('% from 52w Low', [t.entry_pct_from_52w_low for t in self.trades]),
            ('% from 50DMA', [t.entry_pct_from_50dma for t in self.trades]),
            ('% from 200DMA', [t.entry_pct_from_200dma for t in self.trades]),
            
            # Fundamentals
            ('P/E Ratio', [t.entry_pe for t in self.trades]),
            ('Forward P/E', [t.entry_forward_pe for t in self.trades]),
            ('Beta', [t.entry_beta for t in self.trades]),
            ('Market Cap $B', [t.entry_market_cap for t in self.trades]),
            
            # Technicals
            ('RSI 14', [t.entry_rsi for t in self.trades]),
            ('RSI 5', [t.entry_rsi_5d for t in self.trades]),
            ('MACD Hist', [t.entry_macd_hist for t in self.trades]),
            ('ADX', [t.entry_adx for t in self.trades]),
            ('ATR %', [t.entry_atr_pct for t in self.trades]),
            ('BB Position', [t.entry_bb_position for t in self.trades]),
            ('Volume Ratio', [t.entry_volume_ratio for t in self.trades]),
            
            # Trend
            ('5d Return', [t.entry_trend_5d for t in self.trades]),
            ('10d Return', [t.entry_trend_10d for t in self.trades]),
            ('20d Return', [t.entry_trend_20d for t in self.trades]),
            ('Buffer %', [t.entry_buffer_pct for t in self.trades]),
            
            # Sentiment
            ('Analyst %', [t.entry_analyst_pct for t in self.trades]),
            ('Short Ratio', [t.entry_short_ratio for t in self.trades]),
            ('Short % Float', [t.entry_short_pct for t in self.trades]),
            ('Put/Call', [t.entry_put_call_ratio for t in self.trades]),
            
            # Volatility
            ('IV %', [t.entry_iv for t in self.trades]),
            ('IV Rank', [t.entry_iv_rank for t in self.trades]),
            ('HV 20', [t.entry_hv_20 for t in self.trades]),
            ('IV/HV Ratio', [t.entry_iv_hv_ratio for t in self.trades]),
            
            # Timing
            ('Day of Week', [t.entry_day_of_week for t in self.trades]),
            ('Days to Earnings', [t.entry_days_to_earnings for t in self.trades]),
            ('Days to Expiry', [t.entry_days_to_expiry for t in self.trades]),
            
            # Outcome-related
            ('Days Held', [t.days_held for t in self.trades]),
            ('Debit $', [t.debit_paid for t in self.trades]),
        ]
        
        results = []
        for name, values in factors:
            # Filter out None values
            pairs = [(r, v) for r, v in zip(returns, values) 
                     if v is not None and r is not None]
            if len(pairs) < 3:
                continue
            
            r_vals = [p[0] for p in pairs]
            f_vals = [p[1] for p in pairs]
            
            r = self._correlation(f_vals, r_vals)
            t = self._t_stat(r, len(pairs))
            p = self._p_value_approx(t, len(pairs) - 2)
            
            results.append({
                'factor': name,
                'n': len(pairs),
                'r': round(r, 4),
                'r_squared': round(r ** 2, 4),
                't_stat': round(t, 4),
                'p_value': round(p, 4),
                'significant': p < 0.05,
            })
        
        return sorted(results, key=lambda x: abs(x['r']), reverse=True)
    
    def regression(self) -> dict:
        """Multivariate regression: Return = f(factors)."""
        if self.n < 5:
            return {}
        
        # Get complete cases only
        complete = []
        for t in self.trades:
            if all([
                t.entry_analyst_pct is not None,
                t.entry_iv is not None,
                t.days_held is not None,
            ]):
                complete.append(t)
        
        if len(complete) < 5:
            return {}
        
        n = len(complete)
        y = [t.return_pct for t in complete]
        
        # Build X matrix: [1, analyst, iv, days]
        X = [
            [1, t.entry_analyst_pct, t.entry_iv, t.days_held]
            for t in complete
        ]
        
        # Solve normal equations: (X'X)^-1 X'y
        # Simplified 4x4 Gauss-Jordan
        XtX = [[sum(X[k][i]*X[k][j] for k in range(n)) 
                for j in range(4)] for i in range(4)]
        Xty = [sum(X[k][i]*y[k] for k in range(n)) for i in range(4)]
        
        try:
            betas = self._solve_linear(XtX, Xty)
            
            # Calculate R-squared
            y_pred = [sum(betas[j]*X[i][j] for j in range(4)) 
                      for i in range(n)]
            y_mean = sum(y) / n
            ss_tot = sum((y[i] - y_mean)**2 for i in range(n))
            ss_res = sum((y[i] - y_pred[i])**2 for i in range(n))
            r_squared = 1 - ss_res/ss_tot if ss_tot > 0 else 0
            adj_r_squared = 1 - (1-r_squared)*(n-1)/(n-4) if n > 4 else 0
            rmse = math.sqrt(ss_res / (n - 4)) if n > 4 else 0
            
            return {
                'n': n,
                'intercept': round(betas[0], 2),
                'coef_analyst': round(betas[1], 4),
                'coef_iv': round(betas[2], 4),
                'coef_days': round(betas[3], 4),
                'r_squared': round(r_squared, 4),
                'adj_r_squared': round(adj_r_squared, 4),
                'rmse': round(rmse, 2),
            }
        except:
            return {}
    
    def _solve_linear(self, A: list, b: list) -> list:
        """Solve Ax = b using Gauss-Jordan elimination."""
        n = len(A)
        M = [A[i] + [b[i]] for i in range(n)]
        
        for col in range(n):
            max_row = col
            for row in range(col + 1, n):
                if abs(M[row][col]) > abs(M[max_row][col]):
                    max_row = row
            M[col], M[max_row] = M[max_row], M[col]
            
            for row in range(n):
                if row != col and M[col][col] != 0:
                    factor = M[row][col] / M[col][col]
                    for j in range(n + 1):
                        M[row][j] -= factor * M[col][j]
        
        return [M[i][n] / M[i][i] if M[i][i] != 0 else 0 
                for i in range(n)]
    
    def required_n(self, r: float = 0.5, power: float = 0.8) -> int:
        """Calculate sample size needed to detect correlation r."""
        # Fisher z transformation
        if abs(r) >= 1:
            return 3
        z_alpha = 1.96  # Two-tailed alpha = 0.05
        z_beta = 0.84   # Power = 0.80
        z_r = 0.5 * math.log((1 + r) / (1 - r))
        n = ((z_alpha + z_beta) / z_r) ** 2 + 3
        return int(math.ceil(n))
    
    def print_report(self):
        """Print full analysis report."""
        print("=" * 70)
        print("   SPREAD QUANTITATIVE ANALYSIS")
        print("=" * 70)
        
        stats = self.basic_stats()
        if not stats:
            print("\n   No closed trades to analyze.")
            return
        
        print(f"\n   Sample Size: n = {stats['n']}")
        
        # Required sample sizes
        req_n = self.required_n(0.5)
        print(f"   Required for significance: n ≥ {req_n} "
              f"(to detect r ≥ 0.5)")
        
        if stats['n'] < req_n:
            pct = round(stats['n'] / req_n * 100)
            print(f"   Progress: {pct}% of required sample size")
        
        print("\n" + "-" * 70)
        print("   RETURN STATISTICS")
        print("-" * 70)
        print(f"   Mean Return:      {stats['mean_return']:+.2f}%")
        print(f"   Std Deviation:    {stats['std_return']:.2f}%")
        print(f"   Mean P&L:         ${stats['mean_pnl']:+.2f}")
        print(f"   Win Rate:         {stats['win_rate']:.1f}% "
              f"(95% CI: [{stats['win_rate_ci_low']:.1f}%, "
              f"{stats['win_rate_ci_high']:.1f}%])")
        print(f"   Sharpe Ratio:     {stats['sharpe']:.3f}")
        print(f"   Sortino Ratio:    {stats['sortino']:.3f}")
        print(f"   Profit Factor:    {stats['profit_factor']:.2f}")
        print(f"   Max Drawdown:     {stats['max_drawdown']:.2f}%")
        
        print("\n" + "-" * 70)
        print("   CORRELATION ANALYSIS")
        print("-" * 70)
        
        corrs = self.correlation_analysis()
        if corrs:
            print(f"\n   {'Factor':<15} {'n':<5} {'r':<10} {'R²':<10} "
                  f"{'p-value':<10} {'Sig?':<5}")
            print("   " + "-" * 55)
            for c in corrs:
                sig = "YES*" if c['significant'] else "no"
                print(f"   {c['factor']:<15} {c['n']:<5} "
                      f"{c['r']:+.4f}    {c['r_squared']:.4f}    "
                      f"{c['p_value']:.4f}    {sig}")
            print("\n   * Statistically significant at p < 0.05")
        else:
            print("   Not enough data for correlation analysis.")
        
        print("\n" + "-" * 70)
        print("   REGRESSION MODEL")
        print("-" * 70)
        
        reg = self.regression()
        if reg:
            print(f"\n   Return = {reg['intercept']:.1f} "
                  f"+ {reg['coef_analyst']:.3f}×Analyst "
                  f"+ {reg['coef_iv']:.3f}×IV "
                  f"+ {reg['coef_days']:.3f}×Days")
            print(f"\n   R² = {reg['r_squared']:.4f} "
                  f"({reg['r_squared']*100:.1f}% variance explained)")
            print(f"   Adjusted R² = {reg['adj_r_squared']:.4f}")
            print(f"   RMSE = {reg['rmse']:.2f}%")
        else:
            print("   Not enough data for regression.")
        
        print("\n" + "=" * 70)


def cmd_import(args):
    """Import trades from CSV."""
    db = TradeDatabase()
    parser = CSVParser()
    fetcher = MarketDataFetcher()
    
    trades = parser.parse_spreads(args.csv_file)
    print(f"Found {len(trades)} spread trades in {args.csv_file}")
    
    added = 0
    for t in trades:
        # Create trade object
        trade_id = f"{t['ticker']}_{t['entry_date']}_{t['long_strike']}"
        
        # Fetch entry conditions if not already stored
        print(f"  Processing {t['ticker']} {t['entry_date']}...")
        conditions = fetcher.fetch_entry_conditions(
            t['ticker'], t['entry_date']
        )
        
        trade = SpreadTrade(
            id=trade_id,
            ticker=t['ticker'],
            entry_date=t['entry_date'],
            exit_date=t['exit_date'],
            long_strike=t['long_strike'],
            short_strike=t['short_strike'],
            expiration=t['expiration'],
            debit_paid=t['debit_paid'],
            exit_credit=t['exit_credit'],
            pnl=t['pnl'],
            return_pct=t['return_pct'],
            entry_price=conditions.get('entry_price'),
            entry_rsi=conditions.get('entry_rsi'),
            entry_buffer_pct=conditions.get('entry_buffer_pct'),
            entry_analyst_pct=conditions.get('entry_analyst_pct'),
            entry_iv=conditions.get('entry_iv'),
            entry_trend_pct=conditions.get('entry_trend_pct'),
            entry_pe=conditions.get('entry_pe'),
            entry_market_cap=conditions.get('entry_market_cap'),
            days_held=t['days_held'],
            is_winner=t['is_winner'],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        
        if db.add_trade(trade):
            added += 1
            status = "WIN" if t['is_winner'] else (
                "LOSS" if t['is_winner'] is False else "OPEN"
            )
            print(f"    Added: {status}")
        else:
            print(f"    Skipped (duplicate)")
    
    db.save()
    print(f"\nAdded {added} new trades. Total: {len(db.trades)}")


def cmd_analyze(args):
    """Run quantitative analysis."""
    db = TradeDatabase()
    closed = db.get_closed_trades()
    
    if not closed:
        print("No closed trades to analyze.")
        print("Import trades first: python spread_quant_analysis.py "
              "import pf.csv")
        return
    
    analyzer = QuantAnalyzer(closed)
    analyzer.print_report()
    
    # Deep dive analysis
    print("\n" + "=" * 70)
    print("   DEEP DIVE: WINNERS vs LOSERS")
    print("=" * 70)
    
    winners = [t for t in closed if t.pnl > 0]
    losers = [t for t in closed if t.pnl <= 0]
    
    print(f"\n   Winners: {len(winners)}  |  Losers: {len(losers)}")
    
    def avg(lst):
        vals = [v for v in lst if v is not None]
        return sum(vals) / len(vals) if vals else None
    
    def profile(trades, label):
        print(f"\n   {label} PROFILE:")
        returns = [t.return_pct for t in trades]
        analysts = [t.entry_analyst_pct for t in trades 
                    if t.entry_analyst_pct]
        ivs = [t.entry_iv for t in trades if t.entry_iv]
        days = [t.days_held for t in trades if t.days_held]
        
        if returns:
            print(f"   Avg Return: {avg(returns):+.2f}%")
        if analysts:
            print(f"   Avg Analyst: {avg(analysts):.0f}%")
        if ivs:
            print(f"   Avg IV: {avg(ivs):.0f}%")
        if days:
            print(f"   Avg Days: {avg(days):.1f}")
    
    if winners:
        profile(winners, "WINNERS")
    if losers:
        profile(losers, "LOSERS")
    
    # Key thresholds
    print("\n" + "-" * 70)
    print("   KEY THRESHOLD ANALYSIS")
    print("-" * 70)
    
    # Analyst threshold
    high_analyst = [t for t in closed 
                    if t.entry_analyst_pct and t.entry_analyst_pct >= 80]
    low_analyst = [t for t in closed 
                   if t.entry_analyst_pct and t.entry_analyst_pct < 80]
    
    if high_analyst:
        wr = sum(1 for t in high_analyst if t.pnl > 0) / len(high_analyst)
        ret = avg([t.return_pct for t in high_analyst])
        print(f"   Analyst ≥80%: {len(high_analyst)} trades, "
              f"WR={wr*100:.0f}%, Avg={ret:+.1f}%")
    if low_analyst:
        wr = sum(1 for t in low_analyst if t.pnl > 0) / len(low_analyst)
        ret = avg([t.return_pct for t in low_analyst])
        print(f"   Analyst <80%: {len(low_analyst)} trades, "
              f"WR={wr*100:.0f}%, Avg={ret:+.1f}%")
    
    # IV threshold
    low_iv = [t for t in closed if t.entry_iv and t.entry_iv <= 50]
    high_iv = [t for t in closed if t.entry_iv and t.entry_iv > 50]
    
    if low_iv:
        wr = sum(1 for t in low_iv if t.pnl > 0) / len(low_iv)
        ret = avg([t.return_pct for t in low_iv])
        print(f"   IV ≤50%: {len(low_iv)} trades, "
              f"WR={wr*100:.0f}%, Avg={ret:+.1f}%")
    if high_iv:
        wr = sum(1 for t in high_iv if t.pnl > 0) / len(high_iv)
        ret = avg([t.return_pct for t in high_iv])
        print(f"   IV >50%: {len(high_iv)} trades, "
              f"WR={wr*100:.0f}%, Avg={ret:+.1f}%")
    
    # Ticker performance
    print("\n" + "-" * 70)
    print("   TICKER PERFORMANCE")
    print("-" * 70)
    
    from collections import defaultdict
    by_ticker = defaultdict(list)
    for t in closed:
        by_ticker[t.ticker].append(t)
    
    for ticker in sorted(by_ticker.keys()):
        trades = by_ticker[ticker]
        pnl = sum(t.pnl for t in trades)
        wr = sum(1 for t in trades if t.pnl > 0) / len(trades)
        status = "✓" if wr >= 0.5 else "✗"
        print(f"   {status} {ticker}: {len(trades)} trades, "
              f"${pnl:+.2f}, WR={wr*100:.0f}%")


def cmd_show(args):
    """Show trade database."""
    db = TradeDatabase()
    
    print(f"\nTotal trades: {len(db.trades)}")
    print(f"Closed: {len(db.get_closed_trades())}")
    print(f"Open: {len(db.get_open_trades())}")
    
    print("\n" + "-" * 80)
    print(f"{'Ticker':<8} {'Entry':<12} {'Exit':<12} "
          f"{'Strikes':<15} {'P&L':<10} {'Return':<10}")
    print("-" * 80)
    
    for t in sorted(db.trades, key=lambda x: x.entry_date):
        strikes = f"${t.long_strike}/${t.short_strike}"
        pnl = f"${t.pnl:+.2f}" if t.pnl else "OPEN"
        ret = f"{t.return_pct:+.2f}%" if t.return_pct else ""
        exit_d = t.exit_date or ""
        print(f"{t.ticker:<8} {t.entry_date:<12} {exit_d:<12} "
              f"{strikes:<15} {pnl:<10} {ret:<10}")


def cmd_update(args):
    """Manually update entry conditions for a trade."""
    db = TradeDatabase()
    
    # Find trade
    trade = None
    for t in db.trades:
        if t.ticker == args.ticker and t.entry_date == args.date:
            trade = t
            break
    
    if not trade:
        print(f"Trade not found: {args.ticker} on {args.date}")
        return
    
    # Update all provided fields
    updates = {}
    for field, value in vars(args).items():
        if field in ['ticker', 'date', 'func'] or value is None:
            continue
        attr_name = f'entry_{field}' if not field.startswith('entry_') else field
        if hasattr(trade, attr_name):
            setattr(trade, attr_name, value)
            updates[attr_name] = value
    
    trade.updated_at = datetime.now().isoformat()
    db.save()
    
    print(f"Updated {trade.ticker} ({trade.entry_date}):")
    for k, v in updates.items():
        print(f"  {k}: {v}")


def cmd_fetch(args):
    """Fetch data from Yahoo proxy to fill missing fields."""
    db = TradeDatabase()
    fetcher = MarketDataFetcher()
    
    if not fetcher.proxy_url:
        print("ERROR: YAHOO_PROXY_URL not set")
        return
    
    # Find trades to update
    if args.ticker:
        trades = [t for t in db.trades if t.ticker == args.ticker]
    else:
        # Get trades with missing data
        trades = [t for t in db.trades 
                  if t.entry_price is None or t.entry_beta is None]
    
    if not trades:
        print("No trades need updating.")
        return
    
    print(f"Fetching data for {len(trades)} trades...")
    
    updated = 0
    for t in trades:
        print(f"  {t.ticker} ({t.entry_date})...", end=" ")
        
        conditions = fetcher.fetch_entry_conditions(t.ticker, t.entry_date)
        
        if not conditions:
            print("FAILED")
            continue
        
        # Update fields that are None
        fields_updated = 0
        for key, value in conditions.items():
            if value is not None and getattr(t, key, "MISSING") is None:
                setattr(t, key, value)
                fields_updated += 1
        
        t.updated_at = datetime.now().isoformat()
        print(f"OK ({fields_updated} fields)")
        updated += 1
    
    db.save()
    print(f"\nUpdated {updated}/{len(trades)} trades.")


def cmd_template(args):
    """Export CSV template for manual data entry."""
    db = TradeDatabase()
    
    # Key fields to export
    fields = [
        'ticker', 'entry_date', 'entry_price', 
        'entry_pct_from_52w_high', 'entry_pct_from_50dma',
        'entry_pe', 'entry_beta', 'entry_market_cap',
        'entry_rsi', 'entry_macd_hist', 'entry_adx', 'entry_bb_position',
        'entry_trend_5d', 'entry_trend_20d', 'entry_ma_alignment',
        'entry_analyst_pct', 'entry_short_ratio', 'entry_put_call_ratio',
        'entry_iv', 'entry_iv_rank', 'entry_hv_20',
        'entry_days_to_earnings', 'entry_day_of_week',
    ]
    
    with open(args.output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        
        for t in db.trades:
            row = {f: getattr(t, f, None) for f in fields}
            writer.writerow(row)
    
    print(f"Exported template to {args.output}")
    print(f"Fill in the missing values and run:")
    print(f"  python spread_quant_analysis.py batch-update {args.output}")


def cmd_coverage(args):
    """Show data coverage statistics."""
    db = TradeDatabase()
    closed = db.get_closed_trades()
    
    if not closed:
        print("No closed trades to analyze.")
        return
    
    print("=" * 70)
    print("   DATA COVERAGE REPORT")
    print("=" * 70)
    print(f"\n   Total closed trades: {len(closed)}")
    
    # Group fields by category
    categories = {
        'Position': ['entry_price', 'entry_52w_high', 'entry_52w_low',
                     'entry_pct_from_52w_high', 'entry_pct_from_52w_low',
                     'entry_50dma', 'entry_200dma', 'entry_pct_from_50dma',
                     'entry_pct_from_200dma'],
        'Fundamentals': ['entry_pe', 'entry_forward_pe', 'entry_eps',
                         'entry_market_cap', 'entry_beta', 
                         'entry_dividend_yield'],
        'Technicals': ['entry_rsi', 'entry_rsi_5d', 'entry_macd_hist',
                       'entry_adx', 'entry_atr', 'entry_atr_pct',
                       'entry_bb_position', 'entry_volume_ratio'],
        'Trend': ['entry_trend_5d', 'entry_trend_10d', 'entry_trend_20d',
                  'entry_buffer_pct', 'entry_support', 'entry_resistance',
                  'entry_higher_low', 'entry_ma_alignment'],
        'Sentiment': ['entry_analyst_pct', 'entry_analyst_count',
                      'entry_short_ratio', 'entry_short_pct',
                      'entry_put_call_ratio', 'entry_institutional_pct'],
        'Volatility': ['entry_iv', 'entry_iv_rank', 'entry_hv_20',
                       'entry_iv_hv_ratio'],
        'Timing': ['entry_day_of_week', 'entry_days_to_earnings',
                   'entry_days_to_expiry', 'days_held'],
    }
    
    for cat, fields in categories.items():
        print(f"\n   {cat}:")
        for field in fields:
            count = sum(1 for t in closed 
                       if getattr(t, field, None) is not None)
            pct = count / len(closed) * 100
            bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            status = "✓" if pct >= 50 else "○"
            print(f"   {status} {field:<28} {bar} {count:>3}/{len(closed)} "
                  f"({pct:.0f}%)")
    
    # Summary
    all_fields = [f for fields in categories.values() for f in fields]
    total_cells = len(all_fields) * len(closed)
    filled_cells = sum(
        1 for t in closed for f in all_fields 
        if getattr(t, f, None) is not None
    )
    overall = filled_cells / total_cells * 100
    
    print(f"\n" + "-" * 70)
    print(f"   Overall Coverage: {filled_cells}/{total_cells} "
          f"cells ({overall:.1f}%)")
    print(f"   Factors with >50% coverage: "
          f"{sum(1 for f in all_fields if sum(1 for t in closed if getattr(t, f, None)) > len(closed)//2)}"
          f"/{len(all_fields)}")
    print("=" * 70)


def cmd_open(args):
    """Analyze open positions with recommendations."""
    db = TradeDatabase()
    open_trades = db.get_open_trades()
    closed = db.get_closed_trades()
    
    if not open_trades:
        print("No open positions.")
        return
    
    # Calculate thresholds from closed trades
    def avg(lst):
        vals = [v for v in lst if v is not None]
        return sum(vals) / len(vals) if vals else None
    
    winners = [t for t in closed if t.pnl and t.pnl > 0]
    losers = [t for t in closed if t.pnl and t.pnl <= 0]
    
    print("=" * 70)
    print("   OPEN POSITION ANALYSIS")
    print("=" * 70)
    
    if winners and losers:
        w_analyst = avg([t.entry_analyst_pct for t in winners 
                         if t.entry_analyst_pct])
        l_analyst = avg([t.entry_analyst_pct for t in losers 
                         if t.entry_analyst_pct])
        w_iv = avg([t.entry_iv for t in winners if t.entry_iv])
        l_iv = avg([t.entry_iv for t in losers if t.entry_iv])
        w_days = avg([t.days_held for t in winners if t.days_held])
        
        print(f"\n   Optimal criteria (from {len(closed)} closed trades):")
        if w_analyst and l_analyst:
            print(f"   • Analyst ≥ {int(w_analyst)}% "
                  f"(winners avg {w_analyst:.0f}% vs {l_analyst:.0f}%)")
        if w_iv and l_iv:
            print(f"   • IV ≤ {int(l_iv)}% "
                  f"(winners avg {w_iv:.0f}% vs {l_iv:.0f}%)")
        if w_days:
            print(f"   • Hold ≥ {int(w_days)} days "
                  f"(winners avg {w_days:.0f} days)")
    
    print("\n" + "-" * 70)
    
    today = datetime.now()
    
    for t in open_trades:
        try:
            entry = datetime.strptime(t.entry_date, '%m/%d/%Y')
            days_held = (today - entry).days
        except:
            days_held = 0
        
        print(f"\n   {t.ticker} ${t.long_strike}/{t.short_strike}")
        print(f"   Entry: {t.entry_date} | Days held: {days_held} | "
              f"Debit: ${t.debit_paid:.0f}")
        
        # Score
        score = 50
        signals = []
        
        if t.entry_analyst_pct:
            if t.entry_analyst_pct >= 90:
                score += 20
                signals.append(f"✓ Analyst {t.entry_analyst_pct:.0f}%")
            elif t.entry_analyst_pct >= 80:
                score += 10
                signals.append(f"✓ Analyst {t.entry_analyst_pct:.0f}%")
            elif t.entry_analyst_pct < 70:
                score -= 15
                signals.append(f"⚠ Analyst {t.entry_analyst_pct:.0f}%")
        else:
            signals.append("? No analyst data")
        
        if t.entry_iv:
            if t.entry_iv <= 40:
                score += 15
                signals.append(f"✓ IV {t.entry_iv:.0f}%")
            elif t.entry_iv > 60:
                score -= 15
                signals.append(f"⚠ IV {t.entry_iv:.0f}%")
        else:
            signals.append("? No IV data")
        
        if days_held >= 10:
            score += 5
            signals.append(f"✓ Day {days_held}")
        elif days_held < 7:
            signals.append(f"⏳ Day {days_held} (hold to day 7+)")
        
        # Ticker history
        ticker_hist = [x for x in closed if x.ticker == t.ticker]
        if ticker_hist:
            wr = sum(1 for x in ticker_hist if x.pnl > 0) / len(ticker_hist)
            if wr == 0:
                score -= 20
                signals.append(f"⚠ {t.ticker} 0% win rate historically")
            elif wr >= 0.75:
                score += 10
                signals.append(f"✓ {t.ticker} {wr*100:.0f}% win rate")
        
        # Recommendation
        if score >= 70:
            rec = "STRONG HOLD"
        elif score >= 50:
            rec = "HOLD"
        elif score >= 35:
            rec = "MONITOR CLOSELY"
        else:
            rec = "CONSIDER EXIT"
        
        print(f"   Score: {score}/100 → {rec}")
        for s in signals:
            print(f"      {s}")
    
    print("\n" + "=" * 70)


def cmd_batch_update(args):
    """Batch update from CSV - handles ALL fields dynamically."""
    db = TradeDatabase()
    
    # Map CSV column names to dataclass field names
    field_map = {
        'rsi': 'entry_rsi', 'rsi_5d': 'entry_rsi_5d',
        'buffer': 'entry_buffer_pct', 'analyst': 'entry_analyst_pct',
        'iv': 'entry_iv', 'trend': 'entry_trend_pct',
        'pe': 'entry_pe', 'beta': 'entry_beta',
        'market_cap': 'entry_market_cap', 'price': 'entry_price',
        'macd_hist': 'entry_macd_hist', 'adx': 'entry_adx',
        'atr_pct': 'entry_atr_pct', 'bb_position': 'entry_bb_position',
        'trend_5d': 'entry_trend_5d', 'trend_20d': 'entry_trend_20d',
        'short_ratio': 'entry_short_ratio', 'put_call': 'entry_put_call_ratio',
        'iv_rank': 'entry_iv_rank', 'hv_20': 'entry_hv_20',
        'days_to_earnings': 'entry_days_to_earnings',
        'pct_from_52w_high': 'entry_pct_from_52w_high',
        'pct_from_50dma': 'entry_pct_from_50dma',
        'ma_alignment': 'entry_ma_alignment',
    }
    
    with open(args.csv_file, 'r') as f:
        reader = csv.DictReader(f)
        updated = 0
        
        for row in reader:
            ticker = row.get('ticker')
            entry_date = row.get('entry_date')
            
            for t in db.trades:
                if t.ticker == ticker and t.entry_date == entry_date:
                    fields_set = 0
                    for csv_col, value in row.items():
                        if csv_col in ['ticker', 'entry_date'] or not value:
                            continue
                        
                        # Map to dataclass field name
                        field_name = field_map.get(csv_col, csv_col)
                        
                        if hasattr(t, field_name):
                            try:
                                # Type conversion
                                if field_name in ['entry_ma_alignment']:
                                    setattr(t, field_name, value)
                                elif field_name in ['entry_higher_low']:
                                    setattr(t, field_name, 
                                            value.lower() in ['true', '1', 'yes'])
                                elif 'day' in field_name and 'days' not in field_name:
                                    setattr(t, field_name, int(value))
                                else:
                                    setattr(t, field_name, float(value))
                                fields_set += 1
                            except (ValueError, TypeError):
                                pass
                    
                    if fields_set > 0:
                        t.updated_at = datetime.now().isoformat()
                        updated += 1
                        print(f"  Updated {ticker} {entry_date} "
                              f"({fields_set} fields)")
                    break
    
    db.save()
    print(f"\nUpdated {updated} trades.")


def cmd_export(args):
    """Export to CSV."""
    db = TradeDatabase()
    
    with open(args.output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'ticker', 'entry_date', 'exit_date', 'long_strike',
            'short_strike', 'debit_paid', 'pnl', 'return_pct',
            'days_held', 'entry_rsi', 'entry_buffer_pct',
            'entry_analyst_pct', 'entry_iv', 'entry_trend_pct',
        ])
        writer.writeheader()
        for t in db.trades:
            writer.writerow({
                'ticker': t.ticker,
                'entry_date': t.entry_date,
                'exit_date': t.exit_date,
                'long_strike': t.long_strike,
                'short_strike': t.short_strike,
                'debit_paid': t.debit_paid,
                'pnl': t.pnl,
                'return_pct': t.return_pct,
                'days_held': t.days_held,
                'entry_rsi': t.entry_rsi,
                'entry_buffer_pct': t.entry_buffer_pct,
                'entry_analyst_pct': t.entry_analyst_pct,
                'entry_iv': t.entry_iv,
                'entry_trend_pct': t.entry_trend_pct,
            })
    
    print(f"Exported {len(db.trades)} trades to {args.output}")


def main():
    parser = argparse.ArgumentParser(
        description="Spread Quantitative Analysis System"
    )
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    # Import command
    import_parser = subparsers.add_parser(
        'import', help='Import trades from CSV'
    )
    import_parser.add_argument('csv_file', help='Robinhood CSV export')
    import_parser.set_defaults(func=cmd_import)
    
    # Analyze command
    analyze_parser = subparsers.add_parser(
        'analyze', help='Run quantitative analysis'
    )
    analyze_parser.set_defaults(func=cmd_analyze)
    
    # Show command
    show_parser = subparsers.add_parser(
        'show', help='Show trade database'
    )
    show_parser.set_defaults(func=cmd_show)
    
    # Open positions command
    open_parser = subparsers.add_parser(
        'open', help='Analyze open positions'
    )
    open_parser.set_defaults(func=cmd_open)
    
    # Export command
    export_parser = subparsers.add_parser(
        'export', help='Export to CSV'
    )
    export_parser.add_argument('output', help='Output CSV file')
    export_parser.set_defaults(func=cmd_export)
    
    # Update command (manual entry conditions)
    # Coverage command
    coverage_parser = subparsers.add_parser(
        'coverage', help='Show data coverage statistics'
    )
    coverage_parser.set_defaults(func=cmd_coverage)
    
    # Fetch command
    fetch_parser = subparsers.add_parser(
        'fetch', help='Fetch data from Yahoo proxy'
    )
    fetch_parser.add_argument('--ticker', help='Specific ticker to update')
    fetch_parser.set_defaults(func=cmd_fetch)
    
    # Template command
    template_parser = subparsers.add_parser(
        'template', help='Export CSV template for data entry'
    )
    template_parser.add_argument('output', help='Output CSV file')
    template_parser.set_defaults(func=cmd_template)
    
    # Update command with comprehensive fields
    update_parser = subparsers.add_parser(
        'update', help='Update entry conditions for a trade'
    )
    update_parser.add_argument('ticker', help='Ticker symbol')
    update_parser.add_argument('date', help='Entry date (MM/DD/YYYY)')
    # Price & Position
    update_parser.add_argument('--price', type=float, help='Entry price')
    update_parser.add_argument('--52w_high', type=float, dest='_52w_high')
    update_parser.add_argument('--52w_low', type=float, dest='_52w_low')
    update_parser.add_argument('--pct_from_high', type=float)
    update_parser.add_argument('--pct_from_low', type=float)
    update_parser.add_argument('--50dma', type=float, dest='_50dma')
    update_parser.add_argument('--200dma', type=float, dest='_200dma')
    # Fundamentals
    update_parser.add_argument('--pe', type=float, help='P/E ratio')
    update_parser.add_argument('--forward_pe', type=float)
    update_parser.add_argument('--beta', type=float)
    update_parser.add_argument('--market_cap', type=float, help='$B')
    # Technicals
    update_parser.add_argument('--rsi', type=float, help='RSI 14')
    update_parser.add_argument('--rsi_5d', type=float, help='RSI 5')
    update_parser.add_argument('--macd_hist', type=float)
    update_parser.add_argument('--adx', type=float)
    update_parser.add_argument('--atr_pct', type=float)
    update_parser.add_argument('--bb_position', type=float)
    update_parser.add_argument('--volume_ratio', type=float)
    # Trend
    update_parser.add_argument('--trend_5d', type=float)
    update_parser.add_argument('--trend_10d', type=float)
    update_parser.add_argument('--trend_20d', type=float)
    update_parser.add_argument('--buffer', type=float, help='Buffer %')
    # Sentiment
    update_parser.add_argument('--analyst', type=float, help='Analyst %')
    update_parser.add_argument('--short_ratio', type=float)
    update_parser.add_argument('--short_pct', type=float)
    update_parser.add_argument('--put_call', type=float)
    # Volatility
    update_parser.add_argument('--iv', type=float, help='ATM IV %')
    update_parser.add_argument('--iv_rank', type=float)
    update_parser.add_argument('--hv_20', type=float)
    # Timing
    update_parser.add_argument('--days_to_earnings', type=int)
    update_parser.set_defaults(func=cmd_update)
    
    # Batch update command
    batch_parser = subparsers.add_parser(
        'batch-update', help='Batch update from CSV'
    )
    batch_parser.add_argument('csv_file', 
                              help='CSV with ticker,entry_date,rsi,...')
    batch_parser.set_defaults(func=cmd_batch_update)
    
    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()

