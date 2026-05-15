#!/usr/bin/env python3
"""
Music Health - Ableton plugin auditor and health checker for macOS.

Scans macOS audio plugin directories, tracks plugin ownership,
and checks Ableton Live installation health.
"""

import argparse
import csv
import glob
import json
import os
import plistlib
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

console = Console()

REGISTRY_PATH = Path(__file__).parent / "plugin_registry.json"

PLUGIN_DIRS = {
    "VST": {
        "system": Path("/Library/Audio/Plug-Ins/VST"),
        "user": Path.home() / "Library/Audio/Plug-Ins/VST",
        "ext": ".vst",
    },
    "VST3": {
        "system": Path("/Library/Audio/Plug-Ins/VST3"),
        "user": Path.home() / "Library/Audio/Plug-Ins/VST3",
        "ext": ".vst3",
    },
    "AU": {
        "system": Path("/Library/Audio/Plug-Ins/Components"),
        "user": Path.home() / "Library/Audio/Plug-Ins/Components",
        "ext": ".component",
    },
    "CLAP": {
        "system": Path("/Library/Audio/Plug-Ins/CLAP"),
        "user": Path.home() / "Library/Audio/Plug-Ins/CLAP",
        "ext": ".clap",
    },
}

OWNERSHIP_LABELS = {
    "owned": "[green]Owned[/green]",
    "not_mine": "[red]Not Mine[/red]",
    "factory": "[blue]Factory[/blue]",
    "unknown": "[yellow]Unknown[/yellow]",
}

ABLETON_PATHS = {
    "app": "/Applications",
    "preferences": Path.home() / "Library/Preferences/Ableton",
    "user_library": Path.home() / "Music/Ableton",
    "crash_logs": Path.home() / "Library/Logs/DiagnosticReports",
}


@dataclass
class PluginInfo:
    name: str
    plugin_type: str  # VST, VST3, AU, CLAP
    path: str
    scope: str  # system or user
    size_mb: float
    last_modified: str
    ownership: str = "unknown"  # owned, not_mine, factory, unknown
    audited_at: Optional[str] = None
    notes: str = ""


def get_dir_size_mb(path: Path) -> float:
    total = 0
    if path.is_file():
        return path.stat().st_size / (1024 * 1024)
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total / (1024 * 1024)


@dataclass
class CodesignInfo:
    # "signed", "unsigned", "invalid", "resource_fork" (signed but xattr detritus)
    status: str
    authority: str = ""
    team_id: str = ""
    timestamp: str = ""
    failure_reason: str = ""
    has_quarantine: bool = False


def get_codesign_info(path: str) -> CodesignInfo:
    """Run macOS codesign to get signing details and verify integrity."""
    try:
        result = subprocess.run(
            ["codesign", "-d", "--verbose=2", path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if "not signed" in result.stderr:
            return CodesignInfo(status="unsigned")

        authority = ""
        team_id = ""
        timestamp = ""
        for line in result.stderr.splitlines():
            if line.startswith("Authority=") and not authority:
                authority = line.split("=", 1)[1]
            elif line.startswith("TeamIdentifier="):
                team_id = line.split("=", 1)[1]
            elif line.startswith("Timestamp="):
                timestamp = line.split("=", 1)[1]

        has_quarantine = False
        try:
            xattr_result = subprocess.run(
                ["xattr", path],
                capture_output=True,
                text=True,
                timeout=5,
            )
            has_quarantine = "com.apple.quarantine" in xattr_result.stdout
        except (subprocess.TimeoutExpired, OSError):
            pass

        verify = subprocess.run(
            ["codesign", "-v", "--strict", path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if verify.returncode != 0:
            stderr = verify.stderr
            if "resource fork" in stderr or "detritus" in stderr:
                return CodesignInfo(
                    status="resource_fork",
                    authority=authority,
                    team_id=team_id,
                    timestamp=timestamp,
                    failure_reason="Finder metadata (resource fork / xattr) breaking strict verification",
                    has_quarantine=has_quarantine,
                )
            return CodesignInfo(
                status="invalid",
                authority=authority,
                team_id=team_id,
                timestamp=timestamp,
                failure_reason=stderr.strip().split(": ", 1)[-1] if stderr else "unknown",
                has_quarantine=has_quarantine,
            )

        return CodesignInfo(
            status="signed",
            authority=authority,
            team_id=team_id,
            timestamp=timestamp,
            has_quarantine=has_quarantine,
        )
    except (subprocess.TimeoutExpired, OSError):
        return CodesignInfo(status="unsigned")


RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"

RISK_LABELS = {
    RISK_LOW: "[green]Low[/green]",
    RISK_MEDIUM: "[yellow]Medium[/yellow]",
    RISK_HIGH: "[red]High[/red]",
}


@dataclass
class SecurityAssessment:
    plugin: PluginInfo
    codesign: CodesignInfo
    notarized: bool = False
    has_arm64: bool = False
    has_x86_64: bool = False
    has_i386: bool = False
    hidden_files: list = field(default_factory=list)
    suspicious_files: list = field(default_factory=list)
    non_system_dylibs: list = field(default_factory=list)
    world_writable_binary: bool = False
    risk: str = RISK_LOW
    findings: list = field(default_factory=list)


def check_notarization(path: str) -> bool:
    """Check if a plugin has a stapled notarization ticket."""
    try:
        result = subprocess.run(
            ["stapler", "validate", path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def check_architectures(plugin_path: str) -> tuple[bool, bool, bool]:
    """Check what CPU architectures the binary supports. Returns (arm64, x86_64, i386)."""
    bundle = Path(plugin_path)
    macos_dir = bundle / "Contents" / "MacOS"
    if not macos_dir.exists():
        return False, False, False

    binaries = [f for f in macos_dir.iterdir() if f.is_file()]
    if not binaries:
        return False, False, False

    try:
        result = subprocess.run(
            ["file", str(binaries[0])],
            capture_output=True,
            text=True,
            timeout=5,
        )
        output = result.stdout
        return "arm64" in output, "x86_64" in output, "i386" in output
    except (subprocess.TimeoutExpired, OSError):
        return False, False, False


KNOWN_SAFE_SCRIPTS = {"uninstall.sh", "install.sh", "postinstall.sh", "preinstall.sh"}
KNOWN_SAFE_HIDDEN = {".DS_Store", ".hgignore", ".hgtags", ".gitignore", ".gitkeep"}


def check_bundle_integrity(plugin_path: str) -> tuple[list[str], list[str]]:
    """Check for hidden files and suspicious content inside a plugin bundle."""
    bundle = Path(plugin_path)
    hidden = []
    suspicious = []
    suspect_extensions = {".sh", ".py", ".rb", ".pl", ".command", ".tool", ".app"}

    for root, dirs, files in os.walk(bundle):
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, bundle)

            if name.startswith(".") and name not in KNOWN_SAFE_HIDDEN:
                hidden.append(rel)

            ext = os.path.splitext(name)[1].lower()
            if ext in suspect_extensions and name.lower() not in KNOWN_SAFE_SCRIPTS:
                suspicious.append(rel)

        for name in dirs:
            if name.startswith(".") and name != ".DS_Store":
                full = os.path.join(root, name)
                hidden.append(os.path.relpath(full, bundle))

    return hidden, suspicious


def check_linked_libraries(plugin_path: str) -> list[str]:
    """Check for non-system dynamic libraries the plugin links against."""
    bundle = Path(plugin_path)
    macos_dir = bundle / "Contents" / "MacOS"
    if not macos_dir.exists():
        return []

    binaries = [f for f in macos_dir.iterdir() if f.is_file()]
    if not binaries:
        return []

    try:
        result = subprocess.run(
            ["otool", "-L", str(binaries[0])],
            capture_output=True,
            text=True,
            timeout=5,
        )
        non_system = []
        system_prefixes = (
            "/usr/lib/",
            "/System/",
            "@rpath",
            "@loader_path",
            "@executable_path",
        )
        for line in result.stdout.splitlines()[1:]:
            stripped = line.strip()
            if not stripped.startswith("\t") and not line.startswith("\t"):
                continue
            lib = stripped.split(" (")[0].strip()
            if lib and not any(lib.startswith(p) for p in system_prefixes):
                non_system.append(lib)
        return non_system
    except (subprocess.TimeoutExpired, OSError):
        return []


def check_binary_permissions(plugin_path: str) -> bool:
    """Check if the main binary is world-writable (unusual)."""
    bundle = Path(plugin_path)
    macos_dir = bundle / "Contents" / "MacOS"
    if not macos_dir.exists():
        return False
    for f in macos_dir.iterdir():
        if f.is_file():
            mode = f.stat().st_mode
            if mode & 0o002:
                return True
    return False


def assess_plugin(plugin: PluginInfo, codesign: CodesignInfo) -> SecurityAssessment:
    """Run a full security assessment on a single plugin."""
    assessment = SecurityAssessment(plugin=plugin, codesign=codesign)

    assessment.notarized = check_notarization(plugin.path)
    assessment.has_arm64, assessment.has_x86_64, assessment.has_i386 = (
        check_architectures(plugin.path)
    )
    assessment.hidden_files, assessment.suspicious_files = check_bundle_integrity(
        plugin.path
    )
    assessment.non_system_dylibs = check_linked_libraries(plugin.path)
    assessment.world_writable_binary = check_binary_permissions(plugin.path)

    # Risk scoring
    risk = RISK_LOW
    findings = []

    if codesign.status == "unsigned":
        risk = RISK_HIGH
        findings.append("No code signature")
    elif codesign.status == "invalid":
        risk = RISK_HIGH
        findings.append(f"Invalid signature: {codesign.failure_reason}")
    elif codesign.status == "resource_fork":
        findings.append("Xattr metadata breaking strict verification (fixable)")

    if codesign.has_quarantine:
        findings.append("Quarantine flag set (downloaded from internet)")

    if assessment.notarized:
        findings.append("Notarized by Apple (malware scanned)")
    elif codesign.status in ("signed", "resource_fork"):
        if risk == RISK_LOW:
            risk = RISK_MEDIUM
        findings.append("Not notarized by Apple")
    else:
        findings.append("Not notarized by Apple")

    if assessment.suspicious_files:
        risk = RISK_HIGH
        findings.append(
            f"Suspicious files in bundle: {', '.join(assessment.suspicious_files[:3])}"
        )

    if assessment.hidden_files:
        findings.append(
            f"Hidden files: {', '.join(assessment.hidden_files[:3])}"
        )

    if assessment.non_system_dylibs:
        findings.append(
            f"Non-system libraries: {', '.join(os.path.basename(d) for d in assessment.non_system_dylibs[:3])}"
        )

    if assessment.world_writable_binary:
        findings.append("Binary is world-writable (common for installer-deployed plugins)")

    if not assessment.has_arm64 and assessment.has_i386:
        findings.append("Legacy 32-bit only (i386) - no longer runs on modern macOS")
    elif not assessment.has_arm64:
        findings.append("x86_64 only (runs via Rosetta 2)")

    assessment.risk = risk
    assessment.findings = findings
    return assessment


def scan_plugins() -> list[PluginInfo]:
    """Scan all macOS audio plugin directories and return found plugins."""
    plugins = []

    for ptype, dirs in PLUGIN_DIRS.items():
        for scope in ("system", "user"):
            base = dirs[scope]
            ext = dirs["ext"]
            if not base.exists():
                continue

            for entry in sorted(base.iterdir()):
                if entry.suffix.lower() == ext:
                    stat = entry.stat()
                    plugins.append(
                        PluginInfo(
                            name=entry.stem,
                            plugin_type=ptype,
                            path=str(entry),
                            scope=scope,
                            size_mb=round(get_dir_size_mb(entry), 2),
                            last_modified=datetime.fromtimestamp(
                                stat.st_mtime
                            ).strftime("%Y-%m-%d"),
                        )
                    )

    return plugins


def load_registry() -> dict[str, dict]:
    """Load the plugin registry from disk."""
    if REGISTRY_PATH.exists():
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    return {}


def save_registry(registry: dict[str, dict]) -> None:
    """Save the plugin registry to disk."""
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2, sort_keys=True)


def plugin_key(plugin: PluginInfo) -> str:
    """Unique key for a plugin based on name + type + scope."""
    return f"{plugin.plugin_type}::{plugin.scope}::{plugin.name}"


def merge_with_registry(
    plugins: list[PluginInfo], registry: dict[str, dict]
) -> list[PluginInfo]:
    """Merge scanned plugins with saved registry data."""
    for p in plugins:
        key = plugin_key(p)
        if key in registry:
            p.ownership = registry[key].get("ownership", "unknown")
            p.audited_at = registry[key].get("audited_at")
            p.notes = registry[key].get("notes", "")
    return plugins


def cmd_scan(args: argparse.Namespace) -> None:
    """Scan and display all installed plugins."""
    console.print(
        Panel("[bold]Scanning macOS Audio Plugins...[/bold]", style="cyan")
    )

    plugins = scan_plugins()
    registry = load_registry()
    plugins = merge_with_registry(plugins, registry)

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    table = Table(title=f"Installed Plugins ({len(plugins)} found)")
    table.add_column("Name", style="bold white", max_width=35)
    table.add_column("Type", justify="center")
    table.add_column("Scope", justify="center")
    table.add_column("Size", justify="right")
    table.add_column("Modified", justify="center")
    table.add_column("Status", justify="center")

    type_colors = {"VST": "magenta", "VST3": "cyan", "AU": "green", "CLAP": "yellow"}

    for p in sorted(plugins, key=lambda x: (x.plugin_type, x.name.lower())):
        type_color = type_colors.get(p.plugin_type, "white")
        table.add_row(
            p.name,
            f"[{type_color}]{p.plugin_type}[/{type_color}]",
            "System" if p.scope == "system" else "User",
            f"{p.size_mb:.1f} MB",
            p.last_modified,
            OWNERSHIP_LABELS.get(p.ownership, p.ownership),
        )

    console.print(table)

    counts = {}
    for p in plugins:
        counts[p.ownership] = counts.get(p.ownership, 0) + 1

    summary = " | ".join(
        f"{OWNERSHIP_LABELS.get(k, k)}: {v}" for k, v in sorted(counts.items())
    )
    console.print(f"\n{summary}\n")

    if hasattr(args, "export") and args.export:
        rows = []
        for p in sorted(plugins, key=lambda x: (x.plugin_type, x.name.lower())):
            rows.append({
                "name": p.name,
                "type": p.plugin_type,
                "scope": p.scope,
                "size_mb": round(p.size_mb, 2),
                "last_modified": p.last_modified,
                "ownership": p.ownership,
            })
        _write_export(rows, args.export, "scan")


def cmd_audit(args: argparse.Namespace) -> None:
    """Interactive audit of unaudited plugins."""
    plugins = scan_plugins()
    registry = load_registry()
    plugins = merge_with_registry(plugins, registry)

    unaudited = [p for p in plugins if p.ownership == "unknown"]

    if not unaudited:
        console.print(
            "[green]All plugins have been audited. Run 'scan' to see the full list.[/green]"
        )
        return

    console.print(
        Panel(
            f"[bold]{len(unaudited)} unaudited plugin(s) found.[/bold]\n"
            "For each plugin, choose:\n"
            "  [green][o]wned[/green]    - You purchased/own this\n"
            "  [red][n]ot mine[/red] - Not yours\n"
            "  [blue][f]actory[/blue]  - Ships with Ableton or macOS\n"
            "  [yellow][s]kip[/yellow]     - Decide later\n"
            "  [dim][q]uit[/dim]     - Stop auditing",
            title="Plugin Audit",
            style="cyan",
        )
    )

    audited_count = 0
    for i, p in enumerate(unaudited, 1):
        console.print(f"\n[dim]({i}/{len(unaudited)})[/dim]")

        info_table = Table(show_header=False, box=None, padding=(0, 2))
        info_table.add_column("Key", style="dim")
        info_table.add_column("Value")
        info_table.add_row("Plugin", f"[bold]{p.name}[/bold]")
        info_table.add_row("Type", p.plugin_type)
        info_table.add_row("Scope", "System" if p.scope == "system" else "User")
        info_table.add_row("Path", f"[dim]{p.path}[/dim]")
        info_table.add_row("Size", f"{p.size_mb:.1f} MB")
        info_table.add_row("Modified", p.last_modified)
        console.print(info_table)

        choice = Prompt.ask(
            "\n  Status",
            choices=["o", "n", "f", "s", "q"],
            default="s",
        )

        if choice == "q":
            console.print(f"[dim]Stopped. Audited {audited_count} plugin(s) this session.[/dim]")
            break

        ownership_map = {"o": "owned", "n": "not_mine", "f": "factory", "s": "unknown"}
        ownership = ownership_map[choice]

        if ownership != "unknown":
            p.ownership = ownership
            p.audited_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            key = plugin_key(p)
            registry[key] = {
                "name": p.name,
                "plugin_type": p.plugin_type,
                "scope": p.scope,
                "ownership": p.ownership,
                "audited_at": p.audited_at,
                "notes": p.notes,
            }
            save_registry(registry)
            audited_count += 1
            label = OWNERSHIP_LABELS.get(ownership, ownership)
            console.print(f"  -> Marked as {label}")
    else:
        console.print(
            f"\n[green]Audit complete! Audited {audited_count} plugin(s).[/green]"
        )


def cmd_report(args: argparse.Namespace) -> None:
    """Generate a summary report of all plugins by ownership status."""
    plugins = scan_plugins()
    registry = load_registry()
    plugins = merge_with_registry(plugins, registry)

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    console.print(Panel("[bold]Plugin Ownership Report[/bold]", style="cyan"))

    groups = {"owned": [], "not_mine": [], "factory": [], "unknown": []}
    for p in plugins:
        groups.setdefault(p.ownership, []).append(p)

    total_size = sum(p.size_mb for p in plugins)

    summary_table = Table(title="Summary")
    summary_table.add_column("Category", style="bold")
    summary_table.add_column("Count", justify="right")
    summary_table.add_column("Size", justify="right")

    for category in ("owned", "not_mine", "factory", "unknown"):
        items = groups.get(category, [])
        size = sum(p.size_mb for p in items)
        label = OWNERSHIP_LABELS.get(category, category)
        summary_table.add_row(
            Text.from_markup(label),
            str(len(items)),
            f"{size:.1f} MB",
        )

    summary_table.add_row(
        "[bold]Total[/bold]",
        f"[bold]{len(plugins)}[/bold]",
        f"[bold]{total_size:.1f} MB[/bold]",
    )

    console.print(summary_table)

    for category, label_name in [
        ("owned", "Owned Plugins"),
        ("not_mine", "Not Mine"),
        ("factory", "Factory Plugins"),
        ("unknown", "Unaudited Plugins"),
    ]:
        items = groups.get(category, [])
        if not items:
            continue

        console.print(f"\n[bold]{label_name}[/bold] ({len(items)})")
        for p in sorted(items, key=lambda x: x.name.lower()):
            type_tag = f"[dim]{p.plugin_type}[/dim]"
            console.print(f"  {p.name} {type_tag}")

    if groups.get("not_mine"):
        not_mine_size = sum(p.size_mb for p in groups["not_mine"])
        console.print(
            f"\n[red bold]Plugins marked 'Not Mine' use {not_mine_size:.1f} MB. "
            f"Consider removing them to free up space.[/red bold]"
        )

    if hasattr(args, "export") and args.export:
        rows = []
        for p in sorted(plugins, key=lambda x: (x.ownership, x.name.lower())):
            rows.append({
                "name": p.name,
                "type": p.plugin_type,
                "scope": p.scope,
                "ownership": p.ownership,
                "size_mb": round(p.size_mb, 2),
                "last_modified": p.last_modified,
            })
        _write_export(rows, args.export, "report")


def cmd_security(args: argparse.Namespace) -> None:
    """Security scan - verify code signatures on all plugins."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    # Deduplicate by name: prefer VST3 > AU > VST > CLAP for the check,
    # since the same plugin often ships in multiple formats with the same signature.
    type_priority = {"VST3": 0, "AU": 1, "VST": 2, "CLAP": 3}
    seen: dict[str, PluginInfo] = {}
    for p in sorted(plugins, key=lambda x: type_priority.get(x.plugin_type, 99)):
        if p.name not in seen:
            seen[p.name] = p
    unique_plugins = sorted(seen.values(), key=lambda x: x.name.lower())

    console.print(
        Panel(
            f"[bold]Security Scan[/bold] - checking {len(unique_plugins)} unique plugins "
            f"({len(plugins)} total across formats)",
            style="cyan",
        )
    )

    results: list[tuple[PluginInfo, CodesignInfo]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Verifying signatures...", total=len(unique_plugins))
        for p in unique_plugins:
            progress.update(task, description=f"Checking {p.name[:30]}...")
            info = get_codesign_info(p.path)
            results.append((p, info))
            progress.advance(task)

    signed = [(p, i) for p, i in results if i.status == "signed"]
    unsigned = [(p, i) for p, i in results if i.status == "unsigned"]
    invalid = [(p, i) for p, i in results if i.status == "invalid"]
    resource_fork = [(p, i) for p, i in results if i.status == "resource_fork"]
    quarantined = [(p, i) for p, i in results if i.has_quarantine]

    # Summary table
    summary = Table(title=f"Security Scan Results ({len(unique_plugins)} unique plugins)")
    summary.add_column("Status", style="bold")
    summary.add_column("Count", justify="right")
    summary.add_row("[green]Signed (valid)[/green]", str(len(signed)))
    summary.add_row(
        "[cyan]Signed (xattr issue)[/cyan]",
        str(len(resource_fork)),
    )
    summary.add_row("[yellow]Unsigned[/yellow]", str(len(unsigned)))
    summary.add_row("[red]Invalid Signature[/red]", str(len(invalid)))
    if quarantined:
        summary.add_row("[magenta]Quarantine Flag[/magenta]", str(len(quarantined)))
    console.print(summary)

    # Group signed plugins by developer (include resource_fork as "signed by")
    all_signed = signed + resource_fork
    if all_signed:
        developers: dict[str, list[str]] = {}
        team_ids: dict[str, str] = {}
        for p, info in all_signed:
            dev = info.authority or "Unknown Developer"
            developers.setdefault(dev, []).append(p.name)
            if info.team_id and info.team_id != "not set":
                team_ids[dev] = info.team_id

        dev_table = Table(title=f"Signed Developers ({len(developers)})")
        dev_table.add_column("Developer", style="bold white", max_width=45)
        dev_table.add_column("Team ID", style="dim")
        dev_table.add_column("Plugins", justify="right")

        for dev, names in sorted(
            developers.items(), key=lambda x: len(x[1]), reverse=True
        ):
            dev_table.add_row(
                dev,
                team_ids.get(dev, "-"),
                str(len(names)),
            )

        console.print(dev_table)

    # Show resource fork issues (fixable, not a real security concern)
    if resource_fork:
        console.print(
            f"\n[cyan bold]Xattr / Resource Fork Issues ({len(resource_fork)})[/cyan bold]"
        )
        console.print(
            "[cyan]These plugins are properly signed but have macOS Finder metadata "
            "(resource forks, extended attributes) that break strict signature verification. "
            "This is cosmetic, not a security risk.[/cyan]"
        )
        console.print(
            "[dim]Fix: sudo /usr/bin/xattr -cr <plugin_path>  (or run: python music_health.py fix)[/dim]\n"
        )
        rf_table = Table(show_header=True, padding=(0, 1))
        rf_table.add_column("Plugin", style="bold")
        rf_table.add_column("Type", justify="center")
        rf_table.add_column("Authority")
        rf_table.add_column("Quarantine", justify="center")

        for p, info in sorted(resource_fork, key=lambda x: x[0].name.lower()):
            quarantine_flag = "[magenta]Yes[/magenta]" if info.has_quarantine else "-"
            rf_table.add_row(
                p.name,
                p.plugin_type,
                info.authority or "-",
                quarantine_flag,
            )
        console.print(rf_table)

    # Show unsigned plugins
    if unsigned:
        console.print(f"\n[yellow bold]Unsigned Plugins ({len(unsigned)})[/yellow bold]")
        console.print(
            "[yellow]No code signature. Common for older free plugins.[/yellow]\n"
        )
        unsigned_table = Table(show_header=True, padding=(0, 1))
        unsigned_table.add_column("Plugin", style="bold")
        unsigned_table.add_column("Type", justify="center")
        unsigned_table.add_column("Size", justify="right")
        unsigned_table.add_column("Modified", justify="center")

        for p, _ in sorted(unsigned, key=lambda x: x[0].name.lower()):
            unsigned_table.add_row(
                p.name,
                p.plugin_type,
                f"{p.size_mb:.1f} MB",
                p.last_modified,
            )
        console.print(unsigned_table)

    # Show truly invalid signatures (highest concern)
    if invalid:
        console.print(
            f"\n[red bold]Invalid Signatures ({len(invalid)})[/red bold]"
        )
        console.print(
            "[red]These plugins have signatures that failed verification "
            "for reasons beyond xattr metadata. The binary may have been "
            "modified after signing.[/red]\n"
        )
        invalid_table = Table(show_header=True, padding=(0, 1))
        invalid_table.add_column("Plugin", style="bold red")
        invalid_table.add_column("Type", justify="center")
        invalid_table.add_column("Authority", style="dim")
        invalid_table.add_column("Reason")

        for p, info in sorted(invalid, key=lambda x: x[0].name.lower()):
            invalid_table.add_row(
                p.name,
                p.plugin_type,
                info.authority or "-",
                info.failure_reason or "-",
            )
        console.print(invalid_table)

    if not unsigned and not invalid and not resource_fork:
        console.print(
            "\n[green bold]All plugins are properly signed and verified.[/green bold]"
        )

    if hasattr(args, "export") and args.export:
        rows = []
        for p, info in results:
            rows.append({
                "name": p.name,
                "type": p.plugin_type,
                "status": info.status,
                "authority": info.authority,
                "team_id": info.team_id,
                "timestamp": info.timestamp,
                "failure_reason": info.failure_reason,
                "quarantine": info.has_quarantine,
            })
        _write_export(rows, args.export, "security")


def cmd_assess(args: argparse.Namespace) -> None:
    """Deep security assessment of all plugins."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    type_priority = {"VST3": 0, "AU": 1, "VST": 2, "CLAP": 3}
    seen: dict[str, PluginInfo] = {}
    for p in sorted(plugins, key=lambda x: type_priority.get(x.plugin_type, 99)):
        if p.name not in seen:
            seen[p.name] = p
    unique_plugins = sorted(seen.values(), key=lambda x: x.name.lower())

    console.print(
        Panel(
            f"[bold]Deep Security Assessment[/bold] - {len(unique_plugins)} unique plugins\n"
            "[dim]Checks: code signing, notarization, bundle integrity, "
            "linked libraries, architecture, permissions[/dim]",
            style="cyan",
        )
    )

    assessments: list[SecurityAssessment] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Assessing...", total=len(unique_plugins))
        for p in unique_plugins:
            progress.update(task, description=f"Assessing {p.name[:30]}...")
            codesign = get_codesign_info(p.path)
            assessment = assess_plugin(p, codesign)
            assessments.append(assessment)
            progress.advance(task)

    high = [a for a in assessments if a.risk == RISK_HIGH]
    medium = [a for a in assessments if a.risk == RISK_MEDIUM]
    low = [a for a in assessments if a.risk == RISK_LOW]
    notarized = [a for a in assessments if a.notarized]
    arm64_native = [a for a in assessments if a.has_arm64]

    # Overview
    overview = Table(title="Assessment Overview")
    overview.add_column("Metric", style="bold")
    overview.add_column("Value", justify="right")
    overview.add_row("Total Unique Plugins", str(len(assessments)))
    overview.add_row(f"{RISK_LABELS[RISK_HIGH]} Risk", str(len(high)))
    overview.add_row(f"{RISK_LABELS[RISK_MEDIUM]} Risk", str(len(medium)))
    overview.add_row(f"{RISK_LABELS[RISK_LOW]} Risk", str(len(low)))
    overview.add_row("Notarized by Apple", str(len(notarized)))
    overview.add_row("Apple Silicon Native", str(len(arm64_native)))
    console.print(overview)

    # High risk plugins (detailed)
    if high:
        console.print(
            f"\n[red bold]High Risk Plugins ({len(high)})[/red bold]"
        )
        console.print(
            "[red]These plugins have significant security concerns "
            "and should be investigated.[/red]\n"
        )

        for a in sorted(high, key=lambda x: x.plugin.name.lower()):
            detail = Table(show_header=False, box=None, padding=(0, 2))
            detail.add_column("Key", style="dim", min_width=12)
            detail.add_column("Value")
            detail.add_row("Plugin", f"[bold red]{a.plugin.name}[/bold red]")
            detail.add_row("Type", a.plugin.plugin_type)
            detail.add_row("Path", f"[dim]{a.plugin.path}[/dim]")
            detail.add_row("Size", f"{a.plugin.size_mb:.1f} MB")
            detail.add_row("Modified", a.plugin.last_modified)

            sig_status = a.codesign.status
            if sig_status == "signed":
                detail.add_row("Signature", f"[green]Valid[/green] - {a.codesign.authority}")
            elif sig_status == "unsigned":
                detail.add_row("Signature", "[red]Unsigned[/red]")
            elif sig_status == "invalid":
                detail.add_row("Signature", f"[red]Invalid[/red] - {a.codesign.failure_reason}")
            elif sig_status == "resource_fork":
                detail.add_row("Signature", f"[cyan]Xattr issue[/cyan] - {a.codesign.authority}")

            detail.add_row(
                "Notarized",
                "[green]Yes[/green]" if a.notarized else "[red]No[/red]",
            )

            arch_parts = []
            if a.has_arm64:
                arch_parts.append("arm64")
            if a.has_x86_64:
                arch_parts.append("x86_64")
            if a.has_i386:
                arch_parts.append("i386")
            detail.add_row("Architecture", ", ".join(arch_parts) or "unknown")

            for finding in a.findings:
                detail.add_row("Finding", f"[red]{finding}[/red]")

            console.print(detail)
            console.print("")

    # Medium risk plugins (table)
    if medium:
        console.print(
            f"\n[yellow bold]Medium Risk Plugins ({len(medium)})[/yellow bold]"
        )
        console.print(
            "[yellow]These plugins have minor concerns, typically just missing notarization.[/yellow]\n"
        )

        med_table = Table(show_header=True, padding=(0, 1))
        med_table.add_column("Plugin", style="bold", max_width=30)
        med_table.add_column("Type", justify="center")
        med_table.add_column("Signed", justify="center")
        med_table.add_column("Notarized", justify="center")
        med_table.add_column("ARM64", justify="center")
        med_table.add_column("Findings")

        for a in sorted(medium, key=lambda x: x.plugin.name.lower()):
            signed_icon = "[green]Yes[/green]" if a.codesign.status in ("signed", "resource_fork") else "[red]No[/red]"
            notar_icon = "[green]Yes[/green]" if a.notarized else "[yellow]No[/yellow]"
            arm_icon = "[green]Yes[/green]" if a.has_arm64 else "[yellow]No[/yellow]"
            findings_text = "; ".join(a.findings[:2])
            if len(a.findings) > 2:
                findings_text += f" (+{len(a.findings) - 2} more)"
            med_table.add_row(
                a.plugin.name,
                a.plugin.plugin_type,
                signed_icon,
                notar_icon,
                arm_icon,
                findings_text,
            )
        console.print(med_table)

    # Low risk summary
    if low:
        console.print(
            f"\n[green bold]Low Risk Plugins ({len(low)})[/green bold]"
        )
        console.print(
            "[green]These plugins are properly signed with no significant concerns.[/green]\n"
        )

        low_table = Table(show_header=True, padding=(0, 1))
        low_table.add_column("Plugin", style="bold", max_width=30)
        low_table.add_column("Type", justify="center")
        low_table.add_column("Developer", max_width=35)
        low_table.add_column("Notarized", justify="center")
        low_table.add_column("ARM64", justify="center")

        for a in sorted(low, key=lambda x: x.plugin.name.lower()):
            dev = a.codesign.authority or "-"
            dev = dev.replace("Developer ID Application: ", "")
            notar_icon = "[green]Yes[/green]" if a.notarized else "[dim]No[/dim]"
            arm_icon = "[green]Yes[/green]" if a.has_arm64 else "[dim]No[/dim]"
            low_table.add_row(
                a.plugin.name,
                a.plugin.plugin_type,
                dev,
                notar_icon,
                arm_icon,
            )
        console.print(low_table)

    # Final summary
    console.print(Panel(
        f"[bold]Assessment Complete[/bold]\n\n"
        f"  {RISK_LABELS[RISK_HIGH]} risk: {len(high)} plugins\n"
        f"  {RISK_LABELS[RISK_MEDIUM]} risk: {len(medium)} plugins\n"
        f"  {RISK_LABELS[RISK_LOW]} risk: {len(low)} plugins\n\n"
        f"  Notarized: {len(notarized)}/{len(assessments)}\n"
        f"  Apple Silicon native: {len(arm64_native)}/{len(assessments)}",
        style="cyan",
    ))

    if hasattr(args, "export") and args.export:
        rows = []
        for a in assessments:
            rows.append({
                "name": a.plugin.name,
                "type": a.plugin.plugin_type,
                "risk": a.risk,
                "signature": a.codesign.status,
                "authority": a.codesign.authority,
                "notarized": a.notarized,
                "arm64": a.has_arm64,
                "x86_64": a.has_x86_64,
                "findings": "; ".join(a.findings),
            })
        _write_export(rows, args.export, "assess")


def cmd_cleanup(args: argparse.Namespace) -> None:
    """Identify and remove plugins incompatible with this Mac's architecture."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    # Determine which unique plugins lack arm64
    type_priority = {"VST3": 0, "AU": 1, "VST": 2, "CLAP": 3}
    seen: dict[str, PluginInfo] = {}
    for p in sorted(plugins, key=lambda x: type_priority.get(x.plugin_type, 99)):
        if p.name not in seen:
            seen[p.name] = p

    non_arm64_names: set[str] = set()
    arch_info: dict[str, tuple[bool, bool, bool]] = {}
    for name, p in seen.items():
        arm64, x86, i386 = check_architectures(p.path)
        if not arm64:
            non_arm64_names.add(name)
            arch_info[name] = (arm64, x86, i386)

    if not non_arm64_names:
        console.print(
            "[green bold]All plugins are Apple Silicon native. Nothing to clean up.[/green bold]"
        )
        return

    # Collect ALL copies across formats for non-arm64 plugins
    removable: list[PluginInfo] = []
    for p in plugins:
        if p.name in non_arm64_names:
            removable.append(p)

    total_size = sum(p.size_mb for p in removable)

    console.print(
        Panel(
            f"[bold]Plugin Cleanup[/bold] - {len(non_arm64_names)} plugins without Apple Silicon support\n"
            f"[dim]{len(removable)} files across all formats, {total_size:.0f} MB total[/dim]",
            style="cyan",
        )
    )

    # Show the table grouped by plugin name
    table = Table(title="Non-ARM64 Plugins")
    table.add_column("Plugin", style="bold", max_width=30)
    table.add_column("Architecture")
    table.add_column("Formats")
    table.add_column("Total Size", justify="right")
    table.add_column("Last Modified", justify="center")

    for name in sorted(non_arm64_names, key=str.lower):
        copies = [p for p in removable if p.name == name]
        formats = ", ".join(sorted(set(p.plugin_type for p in copies)))
        size = sum(p.size_mb for p in copies)
        modified = max(p.last_modified for p in copies)

        _, x86, i386 = arch_info[name]
        arch_parts = []
        if x86:
            arch_parts.append("x86_64")
        if i386:
            arch_parts.append("i386")
        arch_str = " + ".join(arch_parts) or "unknown"

        if i386 and not x86:
            arch_display = f"[red]{arch_str}[/red] (cannot run)"
        else:
            arch_display = f"[yellow]{arch_str}[/yellow] (Rosetta 2)"

        table.add_row(
            name,
            arch_display,
            formats,
            f"{size:.0f} MB",
            modified,
        )

    console.print(table)
    console.print(
        f"\n[bold]Total reclaimable space: {total_size:.0f} MB ({total_size / 1024:.1f} GB)[/bold]\n"
    )

    # Show all file paths that would be removed
    console.print("[bold]Files to remove:[/bold]")
    for p in sorted(removable, key=lambda x: (x.name.lower(), x.plugin_type)):
        console.print(f"  [dim]{p.path}[/dim]")

    console.print("")
    confirm = Prompt.ask(
        "[bold red]Remove all listed plugins?[/bold red] This cannot be undone",
        choices=["yes", "no"],
        default="no",
    )

    if confirm != "yes":
        console.print("[dim]Cancelled. No plugins were removed.[/dim]")
        return

    removed = 0
    failed = 0
    freed_mb = 0.0

    for p in removable:
        path = Path(p.path)
        try:
            result = subprocess.run(
                ["sudo", "rm", "-rf", str(path)],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                removed += 1
                freed_mb += p.size_mb
                console.print(f"  [green]Removed[/green] {p.name} ({p.plugin_type})")
            else:
                failed += 1
                console.print(
                    f"  [red]Failed[/red] {p.name} ({p.plugin_type}): {result.stderr.strip()}"
                )
        except Exception as e:
            failed += 1
            console.print(f"  [red]Error[/red] {p.name} ({p.plugin_type}): {e}")

    console.print(
        Panel(
            f"[bold]Cleanup Complete[/bold]\n\n"
            f"  Removed: {removed} files\n"
            f"  Failed: {failed} files\n"
            f"  Space freed: {freed_mb:.0f} MB ({freed_mb / 1024:.1f} GB)",
            style="green" if failed == 0 else "yellow",
        )
    )

    if removed > 0:
        console.print(
            "\n[dim]Tip: Restart Ableton Live to rescan plugins after cleanup.[/dim]"
        )


def cmd_cleanup_invalid(args: argparse.Namespace) -> None:
    """Identify and remove plugins with invalid code signatures."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    type_priority = {"VST3": 0, "AU": 1, "VST": 2, "CLAP": 3}
    seen: dict[str, PluginInfo] = {}
    for p in sorted(plugins, key=lambda x: type_priority.get(x.plugin_type, 99)):
        if p.name not in seen:
            seen[p.name] = p

    invalid_names: set[str] = set()
    invalid_info: dict[str, CodesignInfo] = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Checking signatures...", total=len(seen))
        for name, p in seen.items():
            progress.update(task, description=f"Checking {name[:30]}...")
            info = get_codesign_info(p.path)
            if info.status == "invalid":
                invalid_names.add(name)
                invalid_info[name] = info
            progress.advance(task)

    if not invalid_names:
        console.print(
            "[green bold]No plugins with invalid signatures found.[/green bold]"
        )
        return

    removable: list[PluginInfo] = [p for p in plugins if p.name in invalid_names]
    total_size = sum(p.size_mb for p in removable)

    console.print(
        Panel(
            f"[bold]Invalid Signature Cleanup[/bold] - {len(invalid_names)} plugins with broken signatures\n"
            f"[dim]{len(removable)} files across all formats, {total_size:.0f} MB total[/dim]",
            style="red",
        )
    )

    table = Table(title="Invalid Signature Plugins")
    table.add_column("Plugin", style="bold red", max_width=30)
    table.add_column("Reason")
    table.add_column("Formats")
    table.add_column("Total Size", justify="right")

    for name in sorted(invalid_names, key=str.lower):
        copies = [p for p in removable if p.name == name]
        formats = ", ".join(sorted(set(p.plugin_type for p in copies)))
        size = sum(p.size_mb for p in copies)
        reason = invalid_info[name].failure_reason or "Verification failed"
        table.add_row(name, reason, formats, f"{size:.0f} MB")

    console.print(table)
    console.print(
        f"\n[bold]Total reclaimable space: {total_size:.0f} MB[/bold]\n"
    )

    console.print("[bold]Files to remove:[/bold]")
    for p in sorted(removable, key=lambda x: (x.name.lower(), x.plugin_type)):
        console.print(f"  [dim]{p.path}[/dim]")

    console.print("")
    confirm = Prompt.ask(
        "[bold red]Remove all listed plugins?[/bold red] This cannot be undone",
        choices=["yes", "no"],
        default="no",
    )

    if confirm != "yes":
        console.print("[dim]Cancelled. No plugins were removed.[/dim]")
        return

    removed = 0
    failed = 0
    freed_mb = 0.0

    for p in removable:
        try:
            result = subprocess.run(
                ["sudo", "rm", "-rf", p.path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                removed += 1
                freed_mb += p.size_mb
                console.print(f"  [green]Removed[/green] {p.name} ({p.plugin_type})")
            else:
                failed += 1
                console.print(
                    f"  [red]Failed[/red] {p.name} ({p.plugin_type}): {result.stderr.strip()}"
                )
        except Exception as e:
            failed += 1
            console.print(f"  [red]Error[/red] {p.name} ({p.plugin_type}): {e}")

    console.print(
        Panel(
            f"[bold]Cleanup Complete[/bold]\n\n"
            f"  Removed: {removed} files\n"
            f"  Failed: {failed} files\n"
            f"  Space freed: {freed_mb:.0f} MB",
            style="green" if failed == 0 else "yellow",
        )
    )

    if removed > 0:
        console.print(
            "\n[dim]Tip: Restart Ableton Live to rescan plugins after cleanup.[/dim]"
        )


def cmd_fix(args: argparse.Namespace) -> None:
    """Auto-clear xattr metadata on plugins with resource fork issues."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    type_priority = {"VST3": 0, "AU": 1, "VST": 2, "CLAP": 3}
    seen: dict[str, PluginInfo] = {}
    for p in sorted(plugins, key=lambda x: type_priority.get(x.plugin_type, 99)):
        if p.name not in seen:
            seen[p.name] = p

    affected: list[PluginInfo] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Scanning for xattr issues...", total=len(seen))
        for name, p in seen.items():
            progress.update(task, description=f"Checking {name[:30]}...")
            info = get_codesign_info(p.path)
            if info.status == "resource_fork":
                affected.append(p)
            progress.advance(task)

    if not affected:
        console.print(
            "[green bold]No plugins with xattr issues found. All signatures verify cleanly.[/green bold]"
        )
        return

    console.print(
        Panel(
            f"[bold]Xattr Fix[/bold] - {len(affected)} plugins with resource fork / Finder metadata issues\n"
            "[dim]Running sudo /usr/bin/xattr -cr on each to clear extended attributes[/dim]",
            style="cyan",
        )
    )

    table = Table(title="Plugins to Fix")
    table.add_column("Plugin", style="bold")
    table.add_column("Type", justify="center")
    table.add_column("Path", style="dim", max_width=60)

    for p in sorted(affected, key=lambda x: x.name.lower()):
        table.add_row(p.name, p.plugin_type, p.path)

    console.print(table)
    console.print("")

    confirm = Prompt.ask(
        "[bold cyan]Clear xattr metadata on these plugins?[/bold cyan] (requires sudo)",
        choices=["yes", "no"],
        default="yes",
    )

    if confirm != "yes":
        console.print("[dim]Cancelled.[/dim]")
        return

    fixed = 0
    failed = 0

    for p in affected:
        try:
            # Use /usr/bin/xattr directly - pyenv shims shadow it with
            # a Python wrapper that lacks -r and has different behavior.
            result = subprocess.run(
                ["sudo", "/usr/bin/xattr", "-cr", p.path],
                capture_output=True,
                text=True,
                timeout=60,
            )

            # Verify the fix actually worked via codesign
            verify = subprocess.run(
                ["codesign", "-v", "--strict", p.path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if verify.returncode == 0:
                fixed += 1
                console.print(f"  [green]Fixed[/green] {p.name}")
            elif "resource fork" not in verify.stderr:
                fixed += 1
                console.print(f"  [green]Fixed[/green] {p.name}")
            else:
                failed += 1
                err = result.stderr.strip() or verify.stderr.strip()
                console.print(
                    f"  [red]Failed[/red] {p.name}: {err[:80]}"
                )
        except Exception as e:
            failed += 1
            console.print(f"  [red]Error[/red] {p.name}: {e}")

    console.print(
        Panel(
            f"[bold]Fix Complete[/bold]\n\n"
            f"  Fixed: {fixed} plugins\n"
            f"  Failed: {failed} plugins\n\n"
            "[dim]These plugins should now pass strict codesign verification.[/dim]",
            style="green" if failed == 0 else "yellow",
        )
    )


def cmd_duplicates(args: argparse.Namespace) -> None:
    """Detect plugins installed in multiple formats and offer to remove redundant copies."""
    plugins = scan_plugins()

    if not plugins:
        console.print("[yellow]No plugins found.[/yellow]")
        return

    # Group plugins by name
    by_name: dict[str, list[PluginInfo]] = {}
    for p in plugins:
        by_name.setdefault(p.name, []).append(p)

    duplicates = {name: copies for name, copies in by_name.items() if len(copies) > 1}

    if not duplicates:
        console.print(
            "[green bold]No duplicate-format plugins found. Each plugin exists in a single format.[/green bold]"
        )
        return

    format_preference = ["VST3", "AU", "CLAP", "VST"]

    total_removable_size = 0.0
    removable_plugins: list[PluginInfo] = []
    keep_info: dict[str, PluginInfo] = {}

    for name, copies in duplicates.items():
        # Keep the best format, flag the rest as removable
        copies_sorted = sorted(
            copies,
            key=lambda p: format_preference.index(p.plugin_type) if p.plugin_type in format_preference else 99,
        )
        keep = copies_sorted[0]
        keep_info[name] = keep
        for c in copies_sorted[1:]:
            removable_plugins.append(c)
            total_removable_size += c.size_mb

    console.print(
        Panel(
            f"[bold]Duplicate Format Analysis[/bold] - {len(duplicates)} plugins in multiple formats\n"
            f"[dim]{len(removable_plugins)} redundant copies, "
            f"{total_removable_size:.0f} MB reclaimable (keeping preferred format per plugin)[/dim]",
            style="cyan",
        )
    )

    table = Table(title="Duplicate-Format Plugins")
    table.add_column("Plugin", style="bold", max_width=30)
    table.add_column("Keep", style="green")
    table.add_column("Remove", style="red")
    table.add_column("Reclaimable", justify="right")

    for name in sorted(duplicates.keys(), key=str.lower):
        copies = duplicates[name]
        keep = keep_info[name]
        remove = [c for c in copies if c is not keep]
        remove_formats = ", ".join(c.plugin_type for c in remove)
        remove_size = sum(c.size_mb for c in remove)
        table.add_row(name, keep.plugin_type, remove_formats, f"{remove_size:.0f} MB")

    console.print(table)

    if hasattr(args, "export") and args.export:
        rows = []
        for name in sorted(duplicates.keys(), key=str.lower):
            keep = keep_info[name]
            remove = [c for c in duplicates[name] if c is not keep]
            for c in remove:
                rows.append({
                    "plugin": name,
                    "keep_format": keep.plugin_type,
                    "remove_format": c.plugin_type,
                    "remove_path": c.path,
                    "size_mb": round(c.size_mb, 2),
                })
        _write_export(rows, args.export, "duplicates")
        return

    console.print(
        f"\n[bold]Total reclaimable: {total_removable_size:.0f} MB[/bold]"
    )
    console.print(
        f"[dim]Format preference: {' > '.join(format_preference)} (keeps the first available)[/dim]\n"
    )

    console.print("[bold]Files to remove:[/bold]")
    for p in sorted(removable_plugins, key=lambda x: (x.name.lower(), x.plugin_type)):
        console.print(f"  [dim]{p.path}[/dim]")

    console.print("")
    confirm = Prompt.ask(
        "[bold red]Remove redundant copies?[/bold red] This cannot be undone",
        choices=["yes", "no"],
        default="no",
    )

    if confirm != "yes":
        console.print("[dim]Cancelled. No plugins were removed.[/dim]")
        return

    removed = 0
    failed = 0
    freed_mb = 0.0

    for p in removable_plugins:
        try:
            result = subprocess.run(
                ["sudo", "rm", "-rf", p.path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                removed += 1
                freed_mb += p.size_mb
                console.print(f"  [green]Removed[/green] {p.name} ({p.plugin_type})")
            else:
                failed += 1
                console.print(
                    f"  [red]Failed[/red] {p.name} ({p.plugin_type}): {result.stderr.strip()}"
                )
        except Exception as e:
            failed += 1
            console.print(f"  [red]Error[/red] {p.name} ({p.plugin_type}): {e}")

    console.print(
        Panel(
            f"[bold]Cleanup Complete[/bold]\n\n"
            f"  Removed: {removed} redundant copies\n"
            f"  Failed: {failed}\n"
            f"  Space freed: {freed_mb:.0f} MB",
            style="green" if failed == 0 else "yellow",
        )
    )

    if removed > 0:
        console.print(
            "\n[dim]Tip: Restart Ableton Live to rescan plugins after removing duplicates.[/dim]"
        )


def cmd_library(args: argparse.Namespace) -> None:
    """Analyze Ableton's user library disk usage by category."""
    lib_base = ABLETON_PATHS["user_library"]

    if not lib_base.exists():
        console.print(
            f"[red]Ableton library not found at {lib_base}[/red]"
        )
        return

    console.print(
        Panel(
            f"[bold]Ableton Library Analysis[/bold]\n[dim]{lib_base}[/dim]",
            style="cyan",
        )
    )

    # Top-level directory breakdown
    entries: list[tuple[str, float, int]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        dirs = sorted(
            [d for d in lib_base.iterdir() if d.is_dir()],
            key=lambda d: d.name.lower(),
        )
        task = progress.add_task("Scanning library...", total=len(dirs))
        for d in dirs:
            progress.update(task, description=f"Scanning {d.name[:40]}...")
            size_mb = get_dir_size_mb(d)
            file_count = sum(1 for _ in d.rglob("*") if _.is_file())
            entries.append((d.name, size_mb, file_count))
            progress.advance(task)

    # Also count loose files in root
    loose_files = [f for f in lib_base.iterdir() if f.is_file()]
    if loose_files:
        loose_size = sum(f.stat().st_size for f in loose_files) / (1024 * 1024)
        entries.append(("(loose files)", loose_size, len(loose_files)))

    entries.sort(key=lambda x: x[1], reverse=True)
    total_size = sum(e[1] for e in entries)
    total_files = sum(e[2] for e in entries)

    table = Table(title=f"Library Disk Usage ({total_size / 1024:.1f} GB total)")
    table.add_column("Directory", style="bold", max_width=45)
    table.add_column("Size", justify="right")
    table.add_column("Files", justify="right")
    table.add_column("% of Total", justify="right")
    table.add_column("Bar", min_width=20)

    for name, size_mb, file_count in entries:
        pct = (size_mb / total_size * 100) if total_size > 0 else 0
        bar_len = int(pct / 5)
        bar = "█" * bar_len + "░" * (20 - bar_len)

        if size_mb >= 1024:
            size_str = f"{size_mb / 1024:.1f} GB"
        else:
            size_str = f"{size_mb:.0f} MB"

        if pct >= 30:
            style = "red"
        elif pct >= 10:
            style = "yellow"
        else:
            style = "dim"

        table.add_row(
            name,
            size_str,
            f"{file_count:,}",
            f"{pct:.1f}%",
            f"[{style}]{bar}[/{style}]",
        )

    console.print(table)

    # Deep dive into the largest directories - show sub-categories
    user_lib = lib_base / "User Library"
    if user_lib.exists():
        console.print(f"\n[bold]User Library Breakdown[/bold]")
        sub_entries: list[tuple[str, float, int]] = []
        for d in sorted(user_lib.iterdir()):
            if d.is_dir():
                size_mb = get_dir_size_mb(d)
                file_count = sum(1 for _ in d.rglob("*") if _.is_file())
                sub_entries.append((d.name, size_mb, file_count))

        sub_entries.sort(key=lambda x: x[1], reverse=True)

        sub_table = Table(show_header=True, padding=(0, 1))
        sub_table.add_column("Category", style="bold", max_width=35)
        sub_table.add_column("Size", justify="right")
        sub_table.add_column("Files", justify="right")

        for name, size_mb, file_count in sub_entries:
            if size_mb >= 1024:
                size_str = f"{size_mb / 1024:.1f} GB"
            elif size_mb >= 1:
                size_str = f"{size_mb:.0f} MB"
            else:
                size_str = f"{size_mb * 1024:.0f} KB"
            sub_table.add_row(name, size_str, f"{file_count:,}")

        console.print(sub_table)

    # File type analysis across the entire library
    console.print(f"\n[bold]Largest File Types[/bold]")
    ext_stats: dict[str, tuple[float, int]] = {}
    for f in lib_base.rglob("*"):
        if f.is_file():
            ext = f.suffix.lower() or "(no extension)"
            try:
                size = f.stat().st_size / (1024 * 1024)
            except OSError:
                continue
            current = ext_stats.get(ext, (0.0, 0))
            ext_stats[ext] = (current[0] + size, current[1] + 1)

    sorted_exts = sorted(ext_stats.items(), key=lambda x: x[1][0], reverse=True)[:15]

    ext_table = Table(show_header=True, padding=(0, 1))
    ext_table.add_column("Extension", style="bold")
    ext_table.add_column("Total Size", justify="right")
    ext_table.add_column("Count", justify="right")

    for ext, (size_mb, count) in sorted_exts:
        if size_mb >= 1024:
            size_str = f"{size_mb / 1024:.1f} GB"
        elif size_mb >= 1:
            size_str = f"{size_mb:.0f} MB"
        else:
            size_str = f"{size_mb * 1024:.0f} KB"
        ext_table.add_row(ext, size_str, f"{count:,}")

    console.print(ext_table)

    if hasattr(args, "export") and args.export:
        rows = []
        for name, size_mb, file_count in entries:
            rows.append({
                "directory": name,
                "size_mb": round(size_mb, 2),
                "files": file_count,
                "percent": round((size_mb / total_size * 100) if total_size > 0 else 0, 1),
            })
        _write_export(rows, args.export, "library")

    console.print(
        Panel(
            f"[bold]Library Summary[/bold]\n\n"
            f"  Total size: {total_size / 1024:.1f} GB\n"
            f"  Total files: {total_files:,}\n"
            f"  Top-level directories: {len(entries)}",
            style="cyan",
        )
    )


def _write_export(data: list[dict], fmt: str, prefix: str) -> None:
    """Write export data to JSON or CSV file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if fmt == "json":
        filename = f"{prefix}_{timestamp}.json"
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
    elif fmt == "csv":
        filename = f"{prefix}_{timestamp}.csv"
        if not data:
            console.print("[yellow]No data to export.[/yellow]")
            return
        with open(filename, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
    else:
        console.print(f"[red]Unknown export format: {fmt}[/red]")
        return

    console.print(f"\n[green]Exported to {filename}[/green]")


def find_ableton_installation() -> Optional[Path]:
    """Find the Ableton Live application bundle."""
    app_dir = Path(ABLETON_PATHS["app"])
    matches = sorted(app_dir.glob("Ableton Live*"), reverse=True)
    return matches[0] if matches else None


def get_ableton_version(app_path: Path) -> Optional[str]:
    """Extract version from Ableton's Info.plist."""
    plist_path = app_path / "Contents/Info.plist"
    if not plist_path.exists():
        return None
    try:
        with open(plist_path, "rb") as f:
            plist = plistlib.load(f)
        return plist.get("CFBundleShortVersionString", plist.get("CFBundleVersion"))
    except Exception:
        return None


def cmd_health(args: argparse.Namespace) -> None:
    """Check Ableton Live installation health."""
    console.print(
        Panel("[bold]Ableton Live Health Check[/bold]", style="cyan")
    )

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Check", style="bold", min_width=25)
    table.add_column("Result")

    ableton_path = find_ableton_installation()
    if ableton_path:
        version = get_ableton_version(ableton_path) or "unknown"
        table.add_row(
            "Ableton Live",
            f"[green]Installed[/green] - {ableton_path.name} (v{version})",
        )
        app_size = get_dir_size_mb(ableton_path)
        table.add_row("App Size", f"{app_size:.0f} MB")
    else:
        table.add_row("Ableton Live", "[red]Not found in /Applications[/red]")

    prefs_path = ABLETON_PATHS["preferences"]
    if prefs_path.exists():
        prefs_size = get_dir_size_mb(prefs_path)
        versions = sorted(
            [d.name for d in prefs_path.iterdir() if d.is_dir()], reverse=True
        )
        table.add_row(
            "Preferences",
            f"[green]Found[/green] ({prefs_size:.0f} MB) - {', '.join(versions[:3])}",
        )
    else:
        table.add_row("Preferences", "[yellow]Not found[/yellow]")

    lib_path = ABLETON_PATHS["user_library"]
    if lib_path.exists():
        lib_size = get_dir_size_mb(lib_path)
        table.add_row("User Library", f"[green]Found[/green] ({lib_size:.0f} MB)")

        user_lib = lib_path / "User Library"
        if user_lib.exists():
            presets = list(user_lib.glob("**/*.adv")) + list(user_lib.glob("**/*.adg"))
            table.add_row("User Presets", f"{len(presets)} preset files found")
    else:
        table.add_row("User Library", "[yellow]Not found at ~/Music/Ableton/[/yellow]")

    crash_dir = ABLETON_PATHS["crash_logs"]
    if crash_dir.exists():
        crash_files = list(crash_dir.glob("Ableton*")) + list(
            crash_dir.glob("Live*")
        )
        if crash_files:
            crash_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            latest = datetime.fromtimestamp(
                crash_files[0].stat().st_mtime
            ).strftime("%Y-%m-%d")
            table.add_row(
                "Crash Logs",
                f"[yellow]{len(crash_files)} found[/yellow] (latest: {latest})",
            )
        else:
            table.add_row("Crash Logs", "[green]None found[/green]")
    else:
        table.add_row("Crash Logs", "[green]No crash log directory[/green]")

    plugins = scan_plugins()
    registry = load_registry()
    plugins = merge_with_registry(plugins, registry)

    type_counts = {}
    for p in plugins:
        type_counts[p.plugin_type] = type_counts.get(p.plugin_type, 0) + 1

    plugin_summary = ", ".join(
        f"{count} {ptype}" for ptype, count in sorted(type_counts.items())
    )
    table.add_row("Plugins Installed", plugin_summary or "None")

    unknown_count = sum(1 for p in plugins if p.ownership == "unknown")
    if unknown_count:
        table.add_row(
            "Unaudited Plugins",
            f"[yellow]{unknown_count} plugins need audit[/yellow]",
        )
    else:
        table.add_row("Unaudited Plugins", "[green]All audited[/green]")

    console.print(table)


def _add_export_arg(subparser: argparse.ArgumentParser) -> None:
    """Add the --export flag to a subparser."""
    subparser.add_argument(
        "--export",
        choices=["json", "csv"],
        help="Export results to JSON or CSV file",
    )


def main():
    parser = argparse.ArgumentParser(
        description="Music Health - Ableton plugin auditor & health checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
        "  python music_health.py scan             Scan all installed plugins\n"
        "  python music_health.py audit            Interactively audit plugins\n"
        "  python music_health.py report           Plugin ownership report\n"
        "  python music_health.py health           Ableton installation health check\n"
        "  python music_health.py security         Code signature security scan\n"
        "  python music_health.py assess           Deep security assessment\n"
        "  python music_health.py cleanup          Remove non-ARM64 plugins\n"
        "  python music_health.py cleanup --invalid  Remove invalid-signature plugins\n"
        "  python music_health.py fix              Auto-fix xattr issues\n"
        "  python music_health.py duplicates       Detect duplicate-format plugins\n"
        "  python music_health.py library          Analyze Ableton library disk usage\n"
        "  python music_health.py scan --export json  Export scan results to JSON\n",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    sp_scan = subparsers.add_parser("scan", help="Scan and list all installed audio plugins")
    _add_export_arg(sp_scan)

    subparsers.add_parser("audit", help="Interactively audit unaudited plugins")

    sp_report = subparsers.add_parser("report", help="Generate plugin ownership report")
    _add_export_arg(sp_report)

    subparsers.add_parser("health", help="Ableton Live installation health check")

    sp_security = subparsers.add_parser("security", help="Code signature security scan")
    _add_export_arg(sp_security)

    sp_assess = subparsers.add_parser("assess", help="Deep security assessment (signing, notarization, bundle integrity)")
    _add_export_arg(sp_assess)

    sp_cleanup = subparsers.add_parser("cleanup", help="Remove plugins incompatible with Apple Silicon")
    sp_cleanup.add_argument(
        "--invalid",
        action="store_true",
        help="Remove plugins with invalid code signatures instead of non-ARM64",
    )

    subparsers.add_parser("fix", help="Auto-clear xattr metadata on affected plugins")

    sp_duplicates = subparsers.add_parser("duplicates", help="Detect and remove duplicate-format plugins")
    _add_export_arg(sp_duplicates)

    sp_library = subparsers.add_parser("library", help="Analyze Ableton library disk usage")
    _add_export_arg(sp_library)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "cleanup" and args.invalid:
        cmd_cleanup_invalid(args)
        return

    commands = {
        "scan": cmd_scan,
        "audit": cmd_audit,
        "report": cmd_report,
        "health": cmd_health,
        "security": cmd_security,
        "assess": cmd_assess,
        "cleanup": cmd_cleanup,
        "fix": cmd_fix,
        "duplicates": cmd_duplicates,
        "library": cmd_library,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
