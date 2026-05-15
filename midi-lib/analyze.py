"""
Audio analysis engine for inspire mode.

Extracts a VibeProfile from a reference audio track using librosa:
key, BPM, chord complexity, rhythmic density, and swing feel.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np

from theory import NOTE_NAMES

CHROMA_LABELS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Major and minor key profiles (Krumhansl-Kessler)
# Weights representing how well each pitch class fits a key
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


@dataclass
class VibeProfile:
    """Extracted characteristics from a reference audio track."""
    key: str
    mode: str
    bpm: int
    chord_complexity: str
    melody_density: str
    swing: float
    source_file: str

    @property
    def key_display(self) -> str:
        return f"{self.key} {self.mode}"


def analyze(audio_path: str | Path) -> VibeProfile:
    """Analyze an audio file and return its vibe profile."""
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)

    bpm = _detect_bpm(y, sr)
    key, mode = _detect_key(y, sr)
    complexity = _estimate_chord_complexity(y, sr)
    density = _estimate_rhythmic_density(y, sr, bpm)
    swing = _estimate_swing(y, sr, bpm)

    return VibeProfile(
        key=key,
        mode=mode,
        bpm=bpm,
        chord_complexity=complexity,
        melody_density=density,
        swing=round(swing, 2),
        source_file=audio_path.name,
    )


def _detect_bpm(y: np.ndarray, sr: int) -> int:
    """Detect tempo using librosa's beat tracker."""
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    if isinstance(tempo, np.ndarray):
        tempo = float(tempo[0])
    return int(round(tempo))


def _detect_key(y: np.ndarray, sr: int) -> tuple[str, str]:
    """Detect musical key using chroma features and key profiles.

    Correlates the average chroma energy against Krumhansl-Kessler
    major and minor profiles for all 12 possible root notes.
    """
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = np.mean(chroma, axis=1)

    best_corr = -1.0
    best_key = "C"
    best_mode = "major"

    for shift in range(12):
        rotated = np.roll(chroma_avg, -shift)

        major_corr = float(np.corrcoef(rotated, MAJOR_PROFILE)[0, 1])
        if major_corr > best_corr:
            best_corr = major_corr
            best_key = CHROMA_LABELS[shift]
            best_mode = "major"

        minor_corr = float(np.corrcoef(rotated, MINOR_PROFILE)[0, 1])
        if minor_corr > best_corr:
            best_corr = minor_corr
            best_key = CHROMA_LABELS[shift]
            best_mode = "minor"

    return best_key, best_mode


def _estimate_chord_complexity(y: np.ndarray, sr: int) -> str:
    """Estimate harmonic complexity from chroma activation density.

    Counts how many pitch classes are active per frame on average.
    More simultaneous pitches = richer harmony.
    """
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    threshold = 0.4 * np.max(chroma)
    active_per_frame = np.sum(chroma > threshold, axis=0)
    avg_active = float(np.mean(active_per_frame))

    if avg_active >= 5.0:
        return "complex"
    elif avg_active >= 3.5:
        return "moderate"
    return "simple"


def _estimate_rhythmic_density(y: np.ndarray, sr: int, bpm: int) -> str:
    """Estimate note density from onset rate relative to tempo."""
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    duration = librosa.get_duration(y=y, sr=sr)

    if duration == 0 or bpm == 0:
        return "medium"

    beats_total = (duration / 60.0) * bpm
    bars = beats_total / 4.0
    if bars == 0:
        return "medium"

    onsets_per_bar = len(onsets) / bars

    if onsets_per_bar >= 8:
        return "busy"
    elif onsets_per_bar >= 4:
        return "medium"
    return "sparse"


def _estimate_swing(y: np.ndarray, sr: int, bpm: int) -> float:
    """Estimate swing amount from offbeat onset timing deviation.

    Compares actual onset times against a straight eighth-note grid.
    Consistently late offbeats indicate swing.
    """
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    if len(onsets) < 4 or bpm == 0:
        return 0.0

    eighth_dur = 30.0 / bpm

    deviations = []
    for onset in onsets:
        grid_pos = onset / eighth_dur
        nearest_eighth = round(grid_pos)
        if nearest_eighth % 2 == 1:
            deviation = (grid_pos - nearest_eighth) * eighth_dur
            deviations.append(deviation)

    if len(deviations) < 3:
        return 0.0

    mean_dev = float(np.mean(deviations))
    swing_estimate = max(0.0, min(1.0, mean_dev / (eighth_dur * 0.33)))
    return round(swing_estimate, 2)
