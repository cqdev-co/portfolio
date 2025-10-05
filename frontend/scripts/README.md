# Portfolio Scripts

This directory contains utility scripts for maintaining the portfolio project.

## Available Scripts

### Line Length Fixer (`fix-line-length.js`)

Automatically fixes line length violations in MDX files to comply with the 75-character limit.

**Quick Usage:**
```bash
cd frontend
node ../scripts/fix-line-length.js
bun run test  # Verify fixes
```

**Documentation:** See [docs/scripts/line-length-fixer.md](../docs/scripts/line-length-fixer.md) for detailed information.

## General Usage

All scripts should be run from the appropriate directory (usually `frontend/`) to ensure proper dependency resolution and file path handling.

## Contributing

When adding new scripts:

1. Make them executable: `chmod +x script-name.js`
2. Add proper shebang: `#!/usr/bin/env node`
3. Include usage documentation
4. Update this README
5. Add documentation to the `docs/scripts/` directory
