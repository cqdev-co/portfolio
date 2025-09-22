"""Supabase client for Reddit Source data storage."""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from ..config.settings import get_settings
from ..ingest.models import (
    ImageExtraction,
    MarketEnrichment,
    PostCore,
    ProcessingJob,
    QualityScore,
    RedditFeatures,
    TextExtraction,
)

logger = logging.getLogger(__name__)


class SupabaseStorage:
    """Enterprise-grade Supabase storage client for Reddit data."""
    
    def __init__(self, use_service_key: bool = False):
        """Initialize Supabase client.
        
        Args:
            use_service_key: Whether to use service role key for admin operations
        """
        settings = get_settings()
        
        # Choose appropriate key based on operation type
        key = (
            settings.supabase.service_key 
            if use_service_key and settings.supabase.service_key
            else settings.supabase.key
        )
        
        # Configure client options for production use
        options = ClientOptions(
            auto_refresh_token=True,
            persist_session=True,
            headers={"x-application-name": "reddit-source"}
        )
        
        self.client: Client = create_client(
            settings.supabase.url,
            key,
            options=options
        )
        self.use_service_key = use_service_key
        
        logger.info(
            f"Initialized Supabase client with "
            f"{'service' if use_service_key else 'anon'} key"
        )
    
    async def health_check(self) -> bool:
        """Check Supabase connection health."""
        try:
            result = self.client.table("posts").select("count").limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase health check failed: {e}")
            return False
    
    # Posts operations
    async def insert_post(self, post: PostCore) -> bool:
        """Insert a new post into the database."""
        try:
            data = post.dict()
            # Convert UUID to string for JSON serialization
            data["id"] = str(data["id"])
            
            result = self.client.table("posts").insert(data).execute()
            
            if result.data:
                logger.debug(f"Inserted post: {post.post_id}")
                return True
            else:
                logger.error(f"Failed to insert post: {post.post_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error inserting post {post.post_id}: {e}")
            return False
    
    async def insert_posts_batch(self, posts: List[PostCore]) -> int:
        """Insert multiple posts in a batch operation."""
        if not posts:
            return 0
            
        try:
            data = []
            for post in posts:
                post_data = post.dict()
                post_data["id"] = str(post_data["id"])
                data.append(post_data)
            
            result = self.client.table("posts").insert(data).execute()
            
            inserted_count = len(result.data) if result.data else 0
            logger.info(f"Batch inserted {inserted_count}/{len(posts)} posts")
            return inserted_count
            
        except Exception as e:
            logger.error(f"Error batch inserting posts: {e}")
            return 0
    
    async def get_posts_for_processing(
        self, 
        batch_size: int = 50,
        processing_type: str = "ocr"
    ) -> List[Dict[str, Any]]:
        """Get posts that need processing."""
        try:
            # Use the database function for efficient querying
            result = self.client.rpc(
                "get_posts_for_processing",
                {
                    "batch_size": batch_size,
                    "processing_type": processing_type
                }
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting posts for processing: {e}")
            return []
    
    async def update_post_processing_status(
        self,
        post_id: str,
        status: str,
        error: Optional[str] = None
    ) -> bool:
        """Update post processing status."""
        try:
            update_data = {
                "processing_status": status,
                "processed_at": datetime.utcnow().isoformat()
            }
            
            if error:
                update_data["processing_error"] = error
            
            result = self.client.table("posts").update(update_data).eq(
                "post_id", post_id
            ).execute()
            
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Error updating post status {post_id}: {e}")
            return False
    
    # Image extractions operations
    async def insert_image_extraction(
        self, 
        extraction: ImageExtraction
    ) -> bool:
        """Insert image extraction data."""
        try:
            data = extraction.dict()
            
            result = self.client.table("image_extractions").upsert(
                data, 
                on_conflict="post_id"
            ).execute()
            
            if result.data:
                logger.debug(f"Inserted image extraction: {extraction.post_id}")
                return True
            else:
                logger.error(f"Failed to insert image extraction: {extraction.post_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error inserting image extraction {extraction.post_id}: {e}")
            return False
    
    # Text extractions operations
    async def insert_text_extraction(self, extraction: TextExtraction) -> bool:
        """Insert text extraction data."""
        try:
            data = extraction.dict()
            
            result = self.client.table("text_extractions").upsert(
                data,
                on_conflict="post_id"
            ).execute()
            
            if result.data:
                logger.debug(f"Inserted text extraction: {extraction.post_id}")
                return True
            else:
                logger.error(f"Failed to insert text extraction: {extraction.post_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error inserting text extraction {extraction.post_id}: {e}")
            return False
    
    # Market enrichment operations
    async def insert_market_enrichment(
        self, 
        enrichment: MarketEnrichment
    ) -> bool:
        """Insert market enrichment data."""
        try:
            data = enrichment.dict()
            
            result = self.client.table("market_enrichment").upsert(
                data,
                on_conflict="post_id,ticker"
            ).execute()
            
            if result.data:
                logger.debug(
                    f"Inserted market enrichment: {enrichment.post_id} - "
                    f"{enrichment.ticker}"
                )
                return True
            else:
                logger.error(
                    f"Failed to insert market enrichment: {enrichment.post_id} - "
                    f"{enrichment.ticker}"
                )
                return False
                
        except Exception as e:
            logger.error(
                f"Error inserting market enrichment "
                f"{enrichment.post_id} - {enrichment.ticker}: {e}"
            )
            return False
    
    # Quality scores operations
    async def insert_quality_score(self, score: QualityScore) -> bool:
        """Insert quality score data."""
        try:
            data = score.dict()
            
            result = self.client.table("quality_scores").upsert(
                data,
                on_conflict="post_id"
            ).execute()
            
            if result.data:
                logger.debug(f"Inserted quality score: {score.post_id}")
                return True
            else:
                logger.error(f"Failed to insert quality score: {score.post_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error inserting quality score {score.post_id}: {e}")
            return False
    
    # Reddit features operations
    async def insert_reddit_features(self, features: RedditFeatures) -> bool:
        """Insert Reddit features data."""
        try:
            data = features.dict()
            # Convert datetime to ISO string
            data["bucket_2h"] = features.bucket_2h.isoformat()
            
            result = self.client.table("reddit_features").upsert(
                data,
                on_conflict="ticker,bucket_2h"
            ).execute()
            
            if result.data:
                logger.debug(
                    f"Inserted Reddit features: {features.ticker} - "
                    f"{features.bucket_2h}"
                )
                return True
            else:
                logger.error(
                    f"Failed to insert Reddit features: {features.ticker} - "
                    f"{features.bucket_2h}"
                )
                return False
                
        except Exception as e:
            logger.error(
                f"Error inserting Reddit features "
                f"{features.ticker} - {features.bucket_2h}: {e}"
            )
            return False
    
    async def update_reddit_features_for_ticker(
        self,
        ticker: str,
        start_time: datetime,
        end_time: datetime
    ) -> bool:
        """Update Reddit features for a specific ticker and time range."""
        try:
            result = self.client.rpc(
                "update_reddit_features_for_ticker",
                {
                    "target_ticker": ticker,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat()
                }
            ).execute()
            
            logger.info(f"Updated Reddit features for {ticker}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating Reddit features for {ticker}: {e}")
            return False
    
    # Processing jobs operations
    async def create_processing_job(self, job: ProcessingJob) -> Optional[str]:
        """Create a new processing job."""
        try:
            data = job.dict()
            data["id"] = str(data["id"])
            
            result = self.client.table("processing_jobs").insert(data).execute()
            
            if result.data:
                job_id = result.data[0]["id"]
                logger.info(f"Created processing job: {job_id}")
                return job_id
            else:
                logger.error("Failed to create processing job")
                return None
                
        except Exception as e:
            logger.error(f"Error creating processing job: {e}")
            return None
    
    async def update_processing_job(
        self,
        job_id: str,
        status: str,
        progress: Optional[float] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """Update processing job status."""
        try:
            update_data = {"status": status}
            
            if status == "running" and "started_at" not in update_data:
                update_data["started_at"] = datetime.utcnow().isoformat()
            elif status in ["completed", "failed"]:
                update_data["completed_at"] = datetime.utcnow().isoformat()
            
            if progress is not None:
                update_data["progress"] = progress
            
            if error_message:
                update_data["error_message"] = error_message
            
            result = self.client.table("processing_jobs").update(
                update_data
            ).eq("id", job_id).execute()
            
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Error updating processing job {job_id}: {e}")
            return False
    
    # Query operations
    async def get_posts_by_subreddit(
        self,
        subreddit: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get posts by subreddit."""
        try:
            result = self.client.table("posts").select("*").eq(
                "subreddit", subreddit
            ).order("created_datetime", desc=True).range(
                offset, offset + limit - 1
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting posts for subreddit {subreddit}: {e}")
            return []
    
    async def get_scanner_ready_signals(
        self,
        ticker: Optional[str] = None,
        min_buzz_z: float = 1.0,
        quality_tiers: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Get signals ready for scanner integration."""
        try:
            query = self.client.table("scanner_ready_signals").select("*")
            
            if ticker:
                query = query.eq("primary_ticker", ticker)
            
            if min_buzz_z:
                query = query.gte("buzz_z", min_buzz_z)
            
            if quality_tiers:
                query = query.in_("quality_tier", quality_tiers)
            else:
                query = query.in_("quality_tier", ["valuable"])
            
            result = query.order("created_datetime", desc=True).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting scanner ready signals: {e}")
            return []
    
    async def refresh_scanner_signals(self) -> bool:
        """Refresh the materialized view for scanner signals."""
        try:
            result = self.client.rpc("refresh_scanner_signals").execute()
            logger.info("Refreshed scanner signals materialized view")
            return True
            
        except Exception as e:
            logger.error(f"Error refreshing scanner signals: {e}")
            return False
    
    # Analytics operations
    async def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics."""
        try:
            # Get post counts by status
            posts_stats = self.client.table("posts").select(
                "processing_status", 
                count="exact"
            ).execute()
            
            # Get quality distribution
            quality_stats = self.client.table("quality_scores").select(
                "quality_tier",
                count="exact"
            ).execute()
            
            # Get recent activity
            recent_posts = self.client.table("posts").select(
                "created_datetime"
            ).gte(
                "created_datetime", 
                (datetime.utcnow().replace(hour=0, minute=0, second=0)).isoformat()
            ).execute()
            
            return {
                "posts_by_status": posts_stats.data,
                "quality_distribution": quality_stats.data,
                "posts_today": len(recent_posts.data) if recent_posts.data else 0,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting processing stats: {e}")
            return {}


# Global storage instances
_storage_client: Optional[SupabaseStorage] = None
_admin_storage_client: Optional[SupabaseStorage] = None


def get_storage_client() -> SupabaseStorage:
    """Get the standard storage client."""
    global _storage_client
    if _storage_client is None:
        _storage_client = SupabaseStorage(use_service_key=False)
    return _storage_client


def get_admin_storage_client() -> SupabaseStorage:
    """Get the admin storage client with service role permissions."""
    global _admin_storage_client
    if _admin_storage_client is None:
        _admin_storage_client = SupabaseStorage(use_service_key=True)
    return _admin_storage_client
