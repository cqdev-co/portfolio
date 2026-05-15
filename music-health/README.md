# Music Health

Local macOS utility for auditing Ableton Live plugins and checking installation health. Helps track which audio plugins (VST, VST3, AU, CLAP) you actually own vs. ones that shouldn't be there.

## Setup

```bash
cd music-health
pip install -r requirements.txt
```

## Commands

### Scan Plugins

List all audio plugins installed on the system:

```bash
python music_health.py scan
```

Shows every plugin found across system and user plugin directories, along with type, size, and current ownership status.

### Audit Plugins

Interactively walk through unaudited plugins and mark ownership:

```bash
python music_health.py audit
```

For each plugin you'll choose:

- **[o]wned** - You purchased or legitimately own this plugin
- **[n]ot mine** - Not yours, consider removing
- **[f]actory** - Ships with Ableton Live or macOS
- **[s]kip** - Decide later
- **[q]uit** - Stop and save progress

Progress is saved after each plugin, so you can quit and resume anytime.

### Report

View a summary of all plugins grouped by ownership status:

```bash
python music_health.py report
```

Shows counts, disk usage per category, and flags "Not Mine" plugins for potential cleanup.

### Health Check

Check your Ableton Live installation:

```bash
python music_health.py health
```

Checks:

- Ableton Live installation and version
- Preferences directory
- User Library (presets, templates)
- Crash logs
- Plugin counts and audit status

### Security Scan

Verify code signatures on all plugins using macOS `codesign`:

```bash
python music_health.py security
```

Deduplicates plugins across formats (e.g., Serum as AU + VST + VST3 is checked once) and reports:

- **Signed (valid)** - Valid Apple Developer ID signature, grouped by developer with team IDs
- **Signed (xattr issue)** - Properly signed, but macOS Finder metadata (resource forks) breaks strict verification. Fixable with `sudo xattr -cr <path>`
- **Unsigned** - No code signature (common for older free plugins)
- **Invalid Signature** - Signature failed verification beyond xattr issues (binary may have been modified)
- **Quarantine Flag** - Flagged by macOS Gatekeeper as downloaded from the internet

### Deep Security Assessment

Run a thorough multi-layered security assessment of all plugins:

```bash
python music_health.py assess
```

Goes beyond code signing to check six dimensions per plugin:

- **Code Signing** - Signature validity and developer identity
- **Notarization** - Whether Apple has scanned the plugin for malware (`stapler validate`)
- **Bundle Integrity** - Hidden files, unexpected scripts inside the plugin bundle
- **Linked Libraries** - Non-system dynamic libraries (`otool -L`)
- **Architecture** - Apple Silicon native (arm64) vs. Rosetta 2 (x86_64) vs. legacy (i386)
- **Permissions** - World-writable binaries or unusual file modes

Each plugin receives a risk rating:

- **Low** - Signed, notarized, clean bundle
- **Medium** - Signed but not notarized by Apple (most plugins)
- **High** - Unsigned, invalid signature, or suspicious bundle contents

### Cleanup

Identify and remove plugins that don't support Apple Silicon:

```bash
python music_health.py cleanup
```

Scans all plugins for CPU architecture, then shows a table of non-ARM64 plugins with their architecture (x86_64 Rosetta 2, or legacy i386), all file paths across formats, and total reclaimable disk space. Requires explicit `yes` confirmation before removing anything. Uses `sudo rm -rf` since plugins in `/Library/Audio/Plug-Ins/` are root-owned.

Remove plugins with invalid code signatures instead:

```bash
python music_health.py cleanup --invalid
```

Finds plugins whose signature verification failed (beyond xattr issues) and offers to remove all copies across formats.

After cleanup, restart Ableton Live to rescan plugins.

### Fix Xattr Issues

Auto-clear extended attribute metadata on plugins with resource fork issues:

```bash
python music_health.py fix
```

Finds plugins where `codesign --strict` fails due to `com.apple.FinderInfo` or other Finder metadata, then runs `sudo /usr/bin/xattr -cr` on each to restore clean signature verification. Uses the macOS system binary directly to avoid conflicts with Python-based xattr wrappers (e.g., from pyenv).

### Duplicate Format Detection

Detect plugins installed in multiple formats and remove redundant copies:

```bash
python music_health.py duplicates
```

Many plugins ship as VST + VST3 + AU. This command identifies duplicates and offers to keep only the preferred format (VST3 > AU > CLAP > VST) and remove the rest. Shows reclaimable disk space per plugin.

### Library Analysis

Analyze Ableton's user library disk usage:

```bash
python music_health.py library
```

Scans `~/Music/Ableton/` and breaks down:

- Top-level directory sizes with percentage bars
- User Library sub-category breakdown (presets, samples, etc.)
- Largest file types across the entire library

### Export

Most commands support exporting results to JSON or CSV:

```bash
python music_health.py scan --export json
python music_health.py security --export csv
python music_health.py assess --export json
python music_health.py report --export csv
python music_health.py duplicates --export json
python music_health.py library --export csv
```

Export files are saved to the current directory with a timestamp (e.g., `scan_20260321_143000.json`).

## Plugin Directories Scanned

| Type | System Path                           | User Path                              |
| ---- | ------------------------------------- | -------------------------------------- |
| VST  | `/Library/Audio/Plug-Ins/VST/`        | `~/Library/Audio/Plug-Ins/VST/`        |
| VST3 | `/Library/Audio/Plug-Ins/VST3/`       | `~/Library/Audio/Plug-Ins/VST3/`       |
| AU   | `/Library/Audio/Plug-Ins/Components/` | `~/Library/Audio/Plug-Ins/Components/` |
| CLAP | `/Library/Audio/Plug-Ins/CLAP/`       | `~/Library/Audio/Plug-Ins/CLAP/`       |

## Data

Plugin audit state is stored in `plugin_registry.json` (git-ignored, local to your machine). This file is created automatically on first audit.
