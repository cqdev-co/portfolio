#!/usr/bin/env python3
"""
Trade Investigation Script

Fetches market data for traded tickers and analyzes what
signals may have been missed or ignored.

Usage:
    python scripts/trade_investigation.py
"""

import os
import json
import urllib.request
from dataclasses import dataclass
from typing import Optional

PROXY_URL = os.environ.get(
    'YAHOO_PROXY_URL', 
    'https://yahoo-proxy.conorquinlan.workers.dev'
)


@dataclass
class TickerData:
    """Market data for a ticker."""
    symbol: str
    price: float
    forward_pe: Optional[float]
    fifty_day_avg: Optional[float]
    two_hundred_day_avg: Optional[float]
    atm_iv: Optional[float]
    put_call_ratio: Optional[float]
    bullish_pct: Optional[int]
    analyst_count: int
    short_pct_float: Optional[float]
    earnings_days: Optional[int]
    
    @property
    def pct_from_50dma(self) -> Optional[float]:
        if self.fifty_day_avg and self.price:
            return ((self.price - self.fifty_day_avg) / 
                    self.fifty_day_avg) * 100
        return None
    
    @property
    def pct_from_200dma(self) -> Optional[float]:
        if self.two_hundred_day_avg and self.price:
            return ((self.price - self.two_hundred_day_avg) / 
                    self.two_hundred_day_avg) * 100
        return None


def fetch_ticker(symbol: str) -> Optional[TickerData]:
    """Fetch ticker data from Yahoo Proxy."""
    url = f"{PROXY_URL}/ticker/{symbol}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        
        q = data.get('quote', {}) or {}
        a = data.get('analysts', {}) or {}
        s = data.get('shortInterest', {}) or {}
        o = data.get('options', {}) or {}
        e = data.get('earnings', {}) or {}
        
        return TickerData(
            symbol=symbol,
            price=q.get('price'),
            forward_pe=q.get('forwardPE'),
            fifty_day_avg=q.get('fiftyDayAverage'),
            two_hundred_day_avg=q.get('twoHundredDayAverage'),
            atm_iv=o.get('atmIV'),
            put_call_ratio=o.get('pcRatioVol'),
            bullish_pct=a.get('bullishPct'),
            analyst_count=a.get('total', 0),
            short_pct_float=s.get('shortPctFloat'),
            earnings_days=e.get('daysUntil'),
        )
    except Exception as ex:
        print(f"Error fetching {symbol}: {ex}")
        return None


def analyze_trade(
    ticker: TickerData, 
    pnl: float, 
    status: str = 'closed'
) -> dict:
    """Analyze a trade and identify warning signals."""
    warnings = []
    positives = []
    
    # Forward P/E analysis
    if ticker.forward_pe:
        if ticker.forward_pe > 100:
            warnings.append(
                f"⚠️ EXTREME valuation: Fwd P/E {ticker.forward_pe:.1f}"
            )
        elif ticker.forward_pe > 50:
            warnings.append(
                f"⚠️ High valuation: Fwd P/E {ticker.forward_pe:.1f}"
            )
        elif ticker.forward_pe < 30:
            positives.append(
                f"✅ Reasonable valuation: Fwd P/E {ticker.forward_pe:.1f}"
            )
    
    # Options IV analysis (for debit spreads, lower is better)
    if ticker.atm_iv:
        if ticker.atm_iv > 60:
            warnings.append(
                f"⚠️ HIGH IV ({ticker.atm_iv:.0f}%): "
                f"Expensive options, poor spread value"
            )
        elif ticker.atm_iv > 40:
            warnings.append(
                f"⚠️ Elevated IV ({ticker.atm_iv:.0f}%): "
                f"Options moderately expensive"
            )
        elif ticker.atm_iv < 25:
            positives.append(
                f"✅ Low IV ({ticker.atm_iv:.0f}%): "
                f"Good value for debit spreads"
            )
    
    # Put/Call ratio (>1 = bearish sentiment)
    if ticker.put_call_ratio:
        if ticker.put_call_ratio > 1.0:
            warnings.append(
                f"⚠️ Bearish options flow: P/C ratio {ticker.put_call_ratio:.2f}"
            )
        elif ticker.put_call_ratio < 0.5:
            positives.append(
                f"✅ Bullish options flow: P/C ratio {ticker.put_call_ratio:.2f}"
            )
    
    # Analyst sentiment
    if ticker.bullish_pct is not None:
        if ticker.bullish_pct < 50:
            warnings.append(
                f"⚠️ Bearish analysts: Only {ticker.bullish_pct}% bullish"
            )
        elif ticker.bullish_pct < 70:
            warnings.append(
                f"⚠️ Mixed analyst sentiment: {ticker.bullish_pct}% bullish"
            )
        elif ticker.bullish_pct >= 90:
            positives.append(
                f"✅ Strong analyst support: {ticker.bullish_pct}% bullish"
            )
    
    # Short interest
    if ticker.short_pct_float:
        if ticker.short_pct_float > 5:
            warnings.append(
                f"⚠️ High short interest: {ticker.short_pct_float:.1f}% float"
            )
        elif ticker.short_pct_float < 2:
            positives.append(
                f"✅ Low short interest: {ticker.short_pct_float:.1f}% float"
            )
    
    # Price vs moving averages
    if ticker.pct_from_50dma is not None:
        if ticker.pct_from_50dma < -5:
            warnings.append(
                f"⚠️ Below 50DMA: {ticker.pct_from_50dma:.1f}% "
                f"(weak near-term trend)"
            )
        elif ticker.pct_from_50dma > 5:
            positives.append(
                f"✅ Above 50DMA: +{ticker.pct_from_50dma:.1f}% "
                f"(strong momentum)"
            )
    
    # Earnings proximity (for open positions)
    if status == 'open' and ticker.earnings_days is not None:
        if ticker.earnings_days <= 30:
            warnings.append(
                f"🚨 EARNINGS in {ticker.earnings_days} days! "
                f"High binary risk"
            )
    
    return {
        'symbol': ticker.symbol,
        'pnl': pnl,
        'status': status,
        'warnings': warnings,
        'positives': positives,
        'warning_count': len(warnings),
        'data': {
            'price': ticker.price,
            'forward_pe': ticker.forward_pe,
            'iv': ticker.atm_iv,
            'put_call': ticker.put_call_ratio,
            'bullish_pct': ticker.bullish_pct,
            'short_pct': ticker.short_pct_float,
            'pct_50dma': ticker.pct_from_50dma,
            'earnings_days': ticker.earnings_days,
        }
    }


def main():
    # Your trades from the analysis
    trades = [
        # Closed trades
        ('CRWD', -105.20, 'closed'),
        ('NVDA', 107.90, 'closed'),
        ('MSFT', 36.90, 'closed'),
        ('AMZN', 19.90, 'closed'),
        ('HOOD', -0.20, 'closed'),
        # Open positions
        ('TSLA', 0, 'open'),
        ('AMD', 0, 'open'),
        ('AVGO', 0, 'open'),
    ]
    
    print("\n" + "="*70)
    print("   TRADE INVESTIGATION - What Signals Were Missed?")
    print("="*70)
    
    results = []
    
    for symbol, pnl, status in trades:
        print(f"\n>>> Fetching {symbol}...")
        ticker = fetch_ticker(symbol)
        if ticker:
            analysis = analyze_trade(ticker, pnl, status)
            results.append(analysis)
    
    # Sort by warning count (most warnings first)
    results.sort(key=lambda x: (-x['warning_count'], x['pnl']))
    
    # Print analysis
    print("\n" + "="*70)
    print("   ANALYSIS RESULTS (sorted by warning count)")
    print("="*70)
    
    for r in results:
        pnl_str = f"+${r['pnl']:.2f}" if r['pnl'] >= 0 else f"-${abs(r['pnl']):.2f}"
        status_emoji = "🔓" if r['status'] == 'open' else "✅" if r['pnl'] > 0 else "❌"
        
        print(f"\n{status_emoji} {r['symbol']} | {pnl_str} | "
              f"{r['warning_count']} warnings")
        print("-" * 50)
        
        for w in r['warnings']:
            print(f"  {w}")
        for p in r['positives']:
            print(f"  {p}")
        
        if not r['warnings'] and not r['positives']:
            print("  (No significant signals)")
    
    # Summary
    print("\n" + "="*70)
    print("   KEY FINDINGS")
    print("="*70)
    
    # Correlation: warnings vs P&L
    closed = [r for r in results if r['status'] == 'closed']
    losers = [r for r in closed if r['pnl'] < 0]
    winners = [r for r in closed if r['pnl'] > 0]
    
    avg_loser_warnings = (
        sum(r['warning_count'] for r in losers) / len(losers) 
        if losers else 0
    )
    avg_winner_warnings = (
        sum(r['warning_count'] for r in winners) / len(winners) 
        if winners else 0
    )
    
    print(f"\n📊 Warning Correlation:")
    print(f"   Avg warnings on LOSERS:  {avg_loser_warnings:.1f}")
    print(f"   Avg warnings on WINNERS: {avg_winner_warnings:.1f}")
    
    # Open position alerts
    open_positions = [r for r in results if r['status'] == 'open']
    risky_opens = [r for r in open_positions if r['warning_count'] >= 2]
    
    if risky_opens:
        print(f"\n🚨 OPEN POSITIONS WITH MULTIPLE WARNINGS:")
        for r in risky_opens:
            print(f"   {r['symbol']}: {r['warning_count']} warnings")
            for w in r['warnings']:
                print(f"      {w}")
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS:")
    print("-" * 50)
    
    # Find patterns
    high_iv_losers = [
        r for r in losers 
        if r['data'].get('iv') and r['data']['iv'] > 50
    ]
    if high_iv_losers:
        tickers = ', '.join(r['symbol'] for r in high_iv_losers)
        print(f"1. AVOID HIGH IV: {tickers} had IV >50% (expensive spreads)")
    
    low_sentiment_losers = [
        r for r in losers 
        if r['data'].get('bullish_pct') and r['data']['bullish_pct'] < 70
    ]
    if low_sentiment_losers:
        tickers = ', '.join(r['symbol'] for r in low_sentiment_losers)
        print(f"2. CHECK SENTIMENT: {tickers} had weak analyst support")
    
    below_ma_losers = [
        r for r in losers 
        if r['data'].get('pct_50dma') and r['data']['pct_50dma'] < -5
    ]
    if below_ma_losers:
        tickers = ', '.join(r['symbol'] for r in below_ma_losers)
        print(f"3. WAIT FOR TREND: {tickers} were below 50DMA (weak momentum)")
    
    earnings_risk = [
        r for r in open_positions 
        if r['data'].get('earnings_days') and r['data']['earnings_days'] <= 30
    ]
    if earnings_risk:
        for r in earnings_risk:
            print(f"4. ⚠️ {r['symbol']}: Consider closing before earnings "
                  f"({r['data']['earnings_days']} days)")
    
    print("\n" + "="*70 + "\n")


if __name__ == '__main__':
    main()

