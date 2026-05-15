"""
Render agent output for Discord.

Discord hard limit is 2000 chars per message; we target 1800 in-prompt and
chunk anything longer here as a safety net.
"""

from __future__ import annotations

_HARD_LIMIT = 1900  # leave headroom for embedded ticks, fences, etc.


def chunk_for_discord(text: str) -> list[str]:
    """Split `text` into message-safe chunks, preferring newline boundaries.

    Returns a list of strings each <= _HARD_LIMIT characters. Empty input
    returns ["(empty response)"] so the bot never posts a blank message.
    """
    text = (text or "").strip()
    if not text:
        return ["(empty response)"]
    if len(text) <= _HARD_LIMIT:
        return [text]

    chunks: list[str] = []
    remaining = text
    while len(remaining) > _HARD_LIMIT:
        # Prefer to break at the last newline within the limit, else at a
        # space, else hard-cut.
        cut = remaining.rfind("\n", 0, _HARD_LIMIT)
        if cut < 500:  # too early; try a space instead
            cut = remaining.rfind(" ", 0, _HARD_LIMIT)
        if cut < 500:
            cut = _HARD_LIMIT
        chunks.append(remaining[:cut].rstrip())
        remaining = remaining[cut:].lstrip()
    if remaining:
        chunks.append(remaining)
    return chunks
