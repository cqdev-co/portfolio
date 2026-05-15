"""
Supabase-backed conversation memory.

V1: write every turn, load last N per channel. No summarization, no vector
retrieval. Agno's built-in Memory abstractions expect SQLAlchemy or SQLite;
Supabase's REST client is simpler and matches what other Python services in
this repo already use, so we wrap it directly and feed recent turns into
agent runs as message history.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger

from ai_discord_bot.config import get_settings, supabase_client


@dataclass
class Turn:
    role: str  # 'user' | 'assistant' | 'tool' | 'system'
    content: Any  # string for user/assistant, dict/list for tool
    agent_name: str | None = None


class SupabaseMemory:
    """Channel-scoped conversation memory backed by agent_conversations.

    Not threadsafe per instance; create one per event-loop callsite (or
    rely on the fact that the Discord bot processes commands serially).
    """

    TABLE = "agent_conversations"

    def __init__(self, channel_id: str, user_id: str, max_history: int = 20):
        self.channel_id = channel_id
        self.user_id = user_id
        self.max_history = max_history
        self._client = supabase_client()

    # ----- writes -----

    def append(
        self,
        role: str,
        content: Any,
        agent_name: str | None = None,
    ) -> None:
        payload = {
            "channel_id": self.channel_id,
            "user_id": self.user_id,
            "role": role,
            "content": content if isinstance(content, dict | list) else {"text": str(content)},
            "agent_name": agent_name,
        }
        try:
            self._client.table(self.TABLE).insert(payload).execute()
        except Exception as e:
            # Memory write failure must not crash the agent loop.
            logger.warning("SupabaseMemory.append failed: {}", e)

    # ----- reads -----

    def recent_turns(self, limit: int | None = None) -> list[Turn]:
        limit = limit or self.max_history
        try:
            resp = (
                self._client.table(self.TABLE)
                .select("role,content,agent_name,created_at")
                .eq("channel_id", self.channel_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
        except Exception as e:
            logger.warning("SupabaseMemory.recent_turns failed: {}", e)
            return []

        rows = list(reversed(resp.data or []))  # oldest-first for prompting
        return [
            Turn(
                role=r["role"],
                content=r["content"].get("text") if isinstance(r["content"], dict) and set(r["content"].keys()) == {"text"} else r["content"],
                agent_name=r.get("agent_name"),
            )
            for r in rows
        ]

    def as_prompt_context(self, limit: int | None = None) -> str:
        """Render recent turns as a compact plaintext block for a system or
        prefix message. Used by the orchestrator to keep Agno agents
        framework-agnostic.
        """
        turns = self.recent_turns(limit)
        if not turns:
            return ""
        lines = ["PRIOR CONVERSATION (oldest-first):"]
        for t in turns:
            who = t.agent_name or t.role
            text = t.content if isinstance(t.content, str) else str(t.content)
            lines.append(f"[{who}] {text[:500]}")
        return "\n".join(lines)


def memory_for(channel_id: str, user_id: str) -> SupabaseMemory:
    """Factory: returns a SupabaseMemory instance scoped to a Discord channel."""
    s = get_settings()
    if not s.supabase_configured:
        raise RuntimeError(
            "SupabaseMemory requested but Supabase is not configured. "
            "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY."
        )
    return SupabaseMemory(channel_id=channel_id, user_id=user_id)
