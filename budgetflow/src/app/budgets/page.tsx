import { PageHeader } from '@/components/layout/page-header';
import { BudgetView } from '@/components/budgets/budget-view';
import { getBudgetProgress } from '@/lib/actions/budgets';
import { getCategories } from '@/lib/actions/categories';
import { getMonthlySpending } from '@/lib/actions/transactions';
import { getMonthKey } from '@/lib/utils';
import { ensureInitialized } from '@/lib/db';

export const metadata = { title: 'Budget' };

export default async function BudgetsPage() {
  await ensureInitialized();
  const month = getMonthKey();
  const [budgetProgress, cats, monthlyData] = await Promise.all([
    getBudgetProgress(month),
    getCategories(),
    getMonthlySpending(month),
  ]);

  return (
    <>
      <PageHeader
        title="Budget"
        description="Manage your monthly spending limits"
      />
      <BudgetView
        initialBudgets={budgetProgress}
        categories={cats}
        monthlyIncome={monthlyData.totalIncome || 0}
        monthlyExpenses={monthlyData.totalExpenses || 0}
        currentMonth={month}
      />
    </>
  );
}
