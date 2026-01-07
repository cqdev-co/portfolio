"""
Configuration settings management.
"""

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class AppSettings:
    """Application settings."""

    output_dir: str = "outputs"
    default_resolution: str = "1080p"
    default_format: str = "PNG"
    jpeg_quality: int = 95


@dataclass
class Config:
    """Main configuration class."""

    settings: AppSettings


def load_config(config_path: str = "config.json") -> Config:
    """Load configuration from file."""
    config_file = Path(config_path)

    if config_file.exists():
        try:
            with open(config_file) as f:
                config_data = json.load(f)

            settings = AppSettings(**config_data.get("settings", {}))
            return Config(settings=settings)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Warning: Could not load config file: {e}")
            print("Using default configuration.")

    # Return default config
    return create_default_config()


def save_config(config: Config, config_path: str = "config.json") -> None:
    """Save configuration to file."""
    config_data = {"settings": asdict(config.settings)}

    with open(config_path, "w") as f:
        json.dump(config_data, f, indent=2)


def create_default_config() -> Config:
    """Create default configuration."""
    settings = AppSettings()
    return Config(settings=settings)
