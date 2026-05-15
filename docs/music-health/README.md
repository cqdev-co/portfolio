# Music Health

Personal macOS utility for auditing Ableton Live plugins and checking installation health.

## Overview

When producing music with Ableton Live, plugin collections can grow and become hard to track. Music Health scans all standard macOS audio plugin directories, lets you interactively mark which plugins you own, and generates reports to help you clean up.

## Architecture

```
music_health.py (CLI)
├── scan       → Scans /Library/Audio/Plug-Ins/ and ~/Library/Audio/Plug-Ins/
├── audit      → Interactive ownership tagging, saves to plugin_registry.json
├── report     → Aggregated ownership report with disk usage
├── health     → Ableton installation, preferences, library, and crash log checks
├── security   → Code signature verification via macOS codesign
├── assess     → Deep multi-layered security assessment with risk scoring
├── cleanup    → Remove non-ARM64 plugins (--invalid for broken signatures)
├── fix        → Auto-clear xattr metadata on affected plugins
├── duplicates → Detect and remove duplicate-format plugins
└── library    → Analyze Ableton user library disk usage
```

## Plugin Scanning

The script scans four plugin formats across system and user directories:

- **VST** (`.vst`) - Legacy format, still widely used
- **VST3** (`.vst3`) - Modern Steinberg format
- **AU / Audio Units** (`.component`) - Apple's native format, required by Logic/GarageBand
- **CLAP** (`.clap`) - Newer open-standard format

Each plugin is identified by a composite key: `{type}::{scope}::{name}` (e.g., `VST3::system::Serum`).

## Audit Workflow

1. Run `python music_health.py audit`
2. For each unaudited plugin, choose: **owned**, **not mine**, **factory**, or **skip**
3. State saves to `plugin_registry.json` after each choice
4. Re-running audit only shows new or skipped plugins

Ownership categories:

- **Owned** - Purchased or legitimately obtained
- **Not Mine** - Should be removed
- **Factory** - Ships with Ableton Live or macOS
- **Unknown** - Not yet audited

## Security Scan

The `security` command uses macOS `codesign` and `xattr` to verify every plugin's code signature and check for extended attributes:

- **`codesign -d --verbose=2`** - Extracts signing authority, team identifier, and timestamp
- **`codesign -v --strict`** - Verifies signature integrity (detects tampered binaries)
- **`xattr`** - Checks for quarantine flags and Finder metadata

Plugins are deduplicated by name before scanning (the same plugin in VST/VST3/AU formats shares the same signature), checking the VST3 version first. Results are categorized as:

- **Signed (valid)** - Valid Developer ID signature, passes strict verification
- **Signed (xattr issue)** - Properly signed, but macOS Finder metadata (resource forks / `com.apple.FinderInfo`) breaks strict verification. Benign and fixable with `sudo xattr -cr <path>`
- **Unsigned** - No code signature at all (common for older free plugins)
- **Invalid** - Signature failed verification beyond xattr issues (binary may have been modified)
- **Quarantine Flag** - `com.apple.quarantine` attribute present (downloaded from internet, flagged by Gatekeeper)

Signed plugins (including xattr-affected ones) are grouped by developer with team IDs. Each category is shown with actionable context.

## Deep Security Assessment

The `assess` command performs a thorough per-plugin security assessment using six checks:

- **Code Signing** (`codesign`) - Same as `security` command
- **Notarization** (`stapler validate`) - Checks for a stapled Apple notarization ticket, meaning Apple has scanned the binary for malware
- **Bundle Integrity** - Walks the plugin bundle looking for hidden files (dotfiles) and unexpected scripts (`.sh`, `.py`, etc.). Known-safe patterns like `uninstall.sh` in `Contents/Resources/` are whitelisted
- **Linked Libraries** (`otool -L`) - Extracts dynamic library dependencies and flags any non-system libraries (those not under `/usr/lib/`, `/System/`, or using `@rpath`)
- **Architecture** (`file`) - Checks for arm64 (Apple Silicon native), x86_64 (Intel/Rosetta 2), and i386 (legacy 32-bit, can't run on modern macOS)
- **Permissions** - Flags world-writable binaries (common for installer-deployed plugins but noted for awareness)

Risk scoring:

- **Low** - Properly signed and notarized by Apple
- **Medium** - Signed by a developer but not notarized (the majority of audio plugins)
- **High** - Unsigned, invalid signature, or suspicious files found in bundle

## Plugin Cleanup

The `cleanup` command identifies plugins that lack Apple Silicon (arm64) support and removes them:

1. Scans all plugins and checks CPU architecture via `file` command
2. Identifies non-arm64 plugins (x86_64 running through Rosetta 2, or legacy i386 that can't run at all)
3. Finds ALL copies across formats (a plugin like "Vital" may exist as AU + VST + VST3)
4. Shows total reclaimable disk space
5. Lists every file path that would be removed
6. Requires explicit "yes" confirmation before deletion
7. Uses `sudo rm -rf` since `/Library/Audio/Plug-Ins/` is root-owned

Some plugins in the non-arm64 list may have newer versions available with Apple Silicon support (e.g., Vital, Massive X, Reaktor 6). Check the developer's website before removing if you still use the plugin.

### Invalid Signature Cleanup

The `cleanup --invalid` variant targets plugins with broken code signatures:

1. Runs `codesign -v --strict` on each unique plugin
2. Identifies plugins where verification fails for reasons beyond xattr metadata (actual signature corruption or binary modification)
3. Collects all copies across formats for each invalid plugin
4. Shows failure reasons and reclaimable space
5. Requires "yes" confirmation, then removes with `sudo rm -rf`

## Xattr Fix

The `fix` command auto-repairs plugins where macOS Finder metadata (resource forks, `com.apple.FinderInfo` extended attributes) causes `codesign --strict` to fail:

1. Scans all plugins and runs `codesign -v --strict` to identify `resource_fork` status
2. Lists affected plugins
3. Runs `sudo xattr -cr <path>` on each to clear the extended attributes
4. After fixing, these plugins should pass strict codesign verification

This is a cosmetic fix - the plugins were properly signed, but macOS added metadata after installation that breaks the strict check.

Note: The tool uses `/usr/bin/xattr` directly (the macOS system binary with `-cr` recursive support) rather than whichever `xattr` is in `$PATH`. Python environments like pyenv install a Python-based `xattr` wrapper that lacks the `-r` flag and behaves differently.

## Duplicate Format Detection

The `duplicates` command identifies plugins installed in multiple formats (e.g., Serum as VST + VST3 + AU):

- Groups all plugins by name
- Applies format preference: VST3 > AU > CLAP > VST (keeps the first available)
- Marks remaining copies as removable
- Shows per-plugin reclaimable space
- Requires confirmation before removal

Most DAWs (including Ableton) only need one format. VST3 is preferred as it's the modern standard with better resource handling and preset management.

## Library Disk Usage Analysis

The `library` command analyzes `~/Music/Ableton/`:

- **Top-level breakdown** - Each directory's size, file count, and percentage bar
- **User Library sub-categories** - Presets, samples, racks, etc.
- **File type analysis** - The 15 largest file extensions by total size

Useful for identifying where disk space is being consumed and finding large sample packs or unused content.

## Export

Commands supporting `--export json` or `--export csv`:

- `scan` - Plugin list with name, type, scope, size, ownership
- `report` - Same data grouped by ownership
- `security` - Signature status, authority, team ID, quarantine
- `assess` - Risk level, signature, notarization, architecture, findings
- `duplicates` - Keep/remove format pairs with sizes
- `library` - Directory sizes, file counts, percentages

Files are written to the current directory with a timestamp prefix (e.g., `assess_20260321_143000.json`).

## Ableton Health Check

The `health` command inspects:

- **Installation** - Detects Ableton Live in `/Applications/`, reads version from `Info.plist`
- **Preferences** - Checks `~/Library/Preferences/Ableton/` for config versions
- **User Library** - Scans `~/Music/Ableton/` for presets (`.adv`, `.adg` files)
- **Crash Logs** - Looks for Ableton-related reports in `~/Library/Logs/DiagnosticReports/`
- **Plugin Summary** - Total counts by type and audit status

## Data Storage

Plugin audit state is persisted in `music-health/plugin_registry.json` (local only, git-ignored). Format:

```json
{
  "VST3::system::Serum": {
    "name": "Serum",
    "plugin_type": "VST3",
    "scope": "system",
    "ownership": "owned",
    "audited_at": "2026-03-21 14:30:00",
    "notes": ""
  }
}
```

## Tech Stack

- **Language**: Python 3
- **Dependencies**: `rich` (terminal UI)
- **Platform**: macOS only (relies on standard Apple audio plugin paths)

## Usage

```bash
cd music-health
pip install -r requirements.txt

python music_health.py scan               # List all plugins
python music_health.py audit              # Interactive audit
python music_health.py report             # Ownership report
python music_health.py health             # Ableton health check
python music_health.py security           # Code signature security scan
python music_health.py assess             # Deep security assessment
python music_health.py cleanup            # Remove non-ARM64 plugins
python music_health.py cleanup --invalid  # Remove invalid-signature plugins
python music_health.py fix                # Auto-fix xattr issues
python music_health.py duplicates         # Detect duplicate-format plugins
python music_health.py library            # Analyze Ableton library disk usage
python music_health.py scan --export json # Export results to JSON/CSV
```
