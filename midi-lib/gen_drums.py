"""
Drum pattern MIDI generator.

Genre-agnostic engine driven by kit configuration.
Uses General MIDI drum map (channel 10).
"""

from __future__ import annotations

import random
from pathlib import Path

import mido

from kits import DrumPattern, Kit
from theory import apply_swing, humanize_timing, humanize_velocity

TICKS_PER_BEAT = 480
OUTPUT_DIR = Path(__file__).parent / "output" / "drums"

# Sixteenth note duration at 480 ticks/beat
STEP_TICKS = TICKS_PER_BEAT // 4


def _get_pattern(kit: Kit, style: str | None = None) -> DrumPattern:
    if style:
        for p in kit.drum_patterns:
            if p.name == style:
                return p
        available = [p.name for p in kit.drum_patterns]
        raise ValueError(f"Unknown drum style '{style}'. Available: {available}")
    return random.choice(kit.drum_patterns)


def generate(
    kit: Kit,
    bpm: int | None = None,
    style: str | None = None,
    bars: int = 4,
    humanize: bool = True,
) -> Path:
    """Generate a drum pattern MIDI file and return its path."""
    bpm = bpm or kit.default_bpm
    pattern = _get_pattern(kit, style)

    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm)))
    track.append(mido.MetaMessage("track_name", name=f"{kit.name} drums - {pattern.name}"))

    ticks_per_bar = TICKS_PER_BEAT * 4
    note_duration = STEP_TICKS // 2

    events: list[tuple[int, str, int, int]] = []

    for bar_idx in range(bars):
        bar_start = bar_idx * ticks_per_bar

        for instrument, hits in pattern.instruments.items():
            for step, velocity in hits:
                tick = bar_start + step * STEP_TICKS

                if humanize:
                    tick = apply_swing(tick, TICKS_PER_BEAT, kit.swing)
                    tick = humanize_timing(tick, amount=5)
                    velocity = humanize_velocity(velocity, amount=10)

                events.append((tick, "note_on", instrument, velocity))
                events.append((tick + note_duration, "note_off", instrument, 0))

    events.sort(key=lambda e: (e[0], e[1] == "note_on"))

    current_tick = 0
    for tick, msg_type, note, vel in events:
        delta = max(0, tick - current_tick)
        track.append(mido.Message(msg_type, note=note, velocity=vel, time=delta, channel=9))
        current_tick = tick

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    style_name = pattern.name
    filename = f"{kit.name}_{style_name}_{bpm}bpm_drums.mid"
    filepath = OUTPUT_DIR / filename
    mid.save(str(filepath))
    return filepath
