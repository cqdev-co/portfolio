import {
  getMonthlySpending,
  getSpendingByCategory,
  getCashFlow,
} from '@/lib/actions/transactions';
import { getBudgetProgress } from '@/lib/actions/budgets';
import {
  getMonthlyRecurringTotal,
  getRecurringTransactions,
} from '@/lib/actions/recurring';
import { getSavingsGoals } from '@/lib/actions/savings';
import { getTotalBalance, getAccounts } from '@/lib/actions/accounts';
import { db } from '@/lib/db';
import { householdContext } from '@/lib/db/schema';
import { getMonthKey, formatCurrency } from '@/lib/utils';

export async function buildAssistantContext(): Promise<string> {
  const month = getMonthKey();
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const [
    balance,
    accounts,
    monthly,
    categorySpending,
    cashFlow,
    budgetProgress,
    recurringTotal,
    recurring,
    savings,
    household,
  ] = await Promise.all([
    getTotalBalance(),
    getAccounts(),
    getMonthlySpending(month),
    getSpendingByCategory(startDate, endDate),
    getCashFlow(3),
    getBudgetProgress(month),
    getMonthlyRecurringTotal(),
    getRecurringTransactions(),
    getSavingsGoals(),
    db.select().from(householdContext).limit(1),
  ]);

  let ctx = `## Current Financial Snapshot (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})\n\n`;
  ctx += `**Total Balance:** ${formatCurrency(balance)}\n`;
  ctx += `**Accounts:** ${accounts.map((a) => `${a.name} (${formatCurrency(a.currentBalance || 0)})`).join(', ') || 'None connected'}\n`;
  ctx += `**Monthly Income:** ${formatCurrency(monthly.totalIncome || 0)}\n`;
  ctx += `**Monthly Expenses:** ${formatCurrency(monthly.totalExpenses || 0)}\n`;
  ctx += `**Net Cash Flow:** ${formatCurrency((monthly.totalIncome || 0) - (monthly.totalExpenses || 0))}\n\n`;

  if (categorySpending.length > 0) {
    ctx += `## Top Spending Categories This Month\n`;
    categorySpending.slice(0, 8).forEach((c) => {
      ctx += `- ${c.categoryName || 'Uncategorized'}: ${formatCurrency(c.total)} (${c.count} transactions)\n`;
    });
    ctx += '\n';
  }

  if (budgetProgress.length > 0) {
    ctx += `## Budget Status\n`;
    budgetProgress.forEach((b) => {
      ctx += `- ${b.categoryName}: ${formatCurrency(b.spent)} / ${formatCurrency(b.monthlyLimit)} (${b.percentage}% - ${b.status})\n`;
    });
    ctx += '\n';
  }

  if (cashFlow.length > 0) {
    ctx += `## Recent Cash Flow\n`;
    cashFlow.forEach((c) => {
      ctx += `- ${c.label}: Income ${formatCurrency(c.income)}, Expenses ${formatCurrency(c.expenses)}, Net ${formatCurrency(c.net)}\n`;
    });
    ctx += '\n';
  }

  ctx += `**Monthly Recurring Expenses:** ${formatCurrency(recurringTotal)}\n`;
  if (recurring.length > 0) {
    ctx += `Active subscriptions: ${recurring
      .filter((r) => r.isActive)
      .map(
        (r) =>
          `${r.merchantName} (${formatCurrency(r.estimatedAmount)}/${r.frequency})`
      )
      .join(', ')}\n`;
  }

  if (savings.length > 0) {
    ctx += `\n## Savings Goals\n`;
    savings.forEach((g) => {
      const pct =
        g.targetAmount > 0
          ? Math.round((g.currentAmount / g.targetAmount) * 100)
          : 0;
      ctx += `- ${g.name}: ${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)} (${pct}%)\n`;
    });
  }

  if (household.length > 0) {
    const h = household[0];
    ctx += `\n## Household Context\n`;
    if (h.householdSize) ctx += `- Household size: ${h.householdSize}\n`;
    if (h.dependents) ctx += `- Dependents: ${h.dependents}\n`;
    if (h.annualIncome)
      ctx += `- Annual income: ${formatCurrency(h.annualIncome)}\n`;
    if (h.financialGoals) ctx += `- Financial goals: ${h.financialGoals}\n`;
  }

  return ctx;
}

export async function buildInsightContext(widgetType: string): Promise<string> {
  const month = getMonthKey();
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;
  const prevMonth = `${mon === 1 ? year - 1 : year}-${String(mon === 1 ? 12 : mon - 1).padStart(2, '0')}`;
  const prevStartDate = `${prevMonth}-01`;

  switch (widgetType) {
    case 'spending': {
      const [current, previous] = await Promise.all([
        getSpendingByCategory(startDate, endDate),
        getSpendingByCategory(prevStartDate, startDate),
      ]);
      return `Current month spending by category:\n${current.map((c) => `${c.categoryName}: $${c.total.toFixed(2)}`).join('\n')}\n\nPrevious month:\n${previous.map((c) => `${c.categoryName}: $${c.total.toFixed(2)}`).join('\n')}`;
    }
    case 'cashflow': {
      const flow = await getCashFlow(3);
      return `Cash flow last 3 months:\n${flow.map((f) => `${f.label}: Income $${f.income.toFixed(2)}, Expenses $${f.expenses.toFixed(2)}, Net $${f.net.toFixed(2)}`).join('\n')}`;
    }
    case 'budget': {
      const progress = await getBudgetProgress(month);
      return `Budget status this month:\n${progress.map((b) => `${b.categoryName}: $${b.spent.toFixed(2)} / $${b.monthlyLimit.toFixed(2)} (${b.percentage}%)`).join('\n')}`;
    }
    default:
      return await buildAssistantContext();
  }
}
