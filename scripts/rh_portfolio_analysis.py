#!/usr/bin/env python3
"""
Robinhood Portfolio Analysis Script

Analyzes Robinhood CSV exports to provide insights on
Deep ITM Call Debit Spread strategy performance.

Usage:
    python scripts/rh_portfolio_analysis.py <csv_file>
    python scripts/rh_portfolio_analysis.py data.csv --output json
    python scripts/rh_portfolio_analysis.py data.csv --verbose
"""

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional
from pathlib import Path


# ============================================================
# Data Models
# ============================================================

@dataclass
class OptionTrade:
    """Represents a single option transaction."""
    date: datetime
    ticker: str
    strike: float
    expiration: str
    option_type: str  # 'Call' or 'Put'
    action: str       # BTO, STO, BTC, STC
    quantity: int
    price: float
    amount: float
    description: str

    @property
    def is_opening(self) -> bool:
        return self.action in ('BTO', 'STO')

    @property
    def is_long(self) -> bool:
        return self.action in ('BTO', 'BTC')

    @property
    def spread_key(self) -> str:
        """Unique key for matching spread legs."""
        return f"{self.ticker}_{self.expiration}_{self.option_type}"


@dataclass
class SpreadTrade:
    """Represents a complete spread (long + short leg)."""
    ticker: str
    expiration: str
    long_strike: float
    short_strike: float
    spread_width: float
    entry_debit: float
    exit_credit: Optional[float] = None
    entry_date: Optional[datetime] = None
    exit_date: Optional[datetime] = None
    status: str = 'open'  # open, closed

    @property
    def pnl(self) -> Optional[float]:
        """
        Calculate P&L.
        entry_debit is negative (cash out), exit_credit is positive (cash in).
        P&L = total cash flow = exit_credit + entry_debit
        """
        if self.exit_credit is None:
            return None
        return self.exit_credit + self.entry_debit

    @property
    def pnl_percent(self) -> Optional[float]:
        if self.pnl is None or self.entry_debit == 0:
            return None
        return (self.pnl / abs(self.entry_debit)) * 100

    @property
    def max_profit(self) -> float:
        return (self.spread_width * 100) - abs(self.entry_debit)

    @property
    def days_held(self) -> Optional[int]:
        if self.entry_date and self.exit_date:
            return (self.exit_date - self.entry_date).days
        return None

    @property
    def is_winner(self) -> Optional[bool]:
        if self.pnl is None:
            return None
        return self.pnl > 0


@dataclass 
class StockTrade:
    """Represents a stock buy/sell transaction."""
    date: datetime
    ticker: str
    action: str  # Buy, Sell
    quantity: float
    price: float
    amount: float


@dataclass
class OtherIncome:
    """Represents non-trading income."""
    date: datetime
    type: str
    ticker: Optional[str]
    amount: float


@dataclass
class AnalysisResults:
    """Complete analysis results."""
    # TOTAL PORTFOLIO (all transactions)
    total_portfolio_pnl: float = 0.0
    total_cash_in: float = 0.0
    total_cash_out: float = 0.0
    
    # Spread Statistics
    total_spreads: int = 0
    closed_spreads: int = 0
    open_spreads: int = 0
    winners: int = 0
    losers: int = 0
    win_rate: float = 0.0
    
    # Spread P&L (closed spreads only)
    spread_pnl: float = 0.0
    total_gains: float = 0.0
    total_losses: float = 0.0
    profit_factor: float = 0.0
    avg_winner: float = 0.0
    avg_loser: float = 0.0
    largest_winner: float = 0.0
    largest_loser: float = 0.0
    
    # Unmatched closes (opened before this data period)
    unmatched_close_value: float = 0.0
    unmatched_closes: list = field(default_factory=list)
    
    # Stock P&L
    stock_pnl: float = 0.0
    
    # Other Income
    other_income_total: float = 0.0
    
    # Risk Metrics
    avg_debit_paid: float = 0.0
    avg_spread_width: float = 0.0
    avg_days_held: float = 0.0
    capital_at_risk: float = 0.0
    
    # By Ticker
    ticker_performance: dict = field(default_factory=dict)
    
    # Lists
    closed_trades: list = field(default_factory=list)
    open_positions: list = field(default_factory=list)
    stock_trades: list = field(default_factory=list)
    other_income: list = field(default_factory=list)
    
    # Warnings/Insights
    warnings: list = field(default_factory=list)
    insights: list = field(default_factory=list)


# ============================================================
# Parser
# ============================================================

class RobinhoodCSVParser:
    """Parses Robinhood CSV export files."""

    # Regex for option descriptions like 
    # "NVDA 1/16/2026 Call $165.00"
    OPTION_PATTERN = re.compile(
        r'^([A-Z]+)\s+'
        r'(\d{1,2}/\d{1,2}/\d{4})\s+'
        r'(Call|Put)\s+'
        r'\$?([\d,]+\.?\d*)'
    )

    # Transaction codes for options
    OPTION_CODES = {'BTO', 'STO', 'BTC', 'STC'}

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        self.option_trades: list[OptionTrade] = []
        self.stock_trades: list[StockTrade] = []
        self.other_income: list[OtherIncome] = []

    def parse(self) -> tuple[
        list[OptionTrade], 
        list[StockTrade], 
        list[OtherIncome]
    ]:
        """Parse the CSV file and return categorized trades."""
        with open(self.filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        # Handle multi-line descriptions
        cleaned_rows = self._merge_multiline_rows(rows)

        for row in cleaned_rows:
            self._process_row(row)

        return self.option_trades, self.stock_trades, self.other_income

    def _merge_multiline_rows(self, rows: list[dict]) -> list[dict]:
        """Merge rows that span multiple lines (CUSIP info)."""
        cleaned = []
        i = 0
        
        while i < len(rows):
            row = rows[i]
            
            # Skip empty/disclaimer rows
            if not row.get('Activity Date'):
                i += 1
                continue
                
            # Check if next row is a CUSIP continuation
            if (i + 1 < len(rows) and 
                rows[i + 1].get('Activity Date') == '' and
                'CUSIP' in str(rows[i + 1].get('Description', ''))):
                # This is a multi-line stock description, merge
                row['Description'] = (
                    f"{row.get('Description', '')} "
                    f"{rows[i + 1].get('Description', '')}"
                )
                i += 2
            else:
                i += 1
            
            cleaned.append(row)
        
        return cleaned

    def _process_row(self, row: dict) -> None:
        """Process a single row and categorize it."""
        trans_code = row.get('Trans Code', '').strip()
        description = row.get('Description', '').strip()
        amount_str = row.get('Amount', '0').strip()
        
        # Parse amount
        amount = self._parse_amount(amount_str)
        
        # Parse date
        date_str = row.get('Activity Date', '')
        try:
            date = datetime.strptime(date_str, '%m/%d/%Y')
        except ValueError:
            return  # Skip invalid dates
        
        # Option trade
        if trans_code in self.OPTION_CODES:
            option = self._parse_option(row, date, trans_code, amount)
            if option:
                self.option_trades.append(option)
        
        # Stock trade
        elif trans_code in ('Buy', 'Sell'):
            stock = self._parse_stock(row, date, trans_code, amount)
            if stock:
                self.stock_trades.append(stock)
        
        # Other income
        elif trans_code in ('INT', 'CDIV', 'GDBP', 'SLIP', 'FUTSWP'):
            ticker = row.get('Instrument', '').strip() or None
            self.other_income.append(OtherIncome(
                date=date,
                type=trans_code,
                ticker=ticker,
                amount=amount
            ))

    def _parse_option(
        self, 
        row: dict, 
        date: datetime, 
        action: str, 
        amount: float
    ) -> Optional[OptionTrade]:
        """Parse an option trade row."""
        description = row.get('Description', '')
        match = self.OPTION_PATTERN.match(description)
        
        if not match:
            return None
        
        ticker, exp_str, opt_type, strike_str = match.groups()
        strike = float(strike_str.replace(',', ''))
        
        # Parse price
        price_str = row.get('Price', '0').strip()
        price = self._parse_amount(price_str)
        
        # Parse quantity
        qty_str = row.get('Quantity', '1').strip()
        try:
            quantity = int(float(qty_str)) if qty_str else 1
        except ValueError:
            quantity = 1
        
        return OptionTrade(
            date=date,
            ticker=ticker,
            strike=strike,
            expiration=exp_str,
            option_type=opt_type,
            action=action,
            quantity=quantity,
            price=abs(price),
            amount=amount,
            description=description
        )

    def _parse_stock(
        self, 
        row: dict, 
        date: datetime, 
        action: str, 
        amount: float
    ) -> Optional[StockTrade]:
        """Parse a stock trade row."""
        ticker = row.get('Instrument', '').strip()
        if not ticker:
            return None
        
        price_str = row.get('Price', '0').strip()
        price = self._parse_amount(price_str)
        
        qty_str = row.get('Quantity', '0').strip()
        try:
            quantity = float(qty_str) if qty_str else 0
        except ValueError:
            quantity = 0
        
        return StockTrade(
            date=date,
            ticker=ticker,
            action=action,
            quantity=quantity,
            price=abs(price),
            amount=amount
        )

    @staticmethod
    def _parse_amount(s: str) -> float:
        """Parse a currency amount string."""
        if not s:
            return 0.0
        # Remove $, commas, parentheses
        cleaned = s.replace('$', '').replace(',', '').strip()
        # Handle parentheses for negative
        if cleaned.startswith('(') and cleaned.endswith(')'):
            cleaned = '-' + cleaned[1:-1]
        try:
            return float(cleaned)
        except ValueError:
            return 0.0


# ============================================================
# Analyzer
# ============================================================

class SpreadAnalyzer:
    """Analyzes option trades to identify and track spreads."""

    def __init__(
        self, 
        option_trades: list[OptionTrade],
        stock_trades: list[StockTrade],
        other_income: list[OtherIncome]
    ):
        self.option_trades = sorted(
            option_trades, 
            key=lambda x: x.date
        )
        self.stock_trades = stock_trades
        self.other_income = other_income
        self.spreads: list[SpreadTrade] = []
        self.unmatched_closes: list[dict] = []

    def analyze(self) -> AnalysisResults:
        """Run full analysis and return results."""
        self._identify_spreads()
        return self._calculate_metrics()

    def _identify_spreads(self) -> None:
        """Match option trades into spread positions."""
        # Group trades by spread key (ticker + expiration + type)
        grouped: dict[str, list[OptionTrade]] = {}
        
        for trade in self.option_trades:
            key = trade.spread_key
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(trade)

        # Process each group to find spreads
        for key, trades in grouped.items():
            self._process_spread_group(trades)

    def _process_spread_group(self, trades: list[OptionTrade]) -> None:
        """Process a group of trades for the same underlying/exp."""
        # Separate by action type
        opens = [t for t in trades if t.is_opening]
        closes = [t for t in trades if not t.is_opening]

        # Find matching BTO/STO pairs (spread entries)
        open_pairs = self._find_simultaneous_pairs(opens)
        close_pairs = self._find_simultaneous_pairs(closes)
        
        # Track which close pairs get matched
        matched_close_pairs = []

        # Create spread objects
        for (long_leg, short_leg) in open_pairs:
            spread = SpreadTrade(
                ticker=long_leg.ticker,
                expiration=long_leg.expiration,
                long_strike=long_leg.strike,
                short_strike=short_leg.strike,
                spread_width=abs(short_leg.strike - long_leg.strike),
                entry_debit=long_leg.amount + short_leg.amount,
                entry_date=long_leg.date,
                status='open'
            )

            # Try to find matching close
            # When closing: STC closes BTO (long), BTC closes STO (short)
            # close_long here is BTC (buying back), close_short is STC (selling)
            for (close_long, close_short) in close_pairs:
                if (close_long, close_short) in matched_close_pairs:
                    continue
                # STC strike should match original BTO (long_leg)
                # BTC strike should match original STO (short_leg)
                if (close_short.strike == long_leg.strike and
                    close_long.strike == short_leg.strike):
                    spread.exit_credit = (
                        close_long.amount + close_short.amount
                    )
                    spread.exit_date = close_long.date
                    spread.status = 'closed'
                    matched_close_pairs.append((close_long, close_short))
                    break

            self.spreads.append(spread)
        
        # Track unmatched closes (spreads opened before this data period)
        for (close_long, close_short) in close_pairs:
            if (close_long, close_short) not in matched_close_pairs:
                # This is a close without a matching open in this data
                self.unmatched_closes.append({
                    'ticker': close_long.ticker,
                    'expiration': close_long.expiration,
                    'long_strike': close_short.strike,  # STC is long leg
                    'short_strike': close_long.strike,  # BTC is short leg
                    'spread_width': abs(close_long.strike - close_short.strike),
                    'exit_value': close_long.amount + close_short.amount,
                    'exit_date': close_long.date
                })

    def _find_simultaneous_pairs(
        self, 
        trades: list[OptionTrade]
    ) -> list[tuple[OptionTrade, OptionTrade]]:
        """Find pairs of trades that occurred on the same day."""
        pairs = []
        used = set()

        # Sort by date
        sorted_trades = sorted(trades, key=lambda x: (x.date, x.strike))

        for i, t1 in enumerate(sorted_trades):
            if i in used:
                continue
                
            for j, t2 in enumerate(sorted_trades[i+1:], i+1):
                if j in used:
                    continue
                    
                # Same day, different strikes, opposite long/short
                if (t1.date == t2.date and 
                    t1.strike != t2.strike and
                    t1.is_long != t2.is_long):
                    
                    # Determine which is long/short
                    long_leg = t1 if t1.is_long else t2
                    short_leg = t2 if t1.is_long else t1
                    
                    pairs.append((long_leg, short_leg))
                    used.add(i)
                    used.add(j)
                    break

        return pairs

    def _calculate_metrics(self) -> AnalysisResults:
        """Calculate all analysis metrics."""
        results = AnalysisResults()
        
        # ============================================
        # REALIZED P&L CALCULATIONS
        # ============================================
        
        # OPTION REALIZED P&L: Sum all CLOSING transactions (BTC/STC)
        # These represent money received/paid when closing positions
        closing_option_trades = [
            t for t in self.option_trades 
            if t.action in ('BTC', 'STC')
        ]
        opening_option_trades = [
            t for t in self.option_trades 
            if t.action in ('BTO', 'STO')
        ]
        
        # Realized option P&L = sum of all closing transactions
        # (STC gives positive cash, BTC gives negative cash)
        option_close_amounts = sum(t.amount for t in closing_option_trades)
        
        # For closes that have matching opens in this file, 
        # we subtract the open cost
        # For closes WITHOUT matching opens (opened before this data),
        # we just use the close amounts
        
        # STOCK P&L
        all_stock_amounts = [t.amount for t in self.stock_trades]
        results.stock_pnl = sum(all_stock_amounts)
        
        # Other income total
        all_income_amounts = [i.amount for i in self.other_income]
        results.other_income_total = sum(all_income_amounts)
        
        # Total cash flow (for reference)
        all_option_amounts = [t.amount for t in self.option_trades]
        all_amounts = all_option_amounts + all_stock_amounts + all_income_amounts
        results.total_cash_in = sum(a for a in all_amounts if a > 0)
        results.total_cash_out = sum(a for a in all_amounts if a < 0)
        results.total_portfolio_pnl = sum(all_amounts)
        
        # ============================================
        # SPREAD-SPECIFIC ANALYSIS
        # ============================================
        # Basic counts
        results.total_spreads = len(self.spreads)
        closed = [s for s in self.spreads if s.status == 'closed']
        open_pos = [s for s in self.spreads if s.status == 'open']
        
        results.closed_spreads = len(closed)
        results.open_spreads = len(open_pos)
        results.closed_trades = [self._spread_to_dict(s) for s in closed]
        results.open_positions = [self._spread_to_dict(s) for s in open_pos]
        
        # Win/Loss
        winners = [s for s in closed if s.is_winner]
        losers = [s for s in closed if s.pnl is not None and not s.is_winner]
        
        results.winners = len(winners)
        results.losers = len(losers)
        
        if closed:
            results.win_rate = (len(winners) / len(closed)) * 100
        
        # Spread P&L calculations (closed spreads only)
        pnls = [s.pnl for s in closed if s.pnl is not None]
        gains = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        
        results.spread_pnl = sum(pnls)
        results.total_gains = sum(gains)
        results.total_losses = sum(losses)
        
        if losses:
            results.profit_factor = (
                abs(results.total_gains) / abs(results.total_losses)
            )
        
        if gains:
            results.avg_winner = sum(gains) / len(gains)
            results.largest_winner = max(gains)
        
        if losses:
            results.avg_loser = sum(losses) / len(losses)
            results.largest_loser = min(losses)
        
        # Risk metrics
        debits = [abs(s.entry_debit) for s in self.spreads]
        widths = [s.spread_width for s in self.spreads]
        days = [s.days_held for s in closed if s.days_held is not None]
        
        if debits:
            results.avg_debit_paid = sum(debits) / len(debits)
        if widths:
            results.avg_spread_width = sum(widths) / len(widths)
        if days:
            results.avg_days_held = sum(days) / len(days)
        
        # Capital at risk (open positions)
        results.capital_at_risk = sum(
            abs(s.entry_debit) for s in open_pos
        )
        
        # By ticker performance
        results.ticker_performance = self._ticker_breakdown(closed)
        
        # Unmatched closes (spreads opened before this data period)
        results.unmatched_closes = [
            {
                'ticker': uc['ticker'],
                'expiration': uc['expiration'],
                'strikes': f"${uc['long_strike']}/${uc['short_strike']}",
                'spread_width': uc['spread_width'],
                'exit_value': uc['exit_value'],
                'exit_date': uc['exit_date'].strftime('%Y-%m-%d')
            }
            for uc in self.unmatched_closes
        ]
        results.unmatched_close_value = sum(
            uc['exit_value'] for uc in self.unmatched_closes
        )
        
        # Stock trades
        results.stock_trades = [
            {
                'date': s.date.strftime('%Y-%m-%d'),
                'ticker': s.ticker,
                'action': s.action,
                'quantity': s.quantity,
                'price': s.price,
                'amount': s.amount
            }
            for s in self.stock_trades
        ]
        
        # Other income
        results.other_income = [
            {
                'date': o.date.strftime('%Y-%m-%d'),
                'type': o.type,
                'ticker': o.ticker,
                'amount': o.amount
            }
            for o in self.other_income
        ]
        
        # Generate insights
        results.warnings = self._generate_warnings(results)
        results.insights = self._generate_insights(results)
        
        return results

    def _spread_to_dict(self, spread: SpreadTrade) -> dict:
        """Convert spread to dictionary."""
        return {
            'ticker': spread.ticker,
            'expiration': spread.expiration,
            'strikes': f"${spread.long_strike}/${spread.short_strike}",
            'spread_width': spread.spread_width,
            'entry_debit': spread.entry_debit,
            'exit_credit': spread.exit_credit,
            'pnl': spread.pnl,
            'pnl_percent': spread.pnl_percent,
            'entry_date': (
                spread.entry_date.strftime('%Y-%m-%d') 
                if spread.entry_date else None
            ),
            'exit_date': (
                spread.exit_date.strftime('%Y-%m-%d') 
                if spread.exit_date else None
            ),
            'days_held': spread.days_held,
            'status': spread.status
        }

    def _ticker_breakdown(self, closed: list[SpreadTrade]) -> dict:
        """Calculate per-ticker performance."""
        by_ticker: dict[str, list[SpreadTrade]] = {}
        
        for spread in closed:
            if spread.ticker not in by_ticker:
                by_ticker[spread.ticker] = []
            by_ticker[spread.ticker].append(spread)
        
        result = {}
        for ticker, spreads in by_ticker.items():
            pnls = [s.pnl for s in spreads if s.pnl is not None]
            winners = len([p for p in pnls if p > 0])
            
            result[ticker] = {
                'trades': len(spreads),
                'total_pnl': sum(pnls),
                'win_rate': (winners / len(spreads)) * 100 if spreads else 0,
                'avg_pnl': sum(pnls) / len(pnls) if pnls else 0
            }
        
        return result

    def _generate_warnings(self, results: AnalysisResults) -> list[str]:
        """Generate warning messages."""
        warnings = []
        
        # Win rate warning
        if results.win_rate < 70:
            warnings.append(
                f"⚠️ Win rate ({results.win_rate:.1f}%) is below "
                f"break-even threshold (~74%) for this strategy"
            )
        
        # Risk/Reward warning
        if results.avg_debit_paid > 0 and results.avg_spread_width > 0:
            risk_reward = (
                results.avg_debit_paid / 
                (results.avg_spread_width * 100 - results.avg_debit_paid)
            )
            if risk_reward > 2.5:
                warnings.append(
                    f"⚠️ Risk/Reward ratio ({risk_reward:.1f}:1) is "
                    f"unfavorable. Consider wider spreads."
                )
        
        # Ticker-specific warnings
        for ticker, perf in results.ticker_performance.items():
            if perf['trades'] >= 2 and perf['total_pnl'] < -50:
                pnl_val = perf['total_pnl']
                pnl_str = f"-${abs(pnl_val):.2f}" if pnl_val < 0 \
                    else f"+${pnl_val:.2f}"
                warnings.append(
                    f"⚠️ {ticker} is underperforming: "
                    f"{pnl_str} total P&L "
                    f"across {perf['trades']} trades"
                )
        
        # Narrow spread warning
        if results.avg_spread_width < 3:
            warnings.append(
                f"⚠️ Average spread width (${results.avg_spread_width:.0f}) "
                f"is narrow. Commission drag impacts returns."
            )
        
        return warnings

    def _generate_insights(self, results: AnalysisResults) -> list[str]:
        """Generate positive insights."""
        insights = []
        
        # Best performer
        if results.ticker_performance:
            best = max(
                results.ticker_performance.items(),
                key=lambda x: x[1]['total_pnl']
            )
            if best[1]['total_pnl'] > 0:
                insights.append(
                    f"💰 Best performer: {best[0]} "
                    f"(+${best[1]['total_pnl']:.2f})"
                )
        
        # Risk management
        if results.total_spreads > 0:
            insights.append(
                f"✅ Defined risk: Max loss per trade "
                f"~${results.avg_debit_paid:.0f}"
            )
        
        # Profit factor
        if results.profit_factor >= 1.0:
            insights.append(
                f"📈 Profit factor: {results.profit_factor:.2f} "
                f"(gains/losses ratio)"
            )
        
        # Consistency
        if results.avg_days_held < 14:
            insights.append(
                f"⏱️ Active management: Avg hold time "
                f"{results.avg_days_held:.0f} days"
            )
        
        return insights


# ============================================================
# Output Formatters
# ============================================================

def print_report(results: AnalysisResults, verbose: bool = False) -> None:
    """Print formatted analysis report."""
    print("\n" + "="*60)
    print("   ROBINHOOD PORTFOLIO ANALYSIS")
    print("="*60)

    # REALIZED P&L SUMMARY
    print("\n💰 P&L SUMMARY")
    print("-"*40)
    
    # Only matched spreads + other income can be accurately calculated
    verifiable_pnl = results.spread_pnl + results.other_income_total
    
    verifiable_str = f"+${verifiable_pnl:.2f}" if verifiable_pnl >= 0 \
        else f"-${abs(verifiable_pnl):.2f}"
    
    print(f"  ✅ VERIFIABLE P&L:   {verifiable_str}")
    print(f"     (Spreads opened & closed in this period + income)")
    print()
    
    # Breakdown of verifiable
    spread_str = f"+${results.spread_pnl:.2f}" \
        if results.spread_pnl >= 0 else f"-${abs(results.spread_pnl):.2f}"
    income_str = f"+${results.other_income_total:.2f}" \
        if results.other_income_total >= 0 \
        else f"-${abs(results.other_income_total):.2f}"
    
    print("  VERIFIABLE BREAKDOWN:")
    print(f"    Spread P&L:        {spread_str}")
    print(f"    Other Income:      {income_str}")
    
    # Unverifiable items (missing cost basis)
    print()
    print("  ⚠️  INCOMPLETE DATA (cost basis unknown):")
    
    if results.unmatched_closes:
        unmatched_str = f"+${results.unmatched_close_value:.2f}" \
            if results.unmatched_close_value >= 0 \
            else f"-${abs(results.unmatched_close_value):.2f}"
        print(f"    Prior Spread Exits: {unmatched_str} (proceeds only)")
    
    stock_str = f"+${results.stock_pnl:.2f}" \
        if results.stock_pnl >= 0 else f"-${abs(results.stock_pnl):.2f}"
    print(f"    Stock Cash Flow:    {stock_str} (not true P&L)")
    
    print()
    print("  📱 Check Robinhood app for accurate total P&L.")

    # Spread Summary
    print("\n📊 SPREAD TRADING SUMMARY")
    print("-"*40)
    print(f"  Total Spreads:     {results.total_spreads}")
    print(f"  Closed:            {results.closed_spreads}")
    print(f"  Open Positions:    {results.open_spreads}")
    print(f"  Winners:           {results.winners}")
    print(f"  Losers:            {results.losers}")
    print(f"  Win Rate:          {results.win_rate:.1f}%")

    # Spread P&L (closed spreads only)
    print("\n💵 SPREAD P&L (Closed Positions)")
    print("-"*40)
    pnl_str = f"+${results.spread_pnl:.2f}" if results.spread_pnl >= 0 \
        else f"-${abs(results.spread_pnl):.2f}"
    loss_str = f"-${abs(results.total_losses):.2f}" if results.total_losses < 0 \
        else f"${results.total_losses:.2f}"
    avg_loser_str = f"-${abs(results.avg_loser):.2f}" if results.avg_loser < 0 \
        else f"${results.avg_loser:.2f}"
    largest_loser_str = f"-${abs(results.largest_loser):.2f}" \
        if results.largest_loser < 0 else f"${results.largest_loser:.2f}"
    
    print(f"  Net P&L:           {pnl_str}")
    print(f"  Total Gains:       +${results.total_gains:.2f}")
    print(f"  Total Losses:      {loss_str}")
    print(f"  Profit Factor:     {results.profit_factor:.2f}")
    print(f"  Avg Winner:        +${results.avg_winner:.2f}")
    print(f"  Avg Loser:         {avg_loser_str}")
    print(f"  Largest Winner:    +${results.largest_winner:.2f}")
    print(f"  Largest Loser:     {largest_loser_str}")

    # Risk
    print("\n⚖️ RISK METRICS")
    print("-"*40)
    print(f"  Avg Debit Paid:    ${results.avg_debit_paid:.2f}")
    print(f"  Avg Spread Width:  ${results.avg_spread_width:.0f}")
    print(f"  Avg Days Held:     {results.avg_days_held:.1f}")
    print(f"  Capital at Risk:   ${results.capital_at_risk:.2f}")

    # Risk/Reward calculation
    if results.avg_spread_width > 0:
        max_profit = (results.avg_spread_width * 100) - results.avg_debit_paid
        if max_profit > 0:
            risk_reward = results.avg_debit_paid / max_profit
            print(f"  Risk/Reward:       {risk_reward:.1f}:1")
            print(
                f"  Required Win Rate: "
                f"{(risk_reward / (1 + risk_reward)) * 100:.0f}%"
            )

    # By Ticker
    if results.ticker_performance:
        print("\n📈 PERFORMANCE BY TICKER")
        print("-"*40)
        sorted_tickers = sorted(
            results.ticker_performance.items(),
            key=lambda x: x[1]['total_pnl'],
            reverse=True
        )
        for ticker, perf in sorted_tickers:
            pnl_val = perf['total_pnl']
            pnl_str = f"+${pnl_val:.2f}" if pnl_val >= 0 \
                else f"-${abs(pnl_val):.2f}"
            print(
                f"  {ticker:6} | {perf['trades']} trades | "
                f"{pnl_str:>10} | WR: {perf['win_rate']:.0f}%"
            )

    # Open Positions
    if results.open_positions:
        print("\n🔓 OPEN POSITIONS")
        print("-"*40)
        for pos in results.open_positions:
            print(
                f"  {pos['ticker']:6} {pos['strikes']} "
                f"(exp {pos['expiration']}) | "
                f"Debit: ${abs(pos['entry_debit']):.2f}"
            )

    # Closed Trades (verbose)
    if verbose and results.closed_trades:
        print("\n📜 CLOSED TRADES")
        print("-"*40)
        for trade in results.closed_trades:
            pnl_val = trade['pnl']
            pnl_str = f"+${pnl_val:.2f}" if pnl_val >= 0 \
                else f"-${abs(pnl_val):.2f}"
            print(
                f"  {trade['entry_date']} → {trade['exit_date']} | "
                f"{trade['ticker']:6} {trade['strikes']} | "
                f"{pnl_str} ({trade['pnl_percent']:.1f}%)"
            )

    # Unmatched closes (spreads from before this export period)
    if results.unmatched_closes:
        print("\n📋 PRIOR PERIOD SPREAD CLOSES")
        print("-"*40)
        print("  (Opened before this data - showing exit proceeds only)")
        for uc in results.unmatched_closes:
            val_str = f"+${uc['exit_value']:.2f}" if uc['exit_value'] >= 0 \
                else f"-${abs(uc['exit_value']):.2f}"
            print(
                f"  {uc['exit_date']} | {uc['ticker']:6} "
                f"{uc['strikes']} | Exit: {val_str}"
            )
    
    # Other Income (only show in verbose mode)
    if verbose and results.other_income:
        print("\n📋 OTHER INCOME DETAILS")
        print("-"*40)
        print(f"  Total: ${results.other_income_total:.2f}")
        for inc in results.other_income:
            amt_str = f"+${inc['amount']:.2f}" if inc['amount'] >= 0 \
                else f"-${abs(inc['amount']):.2f}"
            print(
                f"    {inc['date']} | {inc['type']:6} | {amt_str}"
            )

    # Warnings
    if results.warnings:
        print("\n⚠️ WARNINGS")
        print("-"*40)
        for warning in results.warnings:
            print(f"  {warning}")

    # Insights
    if results.insights:
        print("\n💡 INSIGHTS")
        print("-"*40)
        for insight in results.insights:
            print(f"  {insight}")

    # Strategy recommendations
    print("\n📋 STRATEGY RECOMMENDATIONS")
    print("-"*40)
    
    if results.win_rate < 70:
        print("  • Improve entry timing with technical triggers")
        print("  • Wait for pullbacks to support before entry")
    
    if results.avg_spread_width < 10:
        print("  • Consider widening spreads to $10+ for better R/R")
    
    # Find problem tickers
    problem_tickers = [
        t for t, p in results.ticker_performance.items()
        if p['trades'] >= 2 and p['total_pnl'] < 0
    ]
    if problem_tickers:
        print(f"  • Avoid repeat losses: {', '.join(problem_tickers)}")
    
    print("  • Set 50-70% profit targets instead of holding to exp")
    print("  • Avoid high-IV names (TSLA, CRWD) for this strategy")
    
    print("\n" + "="*60 + "\n")


def output_json(results: AnalysisResults) -> None:
    """Output results as JSON."""
    verifiable_pnl = results.spread_pnl + results.other_income_total
    
    output = {
        'verifiable_pnl': {
            'total': verifiable_pnl,
            'spread_pnl': results.spread_pnl,
            'other_income': results.other_income_total,
            'note': 'Only positions opened AND closed in this period'
        },
        'incomplete_data': {
            'prior_spread_exits': results.unmatched_close_value,
            'stock_cash_flow': results.stock_pnl,
            'note': 'Missing cost basis - not true P&L'
        },
        'cash_flow': {
            'total': results.total_portfolio_pnl,
            'cash_in': results.total_cash_in,
            'cash_out': results.total_cash_out,
        },
        'spread_summary': {
            'total_spreads': results.total_spreads,
            'closed_spreads': results.closed_spreads,
            'open_spreads': results.open_spreads,
            'winners': results.winners,
            'losers': results.losers,
            'win_rate': results.win_rate,
        },
        'spread_pnl': {
            'total': results.spread_pnl,
            'gains': results.total_gains,
            'losses': results.total_losses,
            'profit_factor': results.profit_factor,
            'avg_winner': results.avg_winner,
            'avg_loser': results.avg_loser,
            'largest_winner': results.largest_winner,
            'largest_loser': results.largest_loser,
        },
        'risk': {
            'avg_debit_paid': results.avg_debit_paid,
            'avg_spread_width': results.avg_spread_width,
            'avg_days_held': results.avg_days_held,
            'capital_at_risk': results.capital_at_risk,
        },
        'by_ticker': results.ticker_performance,
        'closed_trades': results.closed_trades,
        'open_positions': results.open_positions,
        'stock_trades': results.stock_trades,
        'other_income': results.other_income,
        'warnings': results.warnings,
        'insights': results.insights,
    }
    print(json.dumps(output, indent=2))


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description='Analyze Robinhood CSV exports for spread strategy'
    )
    parser.add_argument(
        'csv_file', 
        help='Path to Robinhood CSV export'
    )
    parser.add_argument(
        '--output', '-o',
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed trade history'
    )
    
    args = parser.parse_args()
    
    # Validate file
    if not Path(args.csv_file).exists():
        print(f"Error: File not found: {args.csv_file}", file=sys.stderr)
        sys.exit(1)
    
    # Parse
    parser_obj = RobinhoodCSVParser(args.csv_file)
    options, stocks, income = parser_obj.parse()
    
    # Analyze
    analyzer = SpreadAnalyzer(options, stocks, income)
    results = analyzer.analyze()
    
    # Output
    if args.output == 'json':
        output_json(results)
    else:
        print_report(results, verbose=args.verbose)


if __name__ == '__main__':
    main()
