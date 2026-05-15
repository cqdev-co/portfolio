#!/usr/bin/env python3
"""
MIDI Library Generator CLI.

Generate production-ready MIDI files from genre kits.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

import gen_bass
import gen_chords
import gen_drums
import gen_melody
from analyze import VibeProfile, analyze
from kits import get_kit, list_kits

console = Console()


def cmd_generate(args: argparse.Namespace) -> None:
    """Generate a full kit (chords + drums + bass + melody)."""
    kit = get_kit(args.kit)
    bpm = args.bpm or kit.default_bpm
    key = args.key

    console.print(Panel(
        f"[bold]{kit.description}[/bold]\n"
        f"Key: {key}  |  BPM: {bpm}  |  Kit: {kit.name}",
        title="Generating Full Kit",
    ))

    results = Table(title="Generated Files", show_lines=True)
    results.add_column("Type", style="cyan")
    results.add_column("File", style="green")
    results.add_column("Details", style="dim")

    chord_path = gen_chords.generate(kit, key=key, bpm=bpm, progression_name=args.progression)
    results.add_row("Chords", chord_path.name, f"voicing: {args.voicing or 'random'}")

    drum_path = gen_drums.generate(kit, bpm=bpm, style=args.drum_style)
    results.add_row("Drums", drum_path.name, f"style: {args.drum_style or 'random'}")

    bass_path = gen_bass.generate(kit, key=key, bpm=bpm, progression_name=args.progression, pattern=args.bass_pattern)
    results.add_row("Bass", bass_path.name, f"pattern: {args.bass_pattern or 'random'}")

    melody_path = gen_melody.generate(kit, key=key, bpm=bpm, scale=args.scale, contour=args.contour)
    results.add_row("Melody", melody_path.name, f"contour: {args.contour or 'random'}")

    console.print(results)
    console.print(f"\n[green]Output directory:[/green] {chord_path.parent.parent}")


def cmd_chords(args: argparse.Namespace) -> None:
    """Generate chord progression MIDI."""
    kit = get_kit(args.kit)
    bpm = args.bpm or kit.default_bpm

    path = gen_chords.generate(
        kit, key=args.key, bpm=bpm,
        progression_name=args.progression,
        voicing=args.voicing,
        bars=args.bars,
    )
    console.print(f"[green]Chords:[/green] {path}")


def cmd_drums(args: argparse.Namespace) -> None:
    """Generate drum pattern MIDI."""
    kit = get_kit(args.kit)
    bpm = args.bpm or kit.default_bpm

    path = gen_drums.generate(kit, bpm=bpm, style=args.style, bars=args.bars)
    console.print(f"[green]Drums:[/green] {path}")


def cmd_bass(args: argparse.Namespace) -> None:
    """Generate bassline MIDI."""
    kit = get_kit(args.kit)
    bpm = args.bpm or kit.default_bpm

    path = gen_bass.generate(
        kit, key=args.key, bpm=bpm,
        progression_name=args.progression,
        pattern=args.pattern,
        bars=args.bars,
    )
    console.print(f"[green]Bass:[/green] {path}")


def cmd_melody(args: argparse.Namespace) -> None:
    """Generate melody MIDI."""
    kit = get_kit(args.kit)
    bpm = args.bpm or kit.default_bpm

    path = gen_melody.generate(
        kit, key=args.key, bpm=bpm,
        scale=args.scale,
        contour=args.contour,
        bars=args.bars,
    )
    console.print(f"[green]Melody:[/green] {path}")


def cmd_kits(args: argparse.Namespace) -> None:
    """List available kits or show details for a specific kit."""
    if args.name:
        kit = get_kit(args.name)
        _print_kit_detail(kit)
    else:
        _print_kit_list()


def cmd_analyze(args: argparse.Namespace) -> None:
    """Analyze a reference audio track and display its vibe profile."""
    profile = analyze(args.audio_file)
    _print_vibe_profile(profile)


def cmd_inspire(args: argparse.Namespace) -> None:
    """Analyze a reference track and generate inspired MIDI through a kit."""
    kit = get_kit(args.kit)
    profile = analyze(args.audio_file)

    _print_vibe_profile(profile)

    key = args.key or profile.key
    bpm = args.bpm or profile.bpm
    kit.swing = profile.swing or kit.swing
    kit.melody_density = profile.melody_density

    console.print(Panel(
        f"[bold]{kit.description}[/bold]\n"
        f"Inspired by: {profile.source_file}\n"
        f"Key: {key}  |  BPM: {bpm}  |  Kit: {kit.name}  |  "
        f"Complexity: {profile.chord_complexity}  |  Swing: {kit.swing}",
        title="Generating Inspired Kit",
    ))

    results = Table(title="Generated Files", show_lines=True)
    results.add_column("Type", style="cyan")
    results.add_column("File", style="green")
    results.add_column("Details", style="dim")

    chord_path = gen_chords.generate(kit, key=key, bpm=bpm)
    results.add_row("Chords", chord_path.name, f"complexity: {profile.chord_complexity}")

    drum_path = gen_drums.generate(kit, bpm=bpm)
    results.add_row("Drums", drum_path.name, f"density: {profile.melody_density}")

    bass_path = gen_bass.generate(kit, key=key, bpm=bpm)
    results.add_row("Bass", bass_path.name, f"swing: {kit.swing}")

    melody_path = gen_melody.generate(kit, key=key, bpm=bpm)
    results.add_row("Melody", melody_path.name, f"density: {profile.melody_density}")

    console.print(results)
    console.print(f"\n[green]Output directory:[/green] {chord_path.parent.parent}")


def _print_vibe_profile(profile: VibeProfile) -> None:
    """Display a vibe profile as a rich table."""
    table = Table(title=f"Vibe Profile — {profile.source_file}", show_lines=True)
    table.add_column("Attribute", style="cyan")
    table.add_column("Detected Value", style="bold")

    table.add_row("Key", profile.key_display)
    table.add_row("BPM", str(profile.bpm))
    table.add_row("Chord Complexity", profile.chord_complexity)
    table.add_row("Rhythmic Density", profile.melody_density)
    table.add_row("Swing", str(profile.swing))

    console.print(table)


def _print_kit_list() -> None:
    kits = list_kits()
    table = Table(title="Available Kits")
    table.add_column("Name", style="cyan bold")
    table.add_column("Description")
    table.add_column("BPM Range", justify="center")
    table.add_column("Default BPM", justify="center")

    for kit in sorted(kits, key=lambda k: k.name):
        lo, hi = kit.bpm_range
        table.add_row(kit.name, kit.description, f"{lo}-{hi}", str(kit.default_bpm))

    console.print(table)


def _print_kit_detail(kit) -> None:
    console.print(Panel(
        f"[bold]{kit.description}[/bold]",
        title=f"Kit: {kit.name}",
    ))

    info = Table(show_header=False, box=None, padding=(0, 2))
    info.add_column("Key", style="cyan")
    info.add_column("Value")

    lo, hi = kit.bpm_range
    info.add_row("BPM Range", f"{lo}-{hi}")
    info.add_row("Default BPM", str(kit.default_bpm))
    info.add_row("Swing", str(kit.swing))
    info.add_row("Scales", ", ".join(kit.preferred_scales))
    info.add_row("Voicings", ", ".join(kit.voicings))
    info.add_row("Chord Extensions", ", ".join(kit.chord_extensions))
    info.add_row("Bass Patterns", ", ".join(kit.bass_patterns))
    info.add_row("Melody Scales", ", ".join(kit.melody_scales))
    info.add_row("Melody Density", kit.melody_density)
    console.print(info)

    if kit.progressions:
        prog_table = Table(title="Progressions")
        prog_table.add_column("Name", style="cyan")
        prog_table.add_column("Chords")
        prog_table.add_column("Bars", justify="center")
        for p in kit.progressions:
            prog_table.add_row(p.name, " → ".join(p.chords), str(p.bars))
        console.print(prog_table)

    if kit.drum_patterns:
        drum_table = Table(title="Drum Patterns")
        drum_table.add_column("Name", style="cyan")
        drum_table.add_column("Instruments", justify="center")
        drum_table.add_column("Steps/Bar", justify="center")
        for d in kit.drum_patterns:
            drum_table.add_row(d.name, str(len(d.instruments)), str(d.steps_per_bar))
        console.print(drum_table)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="midi_lib",
        description="Generate production-ready MIDI files from genre kits.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # --- generate (full kit) ---
    p_gen = sub.add_parser("generate", help="Generate a full kit (chords + drums + bass + melody)")
    p_gen.add_argument("--kit", default="rnb", help="Genre kit to use (default: rnb)")
    p_gen.add_argument("--key", default="C", help="Musical key (default: C)")
    p_gen.add_argument("--bpm", type=int, help="Tempo in BPM (default: kit default)")
    p_gen.add_argument("--progression", help="Named progression from kit")
    p_gen.add_argument("--voicing", help="Chord voicing style")
    p_gen.add_argument("--drum-style", help="Drum pattern style")
    p_gen.add_argument("--bass-pattern", help="Bass pattern style")
    p_gen.add_argument("--scale", help="Scale for melody")
    p_gen.add_argument("--contour", help="Melody contour shape")
    p_gen.set_defaults(func=cmd_generate)

    # --- chords ---
    p_chords = sub.add_parser("chords", help="Generate chord progression MIDI")
    p_chords.add_argument("--kit", default="rnb")
    p_chords.add_argument("--key", default="C")
    p_chords.add_argument("--bpm", type=int)
    p_chords.add_argument("--progression", help="Named progression from kit")
    p_chords.add_argument("--voicing", help="Voicing style: closed, open, drop2, drop3")
    p_chords.add_argument("--bars", type=int)
    p_chords.set_defaults(func=cmd_chords)

    # --- drums ---
    p_drums = sub.add_parser("drums", help="Generate drum pattern MIDI")
    p_drums.add_argument("--kit", default="rnb")
    p_drums.add_argument("--bpm", type=int)
    p_drums.add_argument("--style", help="Drum pattern style from kit")
    p_drums.add_argument("--bars", type=int, default=4)
    p_drums.set_defaults(func=cmd_drums)

    # --- bass ---
    p_bass = sub.add_parser("bass", help="Generate bassline MIDI")
    p_bass.add_argument("--kit", default="rnb")
    p_bass.add_argument("--key", default="C")
    p_bass.add_argument("--bpm", type=int)
    p_bass.add_argument("--progression", help="Named progression from kit")
    p_bass.add_argument("--pattern", help="Bass pattern style from kit")
    p_bass.add_argument("--bars", type=int)
    p_bass.set_defaults(func=cmd_bass)

    # --- melody ---
    p_melody = sub.add_parser("melody", help="Generate melody MIDI")
    p_melody.add_argument("--kit", default="rnb")
    p_melody.add_argument("--key", default="C")
    p_melody.add_argument("--bpm", type=int)
    p_melody.add_argument("--scale", help="Scale type for melody")
    p_melody.add_argument("--contour", help="Contour shape: ascending, descending, arch, wave")
    p_melody.add_argument("--bars", type=int, default=4)
    p_melody.set_defaults(func=cmd_melody)

    # --- kits ---
    p_kits = sub.add_parser("kits", help="List available kits or show kit details")
    p_kits.add_argument("name", nargs="?", help="Kit name to show details for")
    p_kits.set_defaults(func=cmd_kits)

    # --- analyze ---
    p_analyze = sub.add_parser("analyze", help="Analyze a reference audio track")
    p_analyze.add_argument("audio_file", help="Path to audio file (mp3, wav, flac)")
    p_analyze.set_defaults(func=cmd_analyze)

    # --- inspire ---
    p_inspire = sub.add_parser("inspire", help="Generate MIDI inspired by a reference track")
    p_inspire.add_argument("audio_file", help="Path to audio file (mp3, wav, flac)")
    p_inspire.add_argument("--kit", default="rnb", help="Genre kit to use (default: rnb)")
    p_inspire.add_argument("--key", default=None, help="Override detected key")
    p_inspire.add_argument("--bpm", type=int, default=None, help="Override detected BPM")
    p_inspire.set_defaults(func=cmd_inspire)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except (ValueError, KeyError, FileNotFoundError) as exc:
        console.print(f"[red]Error:[/red] {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
