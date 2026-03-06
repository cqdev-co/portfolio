'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BudgetItem {
  categoryName: string | null;
  categoryIcon: string | null;
  monthlyLimit: number;
  spent: number;
  percentage: number;
  status: string;
}

interface BudgetOverviewProps {
  budgets: BudgetItem[];
}

export function BudgetOverview({ budgets }: BudgetOverviewProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Budget Progress</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/budgets" className="text-xs text-muted-foreground">
            Manage <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {budgets.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No budgets set.{' '}
            <Link href="/budgets" className="underline">
              Create your first budget
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            {budgets.slice(0, 6).map((budget, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {budget.categoryIcon} {budget.categoryName}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCurrency(budget.spent)} /{' '}
                    {formatCurrency(budget.monthlyLimit)}
                  </span>
                </div>
                <Progress
                  value={Math.min(budget.percentage, 100)}
                  className={cn(
                    'h-2',
                    budget.status === 'over' && '[&>div]:bg-destructive',
                    budget.status === 'warning' && '[&>div]:bg-warning'
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
