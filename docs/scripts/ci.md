# Local CI Script

A local script that mimics the GitHub Actions CI pipeline for quick
pre-commit validation.

## Usage

```bash
./scripts/ci.sh
```

## What It Does

The script runs all CI checks locally in the same order as the GitHub
Actions workflow:

| Job             | Description                      | Command(s)                             |
| --------------- | -------------------------------- | -------------------------------------- |
| **Typecheck**   | TypeScript type validation       | `bun run typecheck`                    |
| **Lint**        | ESLint + Prettier checks         | `bun run lint`, `bun run format:check` |
| **Lint Python** | Ruff linting for Python services | `ruff format --check`, `ruff check`    |
| **Test**        | JavaScript/TypeScript tests      | `bun run test`                         |
| **Test Python** | Pytest (skips if no tests exist) | `poetry run pytest`                    |
| **Build**       | Production build                 | `bun run build`                        |

## Python Services Checked

- `unusual-options-service`
- `penny-stock-scanner`
- `wp-service`

## Prerequisites

- **bun** - Package manager and runtime
- **ruff** - Python linter (optional, skipped if not installed)
- **poetry** - Python dependency manager (optional, skipped if not installed)

## Environment Variables

The script sets placeholder values for required build environment
variables if they're not already set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Exit Codes

- `0` - All checks passed
- `1` - One or more checks failed

## Output

The script provides colored output with:

- Clear section headers for each job
- Success/failure indicators for each check
- Summary of failed jobs at the end
