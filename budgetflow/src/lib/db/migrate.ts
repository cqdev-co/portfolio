import { db } from './index';
import { sql } from 'drizzle-orm';
import { seedCategories } from './seed';

export async function initializeDatabase() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    institution TEXT NOT NULL,
    current_balance REAL DEFAULT 0,
    last_imported TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    icon TEXT,
    is_custom INTEGER DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'expense'
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    merchant_name TEXT,
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id),
    user_category_id TEXT REFERENCES categories(id),
    date TEXT NOT NULL,
    pending INTEGER DEFAULT 0,
    is_recurring INTEGER DEFAULT 0,
    is_excluded_from_budget INTEGER DEFAULT 0,
    user_notes TEXT,
    payment_channel TEXT,
    transaction_type TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
    monthly_limit REAL NOT NULL,
    month TEXT NOT NULL,
    budget_mode TEXT NOT NULL DEFAULT 'category',
    rollover_amount REAL DEFAULT 0,
    bucket_type TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id),
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    deadline TEXT,
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    estimated_amount REAL NOT NULL,
    frequency TEXT NOT NULL,
    next_expected_date TEXT,
    last_seen_date TEXT,
    is_active INTEGER DEFAULT 1,
    category_id TEXT REFERENCES categories(id)
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS weekly_recaps (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    content TEXT NOT NULL,
    total_spending REAL,
    top_categories TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS household_context (
    id TEXT PRIMARY KEY DEFAULT 'default',
    household_size INTEGER,
    dependents INTEGER,
    annual_income REAL,
    financial_goals TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default',
    budget_mode TEXT NOT NULL DEFAULT 'category',
    dashboard_widgets TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.run(
    sql`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month)`
  );

  await seedCategories();
}
