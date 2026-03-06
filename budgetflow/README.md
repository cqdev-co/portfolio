# BudgetFlow

Personal local-only finance dashboard for visualizing and budgeting the money that flows in and out of your bank accounts. Modeled after [Monarch Money](https://monarchmoney.com/) with AI features powered by local Ollama.

## Features

- **CSV Import** — Import transactions from Bank of America and Chase CSV exports with auto-detection, deduplication, and auto-categorization
- **Dashboard** — Balance cards, spending donut chart, cash flow bars, budget progress, weekly recap
- **Transactions** — Searchable/filterable table with inline re-categorization, notes, and budget exclusions
- **Two Budget Modes** — Category Budgeting (traditional per-category limits) and Flex Budgeting (one flexible spending number)
- **Trends & Reports** — Income vs expenses, net cash flow, cumulative savings, spending by group
- **Recurring Detection** — Automatically detects subscriptions and regular charges by analyzing transaction patterns
- **Savings Goals** — Progress rings, projected completion dates, and contribution tracking
- **AI Financial Assistant** — Chat sidebar powered by Ollama (local) to ask questions about your spending
- **AI Insights** — Sparkle icons on dashboard widgets that generate contextual financial insights on click
- **AI Weekly Recap** — Auto-generated weekly financial summary

## Tech Stack

| Layer     | Choice                            |
| --------- | --------------------------------- |
| Framework | Next.js 16 (App Router)           |
| Styling   | Tailwind CSS + Shadcn/UI          |
| Charts    | Recharts                          |
| Database  | SQLite via Drizzle ORM + libsql   |
| Bank Data | CSV Import (BofA, Chase, generic) |
| AI        | Ollama (local LLM)                |
| Runtime   | Bun                               |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- Ollama model pulled: `ollama pull llama3.2`

### Setup

```bash
# From the monorepo root
cp budgetflow/.env.local.example budgetflow/.env.local

# Install dependencies
bun install

# Start the dev server
bun run dev:budget
```

The app runs at [http://localhost:3100](http://localhost:3100).

### First-time Setup

1. Go to **Settings > Accounts** and create your bank accounts (e.g., "BofA Checking", "Chase Credit Card")
2. Export CSV files from your bank's website
3. Click **Import CSV** on the transactions page or dashboard, select an account, and drop the file
4. Transactions are auto-parsed, deduplicated, and categorized

### Environment Variables

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Supported Banks

| Bank            | Account Types                  | CSV Format                                                           |
| --------------- | ------------------------------ | -------------------------------------------------------------------- |
| Bank of America | Checking, Savings, Credit Card | `Date,Description,Amount,Running Bal.`                               |
| Chase           | Credit Card                    | `Transaction Date,Post Date,Description,Category,Type,Amount,Memo`   |
| Generic         | Any                            | Auto-detected from headers (needs date, description, amount columns) |

## Architecture

```
budgetflow/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Dashboard
│   │   ├── transactions/       # Transaction list
│   │   ├── budgets/            # Budget management
│   │   ├── trends/             # Charts & reports
│   │   ├── recurring/          # Subscription detection
│   │   ├── savings/            # Savings goals
│   │   ├── settings/           # Preferences & accounts
│   │   └── api/
│   │       ├── init/           # DB initialization
│   │       ├── import/         # CSV import endpoint
│   │       └── ai/             # Chat, insights, weekly recap
│   ├── components/
│   │   ├── ai/                 # AI chat sidebar, insight buttons, weekly recap
│   │   ├── budgets/            # Budget views (Category + Flex modes)
│   │   ├── dashboard/          # Balance cards, charts, recent transactions
│   │   ├── import/             # CSV import dialog & button
│   │   ├── layout/             # Sidebar navigation, page header
│   │   ├── recurring/          # Recurring expense views
│   │   ├── savings/            # Savings goal cards & dialogs
│   │   ├── settings/           # Settings tabs (accounts, categories, AI)
│   │   ├── transactions/       # Transaction table & row components
│   │   └── ui/                 # Shadcn/UI components
│   └── lib/
│       ├── actions/            # Server actions (accounts, budgets, categories, etc.)
│       ├── ai/                 # Ollama client, prompts, context builder
│       ├── csv/                # CSV parser engine (BofA, Chase, generic)
│       ├── db/                 # Drizzle schema, migrations, seed data
│       └── utils.ts            # Shared utilities
├── .data/                      # SQLite database (gitignored)
├── drizzle.config.ts
└── package.json
```

## Data Flow

```
Bank Website → Download CSV → Drop into BudgetFlow → Auto-detect format
→ Parse & normalize → Deduplicate against existing → Preview new vs skipped
→ Import into SQLite → Auto-categorize by merchant name
```

## Data Privacy

- **100% local** — All financial data is stored locally in SQLite (`.data/budgetflow.db`)
- AI processing happens entirely on your local Ollama instance
- No financial data is sent to any third-party service
- No API keys, bank credentials, or cloud connections required
