'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { AddBudgetDialog } from './add-budget-dialog';
import { FlexBudgetView } from './flex-budget-view';

interface BudgetItem {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
  monthlyLimit: number;
  rolloverAmount: number | null;
  bucketType: string | null;
  spent: number;
  remaining: number;
  percentage: number;
  status: string;
}

interface Category {
  id: string;
  name: string;
  groupName: string;
  icon: string | null;
  type: string;
}

interface BudgetViewProps {
  initialBudgets: BudgetItem[];
  categories: Category[];
  monthlyIncome: number;
  monthlyExpenses: number;
  currentMonth: string;
}

export function BudgetView({
  initialBudgets,
  categories,
  monthlyIncome,
  monthlyExpenses,
  currentMonth,
}: BudgetViewProps) {
  const [month, setMonth] = useState(currentMonth);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const totalBudgeted = initialBudgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = initialBudgets.reduce((s, b) => s + b.spent, 0);
  const overallPercentage =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const grouped = initialBudgets.reduce<Record<string, BudgetItem[]>>(
    (acc, b) => {
      const group = b.categoryGroup || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(b);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {monthLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Budget
        </Button>
      </div>

      <Tabs defaultValue="category">
        <TabsList>
          <TabsTrigger value="category">Category Budget</TabsTrigger>
          <TabsTrigger value="flex">Flex Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">
                  Total Budgeted
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalBudgeted)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Spent</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalSpent)}
                </div>
                <Progress
                  value={Math.min(overallPercentage, 100)}
                  className={cn(
                    'h-2 mt-2',
                    overallPercentage >= 100 && '[&>div]:bg-destructive',
                    overallPercentage >= 75 &&
                      overallPercentage < 100 &&
                      '[&>div]:bg-warning'
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Remaining</div>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    totalBudgeted - totalSpent < 0
                      ? 'text-destructive'
                      : 'text-success'
                  )}
                >
                  {formatCurrency(totalBudgeted - totalSpent)}
                </div>
              </CardContent>
            </Card>
          </div>

          {Object.entries(grouped).map(([group, items]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{group}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((budget) => (
                  <div key={budget.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {budget.categoryIcon} {budget.categoryName}
                        {(budget.rolloverAmount ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (+{formatCurrency(budget.rolloverAmount!)} rollover)
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(budget.spent)} /{' '}
                        {formatCurrency(
                          budget.monthlyLimit + (budget.rolloverAmount || 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(budget.percentage, 100)}
                        className={cn(
                          'h-2 flex-1',
                          budget.status === 'over' && '[&>div]:bg-destructive',
                          budget.status === 'warning' && '[&>div]:bg-warning'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums min-w-[36px] text-right',
                          budget.status === 'over' && 'text-destructive',
                          budget.status === 'warning' && 'text-warning'
                        )}
                      >
                        {budget.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {initialBudgets.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">
                  No budgets set for {monthLabel}
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Your First Budget
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flex" className="mt-4">
          <FlexBudgetView
            budgets={initialBudgets}
            monthlyIncome={monthlyIncome}
            monthlyExpenses={monthlyExpenses}
          />
        </TabsContent>
      </Tabs>

      <AddBudgetDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        categories={categories}
        month={month}
      />
    </div>
  );
}
