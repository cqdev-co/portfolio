'use server';

import { db } from '@/lib/db';
import { budgets, categories, transactions } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getMonthKey } from '@/lib/utils';
import { v4 as uuid } from 'uuid';

export async function getBudgets(month?: string) {
  const m = month || getMonthKey();

  return db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      monthlyLimit: budgets.monthlyLimit,
      month: budgets.month,
      budgetMode: budgets.budgetMode,
      rolloverAmount: budgets.rolloverAmount,
      bucketType: budgets.bucketType,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryGroup: categories.groupName,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.month, m));
}

export async function getBudgetProgress(month?: string) {
  const m = month || getMonthKey();
  const startDate = `${m}-01`;
  const [year, mon] = m.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const budgetList = await getBudgets(m);

  const progress = await Promise.all(
    budgetList.map(async (budget) => {
      const [spending] = await db
        .select({
          total: sql<number>`SUM(ABS(${transactions.amount}))`.as('total'),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.categoryId, budget.categoryId!),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate),
            eq(transactions.isExcludedFromBudget, false),
            sql`${transactions.amount} > 0`
          )
        );

      const spent = spending?.total || 0;
      const limit = budget.monthlyLimit + (budget.rolloverAmount || 0);
      const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;

      return {
        ...budget,
        spent,
        remaining: limit - spent,
        percentage,
        status:
          percentage >= 100 ? 'over' : percentage >= 75 ? 'warning' : 'good',
      };
    })
  );

  return progress;
}

export async function upsertBudget(data: {
  categoryId: string;
  monthlyLimit: number;
  month: string;
  budgetMode?: string;
  bucketType?: string;
}) {
  const existing = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.categoryId, data.categoryId),
        eq(budgets.month, data.month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({
        monthlyLimit: data.monthlyLimit,
        budgetMode: data.budgetMode || 'category',
        bucketType: data.bucketType,
      })
      .where(eq(budgets.id, existing[0].id));
    return existing[0].id;
  }

  const id = uuid();
  await db.insert(budgets).values({
    id,
    categoryId: data.categoryId,
    monthlyLimit: data.monthlyLimit,
    month: data.month,
    budgetMode: data.budgetMode || 'category',
    bucketType: data.bucketType,
  });
  return id;
}

export async function deleteBudget(id: string) {
  await db.delete(budgets).where(eq(budgets.id, id));
}

export async function calculateRollovers(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const prevMonth = `${mon === 1 ? year - 1 : year}-${String(mon === 1 ? 12 : mon - 1).padStart(2, '0')}`;

  const prevBudgets = await getBudgetProgress(prevMonth);

  for (const budget of prevBudgets) {
    if (budget.remaining > 0 && budget.categoryId) {
      const currentBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.categoryId, budget.categoryId),
            eq(budgets.month, month)
          )
        );

      if (currentBudgets.length > 0) {
        await db
          .update(budgets)
          .set({ rolloverAmount: budget.remaining })
          .where(eq(budgets.id, currentBudgets[0].id));
      }
    }
  }
}
