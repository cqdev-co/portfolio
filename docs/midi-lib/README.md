# MIDI Library Generator — Technical Documentation

## Overview

A genre-kit-driven Python CLI that generates production-ready MIDI files (chords, drums, bass, melodies) for import into Ableton Live or any DAW. Genre-specific knowledge lives in pluggable kit definitions — the generators themselves are genre-agnostic engines.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     midi_lib.py (CLI)                        │
│  argparse → kit loader → generator dispatch → rich output   │
└──────┬───────────┬──────────────────────────┬───────────────┘
       │           │                          │
┌──────▼──────┐ ┌──▼───────────┐    ┌─────────▼─────────┐
│ Kit System  │ │ analyze.py   │    │    Generators      │
│ kits/       │ │ (librosa)    │    │  gen_chords.py     │
│ __init__.py │◄│ VibeProfile  │───►│  gen_drums.py      │
│ rnb.py      │ │ key, bpm,    │    │  gen_bass.py       │
│ (future...) │ │ complexity,  │    │  gen_melody.py     │
│             │ │ density,     │    │                    │
│             │ │ swing        │    │                    │
└─────────────┘ └──────────────┘    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │    theory.py       │
                                    │  Scales, chords,   │
                                    │  voicings, swing,  │
                                    │  humanization      │
                                    └───────────────────┘
```

### Data Flow

**Standard generation:**

1. CLI parses arguments and loads a kit by name
2. Kit provides genre-specific configuration (scales, progressions, patterns, swing, etc.)
3. Generator receives kit config + user overrides (key, BPM, etc.)
4. Generator uses theory.py for music theory operations (note math, voicings, humanization)
5. Generator writes MIDI via `mido` to `output/<type>/`

**Inspire mode:**

1. CLI loads a reference audio file (mp3/wav/flac)
2. `analyze.py` extracts a `VibeProfile` via librosa (key, BPM, chord complexity, rhythmic density, swing)
3. VibeProfile overrides kit defaults (key, BPM, swing, melody density)
4. Generators run with the profile-informed parameters, producing new MIDI that matches the reference's feel

## Module Reference

### theory.py — Music Theory Engine

Pure music theory with no genre opinions.

**Scales** (via `SCALE_INTERVALS`):

- Major, natural/harmonic/melodic minor
- Dorian, mixolydian, lydian, phrygian
- Pentatonic (major/minor), blues, whole tone

**Chord types** (via `CHORD_INTERVALS`):

- Triads: maj, min, dim, aug, sus2, sus4
- Sevenths: maj7, min7, dom7, dim7, half_dim7, min_maj7, aug7
- Extensions: add9, maj9, min9, dom9, maj11, min11, dom11, maj13, min13, dom13

**Voicings** (via `VOICING_FUNCTIONS`):

- `closed` — notes in closest position
- `open` — alternating voices raised an octave
- `drop2` — second-highest note dropped an octave
- `drop3` — third-highest note dropped an octave

**Humanization**:

- `humanize_velocity(base, amount)` — random velocity variation
- `humanize_timing(tick, amount)` — random timing offset
- `humanize_duration(duration, amount)` — random duration variation
- `apply_swing(tick, ticks_per_beat, swing)` — offbeat shift (0.0 straight → 1.0 full triplet)

**Roman numeral parsing**:

- `parse_roman_chord("ii7", "C")` → `("D", "min7")`
- `parse_roman_chord("V7", "C")` → `("G", "dom7")`
- Supports flat/sharp alterations: `bVII7`, `#IV`

### analyze.py — Audio Analysis Engine (Inspire Mode)

Uses `librosa` to extract a `VibeProfile` from a reference audio track.

**VibeProfile dataclass:**

| Field              | Type  | Description                           |
| ------------------ | ----- | ------------------------------------- |
| `key`              | str   | Detected musical key (e.g. "C", "F#") |
| `mode`             | str   | "major" or "minor"                    |
| `bpm`              | int   | Detected tempo                        |
| `chord_complexity` | str   | "simple", "moderate", or "complex"    |
| `melody_density`   | str   | "sparse", "medium", or "busy"         |
| `swing`            | float | Estimated swing amount (0.0–1.0)      |
| `source_file`      | str   | Original filename                     |

**Detection methods:**

- **Key detection**: Chroma CQT features correlated against Krumhansl-Kessler major/minor key profiles across all 12 roots
- **BPM**: `librosa.beat.beat_track()` tempo estimation
- **Chord complexity**: Average count of active chroma bins per frame — more simultaneous pitch classes = richer harmony
- **Rhythmic density**: Onset detection rate per bar — mapped to sparse (< 4/bar), medium (4-7/bar), busy (8+/bar)
- **Swing**: Timing deviation of offbeat onsets from a straight eighth-note grid

### kits/ — Kit System

**Base class** (`Kit`): Defines all configurable attributes a genre kit can set.

| Attribute          | Type              | Purpose                                  |
| ------------------ | ----------------- | ---------------------------------------- |
| `name`             | str               | Kit identifier for CLI                   |
| `description`      | str               | Human-readable description               |
| `bpm_range`        | tuple[int, int]   | Valid tempo range                        |
| `default_bpm`      | int               | Default tempo                            |
| `preferred_scales` | list[str]         | Scale types for the genre                |
| `voicings`         | list[str]         | Voicing styles to use                    |
| `chord_extensions` | list[str]         | Chord quality preferences                |
| `progressions`     | list[Progression] | Named chord progressions                 |
| `chord_rhythm`     | str               | Rhythm pattern (whole, syncopated, half) |
| `drum_patterns`    | list[DrumPattern] | Step-sequencer patterns                  |
| `swing`            | float             | Swing amount (0.0–1.0)                   |
| `bass_patterns`    | list[str]         | Bass pattern types                       |
| `bass_octave`      | int               | Octave for bass notes                    |
| `melody_scales`    | list[str]         | Scale preferences for melodies           |
| `melody_octave`    | int               | Octave for melody notes                  |
| `melody_density`   | str               | Note density (sparse/medium/busy)        |

**Auto-discovery**: All `.py` files in `kits/` that define a `Kit` subclass with a non-empty `name` are automatically registered at import time.

### Generators

All generators follow the same pattern:

1. Accept a `Kit` instance + optional parameter overrides
2. Read genre config from the kit
3. Generate MIDI events using theory.py
4. Write a `.mid` file to the appropriate output subdirectory
5. Return the output `Path`

| Generator       | Kit Config Used                                     | Output             |
| --------------- | --------------------------------------------------- | ------------------ |
| `gen_chords.py` | progressions, voicings, chord_rhythm, swing         | `output/chords/`   |
| `gen_drums.py`  | drum_patterns, swing                                | `output/drums/`    |
| `gen_bass.py`   | progressions, bass_patterns, bass_octave, swing     | `output/bass/`     |
| `gen_melody.py` | melody_scales, melody_octave, melody_density, swing | `output/melodies/` |

## CLI Reference

```
midi_lib.py <command> [options]
```

### Commands

| Command    | Description                                          |
| ---------- | ---------------------------------------------------- |
| `generate` | Generate a full kit (all four MIDI files)            |
| `chords`   | Generate chord progression only                      |
| `drums`    | Generate drum pattern only                           |
| `bass`     | Generate bassline only                               |
| `melody`   | Generate melody only                                 |
| `kits`     | List kits or show kit details                        |
| `analyze`  | Analyze a reference audio track (show vibe profile)  |
| `inspire`  | Analyze a reference track and generate inspired MIDI |

### Common Options

| Option   | Default     | Description      |
| -------- | ----------- | ---------------- |
| `--kit`  | `rnb`       | Genre kit to use |
| `--key`  | `C`         | Musical key      |
| `--bpm`  | Kit default | Tempo in BPM     |
| `--bars` | 4           | Number of bars   |

### Generator-Specific Options

| Command   | Option          | Description                                        |
| --------- | --------------- | -------------------------------------------------- |
| `chords`  | `--progression` | Named progression from kit                         |
| `chords`  | `--voicing`     | Voicing style (closed/open/drop2/drop3)            |
| `drums`   | `--style`       | Drum pattern name from kit                         |
| `bass`    | `--progression` | Named progression from kit                         |
| `bass`    | `--pattern`     | Bass pattern style from kit                        |
| `melody`  | `--scale`       | Scale type for melody                              |
| `melody`  | `--contour`     | Contour shape (ascending/descending/arch/wave)     |
| `analyze` | `audio_file`    | Path to audio file (mp3/wav/flac) — positional arg |
| `inspire` | `audio_file`    | Path to audio file (mp3/wav/flac) — positional arg |
| `inspire` | `--kit`         | Genre kit to use (default: rnb)                    |
| `inspire` | `--key`         | Override detected key                              |
| `inspire` | `--bpm`         | Override detected BPM                              |

## How to Add a Genre Kit

1. Create a new file in `kits/`, e.g. `kits/lofi.py`
2. Import the base classes: `from kits import Kit, DrumPattern, Progression`
3. Define a class that subclasses `Kit` and sets a non-empty `name`
4. Populate all genre-specific attributes

```python
# kits/lofi.py
from kits import DrumPattern, Kit, Progression

class LofiKit(Kit):
    name = "lofi"
    description = "Lo-Fi Hip Hop — dusty chords, lazy drums"
    bpm_range = (70, 85)
    default_bpm = 78
    preferred_scales = ["minor", "dorian", "pentatonic_minor"]
    voicings = ["closed", "drop2"]
    chord_extensions = ["maj7", "min7", "dom9"]
    swing = 0.5
    melody_density = "sparse"
    # ... progressions, drum_patterns, bass_patterns
```

The kit is immediately usable: `python midi_lib.py generate --kit lofi`

## Dependencies

| Package   | Purpose                                                     |
| --------- | ----------------------------------------------------------- |
| `mido`    | MIDI file reading and writing                               |
| `rich`    | CLI output formatting                                       |
| `librosa` | Audio analysis for inspire mode (key, BPM, onset detection) |
| `numpy`   | Numerical operations (librosa dependency)                   |

## File Output Convention

```
output/
├── chords/    {kit}_{key}_{progression}_{bpm}bpm_chords.mid
├── drums/     {kit}_{style}_{bpm}bpm_drums.mid
├── bass/      {kit}_{key}_{progression}_{pattern}_{bpm}bpm_bass.mid
└── melodies/  {kit}_{key}_{scale}_{contour}_{bpm}bpm_melody.mid
```

All output is gitignored. Files are designed to be dragged directly into Ableton Live tracks.
