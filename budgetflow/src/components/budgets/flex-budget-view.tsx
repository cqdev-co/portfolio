'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, cn } from '@/lib/utils';

interface BudgetItem {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
  monthlyLimit: number;
  bucketType: string | null;
  spent: number;
  percentage: number;
  status: string;
}

interface FlexBudgetViewProps {
  budgets: BudgetItem[];
  monthlyIncome: number;
  monthlyExpenses: number;
}

const FIXED_GROUPS = ['Housing', 'Transportation', 'Financial'];
const NON_MONTHLY_GROUPS = ['Travel'];

export function FlexBudgetView({
  budgets,
  monthlyIncome,
  monthlyExpenses: _monthlyExpenses,
}: FlexBudgetViewProps) {
  const fixed = budgets.filter(
    (b) =>
      b.bucketType === 'fixed' || FIXED_GROUPS.includes(b.categoryGroup || '')
  );
  const nonMonthly = budgets.filter(
    (b) =>
      b.bucketType === 'non-monthly' ||
      NON_MONTHLY_GROUPS.includes(b.categoryGroup || '')
  );
  const flexible = budgets.filter(
    (b) => !fixed.includes(b) && !nonMonthly.includes(b)
  );

  const fixedTotal = fixed.reduce((s, b) => s + b.monthlyLimit, 0);
  const fixedSpent = fixed.reduce((s, b) => s + b.spent, 0);
  const nonMonthlyTotal = nonMonthly.reduce((s, b) => s + b.monthlyLimit, 0);
  const nonMonthlySpent = nonMonthly.reduce((s, b) => s + b.spent, 0);

  const flexBudget = monthlyIncome - fixedTotal - nonMonthlyTotal;
  const flexSpent = flexible.reduce((s, b) => s + b.spent, 0);
  const flexRemaining = flexBudget - flexSpent;
  const flexPercentage =
    flexBudget > 0 ? Math.round((flexSpent / flexBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Your Flex Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-4xl font-bold mb-2',
              flexRemaining >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {formatCurrency(flexRemaining)}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            left to spend on flexible expenses this month
          </p>
          <Progress
            value={Math.min(flexPercentage, 100)}
            className={cn(
              'h-3',
              flexPercentage >= 100 && '[&>div]:bg-destructive',
              flexPercentage >= 75 &&
                flexPercentage < 100 &&
                '[&>div]:bg-warning'
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatCurrency(flexSpent)} spent</span>
            <span>{formatCurrency(flexBudget)} budget</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Fixed Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(fixedSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(fixedTotal)} budgeted
            </p>
            <div className="mt-3 space-y-2">
              {fixed.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    {b.categoryIcon} {b.categoryName}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(b.spent)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Flexible Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(flexSpent)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(flexBudget)} available
            </p>
            <div className="mt-3 space-y-2">
              {flexible.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    {b.categoryIcon} {b.categoryName}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(b.spent)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Non-Monthly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(nonMonthlySpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(nonMonthlyTotal)} set aside
            </p>
            <div className="mt-3 space-y-2">
              {nonMonthly.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    {b.categoryIcon} {b.categoryName}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(b.spent)}
                  </span>
                </div>
              ))}
              {nonMonthly.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No non-monthly expenses
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
