# MIDI Library Generator

Genre-kit-driven CLI that generates production-ready MIDI files for Ableton Live (or any DAW). Genre knowledge lives in pluggable kit definitions — R&B ships first, new genres are added by dropping a file into `kits/`.

## Quick Start

```bash
cd midi-lib
pip install -r requirements.txt

# Generate a full R&B kit
python midi_lib.py generate --kit rnb --key C --bpm 90

# Individual generators
python midi_lib.py chords --kit rnb --key Eb --progression soul_turnaround
python midi_lib.py drums --kit rnb --style trapsoul --bpm 85
python midi_lib.py bass --kit rnb --key G --pattern octave_bounce
python midi_lib.py melody --kit rnb --key A --scale pentatonic_minor

# List available kits
python midi_lib.py kits

# Show kit details
python midi_lib.py kits rnb

# Analyze a reference track
python midi_lib.py analyze ~/Music/reference.mp3

# Generate MIDI inspired by a reference track
python midi_lib.py inspire ~/Music/reference.mp3 --kit rnb

# Override the detected key
python midi_lib.py inspire ~/Music/reference.mp3 --kit rnb --key Eb
```

## Features

- **Kit-driven architecture** — generators are genre-agnostic engines; all genre knowledge lives in kit definitions
- **Inspire mode** — analyze a reference audio track to extract key, BPM, chord complexity, rhythmic density, and swing, then generate new MIDI that matches the feel
- **Music theory engine** — scales, chord voicings (closed, open, drop-2, drop-3), extensions (7ths through 13ths)
- **Humanization** — velocity variation, timing nudges, swing/groove to avoid robotic output
- **Four generators** — chords, drums, bass, melodies
- **Rich CLI** — formatted output with file summaries

## Available Kits

| Kit   | Genre          | BPM Range | Drum Styles                          |
| ----- | -------------- | --------- | ------------------------------------ |
| `rnb` | R&B / Neo-Soul | 75-95     | trapsoul, boom_bap, neo_soul_shuffle |

## Output

Generated `.mid` files are organized by type in `output/`:

```
output/
├── chords/    # Chord progression MIDI
├── drums/     # Drum pattern MIDI
├── bass/      # Bassline MIDI
└── melodies/  # Melody MIDI
```

Drag these directly into Ableton Live tracks.

## Adding a New Genre

Create a file in `kits/` that subclasses `Kit`:

```python
# kits/lofi.py
from kits import Kit, DrumPattern, Progression

class LofiKit(Kit):
    name = "lofi"
    description = "Lo-Fi Hip Hop — dusty chords, lazy drums"
    bpm_range = (70, 85)
    default_bpm = 78
    swing = 0.5
    # ... define progressions, drum_patterns, etc.
```

It's immediately available: `python midi_lib.py generate --kit lofi`

## Dependencies

- `mido` — MIDI file I/O
- `rich` — CLI output formatting
- `librosa` — audio analysis for inspire mode
- `numpy` — numerical operations
