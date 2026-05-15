"""
Bassline MIDI generator.

Genre-agnostic engine driven by kit configuration.
Follows chord roots from a progression.
"""

from __future__ import annotations

import random
from pathlib import Path

import mido

from kits import Kit, Progression
from theory import (
    apply_swing,
    humanize_duration,
    humanize_timing,
    humanize_velocity,
    note_to_midi,
    parse_roman_chord,
)

TICKS_PER_BEAT = 480
OUTPUT_DIR = Path(__file__).parent / "output" / "bass"

STEP_TICKS = TICKS_PER_BEAT // 4  # sixteenth note


def _build_bass_events(
    pattern: str,
    root_midi: int,
    bar_start: int,
    ticks_per_bar: int,
    swing: float,
    humanize: bool,
) -> list[tuple[int, str, int, int]]:
    """Build note events for one bar of bass given a pattern type."""
    events: list[tuple[int, str, int, int]] = []
    beat = TICKS_PER_BEAT
    vel_base = 100

    if pattern == "root_fifth":
        fifth = root_midi + 7
        notes_seq = [
            (0, root_midi, beat * 2),
            (beat * 2, fifth, beat),
            (beat * 3, root_midi, beat),
        ]
    elif pattern == "octave_bounce":
        octave_up = root_midi + 12
        notes_seq = [
            (0, root_midi, beat),
            (beat, octave_up, beat // 2),
            (beat + beat // 2, root_midi, beat // 2),
            (beat * 2, root_midi, beat),
            (beat * 3, octave_up, beat),
        ]
    elif pattern == "chromatic_approach":
        approach_note = root_midi - 1
        fifth = root_midi + 7
        notes_seq = [
            (0, root_midi, beat + beat // 2),
            (beat + beat // 2, fifth, beat // 2),
            (beat * 2, root_midi, beat),
            (beat * 3, approach_note, beat // 2),
            (beat * 3 + beat // 2, root_midi, beat // 2),
        ]
    else:
        notes_seq = [(0, root_midi, ticks_per_bar)]

    for offset, note, duration in notes_seq:
        tick = bar_start + offset
        if humanize:
            tick = apply_swing(tick, TICKS_PER_BEAT, swing)
            tick = humanize_timing(tick, amount=5)
            vel = humanize_velocity(vel_base, amount=12)
            duration = humanize_duration(duration, amount=8)
        else:
            vel = vel_base

        events.append((tick, "note_on", note, vel))
        events.append((tick + duration, "note_off", note, 0))

    return events


def _get_progression(kit: Kit, progression_name: str | None = None):
    if progression_name:
        for p in kit.progressions:
            if p.name == progression_name:
                return p
        available = [p.name for p in kit.progressions]
        raise ValueError(f"Unknown progression '{progression_name}'. Available: {available}")
    return random.choice(kit.progressions)


def generate(
    kit: Kit,
    key: str = "C",
    bpm: int | None = None,
    progression_name: str | None = None,
    pattern: str | None = None,
    bars: int | None = None,
    humanize: bool = True,
) -> Path:
    """Generate a bassline MIDI file and return its path."""
    bpm = bpm or kit.default_bpm
    progression = _get_progression(kit, progression_name)
    bass_pattern = pattern or random.choice(kit.bass_patterns)
    total_bars = bars or progression.bars

    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm)))
    track.append(mido.MetaMessage(
        "track_name",
        name=f"{kit.name} bass - {progression.name} ({bass_pattern})",
    ))

    ticks_per_bar = TICKS_PER_BEAT * 4
    events: list[tuple[int, str, int, int]] = []

    for bar_idx in range(total_bars):
        chord_symbol = progression.chords[bar_idx % len(progression.chords)]
        root_name, _ = parse_roman_chord(chord_symbol, key)
        root_midi = note_to_midi(root_name, kit.bass_octave)

        bar_start = bar_idx * ticks_per_bar
        bar_events = _build_bass_events(
            bass_pattern, root_midi, bar_start, ticks_per_bar, kit.swing, humanize,
        )
        events.extend(bar_events)

    events.sort(key=lambda e: e[0])

    current_tick = 0
    for tick, msg_type, note, vel in events:
        delta = max(0, tick - current_tick)
        track.append(mido.Message(msg_type, note=note, velocity=vel, time=delta))
        current_tick = tick

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{kit.name}_{key}_{progression.name}_{bass_pattern}_{bpm}bpm_bass.mid"
    filepath = OUTPUT_DIR / filename
    mid.save(str(filepath))
    return filepath
