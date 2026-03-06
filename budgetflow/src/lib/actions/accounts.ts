'use server';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function getAccounts() {
  return db.select().from(accounts);
}

export async function getTotalBalance() {
  const allAccounts = await db.select().from(accounts);
  return allAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
}

export async function createAccount(data: {
  name: string;
  type: string;
  institution: string;
  currentBalance?: number;
}) {
  const id = uuidv4();
  await db.insert(accounts).values({
    id,
    name: data.name,
    type: data.type,
    institution: data.institution,
    currentBalance: data.currentBalance ?? 0,
  });
  return id;
}

export async function deleteAccount(id: string) {
  await db.delete(accounts).where(eq(accounts.id, id));
}

export async function updateAccountBalance(id: string, balance: number) {
  await db
    .update(accounts)
    .set({ currentBalance: balance, lastImported: new Date().toISOString() })
    .where(eq(accounts.id, id));
}
