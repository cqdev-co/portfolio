"""
Chord progression MIDI generator.

Genre-agnostic engine driven by kit configuration.
"""

from __future__ import annotations

import random
from pathlib import Path

import mido

from kits import Kit, Progression
from theory import (
    apply_swing,
    apply_voicing,
    get_chord_notes,
    humanize_duration,
    humanize_timing,
    humanize_velocity,
    parse_roman_chord,
)

TICKS_PER_BEAT = 480
OUTPUT_DIR = Path(__file__).parent / "output" / "chords"


def _get_progression(kit: Kit, progression_name: str | None = None) -> Progression:
    if progression_name:
        for p in kit.progressions:
            if p.name == progression_name:
                return p
        available = [p.name for p in kit.progressions]
        raise ValueError(f"Unknown progression '{progression_name}'. Available: {available}")
    return random.choice(kit.progressions)


def _rhythm_ticks(style: str, ticks_per_bar: int) -> list[tuple[int, int]]:
    """Return list of (onset_tick, duration_ticks) within one bar for a chord."""
    if style == "syncopated":
        half = ticks_per_bar // 2
        quarter = ticks_per_bar // 4
        return [
            (0, half - quarter // 2),
            (half - quarter // 4, half + quarter // 4),
        ]
    if style == "half":
        half = ticks_per_bar // 2
        return [(0, half), (half, half)]
    # Default: whole note
    return [(0, ticks_per_bar)]


def generate(
    kit: Kit,
    key: str = "C",
    bpm: int | None = None,
    progression_name: str | None = None,
    voicing: str | None = None,
    bars: int | None = None,
    humanize: bool = True,
) -> Path:
    """Generate a chord progression MIDI file and return its path."""
    bpm = bpm or kit.default_bpm
    progression = _get_progression(kit, progression_name)
    voicing = voicing or random.choice(kit.voicings)
    total_bars = bars or progression.bars

    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm)))
    track.append(mido.MetaMessage("track_name", name=f"{kit.name} chords - {progression.name}"))

    ticks_per_bar = TICKS_PER_BEAT * 4
    rhythm = _rhythm_ticks(kit.chord_rhythm, ticks_per_bar)

    events: list[tuple[int, str, int, int]] = []

    for bar_idx in range(total_bars):
        chord_symbol = progression.chords[bar_idx % len(progression.chords)]
        root_name, quality = parse_roman_chord(chord_symbol, key)
        raw_notes = get_chord_notes(root_name, quality, octave=4)
        notes = apply_voicing(raw_notes, voicing)

        bar_start = bar_idx * ticks_per_bar
        for onset, duration in rhythm:
            tick = bar_start + onset
            if humanize:
                tick = apply_swing(tick, TICKS_PER_BEAT, kit.swing)

            for note in notes:
                vel = humanize_velocity(90) if humanize else 90
                t = humanize_timing(tick) if humanize else tick
                dur = humanize_duration(duration) if humanize else duration
                events.append((t, "note_on", note, vel))
                events.append((t + dur, "note_off", note, 0))

    events.sort(key=lambda e: e[0])

    current_tick = 0
    for tick, msg_type, note, vel in events:
        delta = max(0, tick - current_tick)
        track.append(mido.Message(msg_type, note=note, velocity=vel, time=delta))
        current_tick = tick

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{kit.name}_{key}_{progression.name}_{bpm}bpm_chords.mid"
    filepath = OUTPUT_DIR / filename
    mid.save(str(filepath))
    return filepath
