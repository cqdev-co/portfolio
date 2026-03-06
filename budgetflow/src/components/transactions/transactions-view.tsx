'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { TransactionRow } from './transaction-row';

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
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  userCategoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
}

interface Category {
  id: string;
  name: string;
  groupName: string;
  icon: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface TransactionsViewProps {
  initialTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
}

type SortField = 'date' | 'amount' | 'name';
type SortDir = 'asc' | 'desc';

export function TransactionsView({
  initialTransactions,
  categories,
  accounts,
}: TransactionsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = initialTransactions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.merchantName?.toLowerCase().includes(q) ||
          t.categoryName?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(
        (t) =>
          t.categoryId === categoryFilter || t.userCategoryId === categoryFilter
      );
    }

    if (accountFilter !== 'all') {
      result = result.filter((t) => t.accountId === accountFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else cmp = a.name.localeCompare(b.name);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [
    initialTransactions,
    search,
    categoryFilter,
    accountFilter,
    sortField,
    sortDir,
  ]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const totalExpenses = filtered
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = filtered
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 text-sm">
        <Badge variant="outline">{filtered.length} transactions</Badge>
        {totalIncome > 0 && (
          <Badge variant="outline" className="text-success border-success/30">
            +{formatCurrency(totalIncome)} income
          </Badge>
        )}
        {totalExpenses > 0 && (
          <Badge
            variant="outline"
            className="text-destructive border-destructive/30"
          >
            -{formatCurrency(totalExpenses)} expenses
          </Badge>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 text-xs"
                  onClick={() => toggleSort('date')}
                >
                  Date
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 text-xs"
                  onClick={() => toggleSort('name')}
                >
                  Description
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8 text-xs"
                  onClick={() => toggleSort('amount')}
                >
                  Amount
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  categories={categories}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
