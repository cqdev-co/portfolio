"""Configuration management for CDS Finder."""

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv
from loguru import logger


@dataclass
class Config:
    """Configuration for CDS Finder."""
    
    supabase_url: str
    supabase_key: str
    min_grade: str = "A"
    days_back: int = 7
    min_dte: int = 14
    max_dte: int = 60
    account_size: float = 10000
    risk_per_trade_pct: float = 2.0
    min_pop: float = 50.0
    min_rr: float = 2.0
    
    @classmethod
    def from_env(cls, env_path: Optional[str] = None) -> "Config":
        """
        Load configuration from repository root .env file.
        
        Args:
            env_path: Path to .env file. If None, searches for .env in repo root.
            
        Returns:
            Config instance
        """
        # Find repository root (go up from service directory)
        if env_path is None:
            # Assume we're in call-debit-spread-finder/, go up to repo root
            current_dir = Path(__file__).parent.parent.parent.parent
            env_path = current_dir / ".env"
        
        # Load environment variables
        if isinstance(env_path, Path):
            env_path = str(env_path)
        
        if os.path.exists(env_path):
            load_dotenv(env_path)
            logger.debug(f"Loaded .env from {env_path}")
        else:
            # Try loading from current directory or environment
            load_dotenv()
            logger.debug("Loaded .env from current directory or environment")
        
        # Get Supabase credentials (try multiple env var names)
        supabase_url = (
            os.getenv("SUPABASE_URL") or
            os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        )
        
        supabase_key = (
            os.getenv("SUPABASE_KEY") or
            os.getenv("SUPABASE_SERVICE_KEY") or
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
            os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
        )
        
        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY environment variables required. "
                "Set them in repository root .env file."
            )
        
        return cls(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            min_grade=os.getenv("DEFAULT_MIN_GRADE", "A"),
            days_back=int(os.getenv("DEFAULT_DAYS_BACK", "7")),
            min_dte=int(os.getenv("DEFAULT_MIN_DTE", "14")),
            max_dte=int(os.getenv("DEFAULT_MAX_DTE", "60")),
            account_size=float(os.getenv("ACCOUNT_SIZE", "10000")),
            risk_per_trade_pct=float(os.getenv("RISK_PER_TRADE_PCT", "2.0")),
            min_pop=float(os.getenv("MIN_POP", "50.0")),
            min_rr=float(os.getenv("MIN_RR", "2.0")),
        )


def get_config() -> Config:
    """Get configuration instance."""
    return Config.from_env()

