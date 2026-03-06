'use server';

import { db } from '@/lib/db';
import { transactions, categories, accounts } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';
import { getMonthKey } from '@/lib/utils';

export async function getTransactions(opts?: {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  search?: string;
}) {
  const conditions = [];

  if (opts?.startDate) conditions.push(gte(transactions.date, opts.startDate));
  if (opts?.endDate) conditions.push(lte(transactions.date, opts.endDate));
  if (opts?.categoryId) {
    conditions.push(eq(transactions.categoryId, opts.categoryId));
  }
  if (opts?.accountId) {
    conditions.push(eq(transactions.accountId, opts.accountId));
  }
  if (opts?.search) {
    conditions.push(like(transactions.name, `%${opts.search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      id: transactions.id,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      date: transactions.date,
      pending: transactions.pending,
      isRecurring: transactions.isRecurring,
      isExcludedFromBudget: transactions.isExcludedFromBudget,
      userNotes: transactions.userNotes,
      transactionType: transactions.transactionType,
      accountId: transactions.accountId,
      accountName: accounts.name,
      categoryId: transactions.categoryId,
      userCategoryId: transactions.userCategoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryGroup: categories.groupName,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(where)
    .orderBy(desc(transactions.date))
    .limit(opts?.limit || 100)
    .offset(opts?.offset || 0);

  return result;
}

export async function getRecentTransactions(limit = 10) {
  return getTransactions({ limit });
}

export async function getSpendingByCategory(
  startDate: string,
  endDate: string
) {
  const result = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryGroup: categories.groupName,
      total: sql<number>`SUM(ABS(${transactions.amount}))`.as('total'),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        eq(transactions.isExcludedFromBudget, false),
        sql`${transactions.amount} > 0`
      )
    )
    .groupBy(categories.id)
    .orderBy(sql`total DESC`);

  return result;
}

export async function getMonthlySpending(month?: string) {
  const m = month || getMonthKey();
  const startDate = `${m}-01`;
  const [year, mon] = m.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const result = await db
    .select({
      totalExpenses:
        sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`.as(
          'total_expenses'
        ),
      totalIncome:
        sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`.as(
          'total_income'
        ),
      transactionCount: sql<number>`COUNT(*)`.as('count'),
    })
    .from(transactions)
    .where(
      and(gte(transactions.date, startDate), lte(transactions.date, endDate))
    );

  return result[0] || { totalExpenses: 0, totalIncome: 0, transactionCount: 0 };
}

export async function getCashFlow(months = 6) {
  const now = new Date();
  const results = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = getMonthKey(d);
    const data = await getMonthlySpending(monthKey);
    results.push({
      month: monthKey,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      income: data.totalIncome || 0,
      expenses: data.totalExpenses || 0,
      net: (data.totalIncome || 0) - (data.totalExpenses || 0),
    });
  }

  return results;
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string
) {
  await db
    .update(transactions)
    .set({ userCategoryId: categoryId })
    .where(eq(transactions.id, transactionId));
}

export async function updateTransactionNotes(
  transactionId: string,
  notes: string
) {
  await db
    .update(transactions)
    .set({ userNotes: notes })
    .where(eq(transactions.id, transactionId));
}

export async function toggleExcludeFromBudget(transactionId: string) {
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  if (txn) {
    await db
      .update(transactions)
      .set({ isExcludedFromBudget: !txn.isExcludedFromBudget })
      .where(eq(transactions.id, transactionId));
  }
}
