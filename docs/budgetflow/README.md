# BudgetFlow Documentation

## Overview

BudgetFlow is a local-only personal finance dashboard modeled after Monarch Money. It lives inside the portfolio monorepo as a standalone Next.js application with its own SQLite database. Bank data is imported via CSV exports — no third-party APIs or bank credentials required.

## Quick Start

```bash
# From monorepo root
cp budgetflow/.env.local.example budgetflow/.env.local
bun install
bun run dev:budget
# Open http://localhost:3100
```

## Prerequisites

1. **Bun** — Install from [bun.sh](https://bun.sh)
2. **Ollama** (optional, for AI features) — Install from [ollama.com](https://ollama.com), then:
   ```bash
   ollama serve          # Start the Ollama server
   ollama pull llama3.2  # Download the model
   ```

## Features

### CSV Import

Instead of connecting to banks via API, BudgetFlow uses CSV exports downloaded from each bank's website. The import flow:

1. **Create accounts** in Settings (name, bank, type)
2. **Download CSV** from your bank's website (transaction history export)
3. **Import** — Click "Import CSV" anywhere in the app, select an account, drop the file
4. The parser auto-detects the bank format based on the account's institution and CSV headers
5. **Deduplication** — Transactions with matching date + description + amount are skipped, so re-importing overlapping date ranges is safe
6. **Auto-categorization** — Merchant names are matched against a built-in keyword map (e.g., "Starbucks" → Coffee Shops, "Netflix" → Streaming Services). Chase CSVs include their own category field which is also mapped.

#### Supported CSV Formats

**Bank of America** (Checking, Savings, Credit Card):

```
Date,Description,Amount,Running Bal.
01/15/2025,STARBUCKS STORE 12345,-4.75,1234.56
```

**Chase** (Credit Card):

```
Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2025,01/16/2025,AMAZON.COM,Shopping,Sale,-29.99,
```

**Generic** — Any CSV where the parser can identify date, description, and amount columns from the headers.

### Dashboard

- **Balance cards**: Total balance, monthly income, monthly expenses, transaction count
- **Spending by category**: Donut chart with top 8 categories
- **Cash flow**: Bar chart comparing income vs expenses over 6 months
- **Recent transactions**: Latest 8 transactions with quick category display
- **Budget progress**: Summary of active budget progress bars
- **Accounts summary**: List of accounts with balances and quick import button
- **Weekly recap**: AI-generated weekly financial summary widget

### Budget Modes

**Category Budgeting** — Set per-category monthly limits (e.g., Dining: $400/mo). Progress bars show red/yellow/green status. Supports rollover (unspent budget carries forward).

**Flex Budgeting** — Monarch's signature feature. Splits expenses into Fixed, Flexible, and Non-Monthly buckets. Displays one "flex number" showing how much you have left for variable expenses.

### AI Features

All AI features run through local Ollama. Your financial data never leaves your machine.

**AI Assistant** — Chat sidebar accessible from any page via the sparkle icon in the sidebar. Can answer questions like:

- "How much did I spend on dining this month?"
- "Where can I save more?"
- "What are my top 5 expenses?"

The assistant receives your complete financial snapshot as context (balances, spending, budgets, recurring charges, savings goals, household info).

**AI Insights** — Sparkle icons on dashboard widgets. Click to get a 2-3 sentence contextual insight about that specific data (e.g., spending trends, budget status).

**AI Weekly Recap** — Auto-generated summary covering total spending, top categories, cash flow, recurring changes, and actionable tips. Stored in the database for historical viewing.

### Recurring Detection

The detection engine analyzes transaction history to find patterns:

- Groups transactions by merchant name
- Calculates average interval between charges
- Uses standard deviation to filter out irregular charges
- Classifies frequency as weekly/bi-weekly/monthly/quarterly/annual
- Estimates next expected charge date

### Savings Goals

Create named goals with target amounts, deadlines, and icons. The progress ring shows completion percentage, and projected completion dates are calculated based on saving rate since goal creation.

## Database

SQLite database stored at `budgetflow/.data/budgetflow.db` (gitignored). Tables:

- `accounts` — Bank accounts with name, type, institution, balance, and last import timestamp
- `transactions` — All transactions with categories and metadata
- `categories` — Built-in and custom transaction categories (~40 defaults)
- `budgets` — Monthly budget limits per category
- `savings_goals` — Named savings targets
- `recurring_transactions` — Detected recurring charges
- `ai_conversations` — Chat history for the AI assistant
- `weekly_recaps` — Generated weekly summaries
- `household_context` — Optional household details for AI personalization
- `user_preferences` — App preferences (budget mode, widget layout)

The database is auto-initialized on first request via the `/api/init` endpoint and seeded with default categories.

## Account Management

Accounts are created manually in **Settings > Accounts**:

| Field            | Options                           |
| ---------------- | --------------------------------- |
| Name             | Free text (e.g., "BofA Checking") |
| Bank             | Bank of America, Chase, Other     |
| Type             | Checking, Savings, Credit Card    |
| Starting Balance | Optional dollar amount            |

Each account remembers its bank, so the CSV parser knows which format to use during import.

## Monorepo Integration

- Workspace: `@portfolio/budgetflow` in root `package.json`
- Dev command: `bun run dev:budget` (runs on port 3100)
- Build: `bun run --cwd budgetflow build`
- Independent of other workspaces (no shared lib dependencies)

## Environment Variables

| Variable       | Description                                           | Required |
| -------------- | ----------------------------------------------------- | -------- |
| `OLLAMA_HOST`  | Ollama server URL (default: `http://localhost:11434`) | No       |
| `OLLAMA_MODEL` | Ollama model name (default: `llama3.2`)               | No       |

## Data Privacy

- **100% local** — All financial data stored in SQLite, never leaves your machine
- AI processing happens entirely on your local Ollama instance
- No bank API keys, credentials, or cloud connections required
- No third-party services of any kind

## Changelog

### 2026-03-05

- **Fix**: Exported `ButtonProps` type from `button.tsx` UI component to resolve TypeScript compilation error in `import-button.tsx`
- **Cleanup**: Removed unused imports (`eq`, `and`, `Upload`, `formatDate`) and unused variable (`selectedAccount`) across 6 files to eliminate lint warnings
