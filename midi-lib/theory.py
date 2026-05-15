"""
Music theory engine -- scales, chords, voicings, and humanization.

Genre-agnostic foundation that all generators build on.
"""

import random

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

ENHARMONIC_MAP = {
    "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#",
    "Bb": "A#", "Cb": "B", "E#": "F", "B#": "C",
}

# --- Interval definitions (semitones from root) ---

SCALE_INTERVALS = {
    "major":             [0, 2, 4, 5, 7, 9, 11],
    "natural_minor":     [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor":    [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor":     [0, 2, 3, 5, 7, 9, 11],
    "dorian":            [0, 2, 3, 5, 7, 9, 10],
    "mixolydian":        [0, 2, 4, 5, 7, 9, 10],
    "lydian":            [0, 2, 4, 6, 7, 9, 11],
    "phrygian":          [0, 1, 3, 5, 7, 8, 10],
    "pentatonic_major":  [0, 2, 4, 7, 9],
    "pentatonic_minor":  [0, 3, 5, 7, 10],
    "blues":             [0, 3, 5, 6, 7, 10],
    "whole_tone":        [0, 2, 4, 6, 8, 10],
}

# Aliases
SCALE_INTERVALS["minor"] = SCALE_INTERVALS["natural_minor"]
SCALE_INTERVALS["pentatonic"] = SCALE_INTERVALS["pentatonic_minor"]

CHORD_INTERVALS = {
    "maj":      [0, 4, 7],
    "min":      [0, 3, 7],
    "dim":      [0, 3, 6],
    "aug":      [0, 4, 8],
    "sus2":     [0, 2, 7],
    "sus4":     [0, 5, 7],
    "maj7":     [0, 4, 7, 11],
    "min7":     [0, 3, 7, 10],
    "dom7":     [0, 4, 7, 10],
    "dim7":     [0, 3, 6, 9],
    "half_dim7": [0, 3, 6, 10],
    "min_maj7": [0, 3, 7, 11],
    "aug7":     [0, 4, 8, 10],
    "add9":     [0, 4, 7, 14],
    "maj9":     [0, 4, 7, 11, 14],
    "min9":     [0, 3, 7, 10, 14],
    "dom9":     [0, 4, 7, 10, 14],
    "maj11":    [0, 4, 7, 11, 14, 17],
    "min11":    [0, 3, 7, 10, 14, 17],
    "dom11":    [0, 4, 7, 10, 14, 17],
    "maj13":    [0, 4, 7, 11, 14, 21],
    "min13":    [0, 3, 7, 10, 14, 21],
    "dom13":    [0, 4, 7, 10, 14, 21],
}

# Map roman numeral scale degrees to semitone offsets within major scale
ROMAN_TO_SEMITONE = {
    "I": 0, "II": 2, "III": 4, "IV": 5, "V": 7, "VI": 9, "VII": 11,
    "i": 0, "ii": 2, "iii": 4, "iv": 5, "v": 7, "vi": 9, "vii": 11,
    "bII": 1, "bIII": 3, "bV": 6, "bVI": 8, "bVII": 10,
    "bii": 1, "biii": 3, "bv": 6, "bvi": 8, "bvii": 10,
    "#IV": 6, "#iv": 6,
}


def normalize_note(name: str) -> str:
    """Normalize note name to sharp-based representation."""
    return ENHARMONIC_MAP.get(name, name)


def note_to_midi(name: str, octave: int = 4) -> int:
    """Convert note name + octave to MIDI number. C4 = 60."""
    idx = NOTE_NAMES.index(normalize_note(name))
    return 12 * (octave + 1) + idx


def midi_to_note(midi_num: int) -> tuple[str, int]:
    """Convert MIDI number to (note_name, octave)."""
    octave = (midi_num // 12) - 1
    idx = midi_num % 12
    return NOTE_NAMES[idx], octave


def get_scale(root: str, scale_type: str, octave: int = 4) -> list[int]:
    """Return MIDI note numbers for a scale starting at root+octave."""
    intervals = SCALE_INTERVALS[scale_type]
    base = note_to_midi(root, octave)
    return [base + i for i in intervals]


def get_chord_notes(root: str, quality: str, octave: int = 4) -> list[int]:
    """Return MIDI note numbers for a chord."""
    intervals = CHORD_INTERVALS[quality]
    base = note_to_midi(root, octave)
    return [base + i for i in intervals]


def parse_roman_chord(symbol: str, key: str) -> tuple[str, str]:
    """
    Parse a roman numeral chord symbol into (root_note, quality).

    Examples:
        parse_roman_chord("ii7", "C")   -> ("D", "min7")
        parse_roman_chord("V7", "C")    -> ("G", "dom7")
        parse_roman_chord("Imaj7", "C") -> ("C", "maj7")
    """
    degree_part = ""
    quality_part = ""

    i = 0
    if symbol.startswith(("b", "#")):
        degree_part += symbol[0]
        i = 1

    while i < len(symbol) and symbol[i] in "IiVv":
        degree_part += symbol[i]
        i += 1

    quality_part = symbol[i:]

    is_minor = degree_part.replace("b", "").replace("#", "").islower()
    degree_key = degree_part

    semitones = ROMAN_TO_SEMITONE.get(degree_key, 0)
    key_base = NOTE_NAMES.index(normalize_note(key))
    root_midi_class = (key_base + semitones) % 12
    root_name = NOTE_NAMES[root_midi_class]

    if not quality_part:
        quality = "min" if is_minor else "maj"
    elif quality_part in CHORD_INTERVALS:
        quality = quality_part
    elif quality_part == "7":
        if is_minor:
            quality = "min7"
        else:
            quality = "dom7"
    elif quality_part == "9":
        quality = "min9" if is_minor else "dom9"
    elif quality_part == "11":
        quality = "min11" if is_minor else "dom11"
    elif quality_part == "13":
        quality = "min13" if is_minor else "dom13"
    else:
        quality = quality_part

    return root_name, quality


# --- Voicing transforms ---

def closed_voicing(notes: list[int]) -> list[int]:
    """Keep notes in closest position (default stacked voicing)."""
    return sorted(notes)


def open_voicing(notes: list[int]) -> list[int]:
    """Spread notes across a wider range by raising alternating voices an octave."""
    sorted_notes = sorted(notes)
    result = []
    for i, n in enumerate(sorted_notes):
        result.append(n + 12 if i % 2 == 1 else n)
    return sorted(result)


def drop2_voicing(notes: list[int]) -> list[int]:
    """Drop the second-highest note down an octave."""
    if len(notes) < 3:
        return sorted(notes)
    sorted_notes = sorted(notes)
    second_highest = sorted_notes[-2]
    sorted_notes[-2] = second_highest - 12
    return sorted(sorted_notes)


def drop3_voicing(notes: list[int]) -> list[int]:
    """Drop the third-highest note down an octave."""
    if len(notes) < 4:
        return drop2_voicing(notes)
    sorted_notes = sorted(notes)
    third_highest = sorted_notes[-3]
    sorted_notes[-3] = third_highest - 12
    return sorted(sorted_notes)


VOICING_FUNCTIONS = {
    "closed": closed_voicing,
    "open": open_voicing,
    "drop2": drop2_voicing,
    "drop3": drop3_voicing,
}


def apply_voicing(notes: list[int], voicing: str = "closed") -> list[int]:
    """Apply a voicing transform to a list of MIDI notes."""
    fn = VOICING_FUNCTIONS.get(voicing, closed_voicing)
    return fn(notes)


# --- Humanization ---

def humanize_velocity(base_velocity: int, amount: int = 15) -> int:
    """Add random variation to velocity, clamped to 1-127."""
    offset = random.randint(-amount, amount)
    return max(1, min(127, base_velocity + offset))


def humanize_timing(tick: int, amount: int = 10) -> int:
    """Add random timing offset in ticks, never goes below 0."""
    offset = random.randint(-amount, amount)
    return max(0, tick + offset)


def apply_swing(tick: int, ticks_per_beat: int, swing: float) -> int:
    """
    Apply swing to a tick position.

    swing=0.0 is straight, swing=1.0 is full triplet feel.
    Only offbeats (odd eighth-note positions) are shifted.
    """
    eighth = ticks_per_beat // 2
    if eighth == 0:
        return tick
    position_in_beat = tick % ticks_per_beat
    beat_start = tick - position_in_beat

    if position_in_beat == eighth:
        shift = int(eighth * swing * 0.5)
        return beat_start + eighth + shift
    return tick


def humanize_duration(duration: int, amount: int = 10) -> int:
    """Add random variation to note duration, minimum 1 tick."""
    offset = random.randint(-amount, amount)
    return max(1, duration + offset)
