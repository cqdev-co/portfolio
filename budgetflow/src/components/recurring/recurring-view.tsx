'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Repeat, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  detectRecurringTransactions,
  toggleRecurringActive,
} from '@/lib/actions/recurring';
import { useRouter } from 'next/navigation';

interface RecurringItem {
  id: string;
  merchantName: string;
  estimatedAmount: number;
  frequency: string;
  nextExpectedDate: string | null;
  lastSeenDate: string | null;
  isActive: boolean | null;
  categoryName: string | null;
  categoryIcon: string | null;
}

interface RecurringViewProps {
  items: RecurringItem[];
  monthlyTotal: number;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  'bi-weekly': 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export function RecurringView({ items, monthlyTotal }: RecurringViewProps) {
  const router = useRouter();
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    await detectRecurringTransactions();
    setDetecting(false);
    router.refresh();
  };

  const handleToggle = async (id: string) => {
    await toggleRecurringActive(id);
    router.refresh();
  };

  const active = items.filter((i) => i.isActive);
  const inactive = items.filter((i) => !i.isActive);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Recurring
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(monthlyTotal)}
            </div>
            <p className="text-xs text-muted-foreground">estimated per month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Repeat className="h-4 w-4" />
              Active Subscriptions
            </div>
            <div className="text-2xl font-bold">{active.length}</div>
            <p className="text-xs text-muted-foreground">
              recurring charges detected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <Button
              onClick={handleDetect}
              disabled={detecting}
              variant="outline"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`}
              />
              {detecting ? 'Detecting...' : 'Detect Recurring'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {active.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Recurring Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {active.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.categoryIcon || '🔄'}</span>
                    <div>
                      <p className="text-sm font-medium">{item.merchantName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {FREQ_LABELS[item.frequency] || item.frequency}
                        </Badge>
                        {item.categoryName && (
                          <span className="text-xs text-muted-foreground">
                            {item.categoryName}
                          </span>
                        )}
                        {item.nextExpectedDate && (
                          <span className="text-xs text-muted-foreground">
                            Next: {formatDate(item.nextExpectedDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(item.estimatedAmount)}
                    </span>
                    <Switch
                      checked={!!item.isActive}
                      onCheckedChange={() => handleToggle(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inactive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactive.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0 opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.categoryIcon || '🔄'}</span>
                    <div>
                      <p className="text-sm font-medium">{item.merchantName}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {FREQ_LABELS[item.frequency] || item.frequency}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(item.estimatedAmount)}
                    </span>
                    <Switch
                      checked={false}
                      onCheckedChange={() => handleToggle(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No recurring expenses detected yet
            </p>
            <Button onClick={handleDetect} disabled={detecting}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`}
              />
              Scan for Recurring Expenses
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
