"""
Melody MIDI generator.

Genre-agnostic engine driven by kit configuration.
Generates melodies constrained to kit-preferred scales.
"""

from __future__ import annotations

import random
from pathlib import Path

import mido

from kits import Kit
from theory import (
    apply_swing,
    get_scale,
    humanize_duration,
    humanize_timing,
    humanize_velocity,
)

TICKS_PER_BEAT = 480
OUTPUT_DIR = Path(__file__).parent / "output" / "melodies"

DENSITY_MAP = {
    "sparse":  (3, 5),
    "medium":  (5, 8),
    "busy":    (8, 12),
}

CONTOURS = ["ascending", "descending", "arch", "wave"]


def _build_scale_pool(root: str, scale_type: str, octave: int) -> list[int]:
    """Build a two-octave note pool from the given scale."""
    lower = get_scale(root, scale_type, octave)
    upper = [n + 12 for n in lower]
    return lower + upper


def _apply_contour(notes: list[int], contour: str) -> list[int]:
    """Sort/arrange notes to follow a melodic contour shape."""
    pool = sorted(set(notes))
    n = len(pool)

    if contour == "ascending":
        return pool
    elif contour == "descending":
        return list(reversed(pool))
    elif contour == "arch":
        mid_point = n // 2
        return pool[:mid_point] + list(reversed(pool[mid_point:]))
    elif contour == "wave":
        result = []
        low, high = 0, n - 1
        toggle = True
        while low <= high:
            if toggle:
                result.append(pool[low])
                low += 1
            else:
                result.append(pool[high])
                high -= 1
            toggle = not toggle
        return result
    return pool


def generate(
    kit: Kit,
    key: str = "C",
    bpm: int | None = None,
    scale: str | None = None,
    contour: str | None = None,
    bars: int = 4,
    humanize: bool = True,
) -> Path:
    """Generate a melody MIDI file and return its path."""
    bpm = bpm or kit.default_bpm
    scale_type = scale or random.choice(kit.melody_scales)
    contour = contour or random.choice(CONTOURS)

    note_pool = _build_scale_pool(key, scale_type, kit.melody_octave)

    density_range = DENSITY_MAP.get(kit.melody_density, DENSITY_MAP["medium"])
    notes_per_bar = random.randint(*density_range)

    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm)))
    track.append(mido.MetaMessage(
        "track_name",
        name=f"{kit.name} melody - {scale_type} {contour}",
    ))

    ticks_per_bar = TICKS_PER_BEAT * 4
    events: list[tuple[int, str, int, int]] = []

    for bar_idx in range(bars):
        bar_start = bar_idx * ticks_per_bar

        melody_notes = random.choices(note_pool, k=notes_per_bar)
        melody_notes = _apply_contour(melody_notes, contour)

        available_ticks = ticks_per_bar
        slot_size = available_ticks // max(len(melody_notes), 1)

        durations = [
            random.choice([TICKS_PER_BEAT // 4, TICKS_PER_BEAT // 2, TICKS_PER_BEAT])
            for _ in melody_notes
        ]

        rest_chance = 0.15
        for i, note in enumerate(melody_notes):
            if random.random() < rest_chance:
                continue

            tick = bar_start + i * slot_size
            duration = min(durations[i], slot_size - 10)

            if humanize:
                tick = apply_swing(tick, TICKS_PER_BEAT, kit.swing)
                tick = humanize_timing(tick, amount=8)
                vel = humanize_velocity(85, amount=15)
                duration = humanize_duration(duration, amount=10)
            else:
                vel = 85

            duration = max(1, duration)
            events.append((tick, "note_on", note, vel))
            events.append((tick + duration, "note_off", note, 0))

    events.sort(key=lambda e: e[0])

    current_tick = 0
    for tick, msg_type, note, vel in events:
        delta = max(0, tick - current_tick)
        track.append(mido.Message(msg_type, note=note, velocity=vel, time=delta))
        current_tick = tick

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{kit.name}_{key}_{scale_type}_{contour}_{bpm}bpm_melody.mid"
    filepath = OUTPUT_DIR / filename
    mid.save(str(filepath))
    return filepath
