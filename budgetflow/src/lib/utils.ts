import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getMonthKey(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function percentOf(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function calculateProjectedDate(
  currentAmount: number,
  targetAmount: number,
  createdAt: string
): string | null {
  if (currentAmount >= targetAmount) return 'Completed';
  if (currentAmount <= 0) return null;

  const created = new Date(createdAt);
  const now = new Date();
  const daysElapsed = Math.max(
    1,
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
  const dailyRate = currentAmount / daysElapsed;

  if (dailyRate <= 0) return null;

  const remaining = targetAmount - currentAmount;
  const daysRemaining = remaining / dailyRate;
  const projected = new Date(
    now.getTime() + daysRemaining * 24 * 60 * 60 * 1000
  );

  return projected.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}
