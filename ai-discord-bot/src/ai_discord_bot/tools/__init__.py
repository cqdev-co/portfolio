"""Tools exposed to Agno agents.

Each `*_tools.py` module exports plain functions. Agno auto-generates tool
schemas from type hints + docstrings; we keep the signatures simple and the
docstrings tool-caller-friendly (used verbatim by the model).
"""
