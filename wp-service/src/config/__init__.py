"""
Configuration system for the gradient generator.
"""

from .presets import GradientPreset
from .settings import Config, create_default_config, load_config, save_config

__all__ = [
    "Config",
    "load_config",
    "save_config",
    "create_default_config",
    "GradientPreset",
]
