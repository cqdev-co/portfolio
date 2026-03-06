'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, Trash2 } from 'lucide-react';
import {
  formatCurrency,
  percentOf,
  cn,
  calculateProjectedDate,
} from '@/lib/utils';
import { deleteSavingsGoal } from '@/lib/actions/savings';
import { AddGoalDialog } from './add-goal-dialog';
import { useRouter } from 'next/navigation';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  icon: string | null;
  createdAt: string;
  accountName: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface SavingsViewProps {
  goals: Goal[];
  accounts: Account[];
}

export function SavingsView({ goals, accounts }: SavingsViewProps) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);

  const handleDelete = async (id: string) => {
    await deleteSavingsGoal(id);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-4 md:grid-cols-2 flex-1 mr-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Saved</div>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(totalSaved)}
              </div>
              <p className="text-xs text-muted-foreground">
                across {goals.length} goals
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Target</div>
              <div className="text-2xl font-bold">
                {formatCurrency(totalTarget)}
              </div>
              <Progress
                value={percentOf(totalSaved, totalTarget)}
                className="h-2 mt-2"
              />
            </CardContent>
          </Card>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Goal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => {
          const pct = percentOf(goal.currentAmount, goal.targetAmount);
          const projected = calculateProjectedDate(
            goal.currentAmount,
            goal.targetAmount,
            goal.createdAt
          );

          return (
            <Card key={goal.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="text-lg">{goal.icon || '🎯'}</span>
                  {goal.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(goal.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative h-24 w-24">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={
                          pct >= 100
                            ? 'hsl(var(--success))'
                            : 'hsl(var(--primary))'
                        }
                        strokeWidth="8"
                        strokeDasharray={`${(Math.min(pct, 100) / 100) * 264} 264`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{pct}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saved</span>
                    <span className="font-medium text-success tabular-nums">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(
                        Math.max(0, goal.targetAmount - goal.currentAmount)
                      )}
                    </span>
                  </div>
                  {goal.deadline && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deadline</span>
                      <span className="font-medium">{goal.deadline}</span>
                    </div>
                  )}
                  {projected && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Projected</span>
                      <span
                        className={cn(
                          'font-medium',
                          projected === 'Completed' && 'text-success'
                        )}
                      >
                        {projected}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {goals.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No savings goals yet</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Your First Goal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AddGoalDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        accounts={accounts}
      />
    </div>
  );
}
