import { PageHeader } from '@/components/layout/page-header';
import { SavingsView } from '@/components/savings/savings-view';
import { getSavingsGoals } from '@/lib/actions/savings';
import { getAccounts } from '@/lib/actions/accounts';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Savings' };

export default async function SavingsPage() {
  await ensureInitialized();
  const [goals, accts] = await Promise.all([getSavingsGoals(), getAccounts()]);

  return (
    <>
      <PageHeader
        title="Savings Goals"
        description="Track progress toward your financial goals"
      />
      <SavingsView goals={goals} accounts={accts} />
    </>
  );
}
