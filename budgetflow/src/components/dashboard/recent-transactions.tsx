'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  categoryName: string | null;
  categoryIcon: string | null;
  transactionType: string | null;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          Recent Transactions
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/transactions" className="text-xs text-muted-foreground">
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No transactions yet. Connect a bank account to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">
                    {txn.categoryIcon || '💳'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.merchantName || txn.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.categoryName || 'Uncategorized'} &middot;{' '}
                      {formatDateShort(txn.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium tabular-nums flex-shrink-0 ${
                    txn.transactionType === 'income' ? 'text-success' : ''
                  }`}
                >
                  {txn.transactionType === 'income' ? '+' : '-'}
                  {formatCurrency(Math.abs(txn.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
