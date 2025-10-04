"""Reddit sentiment analysis service with bot detection and filtering."""

import asyncio
import re
import warnings
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

# Suppress PRAW async warnings
warnings.filterwarnings("ignore", category=UserWarning, module="praw")

import nltk
import praw
from loguru import logger
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from rds_ticker_analysis.models.reddit import (
    ContentType,
    RedditComment,
    RedditPost,
    RedditUser,
    TickerMention,
    UserType,
)
from rds_ticker_analysis.models.sentiment import (
    ContentClassification,
    EmotionAnalysis,
    EmotionLabel,
    InvestmentHorizon,
    SentimentAnalysis,
    SentimentLabel,
    SentimentScore,
)
from rds_ticker_analysis.utils.text_processing import TextProcessor
from rds_ticker_analysis.utils.ticker_extraction import TickerExtractor


class BotDetector:
    """Advanced bot detection for Reddit accounts."""
    
    def __init__(self) -> None:
        self.suspicious_patterns = [
            r"^[A-Za-z]+\d{4,}$",  # Username with many numbers
            r"^[A-Za-z]+_[A-Za-z]+\d+$",  # Username_Word123 pattern
            r"^(Automatic|Bot|AI).*",  # Obvious bot names
        ]
        
        # Minimum account age for human classification (days)
        self.min_human_age_days = 3
        
        # Suspicious activity thresholds
        self.max_posts_per_day = 50
        self.max_comments_per_day = 200
        self.min_karma_per_day = 0.1
    
    def analyze_user(self, user_data: Dict) -> Tuple[UserType, float]:
        """
        Analyze user characteristics to determine bot probability.
        
        Args:
            user_data: Dictionary containing user information
            
        Returns:
            Tuple of (UserType, bot_probability)
        """
        bot_score = 0.0
        
        # Check username patterns
        username = user_data.get('username', '')
        for pattern in self.suspicious_patterns:
            if re.match(pattern, username):
                bot_score += 0.3
                break
        
        # Account age check
        account_created = user_data.get('account_created')
        if account_created:
            account_age = (datetime.utcnow() - account_created).days
            if account_age < self.min_human_age_days:
                bot_score += 0.5
            elif account_age < 7:
                bot_score += 0.2
        
        # Activity pattern analysis
        total_karma = user_data.get('total_karma', 0)
        total_posts = user_data.get('total_posts', 0)
        total_comments = user_data.get('total_comments', 0)
        
        if account_created:
            days_active = max(1, (datetime.utcnow() - account_created).days)
            posts_per_day = total_posts / days_active
            comments_per_day = total_comments / days_active
            karma_per_day = total_karma / days_active
            
            # Excessive posting activity
            if posts_per_day > self.max_posts_per_day:
                bot_score += 0.4
            elif posts_per_day > self.max_posts_per_day / 2:
                bot_score += 0.2
            
            # Excessive commenting activity
            if comments_per_day > self.max_comments_per_day:
                bot_score += 0.3
            elif comments_per_day > self.max_comments_per_day / 2:
                bot_score += 0.15
            
            # Very low karma accumulation
            if karma_per_day < self.min_karma_per_day and days_active > 30:
                bot_score += 0.2
        
        # Karma distribution analysis
        post_karma = user_data.get('post_karma', 0)
        comment_karma = user_data.get('comment_karma', 0)
        
        if total_karma > 0:
            # Unusual karma distribution (all posts or all comments)
            post_ratio = post_karma / total_karma
            if post_ratio > 0.95 or post_ratio < 0.05:
                bot_score += 0.1
        
        # Account verification indicators
        has_verified_email = user_data.get('has_verified_email', False)
        is_premium = user_data.get('is_premium', False)
        
        if has_verified_email:
            bot_score -= 0.1
        if is_premium:
            bot_score -= 0.15
        
        # Clamp bot score
        bot_score = max(0.0, min(1.0, bot_score))
        
        # Determine user type
        if bot_score >= 0.8:
            user_type = UserType.CONFIRMED_BOT
        elif bot_score >= 0.6:
            user_type = UserType.LIKELY_BOT
        elif bot_score >= 0.4:
            user_type = UserType.SUSPICIOUS
        elif bot_score >= 0.2:
            user_type = UserType.LIKELY_HUMAN
        else:
            user_type = UserType.VERIFIED_HUMAN
        
        return user_type, bot_score


class ContentClassifier:
    """Classify Reddit content for financial relevance and quality."""
    
    def __init__(self) -> None:
        # Financial keywords and patterns
        self.dd_keywords = [
            'due diligence', 'dd', 'analysis', 'research', 'fundamentals',
            'financials', 'earnings', 'revenue', 'profit', 'balance sheet'
        ]
        
        self.ta_keywords = [
            'technical analysis', 'chart', 'support', 'resistance', 'breakout',
            'rsi', 'macd', 'bollinger', 'moving average', 'volume'
        ]
        
        self.news_keywords = [
            'news', 'announcement', 'press release', 'sec filing', 'merger',
            'acquisition', 'partnership', 'fda approval', 'earnings call'
        ]
        
        self.pump_patterns = [
            r'\b(to the moon|moon|rocket|diamond hands|hold the line)\b',
            r'\b(buy buy buy|all in|yolo)\b',
            r'\$\w+\s+(moon|rocket|squeeze)',
        ]
        
        # Price target patterns
        self.price_target_pattern = re.compile(
            r'\$?(\d+(?:\.\d{2})?)\s*(?:price\s*target|pt|target)',
            re.IGNORECASE
        )
        
        # Investment horizon keywords
        self.horizon_keywords = {
            InvestmentHorizon.INTRADAY: ['day trade', 'scalp', 'intraday', 'today'],
            InvestmentHorizon.SWING: ['swing', 'few days', 'week', 'short term'],
            InvestmentHorizon.MEDIUM_TERM: ['month', 'quarter', 'medium term'],
            InvestmentHorizon.LONG_TERM: ['year', 'years', 'long term', 'hold'],
        }
    
    def classify_content(self, text: str, title: str = "") -> ContentClassification:
        """
        Classify content for type and quality indicators.
        
        Args:
            text: Content text to analyze
            title: Title/subject if available
            
        Returns:
            ContentClassification with analysis results
        """
        full_text = f"{title} {text}".lower()
        
        # Content type classification
        is_due_diligence = any(keyword in full_text for keyword in self.dd_keywords)
        is_technical_analysis = any(keyword in full_text for keyword in self.ta_keywords)
        is_news_discussion = any(keyword in full_text for keyword in self.news_keywords)
        is_earnings_related = 'earnings' in full_text or 'eps' in full_text
        is_meme_content = any(word in full_text for word in ['meme', 'joke', 'lol', 'lmao'])
        
        # Pump attempt detection
        is_pump_attempt = any(
            re.search(pattern, full_text) for pattern in self.pump_patterns
        )
        
        # Quality indicators
        has_supporting_evidence = any(
            phrase in full_text for phrase in [
                'source:', 'link:', 'according to', 'data shows', 'report states'
            ]
        )
        
        has_financial_data = any(
            term in full_text for term in [
                'revenue', 'profit', 'eps', 'p/e', 'market cap', 'debt'
            ]
        )
        
        has_price_targets = bool(self.price_target_pattern.search(full_text))
        
        has_risk_discussion = any(
            term in full_text for term in [
                'risk', 'downside', 'bear case', 'worst case', 'caution'
            ]
        )
        
        # Investment horizon detection
        investment_horizon = InvestmentHorizon.UNKNOWN
        for horizon, keywords in self.horizon_keywords.items():
            if any(keyword in full_text for keyword in keywords):
                investment_horizon = horizon
                break
        
        # Position type detection
        position_type = None
        if 'calls' in full_text or 'call options' in full_text:
            position_type = 'calls'
        elif 'puts' in full_text or 'put options' in full_text:
            position_type = 'puts'
        elif 'shares' in full_text or 'stock' in full_text:
            position_type = 'shares'
        
        # Calculate quality score
        quality_factors = [
            has_supporting_evidence,
            has_financial_data,
            has_price_targets,
            has_risk_discussion,
            is_due_diligence,
            is_technical_analysis,
        ]
        
        quality_penalties = [
            is_meme_content,
            is_pump_attempt,
        ]
        
        base_quality = sum(quality_factors) / len(quality_factors)
        penalty = sum(quality_penalties) * 0.2
        quality_score = max(0.0, base_quality - penalty)
        
        # Classification confidence
        classification_confidence = 0.8 if any([
            is_due_diligence, is_technical_analysis, is_news_discussion
        ]) else 0.6
        
        return ContentClassification(
            is_due_diligence=is_due_diligence,
            is_technical_analysis=is_technical_analysis,
            is_news_discussion=is_news_discussion,
            is_earnings_related=is_earnings_related,
            is_meme_content=is_meme_content,
            is_pump_attempt=is_pump_attempt,
            has_supporting_evidence=has_supporting_evidence,
            has_financial_data=has_financial_data,
            has_price_targets=has_price_targets,
            has_risk_discussion=has_risk_discussion,
            investment_horizon=investment_horizon,
            position_type=position_type,
            classification_confidence=classification_confidence,
            quality_score=quality_score,
        )


class RedditSentimentService:
    """
    Enterprise-grade Reddit sentiment analysis service.
    
    Provides comprehensive sentiment analysis of Reddit content with:
    - Advanced bot detection and filtering
    - Multi-model sentiment analysis (VADER, TextBlob)
    - Content classification and quality scoring
    - Ticker mention extraction and validation
    """
    
    def __init__(
        self,
        reddit_client: praw.Reddit,
        subreddits: List[str],
        min_account_age_days: int = 3,
        max_bot_probability: float = 0.6,
    ) -> None:
        """
        Initialize the Reddit sentiment service.
        
        Args:
            reddit_client: Configured PRAW Reddit client
            subreddits: List of subreddits to monitor
            min_account_age_days: Minimum account age for inclusion
            max_bot_probability: Maximum bot probability for inclusion
        """
        self.reddit = reddit_client
        self.subreddits = subreddits
        self.min_account_age_days = min_account_age_days
        self.max_bot_probability = max_bot_probability
        
        # Initialize components
        self.bot_detector = BotDetector()
        self.content_classifier = ContentClassifier()
        self.text_processor = TextProcessor()
        self.ticker_extractor = TickerExtractor()
        
        # Initialize sentiment analyzers
        self.vader_analyzer = SentimentIntensityAnalyzer()
        
        # Download required NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        logger.info(f"Initialized RedditSentimentService for {len(subreddits)} subreddits")
    
    async def analyze_subreddit_activity(
        self,
        subreddit_name: str,
        hours_back: int = 24,
        limit: int = 100,
    ) -> List[SentimentAnalysis]:
        """
        Analyze recent activity in a subreddit for ticker mentions and sentiment.
        
        Args:
            subreddit_name: Name of subreddit to analyze
            hours_back: How many hours back to look
            limit: Maximum number of posts to analyze
            
        Returns:
            List of SentimentAnalysis results
        """
        logger.info(f"Analyzing {subreddit_name} - {hours_back}h back, limit {limit}")
        
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
            
            # Get recent posts
            posts = []
            for post in subreddit.new(limit=limit):
                post_time = datetime.fromtimestamp(post.created_utc)
                if post_time >= cutoff_time:
                    posts.append(post)
            
            logger.info(f"Found {len(posts)} recent posts in r/{subreddit_name}")
            
            # Process posts concurrently
            tasks = []
            for post in posts:
                task = self._analyze_post_with_comments(post)
                tasks.append(task)
            
            # Execute analysis tasks
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Flatten results and filter exceptions
            sentiment_analyses = []
            for result in results:
                if isinstance(result, list):
                    sentiment_analyses.extend(result)
                elif isinstance(result, Exception):
                    logger.warning(f"Analysis failed: {result}")
            
            logger.info(f"Completed analysis: {len(sentiment_analyses)} sentiment analyses")
            return sentiment_analyses
            
        except Exception as e:
            logger.error(f"Failed to analyze r/{subreddit_name}: {e}")
            return []
    
    async def _analyze_post_with_comments(
        self,
        post: praw.models.Submission,
    ) -> List[SentimentAnalysis]:
        """
        Analyze a post and its comments for ticker mentions and sentiment.
        
        Args:
            post: Reddit post to analyze
            
        Returns:
            List of SentimentAnalysis for all ticker mentions found
        """
        analyses = []
        
        try:
            # Analyze the post itself
            post_text = f"{post.title} {post.selftext}"
            post_analyses = await self._analyze_content(
                content_id=post.id,
                content_type=ContentType.POST,
                text=post_text,
                author=post.author.name if post.author else "[deleted]",
                created_utc=post.created_utc,
                score=post.score,
                subreddit=post.subreddit.display_name,
            )
            analyses.extend(post_analyses)
            
            # Analyze top-level comments
            post.comments.replace_more(limit=5)  # Expand comment threads
            for comment in post.comments.list()[:50]:  # Limit comment analysis
                if comment.author and comment.body != "[deleted]":
                    comment_analyses = await self._analyze_content(
                        content_id=comment.id,
                        content_type=ContentType.COMMENT,
                        text=comment.body,
                        author=comment.author.name,
                        created_utc=comment.created_utc,
                        score=comment.score,
                        subreddit=post.subreddit.display_name,
                    )
                    analyses.extend(comment_analyses)
            
        except Exception as e:
            logger.warning(f"Failed to analyze post {post.id}: {e}")
        
        return analyses
    
    async def _analyze_content(
        self,
        content_id: str,
        content_type: ContentType,
        text: str,
        author: str,
        created_utc: float,
        score: int,
        subreddit: str,
    ) -> List[SentimentAnalysis]:
        """
        Analyze a piece of content for ticker mentions and sentiment.
        
        Args:
            content_id: Unique content identifier
            content_type: Type of content (post/comment)
            text: Text content to analyze
            author: Author username
            created_utc: Creation timestamp
            score: Content score
            subreddit: Subreddit name
            
        Returns:
            List of SentimentAnalysis for each ticker mentioned
        """
        analyses = []
        
        # Extract ticker mentions (include unknown tickers for broader coverage)
        tickers = self.ticker_extractor.extract_tickers(text, validate_known=False)
        if not tickers:
            return analyses
        
        # Get author information for bot detection
        author_info = await self._get_author_info(author)
        user_type, bot_probability = self.bot_detector.analyze_user(author_info)
        
        # Filter out likely bots
        if bot_probability > self.max_bot_probability:
            logger.debug(f"Filtered bot content from {author} (prob: {bot_probability:.2f})")
            return analyses
        
        # Process each ticker mention
        for ticker in tickers:
            try:
                # Perform sentiment analysis
                sentiment_score = self._analyze_sentiment(text)
                emotion_analysis = self._analyze_emotions(text)
                content_classification = self.content_classifier.classify_content(text)
                
                # Extract key information
                key_phrases = self.text_processor.extract_key_phrases(text)
                financial_keywords = self.text_processor.extract_financial_keywords(text)
                ticker_context = self.text_processor.get_ticker_context(text, ticker)
                
                # Extract price targets and levels
                price_targets = self.text_processor.extract_price_targets(text)
                support_levels = self.text_processor.extract_support_levels(text)
                resistance_levels = self.text_processor.extract_resistance_levels(text)
                
                # Calculate quality and reliability scores
                content_quality = self._calculate_content_quality(
                    content_classification, sentiment_score, len(text)
                )
                reliability_score = self._calculate_reliability_score(
                    user_type, content_quality, score
                )
                
                # Create sentiment analysis
                analysis = SentimentAnalysis(
                    content_id=content_id,
                    content_type=content_type.value,
                    ticker_symbol=ticker,
                    analyzed_text=text[:1000],  # Truncate for storage
                    text_length=len(text),
                    sentiment=sentiment_score,
                    emotion=emotion_analysis,
                    classification=content_classification,
                    key_phrases=key_phrases,
                    financial_keywords=financial_keywords,
                    ticker_context_words=ticker_context,
                    mentioned_price_targets=price_targets,
                    mentioned_support_levels=support_levels,
                    mentioned_resistance_levels=resistance_levels,
                    content_quality_score=content_quality,
                    reliability_score=reliability_score,
                    model_version="rds-v1.0",
                    processing_time_ms=50,  # Placeholder
                )
                
                analyses.append(analysis)
                
            except Exception as e:
                logger.warning(f"Failed to analyze ticker {ticker} in {content_id}: {e}")
        
        return analyses
    
    def _analyze_sentiment(self, text: str) -> SentimentScore:
        """Perform multi-model sentiment analysis."""
        # VADER analysis
        vader_scores = self.vader_analyzer.polarity_scores(text)
        vader_compound = vader_scores['compound']
        
        # TextBlob analysis
        blob = TextBlob(text)
        textblob_polarity = blob.sentiment.polarity
        textblob_subjectivity = blob.sentiment.subjectivity
        
        # Combined polarity (weighted average)
        combined_polarity = (vader_compound * 0.6 + textblob_polarity * 0.4)
        
        # Determine sentiment label
        if combined_polarity >= 0.6:
            label = SentimentLabel.VERY_BULLISH
        elif combined_polarity >= 0.3:
            label = SentimentLabel.BULLISH
        elif combined_polarity >= 0.1:
            label = SentimentLabel.SLIGHTLY_BULLISH
        elif combined_polarity >= -0.1:
            label = SentimentLabel.NEUTRAL
        elif combined_polarity >= -0.3:
            label = SentimentLabel.SLIGHTLY_BEARISH
        elif combined_polarity >= -0.6:
            label = SentimentLabel.BEARISH
        else:
            label = SentimentLabel.VERY_BEARISH
        
        # Calculate confidence and intensity
        confidence = min(1.0, abs(combined_polarity) + 0.3)
        intensity = abs(combined_polarity)
        
        return SentimentScore(
            label=label,
            confidence=confidence,
            polarity=combined_polarity,
            subjectivity=textblob_subjectivity,
            intensity=intensity,
            vader_compound=vader_compound,
            textblob_polarity=textblob_polarity,
        )
    
    def _analyze_emotions(self, text: str) -> EmotionAnalysis:
        """Analyze emotions in text content."""
        # Simplified emotion analysis - in production, use more sophisticated models
        emotion_keywords = {
            EmotionLabel.JOY: ['happy', 'excited', 'great', 'awesome', 'love', 'bull'],
            EmotionLabel.FEAR: ['scared', 'worried', 'afraid', 'crash', 'dump', 'bear'],
            EmotionLabel.ANGER: ['angry', 'mad', 'frustrated', 'hate', 'terrible'],
            EmotionLabel.TRUST: ['confident', 'trust', 'believe', 'solid', 'reliable'],
            EmotionLabel.ANTICIPATION: ['expecting', 'waiting', 'soon', 'upcoming'],
        }
        
        text_lower = text.lower()
        emotion_scores = {}
        
        for emotion, keywords in emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            emotion_scores[emotion] = min(1.0, score / 10.0)  # Normalize
        
        # Find primary emotion
        primary_emotion = max(emotion_scores, key=emotion_scores.get)
        emotion_confidence = emotion_scores[primary_emotion]
        
        # Calculate market-relevant emotions
        fear_words = emotion_keywords[EmotionLabel.FEAR]
        greed_words = ['moon', 'rocket', 'gains', 'profit', 'buy']
        
        fear_score = sum(1 for word in fear_words if word in text_lower)
        greed_score = sum(1 for word in greed_words if word in text_lower)
        
        total_emotion_words = fear_score + greed_score
        fear_greed_index = 0.5  # Neutral default
        if total_emotion_words > 0:
            fear_greed_index = greed_score / total_emotion_words
        
        fomo_words = ['fomo', 'missing out', 'too late', 'hurry']
        fomo_indicator = min(1.0, sum(1 for word in fomo_words if word in text_lower) / 5.0)
        
        panic_words = ['panic', 'urgent', 'now', 'immediately', 'asap']
        panic_indicator = min(1.0, sum(1 for word in panic_words if word in text_lower) / 5.0)
        
        return EmotionAnalysis(
            primary_emotion=primary_emotion,
            emotion_confidence=emotion_confidence,
            emotion_scores=emotion_scores,
            emotional_intensity=max(emotion_scores.values()),
            fear_greed_index=fear_greed_index,
            fomo_indicator=fomo_indicator,
            panic_indicator=panic_indicator,
        )
    
    async def _get_author_info(self, username: str) -> Dict:
        """Get author information for bot detection with rate limiting protection."""
        try:
            user = self.reddit.redditor(username)
            
            # Add small delay to prevent rate limiting
            await asyncio.sleep(0.1)
            
            # Safely access attributes with fallbacks
            account_created = None
            try:
                if hasattr(user, 'created_utc') and user.created_utc:
                    account_created = datetime.fromtimestamp(user.created_utc)
            except (AttributeError, TypeError):
                pass
                
            total_karma = 0
            post_karma = 0
            comment_karma = 0
            try:
                if hasattr(user, 'link_karma'):
                    post_karma = user.link_karma or 0
                if hasattr(user, 'comment_karma'):
                    comment_karma = user.comment_karma or 0
                total_karma = post_karma + comment_karma
            except (AttributeError, TypeError):
                pass
                
            has_verified_email = False
            is_premium = False
            try:
                has_verified_email = getattr(user, 'has_verified_email', False)
                is_premium = getattr(user, 'is_gold', False)
            except (AttributeError, TypeError):
                pass
            
            return {
                'username': username,
                'account_created': account_created,
                'total_karma': total_karma,
                'post_karma': post_karma,
                'comment_karma': comment_karma,
                'has_verified_email': has_verified_email,
                'is_premium': is_premium,
                'total_posts': 0,  # Would need additional API calls
                'total_comments': 0,  # Would need additional API calls
            }
        except Exception as e:
            # Handle rate limiting specifically
            if "429" in str(e) or "rate" in str(e).lower():
                logger.debug(f"Rate limited for user {username}, using fallback data")
                await asyncio.sleep(1.0)  # Longer delay for rate limits
            else:
                logger.warning(f"Failed to get user info for {username}: {e}")
            
            return {
                'username': username,
                'account_created': None,
                'total_karma': 0,
                'post_karma': 0,
                'comment_karma': 0,
                'has_verified_email': False,
                'is_premium': False,
                'total_posts': 0,
                'total_comments': 0,
            }
    
    def _calculate_content_quality(
        self,
        classification: ContentClassification,
        sentiment: SentimentScore,
        text_length: int,
    ) -> float:
        """Calculate overall content quality score."""
        quality_factors = [
            classification.quality_score * 0.4,  # Primary factor
            min(1.0, text_length / 500) * 0.2,  # Length factor
            sentiment.confidence * 0.2,  # Sentiment confidence
            (1.0 - sentiment.subjectivity) * 0.2,  # Objectivity
        ]
        
        return sum(quality_factors)
    
    def _calculate_reliability_score(
        self,
        user_type: UserType,
        content_quality: float,
        score: int,
    ) -> float:
        """Calculate reliability score for the analysis."""
        # User type factor
        user_factors = {
            UserType.VERIFIED_HUMAN: 1.0,
            UserType.LIKELY_HUMAN: 0.8,
            UserType.SUSPICIOUS: 0.5,
            UserType.LIKELY_BOT: 0.2,
            UserType.CONFIRMED_BOT: 0.0,
        }
        
        user_factor = user_factors.get(user_type, 0.5)
        
        # Score factor (normalized)
        score_factor = min(1.0, max(0.0, (score + 10) / 20))
        
        # Combine factors
        reliability = (
            user_factor * 0.5 +
            content_quality * 0.3 +
            score_factor * 0.2
        )
        
        return min(1.0, max(0.0, reliability))
