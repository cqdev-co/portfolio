'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { upsertBudget } from '@/lib/actions/budgets';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  groupName: string;
  icon: string | null;
  type: string;
}

interface AddBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  month: string;
}

export function AddBudgetDialog({
  open,
  onOpenChange,
  categories,
  month,
}: AddBudgetDialogProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [bucketType, setBucketType] = useState('flexible');
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleSave = async () => {
    if (!categoryId || !amount) return;
    setSaving(true);

    await upsertBudget({
      categoryId,
      monthlyLimit: parseFloat(amount),
      month,
      budgetMode: 'category',
      bucketType,
    });

    setSaving(false);
    onOpenChange(false);
    setCategoryId('');
    setAmount('');
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monthly Limit</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Budget Type (Flex Mode)</Label>
            <Select value={bucketType} onValueChange={setBucketType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
                <SelectItem value="non-monthly">Non-Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !categoryId || !amount}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Add Budget'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
