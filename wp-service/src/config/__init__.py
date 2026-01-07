"""
Configuration system for the gradient generator.
"""

from .settings import Config, load_config, save_config, create_default_config
from .presets import GradientPreset

__all__ = [
    "Config",
    "load_config",
    "save_config",
    "create_default_config",
    "GradientPreset",
]
