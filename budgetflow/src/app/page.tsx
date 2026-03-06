import { PageHeader } from '@/components/layout/page-header';
import { BalanceCards } from '@/components/dashboard/balance-cards';
import { SpendingChart } from '@/components/dashboard/spending-chart';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import { AccountsSummary } from '@/components/dashboard/accounts-summary';
import { WeeklyRecapWidget } from '@/components/ai/weekly-recap-widget';
import { getTotalBalance, getAccounts } from '@/lib/actions/accounts';
import {
  getMonthlySpending,
  getSpendingByCategory,
  getRecentTransactions,
  getCashFlow,
} from '@/lib/actions/transactions';
import { getBudgetProgress } from '@/lib/actions/budgets';
import { getMonthKey } from '@/lib/utils';
import { ensureInitialized } from '@/lib/db';

export default async function DashboardPage() {
  await ensureInitialized();
  const month = getMonthKey();
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const [
    totalBalance,
    monthlyData,
    spendingByCategory,
    recentTxns,
    cashFlow,
    budgetProgress,
    accountsList,
  ] = await Promise.all([
    getTotalBalance(),
    getMonthlySpending(month),
    getSpendingByCategory(startDate, endDate),
    getRecentTransactions(8),
    getCashFlow(6),
    getBudgetProgress(month),
    getAccounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      />

      <div className="space-y-6">
        <BalanceCards
          totalBalance={totalBalance}
          monthlyIncome={monthlyData.totalIncome || 0}
          monthlyExpenses={monthlyData.totalExpenses || 0}
          transactionCount={monthlyData.transactionCount || 0}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <SpendingChart data={spendingByCategory} />
          <CashFlowChart data={cashFlow} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <RecentTransactions transactions={recentTxns} />
            <WeeklyRecapWidget />
          </div>
          <div className="space-y-6">
            <BudgetOverview budgets={budgetProgress} />
            <AccountsSummary accounts={accountsList} />
          </div>
        </div>
      </div>
    </>
  );
}
