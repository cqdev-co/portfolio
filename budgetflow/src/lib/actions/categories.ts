'use server';

import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function getCategories() {
  return db.select().from(categories);
}

export async function getCategoriesByGroup() {
  const all = await db.select().from(categories);
  const grouped: Record<string, typeof all> = {};

  for (const cat of all) {
    if (!grouped[cat.groupName]) grouped[cat.groupName] = [];
    grouped[cat.groupName].push(cat);
  }

  return grouped;
}

export async function createCategory(data: {
  name: string;
  groupName: string;
  icon?: string;
  type?: string;
}) {
  const id = uuid();
  await db.insert(categories).values({
    id,
    name: data.name,
    groupName: data.groupName,
    icon: data.icon || '📁',
    isCustom: true,
    type: data.type || 'expense',
  });
  return id;
}

export async function updateCategory(
  id: string,
  data: { name?: string; groupName?: string; icon?: string }
) {
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
}
