import { PageHeader } from '@/components/layout/page-header';
import { RecurringView } from '@/components/recurring/recurring-view';
import {
  getRecurringTransactions,
  getMonthlyRecurringTotal,
} from '@/lib/actions/recurring';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Recurring' };

export default async function RecurringPage() {
  await ensureInitialized();
  const [items, monthlyTotal] = await Promise.all([
    getRecurringTransactions(),
    getMonthlyRecurringTotal(),
  ]);

  return (
    <>
      <PageHeader
        title="Recurring Expenses"
        description="Track subscriptions and regular charges"
      />
      <RecurringView items={items} monthlyTotal={monthlyTotal} />
    </>
  );
}
