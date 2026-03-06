import { PageHeader } from '@/components/layout/page-header';
import { TrendsView } from '@/components/trends/trends-view';
import { getCashFlow, getSpendingByCategory } from '@/lib/actions/transactions';
import { getMonthKey } from '@/lib/utils';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Trends' };

export default async function TrendsPage() {
  await ensureInitialized();
  const month = getMonthKey();
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const [cashFlow, categorySpending] = await Promise.all([
    getCashFlow(12),
    getSpendingByCategory(startDate, endDate),
  ]);

  return (
    <>
      <PageHeader
        title="Trends"
        description="Analyze your spending patterns over time"
      />
      <TrendsView cashFlow={cashFlow} categorySpending={categorySpending} />
    </>
  );
}
