"""Advanced text processing utilities for financial content analysis."""

import re
from typing import List

from loguru import logger


class TextProcessor:
    """
    Advanced text processing for financial content analysis.
    
    Features:
    - Key phrase extraction
    - Financial keyword identification
    - Price target extraction
    - Support/resistance level detection
    - Context analysis around ticker mentions
    """
    
    def __init__(self) -> None:
        # Financial keywords categories
        self.financial_keywords = {
            'valuation': [
                'pe ratio', 'p/e', 'price to earnings', 'pb ratio', 'p/b',
                'price to book', 'peg ratio', 'ev/ebitda', 'price to sales',
                'market cap', 'enterprise value', 'book value', 'fair value',
                'intrinsic value', 'dcf', 'discounted cash flow',
            ],
            'performance': [
                'earnings', 'revenue', 'profit', 'loss', 'margin', 'ebitda',
                'cash flow', 'free cash flow', 'operating income', 'net income',
                'gross profit', 'operating margin', 'profit margin',
                'return on equity', 'roe', 'return on assets', 'roa',
            ],
            'growth': [
                'growth', 'expansion', 'increase', 'decrease', 'yoy', 'qoq',
                'year over year', 'quarter over quarter', 'guidance',
                'outlook', 'forecast', 'projection', 'estimate',
            ],
            'trading': [
                'buy', 'sell', 'hold', 'long', 'short', 'calls', 'puts',
                'options', 'strike', 'expiry', 'premium', 'volume',
                'liquidity', 'bid', 'ask', 'spread', 'float',
            ],
            'technical': [
                'support', 'resistance', 'breakout', 'breakdown', 'trend',
                'momentum', 'rsi', 'macd', 'bollinger bands', 'moving average',
                'sma', 'ema', 'fibonacci', 'chart pattern', 'head and shoulders',
                'double top', 'double bottom', 'cup and handle',
            ],
            'events': [
                'earnings call', 'earnings report', 'dividend', 'split',
                'merger', 'acquisition', 'ipo', 'spinoff', 'buyback',
                'insider buying', 'insider selling', 'institutional',
            ],
        }
        
        # Flatten all financial keywords
        self.all_financial_keywords = set()
        for category_keywords in self.financial_keywords.values():
            self.all_financial_keywords.update(category_keywords)
        
        # Price target patterns
        self.price_patterns = [
            r'\$(\d+(?:\.\d{2})?)\s*(?:price\s*)?target',
            r'(?:price\s*)?target\s*(?:of\s*)?\$(\d+(?:\.\d{2})?)',
            r'pt\s*\$?(\d+(?:\.\d{2})?)',
            r'target\s*price\s*\$?(\d+(?:\.\d{2})?)',
            r'fair\s*value\s*\$?(\d+(?:\.\d{2})?)',
        ]
        
        # Support/resistance patterns
        self.support_patterns = [
            r'support\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
            r'floor\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
            r'bottom\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
        ]
        
        self.resistance_patterns = [
            r'resistance\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
            r'ceiling\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
            r'top\s*(?:at\s*)?\$?(\d+(?:\.\d{2})?)',
        ]
        
        # Key phrase patterns
        self.key_phrase_patterns = [
            r'\b(?:due diligence|dd)\b',
            r'\b(?:technical analysis|ta)\b',
            r'\b(?:fundamental analysis)\b',
            r'\b(?:risk management)\b',
            r'\b(?:portfolio management)\b',
            r'\b(?:asset allocation)\b',
            r'\b(?:market timing)\b',
            r'\b(?:value investing)\b',
            r'\b(?:growth investing)\b',
            r'\b(?:momentum trading)\b',
            r'\b(?:swing trading)\b',
            r'\b(?:day trading)\b',
        ]
        
        logger.info(f"Initialized TextProcessor with {len(self.all_financial_keywords)} financial keywords")
    
    def extract_key_phrases(self, text: str, max_phrases: int = 10) -> List[str]:
        """
        Extract key financial phrases from text.
        
        Args:
            text: Text to analyze
            max_phrases: Maximum number of phrases to return
            
        Returns:
            List of key phrases found
        """
        text_lower = text.lower()
        found_phrases = []
        
        # Find predefined key phrases
        for pattern in self.key_phrase_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            found_phrases.extend(matches)
        
        # Find financial keyword combinations
        words = text_lower.split()
        for i in range(len(words) - 1):
            bigram = f"{words[i]} {words[i + 1]}"
            if bigram in self.all_financial_keywords:
                found_phrases.append(bigram)
        
        # Remove duplicates and limit results
        unique_phrases = list(dict.fromkeys(found_phrases))
        return unique_phrases[:max_phrases]
    
    def extract_financial_keywords(self, text: str) -> List[str]:
        """
        Extract financial keywords from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of financial keywords found
        """
        text_lower = text.lower()
        found_keywords = []
        
        for keyword in self.all_financial_keywords:
            if keyword in text_lower:
                found_keywords.append(keyword)
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(found_keywords))
    
    def extract_price_targets(self, text: str) -> List[float]:
        """
        Extract price targets mentioned in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of price targets as floats
        """
        price_targets = []
        text_lower = text.lower()
        
        for pattern in self.price_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    price = float(match)
                    # Filter reasonable price ranges (0.01 to 10000)
                    if 0.01 <= price <= 10000:
                        price_targets.append(price)
                except ValueError:
                    continue
        
        # Remove duplicates and sort
        return sorted(list(set(price_targets)))
    
    def extract_support_levels(self, text: str) -> List[float]:
        """
        Extract support levels mentioned in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of support levels as floats
        """
        support_levels = []
        text_lower = text.lower()
        
        for pattern in self.support_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    level = float(match)
                    # Filter reasonable price ranges
                    if 0.01 <= level <= 10000:
                        support_levels.append(level)
                except ValueError:
                    continue
        
        return sorted(list(set(support_levels)))
    
    def extract_resistance_levels(self, text: str) -> List[float]:
        """
        Extract resistance levels mentioned in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of resistance levels as floats
        """
        resistance_levels = []
        text_lower = text.lower()
        
        for pattern in self.resistance_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    level = float(match)
                    # Filter reasonable price ranges
                    if 0.01 <= level <= 10000:
                        resistance_levels.append(level)
                except ValueError:
                    continue
        
        return sorted(list(set(resistance_levels)))
    
    def get_ticker_context(
        self,
        text: str,
        ticker: str,
        window_size: int = 5,
    ) -> List[str]:
        """
        Get context words around ticker mentions.
        
        Args:
            text: Full text content
            ticker: Ticker symbol to find context for
            window_size: Number of words before/after ticker
            
        Returns:
            List of context words
        """
        # Clean and tokenize text
        words = re.findall(r'\b\w+\b', text.lower())
        ticker_lower = ticker.lower()
        context_words = []
        
        # Find ticker occurrences
        for i, word in enumerate(words):
            if word == ticker_lower or f"${word}" == f"${ticker_lower}":
                # Get surrounding words
                start_idx = max(0, i - window_size)
                end_idx = min(len(words), i + window_size + 1)
                
                # Collect context words (excluding ticker itself)
                for j in range(start_idx, end_idx):
                    if j != i and len(words[j]) > 2:  # Skip short words
                        context_words.append(words[j])
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(context_words))
    
    def analyze_sentiment_indicators(self, text: str) -> dict:
        """
        Analyze sentiment indicators in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with sentiment indicators
        """
        text_lower = text.lower()
        
        # Bullish indicators
        bullish_words = [
            'bullish', 'bull', 'buy', 'long', 'moon', 'rocket', 'pump',
            'gains', 'profit', 'up', 'rise', 'surge', 'rally', 'breakout',
            'strong', 'positive', 'optimistic', 'confident', 'excited',
        ]
        
        # Bearish indicators
        bearish_words = [
            'bearish', 'bear', 'sell', 'short', 'dump', 'crash', 'drop',
            'fall', 'decline', 'loss', 'down', 'weak', 'negative',
            'pessimistic', 'worried', 'concerned', 'fear', 'panic',
        ]
        
        # Count occurrences
        bullish_count = sum(1 for word in bullish_words if word in text_lower)
        bearish_count = sum(1 for word in bearish_words if word in text_lower)
        
        # Calculate sentiment ratio
        total_sentiment_words = bullish_count + bearish_count
        if total_sentiment_words > 0:
            bullish_ratio = bullish_count / total_sentiment_words
            bearish_ratio = bearish_count / total_sentiment_words
        else:
            bullish_ratio = bearish_ratio = 0.0
        
        return {
            'bullish_words': bullish_count,
            'bearish_words': bearish_count,
            'bullish_ratio': bullish_ratio,
            'bearish_ratio': bearish_ratio,
            'sentiment_word_density': total_sentiment_words / len(text.split()) if text.split() else 0,
        }
    
    def extract_numerical_data(self, text: str) -> dict:
        """
        Extract numerical financial data from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with extracted numerical data
        """
        # Percentage patterns
        percentage_pattern = r'(\d+(?:\.\d+)?)%'
        percentages = [float(match) for match in re.findall(percentage_pattern, text)]
        
        # Dollar amount patterns
        dollar_pattern = r'\$(\d+(?:,\d{3})*(?:\.\d{2})?)'
        dollar_amounts = []
        for match in re.findall(dollar_pattern, text):
            try:
                # Remove commas and convert to float
                amount = float(match.replace(',', ''))
                dollar_amounts.append(amount)
            except ValueError:
                continue
        
        # Ratio patterns (e.g., "P/E of 15.5")
        ratio_pattern = r'(?:p/e|pe|p/b|pb)\s*(?:of\s*)?(\d+(?:\.\d+)?)'
        ratios = [float(match) for match in re.findall(ratio_pattern, text, re.IGNORECASE)]
        
        # Market cap patterns
        market_cap_pattern = r'market\s*cap\s*(?:of\s*)?\$?(\d+(?:\.\d+)?)\s*([bmk]?)'
        market_caps = []
        for amount, suffix in re.findall(market_cap_pattern, text, re.IGNORECASE):
            try:
                value = float(amount)
                if suffix.lower() == 'b':
                    value *= 1e9
                elif suffix.lower() == 'm':
                    value *= 1e6
                elif suffix.lower() == 'k':
                    value *= 1e3
                market_caps.append(value)
            except ValueError:
                continue
        
        return {
            'percentages': percentages,
            'dollar_amounts': dollar_amounts,
            'ratios': ratios,
            'market_caps': market_caps,
        }
    
    def clean_text(self, text: str) -> str:
        """
        Clean text for analysis by removing noise and normalizing.
        
        Args:
            text: Raw text to clean
            
        Returns:
            Cleaned text
        """
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # Remove Reddit-specific formatting
        text = re.sub(r'/u/\w+', '', text)  # Remove username mentions
        text = re.sub(r'/r/\w+', '', text)  # Remove subreddit mentions
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # Remove bold formatting
        text = re.sub(r'\*(.+?)\*', r'\1', text)  # Remove italic formatting
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        return text
    
    def calculate_readability_score(self, text: str) -> float:
        """
        Calculate a simple readability score for the text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Readability score (0-1, higher is more readable)
        """
        if not text.strip():
            return 0.0
        
        sentences = text.split('.')
        words = text.split()
        
        if not sentences or not words:
            return 0.0
        
        # Average sentence length (words per sentence)
        avg_sentence_length = len(words) / len(sentences)
        
        # Average word length
        avg_word_length = sum(len(word) for word in words) / len(words)
        
        # Simple readability score (inverse relationship with complexity)
        # Optimal: 15-20 words per sentence, 4-6 letters per word
        sentence_score = 1.0 - min(1.0, abs(avg_sentence_length - 17.5) / 17.5)
        word_score = 1.0 - min(1.0, abs(avg_word_length - 5) / 5)
        
        return (sentence_score + word_score) / 2
