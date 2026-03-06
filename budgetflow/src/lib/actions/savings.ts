'use server';

import { db } from '@/lib/db';
import { savingsGoals, accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function getSavingsGoals() {
  return db
    .select({
      id: savingsGoals.id,
      name: savingsGoals.name,
      targetAmount: savingsGoals.targetAmount,
      currentAmount: savingsGoals.currentAmount,
      deadline: savingsGoals.deadline,
      icon: savingsGoals.icon,
      createdAt: savingsGoals.createdAt,
      accountId: savingsGoals.accountId,
      accountName: accounts.name,
    })
    .from(savingsGoals)
    .leftJoin(accounts, eq(savingsGoals.accountId, accounts.id));
}

export async function createSavingsGoal(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  icon?: string;
  accountId?: string;
}) {
  const id = uuid();
  await db.insert(savingsGoals).values({
    id,
    name: data.name,
    targetAmount: data.targetAmount,
    currentAmount: data.currentAmount || 0,
    deadline: data.deadline || null,
    icon: data.icon || '🎯',
    accountId: data.accountId || null,
  });
  return id;
}

export async function updateSavingsGoal(
  id: string,
  data: Partial<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    icon: string;
  }>
) {
  await db.update(savingsGoals).set(data).where(eq(savingsGoals.id, id));
}

export async function deleteSavingsGoal(id: string) {
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
}
