import { NextRequest, NextResponse } from 'next/server';
import { db, ensureInitialized } from '@/lib/db';
import { transactions, accounts, categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseCSV, type BankFormat } from '@/lib/csv/parser';
import { v4 as uuidv4 } from 'uuid';

const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  walmart: 'Groceries',
  target: 'General Shopping',
  amazon: 'Amazon',
  costco: 'Groceries',
  'trader joe': 'Groceries',
  'whole foods': 'Groceries',
  kroger: 'Groceries',
  safeway: 'Groceries',
  starbucks: 'Coffee Shops',
  dunkin: 'Coffee Shops',
  mcdonald: 'Fast Food',
  'chick-fil-a': 'Fast Food',
  chipotle: 'Fast Food',
  'taco bell': 'Fast Food',
  wendy: 'Fast Food',
  'uber eats': 'Restaurants',
  doordash: 'Restaurants',
  grubhub: 'Restaurants',
  uber: 'Rideshare',
  lyft: 'Rideshare',
  shell: 'Gas',
  exxon: 'Gas',
  chevron: 'Gas',
  'bp ': 'Gas',
  netflix: 'Streaming Services',
  spotify: 'Streaming Services',
  hulu: 'Streaming Services',
  'disney+': 'Streaming Services',
  'apple.com/bill': 'Subscriptions',
  'google *': 'Subscriptions',
  gym: 'Gym',
  'planet fitness': 'Gym',
  cvs: 'Pharmacy',
  walgreens: 'Pharmacy',
  venmo: 'Transfer',
  zelle: 'Transfer',
  paypal: 'Transfer',
};

const CHASE_CATEGORY_MAP: Record<string, string> = {
  'food & drink': 'Restaurants',
  groceries: 'Groceries',
  gas: 'Gas',
  travel: 'Vacation',
  shopping: 'General Shopping',
  entertainment: 'Movies & Events',
  'health & wellness': 'Medical',
  personal: 'Personal Care',
  home: 'Maintenance',
  education: 'Education',
  'bills & utilities': 'Utilities',
  automotive: 'Car Payment',
  'fees & adjustments': 'Fees & Charges',
  'gifts & donations': 'Gifts',
  'professional services': 'Subscriptions',
};

async function getCategoryId(name: string): Promise<string | null> {
  const result = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1);
  return result[0]?.id ?? null;
}

function matchMerchantCategory(description: string): string | null {
  const lower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return null;
}

function mapChaseCategory(chaseCategory: string): string | null {
  const lower = chaseCategory.toLowerCase();
  return CHASE_CATEGORY_MAP[lower] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    await ensureInitialized();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const accountId = formData.get('accountId') as string | null;
    const bankOverride = formData.get('bank') as BankFormat | null;

    if (!file || !accountId) {
      return NextResponse.json(
        { error: 'file and accountId are required' },
        { status: 400 }
      );
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const content = await file.text();
    const bank =
      bankOverride || (account.institution as BankFormat) || undefined;
    const result = parseCSV(content, bank);

    if (result.transactions.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors:
          result.errors.length > 0
            ? result.errors
            : ['No transactions found in file'],
        format: result.format,
      });
    }

    const existing = await db
      .select({
        date: transactions.date,
        name: transactions.name,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const existingSet = new Set(
      existing.map((t) => `${t.date}|${t.name}|${t.amount}`)
    );

    let imported = 0;
    let skipped = 0;
    let lastBalance: number | undefined;

    for (const txn of result.transactions) {
      const dedupKey = `${txn.date}|${txn.description}|${txn.amount}`;
      if (existingSet.has(dedupKey)) {
        skipped++;
        continue;
      }

      let categoryName =
        txn.category && result.format === 'chase'
          ? mapChaseCategory(txn.category)
          : null;
      if (!categoryName) {
        categoryName = matchMerchantCategory(txn.description);
      }

      const categoryId = categoryName
        ? await getCategoryId(categoryName)
        : null;

      await db.insert(transactions).values({
        id: uuidv4(),
        accountId,
        name: txn.description,
        merchantName: txn.description,
        amount: txn.amount,
        date: txn.date,
        categoryId,
        transactionType: txn.type || null,
      });

      existingSet.add(dedupKey);
      imported++;

      if (txn.balance !== undefined) {
        lastBalance = txn.balance;
      }
    }

    if (lastBalance !== undefined) {
      await db
        .update(accounts)
        .set({
          currentBalance: lastBalance,
          lastImported: new Date().toISOString(),
        })
        .where(eq(accounts.id, accountId));
    } else {
      await db
        .update(accounts)
        .set({ lastImported: new Date().toISOString() })
        .where(eq(accounts.id, accountId));
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: result.errors,
      format: result.format,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import CSV' },
      { status: 500 }
    );
  }
}
