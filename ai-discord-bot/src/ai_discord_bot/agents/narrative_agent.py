"""NarrativeAgent: composes the final Discord-ready message. No tools."""

from __future__ import annotations


def build_narrative_agent():
    from agno.agent import Agent

    from ai_discord_bot.agents.system_prompts import NARRATIVE_AGENT_PROMPT
    from ai_discord_bot.config import ollama_model_for

    return Agent(
        id="narrative_agent",
        name="NarrativeAgent",
        model=ollama_model_for("NarrativeAgent"),
        description="Combines specialist outputs into a single Discord message.",
        instructions=NARRATIVE_AGENT_PROMPT,
        tools=[],
        markdown=False,
    )
