"""
Advanced ticker extraction system for Reddit financial posts.
Identifies stock symbols, validates them, and handles edge cases.
"""

import re
import logging
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TickerMatch:
    """Represents a found ticker symbol with metadata."""
    symbol: str
    confidence: float
    context: str
    position: int
    source: str  # "dollar_sign", "word_boundary", "explicit"


class TickerExtractor:
    """
    Enterprise-grade ticker extraction with validation and confidence scoring.
    """
    
    def __init__(self):
        # Common ticker patterns
        self.dollar_pattern = re.compile(r'\$([A-Z]{1,5})\b', re.IGNORECASE)
        self.word_boundary_pattern = re.compile(r'\b([A-Z]{2,5})\b')
        
        # Known false positives to filter out (enhanced based on actual data)
        self.false_positives = {
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE',
            'OUR', 'OUT', 'DAY', 'GET', 'USE', 'MAN', 'NEW', 'NOW', 'WAY', 'MAY', 'SAY', 'SEE',
            'HIM', 'TWO', 'HOW', 'ITS', 'WHO', 'OIL', 'SIT', 'SET', 'RUN', 'EAT', 'FAR', 'SEA',
            'EYE', 'BAD', 'BIG', 'BOX', 'YES', 'YET', 'ARM', 'ASK', 'BAG', 'BAR', 'BED', 'BET',
            'BIT', 'BOY', 'BUS', 'BUY', 'CAR', 'CAT', 'CUT', 'DOG', 'EAR', 'END', 'FEW', 'FIX',
            'FLY', 'GOT', 'GUN', 'HAD', 'HAS', 'HIT', 'HOT', 'JOB', 'LAW', 'LEG', 'LET', 'LOT',
            'LOW', 'MAP', 'MOM', 'NET', 'OFF', 'OLD', 'PAY', 'POP', 'PUT', 'RED', 'SUN', 'TAX',
            'TOP', 'TRY', 'WAR', 'WIN', 'WON', 'CEO', 'CFO', 'CTO', 'IPO', 'SEC', 'FDA', 'FED',
            'GDP', 'CPI', 'ATH', 'ATL', 'YTD', 'MTD', 'QTD', 'EOD', 'AH', 'PM', 'EST', 'PST',
            'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BTC', 'ETH', 'SOL',
            'DOW', 'SPY', 'QQQ', 'VIX', 'DXY', 'TLT', 'GLD', 'SLV', 'OIL', 'GAS', 'GOLD',
            'EDIT', 'TLDR', 'YOLO', 'HODL', 'FOMO', 'BTFD', 'MOON', 'PUMP', 'DUMP', 'BULL', 'BEAR',
            'LONG', 'SHORT', 'CALL', 'PUTS', 'LEAP', 'ITM', 'OTM', 'ATM', 'DTE', 'IV', 'THETA',
            'DELTA', 'GAMMA', 'VEGA', 'RHO', 'DD', 'TA', 'FA', 'PE', 'PEG', 'EPS', 'EBITDA',
            'ROI', 'ROE', 'ROA', 'ROIC', 'FCF', 'CAPEX', 'OPEX', 'SGA', 'COGS', 'GAAP',
            # False positives identified from actual processing data
            'GPT', 'AI', 'ETF', 'PR', 'HERE', 'FULL', 'AWS', 'US', 'CORE', 'IMI', 'HV', 'QA',
            'TIL', 'IRS', 'UI', 'EM', 'AR', 'USA', 'UP', 'OF', 'IT', 'IS', 'IN', 'ON', 'TO',
            'ANY', 'YOUR', 'SAID', 'MY', 'SO', 'NO', 'GO', 'DO', 'IF', 'OR', 'AT', 'BY', 'WE',
            'ME', 'BE', 'HE', 'SHE', 'THEY', 'THEM', 'THEIR', 'THERE', 'WHERE', 'WHEN', 'WHAT',
            'WHY', 'WHICH', 'WOULD', 'COULD', 'SHOULD', 'WILL', 'SHALL', 'MIGHT', 'MUST',
            'NYSE', 'NASDAQ', 'LSE', 'TSE', 'HKEX', 'SSE', 'BSE', 'NSE', 'FTSE', 'DAX',
            'NIKKEI', 'HANG', 'SENG', 'KOSPI', 'SENSEX', 'ASX', 'CAC', 'IBEX', 'FTSE',
            'RUSSELL', 'WILSHIRE', 'STOXX', 'EURO', 'MSCI', 'EMERGING', 'DEVELOPED',
            'COVID', 'CHINA', 'RUSSIA', 'UKRAINE', 'EUROPE', 'ASIA', 'AMERICA', 'CANADA',
            'MEXICO', 'BRAZIL', 'INDIA', 'JAPAN', 'KOREA', 'AUSTRALIA', 'GERMANY', 'FRANCE',
            'ITALY', 'SPAIN', 'TURKEY', 'SAUDI', 'UAE', 'ISRAEL', 'EGYPT', 'SOUTH', 'NORTH',
            'EAST', 'WEST', 'CENTRAL', 'PACIFIC', 'ATLANTIC', 'ARCTIC', 'ANTARCTIC'
        }
        
        # Known valid tickers (can be expanded)
        self.known_tickers = {
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'ADBE',
            'CRM', 'ORCL', 'INTC', 'AMD', 'QCOM', 'AVGO', 'TXN', 'ASML', 'TSM', 'AMAT',
            'LRCX', 'KLAC', 'MRVL', 'MU', 'WDC', 'STX', 'NXPI', 'MCHP', 'ADI', 'XLNX',
            'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AXP', 'V', 'MA', 'PYPL', 'SQ', 'HOOD',
            'COIN', 'SOFI', 'AFRM', 'UPST', 'LC', 'ALLY', 'SCHW', 'BLK', 'KKR', 'BX',
            'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'AGG', 'TLT', 'GLD', 'SLV'
        }
        
        # Crypto symbols to exclude (different asset class)
        self.crypto_symbols = {
            'BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX',
            'CRV', 'YFI', 'SUSHI', 'ALPHA', 'RUNE', 'LUNA', 'AVAX', 'MATIC', 'FTM', 'ONE'
        }

    def extract_tickers(self, text: str, title: str = "") -> List[TickerMatch]:
        """
        Extract ticker symbols from text with confidence scoring.
        
        Args:
            text: Main text content to analyze
            title: Post title (given higher weight)
            
        Returns:
            List of TickerMatch objects sorted by confidence
        """
        matches = []
        combined_text = f"{title} {text}".strip()
        
        # Method 1: Dollar sign prefixed tickers ($AAPL)
        for match in self.dollar_pattern.finditer(combined_text):
            symbol = match.group(1).upper()
            if self._is_valid_ticker(symbol):
                confidence = self._calculate_confidence(symbol, match, combined_text, "dollar_sign")
                matches.append(TickerMatch(
                    symbol=symbol,
                    confidence=confidence,
                    context=self._extract_context(combined_text, match.start(), match.end()),
                    position=match.start(),
                    source="dollar_sign"
                ))
        
        # Method 2: Explicit ticker patterns with high confidence
        explicit_patterns = [
            (r'\b([A-Z]{1,5})\s+(?:stock|shares?|calls?|puts?|options?)', 0.85),
            (r'(?:ticker|symbol)\s*:?\s*([A-Z]{1,5})\b', 0.9),
            (r'\b([A-Z]{1,5})\s+(?:up|down|gained?|lost|dropped?)\s+\d+%', 0.8),
            (r'\b([A-Z]{1,5})\s+(?:earnings?|report|guidance)', 0.8),
            (r'(?:buying|selling|bought|sold)\s+([A-Z]{1,5})\b', 0.75),
            (r'\b([A-Z]{1,5})\s+(?:at|@)\s*\$?\d+', 0.7),
            (r'\b([A-Z]{1,5})\s+(?:calls?|puts?)\s+expiring', 0.85),
            (r'\b([A-Z]{1,5})\s+(?:to|hitting?|reaching?)\s*\$?\d+', 0.75),
            (r'(?:long|short)\s+([A-Z]{1,5})\b', 0.7),
            (r'\b([A-Z]{1,5})\s+(?:moon|rocket|squeeze)', 0.6),
        ]
        
        for pattern, base_confidence in explicit_patterns:
            for match in re.finditer(pattern, combined_text, re.IGNORECASE):
                symbol = match.group(1).upper()
                if self._is_valid_ticker(symbol) and symbol not in self.false_positives:
                    # Adjust confidence based on known tickers
                    confidence = base_confidence
                    if symbol in self.known_tickers:
                        confidence = min(confidence + 0.1, 0.95)
                    
                    matches.append(TickerMatch(
                        symbol=symbol,
                        confidence=confidence,
                        context=self._extract_context(combined_text, match.start(), match.end()),
                        position=match.start(),
                        source="explicit_pattern"
                    ))
        
        # Method 3: Word boundary detection (AAPL, Apple Inc) - more conservative
        for match in self.word_boundary_pattern.finditer(combined_text):
            symbol = match.group(1).upper()
            if self._is_valid_ticker(symbol) and symbol not in self.false_positives:
                confidence = self._calculate_confidence(symbol, match, combined_text, "word_boundary")
                # Only include if confidence is reasonably high
                if confidence > 0.5:
                    matches.append(TickerMatch(
                        symbol=symbol,
                        confidence=confidence,
                        context=self._extract_context(combined_text, match.start(), match.end()),
                        position=match.start(),
                        source="word_boundary"
                    ))
        
        # Method 3: Company name to ticker mapping (future enhancement)
        # This would map "Apple" -> "AAPL", "Tesla" -> "TSLA", etc.
        
        # Remove duplicates and sort by confidence
        unique_matches = self._deduplicate_matches(matches)
        return sorted(unique_matches, key=lambda x: x.confidence, reverse=True)

    def _is_valid_ticker(self, symbol: str) -> bool:
        """Check if a symbol could be a valid ticker."""
        if not symbol or len(symbol) < 1 or len(symbol) > 5:
            return False
        if symbol in self.crypto_symbols:
            return False
        if not symbol.isalpha():
            return False
        return True

    def _calculate_confidence(self, symbol: str, match: re.Match, text: str, source: str) -> float:
        """Calculate confidence score for a ticker match."""
        confidence = 0.0
        
        # Base confidence by source
        if source == "dollar_sign":
            confidence = 0.9  # High confidence for $SYMBOL
        elif source == "word_boundary":
            confidence = 0.4  # Lower confidence for standalone words
        
        # Boost for known tickers
        if symbol in self.known_tickers:
            confidence += 0.3
        
        # Context analysis
        context_lower = text[max(0, match.start()-50):match.end()+50].lower()
        
        # Financial context indicators
        financial_terms = [
            'stock', 'share', 'ticker', 'symbol', 'price', 'chart', 'trade', 'buy', 'sell',
            'call', 'put', 'option', 'strike', 'expiry', 'earnings', 'revenue', 'profit',
            'loss', 'bull', 'bear', 'long', 'short', 'hold', 'target', 'support', 'resistance',
            'breakout', 'squeeze', 'moon', 'rocket', 'diamond', 'hands', 'paper', 'yolo',
            'dd', 'analysis', 'forecast', 'prediction', 'outlook', 'guidance', 'beat', 'miss'
        ]
        
        financial_context_count = sum(1 for term in financial_terms if term in context_lower)
        confidence += min(financial_context_count * 0.05, 0.2)
        
        # Penalty for common words that might be false positives
        if symbol.lower() in ['new', 'all', 'can', 'may', 'will', 'now', 'way', 'see', 'get']:
            confidence *= 0.3
        
        # Length-based confidence (2-4 chars most likely)
        if 2 <= len(symbol) <= 4:
            confidence += 0.1
        elif len(symbol) == 5:
            confidence += 0.05
        elif len(symbol) == 1:
            confidence *= 0.2
        
        return min(confidence, 1.0)

    def _extract_context(self, text: str, start: int, end: int, window: int = 30) -> str:
        """Extract context around a ticker match."""
        context_start = max(0, start - window)
        context_end = min(len(text), end + window)
        return text[context_start:context_end].strip()

    def _deduplicate_matches(self, matches: List[TickerMatch]) -> List[TickerMatch]:
        """Remove duplicate ticker matches, keeping the highest confidence."""
        seen = {}
        for match in matches:
            if match.symbol not in seen or match.confidence > seen[match.symbol].confidence:
                seen[match.symbol] = match
        return list(seen.values())

    def extract_tickers_simple(self, text: str, title: str = "") -> List[str]:
        """
        Simplified interface that returns just ticker symbols.
        Used for quick extraction without detailed metadata.
        """
        matches = self.extract_tickers(text, title)
        # Return tickers with confidence > 0.5
        return [match.symbol for match in matches if match.confidence > 0.5]

    def get_ticker_stats(self, text: str, title: str = "") -> Dict:
        """Get statistics about ticker extraction."""
        matches = self.extract_tickers(text, title)
        return {
            'total_matches': len(matches),
            'high_confidence': len([m for m in matches if m.confidence > 0.7]),
            'medium_confidence': len([m for m in matches if 0.4 <= m.confidence <= 0.7]),
            'low_confidence': len([m for m in matches if m.confidence < 0.4]),
            'unique_tickers': len(set(m.symbol for m in matches)),
            'dollar_sign_matches': len([m for m in matches if m.source == "dollar_sign"]),
            'word_boundary_matches': len([m for m in matches if m.source == "word_boundary"])
        }
