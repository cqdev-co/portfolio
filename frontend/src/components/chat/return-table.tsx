'use client';

import { cn } from '@/lib/utils';

interface ReturnTableProps {
  columns: string[];
  rows: { period: string; values: (string | number)[] }[];
  className?: string;
}

function formatCell(v: string | number): {
  text: string;
  positive?: boolean;
  negative?: boolean;
} {
  if (typeof v === 'number') {
    const text = `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
    return { text, positive: v > 0, negative: v < 0 };
  }
  if (typeof v === 'string' && /^[+-]?\d/.test(v)) {
    const numeric = parseFloat(v);
    if (!Number.isNaN(numeric)) {
      return { text: v, positive: numeric > 0, negative: numeric < 0 };
    }
  }
  return { text: String(v) };
}

/**
 * Reuse-friendly comparison table: first column is the period label
 * (e.g. "1Y") and each subsequent column maps to a series. Numeric
 * values are colourised positive/negative and formatted as percentages
 * to match the inspiration UI.
 */
export function ReturnTable({ columns, rows, className }: ReturnTableProps) {
  if (columns.length === 0 || rows.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border border-border/60', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-left font-medium">PERIOD</th>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.period}-${idx}`}
              className={cn(
                'border-t border-border/50',
                idx === rows.length - 1 && 'border-b-0'
              )}
            >
              <td className="px-4 py-3 font-mono text-xs uppercase text-muted-foreground">
                {row.period}
              </td>
              {row.values.map((v, ci) => {
                const cell = formatCell(v);
                return (
                  <td
                    key={`${row.period}-${ci}`}
                    className={cn(
                      'px-4 py-3 font-mono text-sm tabular-nums',
                      cell.positive && 'text-emerald-600 dark:text-emerald-400',
                      cell.negative && 'text-rose-600 dark:text-rose-400',
                      !cell.positive && !cell.negative && 'text-foreground'
                    )}
                  >
                    {cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
