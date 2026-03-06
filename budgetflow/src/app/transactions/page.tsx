import { PageHeader } from '@/components/layout/page-header';
import { TransactionsView } from '@/components/transactions/transactions-view';
import { getTransactions } from '@/lib/actions/transactions';
import { getCategories } from '@/lib/actions/categories';
import { getAccounts } from '@/lib/actions/accounts';
import { ImportButton } from '@/components/import/import-button';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Transactions' };

export default async function TransactionsPage() {
  await ensureInitialized();
  const [txns, cats, accts] = await Promise.all([
    getTransactions({ limit: 200 }),
    getCategories(),
    getAccounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="View and manage all your transactions"
      >
        <ImportButton accounts={accts} />
      </PageHeader>
      <TransactionsView
        initialTransactions={txns}
        categories={cats}
        accounts={accts}
      />
    </>
  );
}
