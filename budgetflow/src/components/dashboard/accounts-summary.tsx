'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import { ImportButton } from '@/components/import/import-button';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currentBalance: number | null;
}

interface AccountsSummaryProps {
  accounts: Account[];
}

export function AccountsSummary({ accounts }: AccountsSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Accounts</CardTitle>
        <ImportButton accounts={accounts} variant="outline" size="sm" />
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Add accounts in Settings to start tracking.
          </p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.institution || account.type}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(account.currentBalance || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
