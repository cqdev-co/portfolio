import { PageHeader } from '@/components/layout/page-header';
import { SettingsView } from '@/components/settings/settings-view';
import { getHouseholdContext } from '@/lib/actions/settings';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategoriesByGroup } from '@/lib/actions/categories';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await ensureInitialized();
  const [accounts, household, categoriesByGroup] = await Promise.all([
    getAccounts(),
    getHouseholdContext(),
    getCategoriesByGroup(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your BudgetFlow preferences"
      />
      <SettingsView
        accounts={accounts}
        household={household}
        categoriesByGroup={categoriesByGroup}
      />
    </>
  );
}
