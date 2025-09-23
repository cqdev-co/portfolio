"""
Data quality filtering system to prevent low-quality posts from being stored.
"""

import logging
from typing import List, Optional
from dataclasses import dataclass

from ..config.settings import get_settings
from ..ingest.simple_models import RDSDataSource

logger = logging.getLogger(__name__)


@dataclass
class FilterResult:
    """Result of data quality filtering."""
    passed: bool
    reason: Optional[str] = None
    score: float = 0.0


class DataQualityFilter:
    """
    Enterprise-grade data quality filter to ensure only valuable posts are stored.
    
    This filter prevents noise, spam, and low-value content from cluttering the database
    by applying multiple quality criteria before allowing storage.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.quality_config = self.settings.quality
        logger.info(f"DataQualityFilter initialized with thresholds: "
                   f"min_confidence={self.quality_config.min_confidence_to_store}, "
                   f"allowed_tiers={self.quality_config.allowed_quality_tiers}")
    
    def should_store_post(self, post: RDSDataSource) -> FilterResult:
        """
        Determine if a post meets quality standards for storage.
        
        Args:
            post: The processed post to evaluate
            
        Returns:
            FilterResult indicating whether to store the post and why
        """
        # Calculate a comprehensive quality score
        quality_score = self._calculate_quality_score(post)
        
        # Apply filtering criteria in order of importance
        filters = [
            self._check_confidence_threshold,
            self._check_quality_tier,
            self._check_ticker_requirement,
            self._check_text_length,
            self._check_engagement_quality,
            self._check_content_value,
        ]
        
        for filter_func in filters:
            result = filter_func(post)
            if not result.passed:
                logger.debug(f"Post {post.post_id} filtered out: {result.reason}")
                return FilterResult(passed=False, reason=result.reason, score=quality_score)
        
        logger.info(f"Post {post.post_id} passed quality filters with score {quality_score:.3f}")
        return FilterResult(passed=True, score=quality_score)
    
    def filter_posts_batch(self, posts: List[RDSDataSource]) -> List[RDSDataSource]:
        """
        Filter a batch of posts, returning only those that meet quality standards.
        
        Args:
            posts: List of processed posts to filter
            
        Returns:
            List of posts that passed quality filtering
        """
        if not posts:
            return []
        
        filtered_posts = []
        filter_stats = {
            "total": len(posts),
            "passed": 0,
            "filtered_reasons": {}
        }
        
        for post in posts:
            result = self.should_store_post(post)
            
            if result.passed:
                filtered_posts.append(post)
                filter_stats["passed"] += 1
            else:
                reason = result.reason or "unknown"
                filter_stats["filtered_reasons"][reason] = filter_stats["filtered_reasons"].get(reason, 0) + 1
        
        # Log filtering statistics
        filtered_count = filter_stats["total"] - filter_stats["passed"]
        logger.info(f"Quality filtering results: {filter_stats['passed']}/{filter_stats['total']} posts passed "
                   f"({filtered_count} filtered)")
        
        if filter_stats["filtered_reasons"]:
            for reason, count in filter_stats["filtered_reasons"].items():
                logger.info(f"  - {reason}: {count} posts")
        
        return filtered_posts
    
    def _calculate_quality_score(self, post: RDSDataSource) -> float:
        """Calculate a comprehensive quality score for the post."""
        score = 0.0
        
        # Base score from confidence
        if post.confidence_score:
            score += post.confidence_score * 0.4
        
        # Engagement score
        if post.score and post.score > 0:
            score += min(post.score / 100.0, 0.2)  # Max 0.2 from upvotes
        
        if post.num_comments and post.num_comments > 0:
            score += min(post.num_comments / 50.0, 0.1)  # Max 0.1 from comments
        
        # Content quality score
        text_length = len(post.selftext or "") + len(post.title or "")
        if text_length > 100:
            score += 0.1
        if text_length > 500:
            score += 0.1
        
        # Ticker and sentiment bonus
        if post.tickers and len(post.tickers) > 0:
            score += 0.1
        
        if post.sentiment and post.sentiment != "neutral":
            score += 0.05
        
        # Market data validation bonus
        if post.market_data and len(post.market_data) > 0:
            score += 0.05
        
        return min(score, 1.0)  # Cap at 1.0
    
    def _check_confidence_threshold(self, post: RDSDataSource) -> FilterResult:
        """Check if post meets minimum confidence threshold."""
        if not post.confidence_score or post.confidence_score < self.quality_config.min_confidence_to_store:
            return FilterResult(
                passed=False, 
                reason=f"low_confidence ({post.confidence_score or 0:.3f} < {self.quality_config.min_confidence_to_store})"
            )
        return FilterResult(passed=True)
    
    def _check_quality_tier(self, post: RDSDataSource) -> FilterResult:
        """Check if post quality tier is acceptable for storage."""
        if not post.quality_tier or post.quality_tier not in self.quality_config.allowed_quality_tiers:
            return FilterResult(
                passed=False, 
                reason=f"unacceptable_quality_tier ({post.quality_tier})"
            )
        return FilterResult(passed=True)
    
    def _check_ticker_requirement(self, post: RDSDataSource) -> FilterResult:
        """Check if post has required tickers (if enabled)."""
        if self.quality_config.require_tickers_to_store:
            if not post.tickers or len(post.tickers) == 0:
                return FilterResult(passed=False, reason="no_tickers_found")
        return FilterResult(passed=True)
    
    def _check_text_length(self, post: RDSDataSource) -> FilterResult:
        """Check if post has sufficient text content."""
        total_text_length = len(post.title or "") + len(post.selftext or "")
        if total_text_length < self.quality_config.min_text_length_to_store:
            return FilterResult(
                passed=False, 
                reason=f"insufficient_text_length ({total_text_length} < {self.quality_config.min_text_length_to_store})"
            )
        return FilterResult(passed=True)
    
    def _check_engagement_quality(self, post: RDSDataSource) -> FilterResult:
        """Check if post has reasonable engagement metrics."""
        # Filter out heavily downvoted posts
        if post.score is not None and post.score < -5:
            return FilterResult(passed=False, reason="heavily_downvoted")
        
        # Filter out posts with suspicious engagement patterns
        if post.upvote_ratio is not None and post.upvote_ratio < 0.3:
            return FilterResult(passed=False, reason="low_upvote_ratio")
        
        return FilterResult(passed=True)
    
    def _check_content_value(self, post: RDSDataSource) -> FilterResult:
        """Check for obvious spam or low-value content patterns."""
        title = (post.title or "").lower()
        selftext = (post.selftext or "").lower()
        
        # Common spam indicators
        spam_indicators = [
            "click here", "free money", "guaranteed profit", "get rich quick",
            "this one trick", "doctors hate", "make money fast", "earn $",
            "work from home", "no experience needed", "limited time offer"
        ]
        
        for indicator in spam_indicators:
            if indicator in title or indicator in selftext:
                return FilterResult(passed=False, reason="spam_content_detected")
        
        # Check for excessive emoji or caps
        if title:
            emoji_count = sum(1 for char in title if ord(char) > 127)
            if emoji_count > len(title) * 0.2:  # More than 20% emoji
                return FilterResult(passed=False, reason="excessive_emoji")
            
            caps_count = sum(1 for char in title if char.isupper())
            if len(title) > 10 and caps_count > len(title) * 0.7:  # More than 70% caps
                return FilterResult(passed=False, reason="excessive_caps")
        
        return FilterResult(passed=True)


def get_data_quality_filter() -> DataQualityFilter:
    """Get a configured data quality filter instance."""
    return DataQualityFilter()
