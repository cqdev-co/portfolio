"""Advanced ticker extraction with validation and context analysis."""

import re
from typing import Dict, List, Set

from loguru import logger


class TickerExtractor:
    """
    Advanced ticker symbol extraction with validation and context analysis.
    
    Features:
    - Pattern-based extraction with context validation
    - Common false positive filtering
    - Market validation against known ticker lists
    - Confidence scoring for extracted tickers
    """
    
    def __init__(self) -> None:
        # Ticker pattern - 1-5 letters, potentially with dots
        self.ticker_pattern = re.compile(
            r'\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b'
        )
        
        # Dollar sign ticker pattern ($AAPL)
        self.dollar_ticker_pattern = re.compile(
            r'\$([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b'
        )
        
        # Common false positives to filter out
        self.false_positives = {
            # Common words that look like tickers
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN',
            'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS',
            'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE',
            'TWO', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE',
            'TOO', 'USE', 'WAY', 'WHY', 'YOU', 'BAD', 'BIG', 'FAR', 'FEW',
            'GOT', 'HIT', 'HOT', 'JOB', 'LOT', 'MAN', 'NEW', 'OWN', 'RUN',
            'SET', 'SIT', 'TRY', 'WIN', 'YES', 'YET',
            
            # Reddit/internet slang
            'LOL', 'OMG', 'WTF', 'TBH', 'IMO', 'IMHO', 'YOLO', 'FOMO',
            'FUD', 'HODL', 'MOON', 'DIP', 'ATH', 'ATL', 'CEO', 'CFO',
            'IPO', 'SEC', 'FDA', 'EPA', 'IRS', 'DOJ', 'FBI', 'CIA',
            
            # Time/date abbreviations
            'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG',
            'SEP', 'OCT', 'NOV', 'DEC', 'MON', 'TUE', 'WED', 'THU',
            'FRI', 'SAT', 'SUN', 'AM', 'PM',
            
            # Common abbreviations
            'USA', 'UK', 'EU', 'NYC', 'LA', 'SF', 'DC', 'TX', 'CA',
            'NY', 'FL', 'IL', 'OH', 'PA', 'MI', 'GA', 'NC', 'NJ',
            'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
            
            # Financial terms that aren't tickers
            'PE', 'PB', 'ROE', 'ROI', 'EPS', 'EBITDA', 'FCF', 'DCF',
            'NPV', 'IRR', 'WACC', 'ROIC', 'EBIT', 'CAPEX', 'OPEX',
            
            # Units and measurements
            'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
            'KG', 'LB', 'OZ', 'FT', 'IN', 'CM', 'MM', 'MI', 'KM',
            'MPH', 'KPH', 'PSI', 'RPM', 'BHP', 'HP', 'KW', 'MW',
        }
        
        # Context words that increase ticker confidence
        self.positive_context_words = {
            'stock', 'ticker', 'symbol', 'shares', 'equity', 'company',
            'corp', 'corporation', 'inc', 'ltd', 'llc', 'plc',
            'buy', 'sell', 'hold', 'long', 'short', 'position',
            'calls', 'puts', 'options', 'strike', 'expiry', 'premium',
            'earnings', 'revenue', 'profit', 'loss', 'guidance',
            'upgrade', 'downgrade', 'target', 'price', 'valuation',
            'analyst', 'rating', 'recommendation', 'coverage',
            'dividend', 'yield', 'payout', 'ex-div', 'record',
            'split', 'merger', 'acquisition', 'spinoff', 'ipo',
            'chart', 'technical', 'support', 'resistance', 'breakout',
            'trend', 'momentum', 'volume', 'volatility', 'squeeze',
        }
        
        # Context words that decrease ticker confidence
        self.negative_context_words = {
            'said', 'says', 'told', 'asked', 'replied', 'answered',
            'think', 'thought', 'believe', 'opinion', 'feel',
            'probably', 'maybe', 'perhaps', 'possibly', 'likely',
            'seems', 'appears', 'looks', 'sounds', 'feels',
            'game', 'movie', 'show', 'book', 'song', 'album',
            'food', 'restaurant', 'hotel', 'travel', 'vacation',
            'weather', 'sports', 'team', 'player', 'coach',
        }
        
        # Known major tickers for validation (subset)
        self.known_tickers = {
            # Major tech stocks
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META',
            'NVDA', 'NFLX', 'CRM', 'ORCL', 'ADBE', 'INTC', 'AMD',
            'PYPL', 'UBER', 'LYFT', 'SHOP', 'SQ', 'ROKU', 'ZOOM',
            
            # Major financial stocks
            'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'V', 'MA',
            'BRK.A', 'BRK.B', 'AXP', 'USB', 'PNC', 'TFC', 'COF',
            
            # Major healthcare/pharma
            'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'TMO', 'ABT',
            'LLY', 'DHR', 'BMY', 'AMGN', 'GILD', 'BIIB', 'REGN',
            
            # Major consumer stocks
            'KO', 'PEP', 'WMT', 'TGT', 'HD', 'LOW', 'MCD', 'SBUX',
            'NKE', 'DIS', 'NFLX', 'CMCSA', 'VZ', 'T', 'TMUS',
            
            # Major industrial/energy
            'BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'FDX', 'LMT',
            'XOM', 'CVX', 'COP', 'SLB', 'HAL', 'OXY', 'MRO',
            
            # Popular ETFs
            'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO',
            'ARKK', 'ARKQ', 'ARKW', 'ARKG', 'ARKF', 'SQQQ', 'TQQQ',
            
            # Crypto-related
            'COIN', 'MSTR', 'RIOT', 'MARA', 'HUT', 'BITF', 'CAN',
            
            # Meme stocks
            'GME', 'AMC', 'BB', 'NOK', 'PLTR', 'WISH', 'CLOV',
            'SPCE', 'TLRY', 'SNDL', 'RKT', 'UWMC', 'WKHS',
        }
        
        logger.info(f"Initialized TickerExtractor with {len(self.known_tickers)} known tickers")
    
    def extract_tickers(
        self,
        text: str,
        min_confidence: float = 0.3,
        validate_known: bool = True,
    ) -> List[str]:
        """
        Extract ticker symbols from text with confidence filtering.
        
        Args:
            text: Text to extract tickers from
            min_confidence: Minimum confidence threshold
            validate_known: Whether to validate against known ticker list
            
        Returns:
            List of validated ticker symbols
        """
        ticker_candidates = self._find_ticker_candidates(text)
        validated_tickers = []
        
        for ticker, confidence in ticker_candidates.items():
            if confidence >= min_confidence:
                if validate_known:
                    if ticker in self.known_tickers:
                        validated_tickers.append(ticker)
                else:
                    validated_tickers.append(ticker)
        
        return validated_tickers
    
    def extract_tickers_with_confidence(
        self,
        text: str,
    ) -> Dict[str, float]:
        """
        Extract ticker symbols with confidence scores.
        
        Args:
            text: Text to extract tickers from
            
        Returns:
            Dictionary mapping tickers to confidence scores
        """
        return self._find_ticker_candidates(text)
    
    def _find_ticker_candidates(self, text: str) -> Dict[str, float]:
        """Find ticker candidates with confidence scoring."""
        candidates = {}
        
        # Find dollar-sign tickers (high confidence)
        dollar_matches = self.dollar_ticker_pattern.findall(text.upper())
        for ticker in dollar_matches:
            if ticker not in self.false_positives:
                candidates[ticker] = 0.9  # High confidence for $TICKER format
        
        # Find regular ticker patterns
        regular_matches = self.ticker_pattern.findall(text.upper())
        for ticker in regular_matches:
            if ticker not in self.false_positives and ticker not in candidates:
                # Calculate confidence based on context
                confidence = self._calculate_context_confidence(text, ticker)
                if confidence > 0:  # Only include if positive confidence
                    candidates[ticker] = confidence
        
        return candidates
    
    def _calculate_context_confidence(self, text: str, ticker: str) -> float:
        """Calculate confidence score based on surrounding context."""
        text_lower = text.lower()
        ticker_lower = ticker.lower()
        
        # Find ticker position(s) in text
        ticker_positions = []
        start = 0
        while True:
            pos = text_lower.find(ticker_lower, start)
            if pos == -1:
                break
            ticker_positions.append(pos)
            start = pos + 1
        
        if not ticker_positions:
            return 0.0
        
        base_confidence = 0.3  # Base confidence for any ticker pattern
        context_bonus = 0.0
        
        # Analyze context around each occurrence
        for pos in ticker_positions:
            # Get context window (50 chars before and after)
            context_start = max(0, pos - 50)
            context_end = min(len(text), pos + len(ticker) + 50)
            context = text_lower[context_start:context_end]
            
            # Count positive context words
            positive_count = sum(
                1 for word in self.positive_context_words
                if word in context
            )
            
            # Count negative context words
            negative_count = sum(
                1 for word in self.negative_context_words
                if word in context
            )
            
            # Calculate context score for this occurrence
            occurrence_bonus = (positive_count * 0.1) - (negative_count * 0.05)
            context_bonus = max(context_bonus, occurrence_bonus)
        
        # Check if ticker is in known list (bonus)
        known_bonus = 0.2 if ticker in self.known_tickers else 0.0
        
        # Check for financial context patterns
        pattern_bonus = 0.0
        financial_patterns = [
            rf'{re.escape(ticker_lower)}\s+(?:stock|shares|equity)',
            rf'(?:buy|sell|hold|long|short)\s+{re.escape(ticker_lower)}',
            rf'{re.escape(ticker_lower)}\s+(?:calls|puts|options)',
            rf'{re.escape(ticker_lower)}\s+(?:earnings|revenue|guidance)',
            rf'{re.escape(ticker_lower)}\s+(?:price|target|valuation)',
        ]
        
        for pattern in financial_patterns:
            if re.search(pattern, text_lower):
                pattern_bonus += 0.1
        
        # Combine all factors
        total_confidence = base_confidence + context_bonus + known_bonus + pattern_bonus
        
        # Clamp to [0, 1]
        return max(0.0, min(1.0, total_confidence))
    
    def get_ticker_context(self, text: str, ticker: str, window_size: int = 10) -> List[str]:
        """
        Get context words around ticker mentions.
        
        Args:
            text: Full text content
            ticker: Ticker symbol to find context for
            window_size: Number of words before/after ticker
            
        Returns:
            List of context words
        """
        words = text.lower().split()
        ticker_lower = ticker.lower()
        context_words = []
        
        for i, word in enumerate(words):
            if ticker_lower in word:
                # Get surrounding words
                start_idx = max(0, i - window_size)
                end_idx = min(len(words), i + window_size + 1)
                
                # Add context words (excluding the ticker itself)
                for j in range(start_idx, end_idx):
                    if j != i and words[j] not in context_words:
                        # Clean word (remove punctuation)
                        clean_word = re.sub(r'[^\w]', '', words[j])
                        if clean_word and len(clean_word) > 2:
                            context_words.append(clean_word)
        
        return context_words
    
    def validate_ticker(self, ticker: str) -> bool:
        """
        Validate if a ticker is likely to be a real stock symbol.
        
        Args:
            ticker: Ticker symbol to validate
            
        Returns:
            True if ticker appears to be valid
        """
        # Basic format validation
        if not re.match(r'^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$', ticker):
            return False
        
        # Check against false positives
        if ticker in self.false_positives:
            return False
        
        # Check against known tickers (high confidence)
        if ticker in self.known_tickers:
            return True
        
        # For unknown tickers, apply heuristics
        # Single letter tickers are usually suspect unless known
        if len(ticker) == 1:
            return False
        
        # Two letter tickers are often abbreviations
        if len(ticker) == 2:
            return ticker not in {'AM', 'PM', 'US', 'UK', 'EU', 'NY', 'CA', 'TX'}
        
        # Three+ letter tickers are more likely to be valid
        return True
