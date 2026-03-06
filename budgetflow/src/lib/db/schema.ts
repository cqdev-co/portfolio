import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  institution: text('institution').notNull(),
  currentBalance: real('current_balance').default(0),
  lastImported: text('last_imported'),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  groupName: text('group_name').notNull(),
  icon: text('icon'),
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false),
  type: text('type').notNull().default('expense'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  merchantName: text('merchant_name'),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  userCategoryId: text('user_category_id').references(() => categories.id),
  date: text('date').notNull(),
  pending: integer('pending', { mode: 'boolean' }).default(false),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  isExcludedFromBudget: integer('is_excluded_from_budget', {
    mode: 'boolean',
  }).default(false),
  userNotes: text('user_notes'),
  paymentChannel: text('payment_channel'),
  transactionType: text('transaction_type'),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'cascade',
  }),
  monthlyLimit: real('monthly_limit').notNull(),
  month: text('month').notNull(),
  budgetMode: text('budget_mode').notNull().default('category'),
  rolloverAmount: real('rollover_amount').default(0),
  bucketType: text('bucket_type'),
});

export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').notNull().default(0),
  deadline: text('deadline'),
  icon: text('icon'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
});

export const recurringTransactions = sqliteTable('recurring_transactions', {
  id: text('id').primaryKey(),
  merchantName: text('merchant_name').notNull(),
  estimatedAmount: real('estimated_amount').notNull(),
  frequency: text('frequency').notNull(),
  nextExpectedDate: text('next_expected_date'),
  lastSeenDate: text('last_seen_date'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  categoryId: text('category_id').references(() => categories.id),
});

export const aiConversations = sqliteTable('ai_conversations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
});

export const weeklyRecaps = sqliteTable('weekly_recaps', {
  id: text('id').primaryKey(),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  content: text('content').notNull(),
  totalSpending: real('total_spending'),
  topCategories: text('top_categories'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
});

export const householdContext = sqliteTable('household_context', {
  id: text('id').primaryKey().default('default'),
  householdSize: integer('household_size'),
  dependents: integer('dependents'),
  annualIncome: real('annual_income'),
  financialGoals: text('financial_goals'),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const userPreferences = sqliteTable('user_preferences', {
  id: text('id').primaryKey().default('default'),
  budgetMode: text('budget_mode').notNull().default('category'),
  dashboardWidgets: text('dashboard_widgets'),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

// Relations
export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  savingsGoals: many(savingsGoals),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions, { relationName: 'categoryTransactions' }),
  budgets: many(budgets),
  recurringTransactions: many(recurringTransactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
    relationName: 'categoryTransactions',
  }),
  userCategory: one(categories, {
    fields: [transactions.userCategoryId],
    references: [categories.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  account: one(accounts, {
    fields: [savingsGoals.accountId],
    references: [accounts.id],
  }),
}));

export const recurringTransactionsRelations = relations(
  recurringTransactions,
  ({ one }) => ({
    category: one(categories, {
      fields: [recurringTransactions.categoryId],
      references: [categories.id],
    }),
  })
);
