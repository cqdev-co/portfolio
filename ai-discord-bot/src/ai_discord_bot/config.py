"""
Central config for ai-discord-bot.

Reads env (from repo-root .env + .env.local + the bot's own .env.example
overlay) into a typed Settings object. Also provides factories for shared
clients: Ollama model, Supabase REST client, asyncpg pool for direct SQL.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load repo-root .env files BEFORE reading Settings. Walk up from this file to
# find the repo root (first parent containing a `package.json`).
_here = Path(__file__).resolve()
_repo_root: Path | None = None
for _p in [_here, *_here.parents]:
    if (_p / "package.json").exists():
        _repo_root = _p
        break

if _repo_root is not None:
    load_dotenv(_repo_root / ".env", override=False)
    load_dotenv(_repo_root / ".env.local", override=True)


class Settings(BaseSettings):
    """Typed env settings. Field aliases match the existing conventions in
    penny-stock-scanner / unusual-options-service.
    """

    # Supabase (shared with other services)
    supabase_url: str = Field(default="", alias="NEXT_PUBLIC_SUPABASE_URL")
    supabase_service_key: str = Field(
        default="", alias="NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_anon_key: str = Field(
        default="", alias="NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )

    # Discord bot (NEW - set these for interactive usage)
    discord_bot_token: str = Field(default="", alias="DISCORD_BOT_TOKEN")
    discord_bot_guild_id: str = Field(default="", alias="DISCORD_BOT_GUILD_ID")
    discord_bot_channel_id: str = Field(default="", alias="DISCORD_BOT_CHANNEL_ID")

    # Ollama
    ollama_base_url: str = Field(
        default="http://localhost:11434", alias="OLLAMA_BASE_URL"
    )
    ollama_model: str = Field(default="qwen3.6:35b", alias="OLLAMA_MODEL")

    # AgentOS (A2A interface)
    agent_os_host: str = Field(default="127.0.0.1", alias="AGENT_OS_HOST")
    agent_os_port: int = Field(default=7777, alias="AGENT_OS_PORT")

    # Scheduler
    brief_cron_hour: int = Field(default=8, alias="BRIEF_CRON_HOUR")
    brief_cron_minute: int = Field(default=30, alias="BRIEF_CRON_MINUTE")
    brief_cron_tz: str = Field(default="America/New_York", alias="BRIEF_CRON_TZ")

    # Optional market data
    fmp_api_key: str = Field(default="", alias="FMP_API_KEY")

    model_config = SettingsConfigDict(
        env_file=None,  # we load via python-dotenv above
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def agent_os_url(self) -> str:
        return f"http://{self.agent_os_host}:{self.agent_os_port}"

    @property
    def discord_configured(self) -> bool:
        return bool(self.discord_bot_token)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    if not s.discord_configured:
        logger.warning(
            "DISCORD_BOT_TOKEN is not set; bot will refuse to start. "
            "See ai-discord-bot/README.md for setup."
        )
    if not s.supabase_configured:
        logger.warning(
            "Supabase env vars are missing; DB tools will return errors. "
            "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY."
        )
    return s


# ---------------------------------------------------------------------------
# Shared client factories
# ---------------------------------------------------------------------------


def ollama_model_for(agent_name: str):
    """Return an Agno Ollama model configured for the given agent.

    Single-model stack: all agents share the same Ollama tag. We pass the
    agent name only for logging / debugging; it does not change the model.
    """
    # Imported lazily so the module can be imported in test contexts without
    # agno installed.
    from agno.models.ollama import Ollama

    settings = get_settings()
    logger.debug(
        "ollama_model_for({}): host={} model={}",
        agent_name,
        settings.ollama_base_url,
        settings.ollama_model,
    )
    return Ollama(
        id=settings.ollama_model,
        host=settings.ollama_base_url,
        # Recommendation from docs/local-ai-eval/README.md: keep thinking off.
        # Qwen3.6 enables it by default which adds ~80s of hidden CoT latency.
        options={"temperature": 0.3, "num_ctx": 8192},
    )


def supabase_client():
    """Return a Supabase REST client. Uses the service role key since this
    process runs locally on your Mac; RLS is bypassed by design."""
    from supabase import Client, create_client

    s = get_settings()
    if not s.supabase_configured:
        raise RuntimeError(
            "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and "
            "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in repo-root .env.local."
        )
    client: Client = create_client(s.supabase_url, s.supabase_service_key)
    return client
