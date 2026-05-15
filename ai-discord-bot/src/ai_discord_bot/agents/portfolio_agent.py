"""PortfolioAgent: positions, spreads, P&L history."""

from __future__ import annotations


def build_portfolio_agent():
    from agno.agent import Agent

    from ai_discord_bot.agents.system_prompts import PORTFOLIO_AGENT_PROMPT
    from ai_discord_bot.config import ollama_model_for
    from ai_discord_bot.tools.calc_tools import calculate_spread
    from ai_discord_bot.tools.portfolio_tools import (
        get_open_spreads,
        get_pnl_history,
        get_portfolio_snapshot,
    )

    return Agent(
        id="portfolio_agent",  # route segment in /a2a/agents/{id}/...
        name="PortfolioAgent",
        model=ollama_model_for("PortfolioAgent"),
        description="Queries the user's private portfolio: open positions, spreads, P&L.",
        instructions=PORTFOLIO_AGENT_PROMPT,
        tools=[
            get_portfolio_snapshot,
            get_open_spreads,
            get_pnl_history,
            calculate_spread,  # shared math tool available to every specialist
        ],
        markdown=False,
    )
