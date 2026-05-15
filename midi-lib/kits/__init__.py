"""
Kit system -- base class, registry, and auto-discovery.

Every genre kit subclasses Kit and gets auto-registered.
Add a new genre by dropping a .py file in this directory.
"""

from __future__ import annotations

import importlib
import pkgutil
from dataclasses import dataclass, field
from pathlib import Path

_REGISTRY: dict[str, type[Kit]] = {}


@dataclass
class DrumPattern:
    """A single drum pattern with per-instrument step sequences.

    Each instrument maps to a list of (step, velocity) tuples where step
    is measured in sixteenth-note positions (0-15 for one bar).
    """
    name: str
    steps_per_bar: int = 16
    instruments: dict[int, list[tuple[int, int]]] = field(default_factory=dict)


@dataclass
class Progression:
    """A named chord progression using roman numeral notation."""
    name: str
    chords: list[str] = field(default_factory=list)
    bars: int = 4


class Kit:
    """Base kit that every genre must populate.

    Subclasses override class attributes. Not a dataclass so that
    subclasses can simply set class variables without constructor gymnastics.
    """
    name: str = ""
    description: str = ""

    bpm_range: tuple[int, int] = (80, 120)
    default_bpm: int = 100

    preferred_scales: list[str] = ["major"]
    voicings: list[str] = ["closed"]

    chord_extensions: list[str] = ["maj", "min"]
    progressions: list[Progression] = []
    chord_rhythm: str = "whole"

    drum_patterns: list[DrumPattern] = []
    swing: float = 0.0

    bass_patterns: list[str] = ["root"]
    bass_octave: int = 2

    melody_scales: list[str] = ["pentatonic_minor"]
    melody_octave: int = 5
    melody_density: str = "medium"

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if cls.name:
            _REGISTRY[cls.name] = cls


def get_kit(name: str) -> Kit:
    """Get an instantiated kit by name."""
    _discover()
    cls = _REGISTRY.get(name)
    if cls is None:
        available = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(f"Unknown kit '{name}'. Available: {available}")
    return cls()


def list_kits() -> list[Kit]:
    """Return instances of all registered kits."""
    _discover()
    return [cls() for cls in _REGISTRY.values()]


_discovered = False


def _discover():
    """Import all modules in this package to trigger Kit subclass registration."""
    global _discovered
    if _discovered:
        return
    package_dir = Path(__file__).parent
    for info in pkgutil.iter_modules([str(package_dir)]):
        importlib.import_module(f"{__name__}.{info.name}")
    _discovered = True
