'use server';

import { db } from '@/lib/db';
import { householdContext, userPreferences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getHouseholdContext() {
  const result = await db.select().from(householdContext).limit(1);
  return result[0] || null;
}

export async function updateHouseholdContext(data: {
  householdSize?: number;
  dependents?: number;
  annualIncome?: number;
  financialGoals?: string;
}) {
  const existing = await db.select().from(householdContext).limit(1);

  if (existing.length > 0) {
    await db
      .update(householdContext)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(householdContext.id, existing[0].id));
  } else {
    await db.insert(householdContext).values({
      id: 'default',
      ...data,
    });
  }
}

export async function getUserPreferences() {
  const result = await db.select().from(userPreferences).limit(1);
  return result[0] || { budgetMode: 'category', dashboardWidgets: null };
}

export async function updateUserPreferences(data: {
  budgetMode?: string;
  dashboardWidgets?: string;
}) {
  const existing = await db.select().from(userPreferences).limit(1);

  if (existing.length > 0) {
    await db
      .update(userPreferences)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(userPreferences.id, existing[0].id));
  } else {
    await db.insert(userPreferences).values({
      id: 'default',
      budgetMode: data.budgetMode || 'category',
      dashboardWidgets: data.dashboardWidgets,
    });
  }
}
