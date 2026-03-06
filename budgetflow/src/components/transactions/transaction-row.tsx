'use client';

import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, MessageSquare, Ban } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import {
  updateTransactionCategory,
  updateTransactionNotes,
  toggleExcludeFromBudget,
} from '@/lib/actions/transactions';
import { useRouter } from 'next/navigation';

interface Transaction {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  pending: boolean | null;
  isRecurring: boolean | null;
  isExcludedFromBudget: boolean | null;
  userNotes: string | null;
  transactionType: string | null;
  accountName: string | null;
  categoryId: string | null;
  userCategoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}

interface Category {
  id: string;
  name: string;
  groupName: string;
  icon: string | null;
}

export function TransactionRow({
  transaction: txn,
  categories,
}: {
  transaction: Transaction;
  categories: Category[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(txn.userNotes || '');

  const handleCategoryChange = async (categoryId: string) => {
    await updateTransactionCategory(txn.id, categoryId);
    router.refresh();
  };

  const handleNotesBlur = async () => {
    if (notes !== txn.userNotes) {
      await updateTransactionNotes(txn.id, notes);
    }
  };

  const handleExclude = async () => {
    await toggleExcludeFromBudget(txn.id);
    router.refresh();
  };

  return (
    <TableRow className={txn.isExcludedFromBudget ? 'opacity-50' : ''}>
      <TableCell className="text-sm text-muted-foreground tabular-nums">
        {formatDateShort(txn.date)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-medium">
              {txn.merchantName || txn.name}
            </p>
            {txn.merchantName && txn.merchantName !== txn.name && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {txn.name}
              </p>
            )}
            {txn.pending && (
              <Badge variant="outline" className="text-[10px] ml-1">
                Pending
              </Badge>
            )}
            {txn.isRecurring && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                Recurring
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Select
          value={txn.userCategoryId || txn.categoryId || ''}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-7 w-[150px] text-xs border-none shadow-none hover:bg-accent">
            <SelectValue>
              {txn.categoryIcon} {txn.categoryName || 'Uncategorized'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id} className="text-xs">
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {txn.accountName || '—'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <span
            className={`text-sm font-medium tabular-nums ${
              txn.transactionType === 'income' ? 'text-success' : ''
            }`}
          >
            {txn.transactionType === 'income' ? '+' : '-'}
            {formatCurrency(Math.abs(txn.amount))}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3" /> Notes
                  </label>
                  <Input
                    placeholder="Add a note..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleExclude}
                >
                  <Ban className="h-3 w-3 mr-1" />
                  {txn.isExcludedFromBudget
                    ? 'Include in Budget'
                    : 'Exclude from Budget'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
    </TableRow>
  );
}
