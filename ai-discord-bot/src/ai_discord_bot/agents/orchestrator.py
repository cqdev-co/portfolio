"""
Orchestrator.

Wraps specialist calls as tools on an Agno agent. The orchestrator model
decides which specialists to consult and in what order; each consultation
flows over A2A (HTTP to localhost:7777). This is genuinely multi-agent:
each specialist has its own system prompt, tools, and reasoning loop, and
the orchestrator composes their outputs.

Entrypoint: `run_orchestrator(channel_id, user_id, query, is_brief)` which
the Discord bot and scheduler both call.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

from loguru import logger

from ai_discord_bot.agents.system_prompts import ORCHESTRATOR_PROMPT
from ai_discord_bot.config import get_settings, ollama_model_for
from ai_discord_bot.memory.supabase_memory import SupabaseMemory

# Agent IDs registered with AgentOS. These are the canonical route segments
# in `/a2a/agents/{id}/v1/message:send`. Must match the `id=` set on each
# specialist Agent().
PORTFOLIO_AGENT_ID = "portfolio_agent"
SIGNALS_AGENT_ID = "signals_agent"
MARKET_AGENT_ID = "market_agent"
NARRATIVE_AGENT_ID = "narrative_agent"

# Agno 2.5 A2AClient.send_message is async. Agno caches an httpx.AsyncClient
# bound to the first event loop that touches it. If we `asyncio.run(...)` per
# call, each call opens/closes a fresh loop; the next call then tries to
# reuse a client attached to a closed loop -> "Event loop is closed". Fix:
# one persistent loop in a dedicated thread, shared across all A2A calls.


# ---------------------------------------------------------------------------
# Persistent event loop for A2A
# ---------------------------------------------------------------------------


_a2a_loop: asyncio.AbstractEventLoop | None = None
_a2a_loop_lock = threading.Lock()


def _get_a2a_loop() -> asyncio.AbstractEventLoop:
    """Lazily start a background thread running a persistent asyncio loop,
    and return that loop. All A2A calls submit coroutines onto it via
    `asyncio.run_coroutine_threadsafe` so the cached httpx.AsyncClient stays
    alive across calls."""
    global _a2a_loop
    if _a2a_loop is not None and not _a2a_loop.is_closed():
        return _a2a_loop

    with _a2a_loop_lock:
        if _a2a_loop is not None and not _a2a_loop.is_closed():
            return _a2a_loop

        ready = threading.Event()
        loop_holder: dict[str, asyncio.AbstractEventLoop] = {}

        def _run_loop() -> None:
            loop = asyncio.new_event_loop()
            loop_holder["loop"] = loop
            asyncio.set_event_loop(loop)
            ready.set()
            try:
                loop.run_forever()
            finally:
                loop.close()

        thread = threading.Thread(target=_run_loop, name="a2a-loop", daemon=True)
        thread.start()
        ready.wait(timeout=5)
        _a2a_loop = loop_holder["loop"]
        logger.debug("A2A background loop started on thread {}", thread.name)
        return _a2a_loop


# ---------------------------------------------------------------------------
# A2A call helpers
# ---------------------------------------------------------------------------


async def _a2a_send_async(agent_id: str, message: str) -> str:
    """Async: send `message` to the given specialist over A2A and return
    the text of the final reply.
    """
    from agno.client.a2a.client import A2AClient

    s = get_settings()
    base_url = f"{s.agent_os_url}/a2a/agents/{agent_id}"
    client = A2AClient(base_url=base_url, timeout=120)
    try:
        result = await client.send_message(message)
    except Exception as e:
        logger.warning("A2A call to {} failed: {}", agent_id, e)
        return f"[A2A error calling {agent_id}: {e}]"
    # TaskResult.content is the assistant reply string.
    text = getattr(result, "content", None)
    return text or "[A2A specialist returned empty content]"


def _run_a2a(agent_id: str, message: str) -> str:
    """Sync bridge used by Agno tools: schedule the coroutine on the
    persistent background loop and block until done."""
    loop = _get_a2a_loop()
    fut = asyncio.run_coroutine_threadsafe(
        _a2a_send_async(agent_id, message), loop
    )
    try:
        return fut.result(timeout=180)
    except Exception as e:
        logger.warning("A2A call to {} raised: {}", agent_id, e)
        return f"[A2A error calling {agent_id}: {e}]"


# ---------------------------------------------------------------------------
# Specialist-call tools exposed to the orchestrator
# ---------------------------------------------------------------------------


def consult_portfolio_agent(question: str) -> str:
    """Ask PortfolioAgent a question. Use for anything about open positions,
    spreads, or P&L history. Pass the question in natural language; the
    specialist will call the right DB tools and return a summary."""
    return _run_a2a(PORTFOLIO_AGENT_ID, question)


def consult_signals_agent(question: str) -> str:
    """Ask SignalsAgent a question. Use for scanner output (CDS / PCS /
    unusual options) and historical CDS outcomes."""
    return _run_a2a(SIGNALS_AGENT_ID, question)


def consult_market_agent(question: str) -> str:
    """Ask MarketAgent a question. Use for live quotes, regime checks, and
    spread math."""
    return _run_a2a(MARKET_AGENT_ID, question)


def compose_final_message(structured_context: str) -> str:
    """Hand off to NarrativeAgent to compose the final Discord message.
    Pass all specialist outputs as a single structured string."""
    return _run_a2a(NARRATIVE_AGENT_ID, structured_context)


# ---------------------------------------------------------------------------
# Orchestrator agent
# ---------------------------------------------------------------------------


def build_orchestrator():
    from agno.agent import Agent

    return Agent(
        name="Orchestrator",
        model=ollama_model_for("Orchestrator"),
        description=(
            "Receives a user question or brief trigger and delegates to "
            "specialist agents over A2A."
        ),
        instructions=ORCHESTRATOR_PROMPT,
        tools=[
            consult_portfolio_agent,
            consult_signals_agent,
            consult_market_agent,
            compose_final_message,
        ],
        markdown=False,
    )


# ---------------------------------------------------------------------------
# Entrypoint used by Discord bot and scheduler
# ---------------------------------------------------------------------------


_BRIEF_TASK = (
    "Generate this morning's brief for the operator. Call PortfolioAgent, "
    "SignalsAgent, and MarketAgent to gather: open positions + P&L, recent "
    "high-grade signals from the last 3 days, and current trading regime. "
    "Then hand everything to NarrativeAgent to compose one Discord message. "
    "Lead with the regime, then portfolio status, then the 2-3 most "
    "notable signals. Under 1800 characters."
)


def run_orchestrator(
    channel_id: str,
    user_id: str,
    query: str,
    is_brief: bool = False,
) -> str:
    """Execute one orchestrator turn. Blocking; safe to call from an async
    context via `asyncio.to_thread`. Returns the final Discord-ready
    string.
    """
    logger.info(
        "run_orchestrator(channel={}, user={}, brief={}, query_len={})",
        channel_id,
        user_id,
        is_brief,
        len(query or ""),
    )

    memory = SupabaseMemory(channel_id=channel_id, user_id=user_id)
    prior = memory.as_prompt_context()

    task = _BRIEF_TASK if is_brief else query
    prompt = (prior + "\n\n" + task).strip() if prior else task

    # Write user turn BEFORE calling (so we still have it if the LLM fails).
    if not is_brief:
        memory.append(role="user", content=query)

    agent = build_orchestrator()
    try:
        run_response: Any = agent.run(prompt)
        reply_text = _extract_reply(run_response)
    except Exception as e:
        logger.exception("Orchestrator run failed")
        reply_text = (
            f"AI backend error: {e}. Check that Ollama is running "
            f"({get_settings().ollama_base_url}) and qwen3.6:35b is pulled."
        )

    memory.append(role="assistant", content=reply_text, agent_name="Orchestrator")
    return reply_text


def _extract_reply(run_response: Any) -> str:
    """Get a Discord-ready string from an Agno RunOutput.

    Order of preference:
      1. run_response.content, when it is a non-empty string.
      2. The last assistant message with non-empty content (some runs leave
         the top-level content empty but the final assistant message has the
         answer).
      3. A compact error explaining the run terminated without a visible
         answer - we deliberately do NOT stringify the full RunOutput,
         because that dumps 50KB+ of debug info into the channel.
    """
    content = getattr(run_response, "content", None)
    if isinstance(content, str) and content.strip():
        return content.strip()

    messages = getattr(run_response, "messages", None) or []
    for msg in reversed(messages):
        role = getattr(msg, "role", None)
        msg_content = getattr(msg, "content", None)
        tool_calls = getattr(msg, "tool_calls", None)
        if role == "assistant" and isinstance(msg_content, str) and msg_content.strip() and not tool_calls:
            return msg_content.strip()

    status = getattr(run_response, "status", "unknown")
    logger.warning(
        "Orchestrator returned no usable content (status={}, messages={})",
        status,
        len(messages),
    )
    return (
        "The orchestrator finished without producing a visible answer. "
        "This usually means a tool returned an error the model could not "
        "recover from. Check the bot logs for details."
    )
