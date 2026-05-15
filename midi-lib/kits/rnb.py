"""R&B / Neo-Soul genre kit."""

from kits import DrumPattern, Kit, Progression

GM_KICK = 36
GM_SNARE = 38
GM_CLAP = 39
GM_CLOSED_HH = 42
GM_OPEN_HH = 46
GM_RIDE = 51
GM_CRASH = 49
GM_RIMSHOT = 37
GM_SHAKER = 70


def _v(base: int, spread: int = 10) -> int:
    """Shorthand for velocity values in pattern definitions."""
    return base


class RnbKit(Kit):
    name = "rnb"
    description = "R&B / Neo-Soul — 7ths, 9ths, lush voicings, groove-heavy drums"

    bpm_range = (75, 95)
    default_bpm = 85

    preferred_scales = ["natural_minor", "dorian", "mixolydian", "pentatonic_minor"]
    voicings = ["closed", "drop2", "open"]

    chord_extensions = ["maj7", "min7", "dom7", "min9", "maj9", "dom9", "min11", "dom13", "sus2", "add9"]
    chord_rhythm = "syncopated"

    progressions = [
        Progression(
            name="classic_ii_V_I",
            chords=["ii7", "V7", "Imaj7", "Imaj7"],
            bars=4,
        ),
        Progression(
            name="soul_turnaround",
            chords=["Imaj7", "vi7", "ii7", "V7"],
            bars=4,
        ),
        Progression(
            name="neo_soul_cycle",
            chords=["iii7", "vi7", "ii7", "V7"],
            bars=4,
        ),
        Progression(
            name="rnb_ballad",
            chords=["Imaj7", "iii7", "vi7", "IV7"],
            bars=4,
        ),
        Progression(
            name="gospel_flavor",
            chords=["IVmaj7", "iii7", "vi7", "ii7"],
            bars=4,
        ),
        Progression(
            name="minor_vibe",
            chords=["i7", "iv7", "bVII7", "bVI7"],
            bars=4,
        ),
    ]

    swing = 0.3

    bass_patterns = ["root_fifth", "octave_bounce", "chromatic_approach"]
    bass_octave = 2

    melody_scales = ["pentatonic_minor", "blues", "dorian"]
    melody_octave = 5
    melody_density = "sparse"

    drum_patterns = [
        DrumPattern(
            name="trapsoul",
            steps_per_bar=16,
            instruments={
                GM_KICK:      [(0, 100), (3, 70), (7, 90), (10, 80)],
                GM_SNARE:     [(4, 110), (12, 110)],
                GM_CLOSED_HH: [(i, 90 if i % 2 == 0 else 60) for i in range(16)],
                GM_OPEN_HH:   [(6, 75), (14, 75)],
            },
        ),
        DrumPattern(
            name="boom_bap",
            steps_per_bar=16,
            instruments={
                GM_KICK:      [(0, 110), (5, 80), (9, 100), (10, 70)],
                GM_SNARE:     [(4, 120), (12, 120)],
                GM_CLOSED_HH: [(i, 80) for i in range(0, 16, 2)],
                GM_OPEN_HH:   [(14, 80)],
            },
        ),
        DrumPattern(
            name="neo_soul_shuffle",
            steps_per_bar=16,
            instruments={
                GM_KICK:      [(0, 95), (6, 85), (10, 90)],
                GM_SNARE:     [(4, 100), (12, 100)],
                GM_RIMSHOT:   [(4, 75), (12, 75)],
                GM_CLOSED_HH: [(0, 85), (2, 55), (4, 85), (6, 55),
                               (8, 85), (10, 55), (12, 85), (14, 55)],
                GM_SHAKER:    [(i, 50) for i in range(0, 16, 2)],
            },
        ),
    ]
