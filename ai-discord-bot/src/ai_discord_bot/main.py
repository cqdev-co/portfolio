"""
Entrypoint: boot AgentOS (FastAPI, A2A interface) and the Discord bot in
one asyncio loop. Also starts the morning-brief scheduler.

Run via `poetry run ai-discord-bot` or `bun run py:bot`.
"""

from __future__ import annotations

import asyncio
import contextlib
import signal
import sys

import uvicorn
from loguru import logger

from ai_discord_bot.agents.market_agent import build_market_agent
from ai_discord_bot.agents.narrative_agent import build_narrative_agent
from ai_discord_bot.agents.portfolio_agent import build_portfolio_agent
from ai_discord_bot.agents.signals_agent import build_signals_agent
from ai_discord_bot.bot.client import build_client
from ai_discord_bot.config import get_settings
from ai_discord_bot.scheduling.brief_scheduler import attach_scheduler


def _build_agent_os():
    """Construct an Agno AgentOS exposing specialists via A2A. Returns the
    FastAPI app ready to be served by uvicorn."""
    from agno.os import AgentOS

    agents = [
        build_portfolio_agent(),
        build_signals_agent(),
        build_market_agent(),
        build_narrative_agent(),
    ]
    agent_os = AgentOS(
        agents=agents,
        a2a_interface=True,
    )
    return agent_os.get_app()


async def _serve_agent_os(app, host: str, port: int) -> None:
    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        log_level="info",
        access_log=False,
    )
    server = uvicorn.Server(config)
    await server.serve()


async def _run() -> None:
    s = get_settings()
    if not s.discord_configured:
        logger.error(
            "DISCORD_BOT_TOKEN is not set. Create a Discord bot, set the "
            "token in repo-root .env.local, and try again. See "
            "ai-discord-bot/README.md."
        )
        sys.exit(2)

    # 1. Start AgentOS (specialists exposed via A2A) in the background.
    app = _build_agent_os()
    agent_os_task = asyncio.create_task(
        _serve_agent_os(app, s.agent_os_host, s.agent_os_port)
    )
    logger.info("AgentOS starting on {}", s.agent_os_url)

    # 2. Build the Discord client, attach scheduler to its loop.
    client, _tree = build_client()
    scheduler = attach_scheduler(client)

    stop = asyncio.Event()

    def _signal_handler(*_args) -> None:
        logger.info("Shutdown signal received; closing")
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_event_loop().add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows fallback; not a concern on macOS but keeps future
            # portability cheap.
            signal.signal(sig, _signal_handler)

    # 3. Start scheduler and bot concurrently.
    scheduler.start()
    bot_task = asyncio.create_task(client.start(s.discord_bot_token))

    try:
        done, pending = await asyncio.wait(
            [bot_task, agent_os_task, asyncio.create_task(stop.wait())],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            if task is not stop:
                exc = task.exception()
                if exc:
                    logger.exception("Task exited with error: {}", exc)
    finally:
        scheduler.shutdown(wait=False)
        await client.close()
        agent_os_task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await agent_os_task
        logger.info("ai-discord-bot stopped")


def main() -> None:
    """Sync entry registered in pyproject.toml."""
    logger.info("ai-discord-bot booting")
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        logger.info("Interrupted")


if __name__ == "__main__":
    main()
