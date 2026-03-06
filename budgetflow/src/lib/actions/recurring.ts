'use server';

import { db } from '@/lib/db';
import {
  transactions,
  recurringTransactions,
  categories,
} from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function getRecurringTransactions() {
  return db
    .select({
      id: recurringTransactions.id,
      merchantName: recurringTransactions.merchantName,
      estimatedAmount: recurringTransactions.estimatedAmount,
      frequency: recurringTransactions.frequency,
      nextExpectedDate: recurringTransactions.nextExpectedDate,
      lastSeenDate: recurringTransactions.lastSeenDate,
      isActive: recurringTransactions.isActive,
      categoryId: recurringTransactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(recurringTransactions)
    .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
    .orderBy(
      desc(recurringTransactions.isActive),
      recurringTransactions.merchantName
    );
}

export async function detectRecurringTransactions() {
  const merchantGroups = await db
    .select({
      merchantName: transactions.merchantName,
      count: sql<number>`COUNT(*)`.as('count'),
      avgAmount: sql<number>`AVG(ABS(${transactions.amount}))`.as('avg_amount'),
      minDate: sql<string>`MIN(${transactions.date})`.as('min_date'),
      maxDate: sql<string>`MAX(${transactions.date})`.as('max_date'),
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      sql`${transactions.merchantName} IS NOT NULL AND ${transactions.amount} > 0`
    )
    .groupBy(transactions.merchantName)
    .having(sql`COUNT(*) >= 2`);

  let detected = 0;

  for (const group of merchantGroups) {
    if (!group.merchantName) continue;

    const txns = await db
      .select({ date: transactions.date, amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.merchantName, group.merchantName))
      .orderBy(transactions.date);

    if (txns.length < 2) continue;

    const intervals: number[] = [];
    for (let i = 1; i < txns.length; i++) {
      const d1 = new Date(txns[i - 1].date).getTime();
      const d2 = new Date(txns[i].date).getTime();
      intervals.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
        intervals.length
    );

    if (stdDev > avgInterval * 0.5 && avgInterval > 7) continue;

    let frequency: string;
    if (avgInterval <= 10) frequency = 'weekly';
    else if (avgInterval <= 20) frequency = 'bi-weekly';
    else if (avgInterval <= 40) frequency = 'monthly';
    else if (avgInterval <= 100) frequency = 'quarterly';
    else frequency = 'annual';

    const lastDate = new Date(txns[txns.length - 1].date);
    const nextDate = new Date(
      lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000
    );

    const existing = await db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.merchantName, group.merchantName))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(recurringTransactions)
        .set({
          estimatedAmount: group.avgAmount,
          frequency,
          lastSeenDate: txns[txns.length - 1].date,
          nextExpectedDate: nextDate.toISOString().split('T')[0],
          isActive: true,
        })
        .where(eq(recurringTransactions.id, existing[0].id));
    } else {
      await db.insert(recurringTransactions).values({
        id: uuid(),
        merchantName: group.merchantName,
        estimatedAmount: group.avgAmount,
        frequency,
        lastSeenDate: txns[txns.length - 1].date,
        nextExpectedDate: nextDate.toISOString().split('T')[0],
        isActive: true,
        categoryId: group.categoryId,
      });
      detected++;
    }

    await db
      .update(transactions)
      .set({ isRecurring: true })
      .where(eq(transactions.merchantName, group.merchantName));
  }

  return detected;
}

export async function toggleRecurringActive(id: string) {
  const [item] = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.id, id));

  if (item) {
    await db
      .update(recurringTransactions)
      .set({ isActive: !item.isActive })
      .where(eq(recurringTransactions.id, id));
  }
}

export async function getMonthlyRecurringTotal() {
  const active = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.isActive, true));

  return active.reduce((total, item) => {
    const amount = item.estimatedAmount;
    switch (item.frequency) {
      case 'weekly':
        return total + amount * 4.33;
      case 'bi-weekly':
        return total + amount * 2.17;
      case 'monthly':
        return total + amount;
      case 'quarterly':
        return total + amount / 3;
      case 'annual':
        return total + amount / 12;
      default:
        return total + amount;
    }
  }, 0);
}
