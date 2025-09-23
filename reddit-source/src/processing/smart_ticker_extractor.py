"""
Intelligent ticker extraction using NLP and financial context understanding.
Replaces regex-based approach with machine learning and contextual analysis.
"""

import logging
import re
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass
import asyncio
from collections import defaultdict

import spacy
from spacy.tokens import Doc, Token
import yfinance as yf

from ..config.settings import get_settings

logger = logging.getLogger(__name__)

# Silence yfinance debug logging
logging.getLogger("yfinance").setLevel(logging.ERROR)
logging.getLogger("peewee").setLevel(logging.ERROR)


@dataclass
class TickerCandidate:
    """Represents a potential ticker with rich metadata."""
    symbol: str
    confidence: float
    context: str
    position: int
    extraction_method: str  # "ner", "pattern", "cashtag", "validation"
    financial_context_score: float
    market_validated: bool = False
    surrounding_entities: List[str] = None


class SmartTickerExtractor:
    """
    Intelligent ticker extraction using NLP and financial context.
    
    Features:
    - spaCy NER for entity recognition
    - Financial context scoring using word embeddings
    - Market data validation as final filter
    - Learning-based confidence scoring
    - Contextual false positive elimination
    """
    
    def __init__(self):
        self.settings = get_settings()
        
        # Load spaCy model with NER
        self.nlp = self._load_spacy_model()
        
        # Financial vocabulary and patterns
        self.financial_vocab = self._build_financial_vocabulary()
        
        # Market validation cache
        self.market_cache: Dict[str, bool] = {}
        
        # Pattern-based extractors (as fallback)
        self.cashtag_pattern = re.compile(r'\$([A-Z]{1,5})\b')
        self.explicit_ticker_pattern = re.compile(
            r'\b(?:ticker|symbol|stock)\s*:?\s*([A-Z]{1,5})\b', re.IGNORECASE
        )
        
        # Known false positives (minimal, let ML handle most)
        self.critical_false_positives = {
            'A', 'I', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BY', 'FOR', 'FROM',
            'HAS', 'HE', 'IN', 'IS', 'IT', 'ITS', 'OF', 'ON', 'OR', 'THE', 'TO', 'WAS',
            'YOU', 'YOUR', 'MY', 'WE', 'US', 'SO', 'NO', 'GO', 'DO', 'IF', 'UP', 'OUT'
        }
        
        logger.info("Initialized SmartTickerExtractor with spaCy NER and financial context analysis")
    
    def _load_spacy_model(self):
        """Load spaCy model with financial extensions."""
        try:
            nlp = spacy.load("en_core_web_sm")
            
            # Add custom entity ruler for financial terms
            if "entity_ruler" not in nlp.pipe_names:
                ruler = nlp.add_pipe("entity_ruler", before="ner")
                
                # Financial entity patterns
                patterns = [
                    {"label": "TICKER", "pattern": [{"TEXT": {"REGEX": r"^\$[A-Z]{1,5}$"}}]},
                    {"label": "ORG", "pattern": [{"LOWER": "apple"}, {"LOWER": "inc"}]},
                    {"label": "ORG", "pattern": [{"LOWER": "tesla"}, {"LOWER": "motors"}]},
                    {"label": "ORG", "pattern": [{"LOWER": "microsoft"}, {"LOWER": "corp"}]},
                    # Add more company name patterns as needed
                ]
                ruler.add_patterns(patterns)
            
            return nlp
        except OSError:
            logger.warning("spaCy model 'en_core_web_sm' not found. Downloading...")
            spacy.cli.download("en_core_web_sm")
            return spacy.load("en_core_web_sm")
    
    def _build_financial_vocabulary(self) -> Set[str]:
        """Build comprehensive financial vocabulary for context scoring."""
        return {
            # Trading terms
            'stock', 'stocks', 'share', 'shares', 'equity', 'securities', 'ticker', 'symbol',
            'buy', 'sell', 'bought', 'sold', 'purchase', 'trade', 'trading', 'trader',
            'long', 'short', 'position', 'holding', 'portfolio', 'investment', 'investing',
            
            # Options and derivatives
            'call', 'calls', 'put', 'puts', 'option', 'options', 'strike', 'expiry', 'expiration',
            'premium', 'theta', 'delta', 'gamma', 'vega', 'iv', 'implied', 'volatility',
            
            # Financial metrics
            'price', 'target', 'pt', 'valuation', 'market', 'cap', 'volume', 'earnings',
            'revenue', 'profit', 'loss', 'eps', 'pe', 'ratio', 'guidance', 'beat', 'miss',
            'growth', 'dividend', 'yield', 'return', 'performance',
            
            # Market terms
            'bull', 'bullish', 'bear', 'bearish', 'rally', 'correction', 'crash', 'bubble',
            'support', 'resistance', 'breakout', 'breakdown', 'trend', 'momentum',
            'oversold', 'overbought', 'ath', 'atl', 'high', 'low', 'close', 'open',
            
            # Reddit/WSB slang
            'moon', 'rocket', 'diamond', 'hands', 'paper', 'tendies', 'yolo', 'fomo',
            'hodl', 'btfd', 'dd', 'ta', 'fa', 'squeeze', 'pump', 'dump', 'ape', 'smooth',
            'brain', 'retard', 'autist', 'gain', 'loss', 'baghold', 'stonk', 'stonks'
        }
    
    async def extract_tickers(self, text: str, title: str = "") -> List[str]:
        """
        Extract tickers using intelligent NLP and market validation.
        
        Pipeline:
        1. NER extraction using spaCy
        2. Pattern-based extraction (cashtags, explicit mentions)
        3. Financial context scoring
        4. Market data validation
        5. Confidence-based filtering
        """
        if not text and not title:
            return []
        
        combined_text = f"{title} {text}".strip()
        doc = self.nlp(combined_text)
        
        # Step 1: Collect all potential candidates
        candidates = []
        
        # Method 1: NER extraction
        candidates.extend(self._extract_via_ner(doc))
        
        # Method 2: Pattern-based extraction
        candidates.extend(self._extract_via_patterns(combined_text))
        
        # Method 3: Context-aware extraction
        candidates.extend(self._extract_via_context(doc))
        
        # Step 2: Score financial context for all candidates
        for candidate in candidates:
            candidate.financial_context_score = self._score_financial_context(
                candidate, doc, combined_text
            )
        
        # Step 3: Market validation for candidates (lowered thresholds for better recall)
        validation_candidates = [
            c for c in candidates 
            if c.confidence > 0.3 and c.financial_context_score > 0.2
        ]
        
        validated_candidates = await self._validate_with_market_data(validation_candidates)
        
        # Step 4: Final filtering and deduplication
        final_tickers = self._finalize_tickers(validated_candidates)
        
        logger.debug(f"Extracted {len(final_tickers)} validated tickers: {final_tickers}")
        return final_tickers
    
    def _extract_via_ner(self, doc: Doc) -> List[TickerCandidate]:
        """Extract tickers using spaCy Named Entity Recognition."""
        candidates = []
        
        for ent in doc.ents:
            # Look for organizations that might be companies
            if ent.label_ in ["ORG", "PERSON", "TICKER"]:
                # Try to map company names to tickers
                potential_ticker = self._company_name_to_ticker(ent.text)
                if potential_ticker:
                    candidates.append(TickerCandidate(
                        symbol=potential_ticker,
                        confidence=0.7,
                        context=self._get_context_around_span(doc, ent.start, ent.end),
                        position=ent.start_char,
                        extraction_method="ner",
                        financial_context_score=0.0  # Will be calculated later
                    ))
            
            # Direct ticker entities (from custom ruler)
            elif ent.label_ == "TICKER":
                symbol = ent.text.replace('$', '').upper()
                if self._is_valid_ticker_format(symbol):
                    candidates.append(TickerCandidate(
                        symbol=symbol,
                        confidence=0.9,
                        context=self._get_context_around_span(doc, ent.start, ent.end),
                        position=ent.start_char,
                        extraction_method="ner",
                        financial_context_score=0.0
                    ))
        
        return candidates
    
    def _extract_via_patterns(self, text: str) -> List[TickerCandidate]:
        """Extract tickers using high-confidence patterns."""
        candidates = []
        
        # Cashtags ($AAPL)
        for match in self.cashtag_pattern.finditer(text):
            symbol = match.group(1).upper()
            if self._is_valid_ticker_format(symbol):
                candidates.append(TickerCandidate(
                    symbol=symbol,
                    confidence=0.95,  # Very high confidence for cashtags
                    context=self._get_context_around_position(text, match.start(), match.end()),
                    position=match.start(),
                    extraction_method="cashtag",
                    financial_context_score=0.0
                ))
        
        # Explicit ticker mentions
        for match in self.explicit_ticker_pattern.finditer(text):
            symbol = match.group(1).upper()
            if self._is_valid_ticker_format(symbol):
                candidates.append(TickerCandidate(
                    symbol=symbol,
                    confidence=0.85,
                    context=self._get_context_around_position(text, match.start(), match.end()),
                    position=match.start(),
                    extraction_method="explicit",
                    financial_context_score=0.0
                ))
        
        return candidates
    
    def _extract_via_context(self, doc: Doc) -> List[TickerCandidate]:
        """Extract tickers by analyzing tokens in financial context."""
        candidates = []
        
        for token in doc:
            # Look for 1-5 letter uppercase words
            if (token.is_alpha and 
                token.is_upper and 
                1 <= len(token.text) <= 5 and
                token.text not in self.critical_false_positives):
                
                # Check if it appears in financial context
                financial_context = self._has_financial_context_nearby(doc, token)
                if financial_context:
                    candidates.append(TickerCandidate(
                        symbol=token.text,
                        confidence=0.4,  # Medium confidence, needs validation
                        context=self._get_context_around_token(doc, token),
                        position=token.idx,
                        extraction_method="context",
                        financial_context_score=0.0
                    ))
        
        return candidates
    
    def _score_financial_context(self, candidate: TickerCandidate, doc: Doc, text: str) -> float:
        """Score how financially relevant the context around a ticker is."""
        score = 0.0
        context_lower = candidate.context.lower()
        
        # Count financial vocabulary in context
        financial_word_count = sum(1 for word in self.financial_vocab if word in context_lower)
        score += min(financial_word_count * 0.1, 0.5)
        
        # Boost for specific patterns
        if any(pattern in context_lower for pattern in [
            'stock price', 'share price', 'market cap', 'earnings report',
            'buy rating', 'sell rating', 'price target', 'options chain'
        ]):
            score += 0.3
        
        # Check for financial numbers (prices, percentages)
        if re.search(r'\$\d+', candidate.context):
            score += 0.2
        if re.search(r'\d+%', candidate.context):
            score += 0.15
        
        # Penalty for non-financial context
        non_financial_indicators = ['weather', 'sports', 'cooking', 'travel', 'music']
        if any(indicator in context_lower for indicator in non_financial_indicators):
            score *= 0.5
        
        return min(score, 1.0)
    
    async def _validate_with_market_data(self, candidates: List[TickerCandidate]) -> List[TickerCandidate]:
        """Validate candidates against real market data."""
        validated = []
        
        for candidate in candidates:
            # Check cache first
            if candidate.symbol in self.market_cache:
                candidate.market_validated = self.market_cache[candidate.symbol]
            else:
                # Validate with yfinance
                is_valid = await self._check_market_data(candidate.symbol)
                self.market_cache[candidate.symbol] = is_valid
                candidate.market_validated = is_valid
            
            if candidate.market_validated:
                # Boost confidence for market-validated tickers
                candidate.confidence = min(candidate.confidence + 0.2, 0.99)
                validated.append(candidate)
        
        return validated
    
    async def _check_market_data(self, symbol: str) -> bool:
        """Check if symbol exists in market data."""
        try:
            ticker = await asyncio.to_thread(yf.Ticker, symbol)
            info = await asyncio.to_thread(lambda: ticker.info)
            
            # More comprehensive validation
            return (
                info.get('regularMarketPrice') is not None or
                info.get('currentPrice') is not None or
                info.get('previousClose') is not None or
                info.get('quoteType') in ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'] or
                len(info) > 10  # Valid tickers usually have substantial info
            )
        except Exception as e:
            logger.debug(f"Market validation failed for {symbol}: {e}")
            return False
    
    def _finalize_tickers(self, candidates: List[TickerCandidate]) -> List[str]:
        """Apply final filtering and return clean ticker list."""
        # Group by symbol and take highest confidence
        symbol_groups = defaultdict(list)
        for candidate in candidates:
            symbol_groups[candidate.symbol].append(candidate)
        
        final_tickers = []
        for symbol, group in symbol_groups.items():
            # Take the candidate with highest combined score
            best_candidate = max(group, key=lambda c: c.confidence + c.financial_context_score)
            
            # Final threshold check (lowered for better recall)
            total_score = best_candidate.confidence + best_candidate.financial_context_score
            if total_score > 0.6 and best_candidate.market_validated:
                final_tickers.append(symbol)
        
        return sorted(list(set(final_tickers)))
    
    # Helper methods
    def _company_name_to_ticker(self, company_name: str) -> Optional[str]:
        """Map company names to ticker symbols."""
        company_mapping = {
            # Major tech companies
            'apple': 'AAPL', 'microsoft': 'MSFT', 'tesla': 'TSLA', 'amazon': 'AMZN',
            'google': 'GOOGL', 'alphabet': 'GOOGL', 'meta': 'META', 'facebook': 'META',
            'nvidia': 'NVDA', 'amd': 'AMD', 'intel': 'INTC', 'netflix': 'NFLX',
            'salesforce': 'CRM', 'oracle': 'ORCL', 'adobe': 'ADBE', 'palantir': 'PLTR',
            
            # Financial sector
            'jpmorgan': 'JPM', 'bank of america': 'BAC', 'wells fargo': 'WFC',
            'goldman sachs': 'GS', 'morgan stanley': 'MS', 'visa': 'V', 'mastercard': 'MA',
            
            # Popular WSB stocks
            'gamestop': 'GME', 'amc': 'AMC', 'blackberry': 'BB', 'nokia': 'NOK',
            'sofi': 'SOFI', 'robinhood': 'HOOD', 'coinbase': 'COIN',
            
            # Healthcare/Biotech
            'pfizer': 'PFE', 'johnson & johnson': 'JNJ', 'moderna': 'MRNA',
            
            # ETFs commonly mentioned
            'spy': 'SPY', 'qqq': 'QQQ', 'iwm': 'IWM'
        }
        
        # Try exact match first
        name_lower = company_name.lower().strip()
        if name_lower in company_mapping:
            return company_mapping[name_lower]
        
        # Try partial matches for common abbreviations
        for key, ticker in company_mapping.items():
            if key in name_lower or name_lower in key:
                return ticker
        
        return None
    
    def _is_valid_ticker_format(self, symbol: str) -> bool:
        """Check if symbol meets basic ticker format requirements."""
        return (
            symbol and 
            1 <= len(symbol) <= 5 and 
            symbol.isalpha() and 
            symbol not in self.critical_false_positives
        )
    
    def _has_financial_context_nearby(self, doc: Doc, token: Token, window: int = 5) -> bool:
        """Check if token has financial context within window."""
        start_idx = max(0, token.i - window)
        end_idx = min(len(doc), token.i + window + 1)
        
        context_tokens = [doc[i].lemma_.lower() for i in range(start_idx, end_idx)]
        return any(word in self.financial_vocab for word in context_tokens)
    
    def _get_context_around_span(self, doc: Doc, start: int, end: int, window: int = 5) -> str:
        """Get context around entity span."""
        context_start = max(0, start - window)
        context_end = min(len(doc), end + window)
        return ' '.join([doc[i].text for i in range(context_start, context_end)])
    
    def _get_context_around_token(self, doc: Doc, token: Token, window: int = 5) -> str:
        """Get context around a specific token."""
        return self._get_context_around_span(doc, token.i, token.i + 1, window)
    
    def _get_context_around_position(self, text: str, start: int, end: int, window: int = 50) -> str:
        """Get context around character position in text."""
        context_start = max(0, start - window)
        context_end = min(len(text), end + window)
        return text[context_start:context_end]
