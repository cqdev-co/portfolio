'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

const DEFAULT_COLORS = [
  'var(--chart-1, #3b82f6)',
  'var(--chart-2, #f97316)',
  'var(--chart-3, #10b981)',
  'var(--chart-4, #a855f7)',
];

export type ReturnSeries = {
  name: string;
  color?: string;
};

export type ReturnPoint = {
  x: string;
  values: number[];
};

interface ReturnChartProps {
  series: ReturnSeries[];
  points: ReturnPoint[];
  className?: string;
}

/**
 * Multi-series line chart used inside `<InsightCard>` and
 * `<ArtifactPanel>`. The point shape carries a `values[]` array
 * indexed by series order so the same data can drive both the chart
 * and the table without restructuring.
 */
export function ReturnChart({ series, points, className }: ReturnChartProps) {
  if (series.length === 0 || points.length === 0) {
    return null;
  }

  const data = points.map((p) => {
    const row: Record<string, number | string> = { x: p.x };
    series.forEach((s, idx) => {
      row[s.name] = p.values[idx] ?? 0;
    });
    return row;
  });

  return (
    <div className={cn('h-56 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, bottom: 4, left: -12 }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="hsl(var(--border) / 0.4)"
            vertical={false}
          />
          <XAxis
            dataKey="x"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--background))',
              fontSize: 12,
            }}
            formatter={(value) =>
              `${typeof value === 'number' ? value.toFixed(2) : value}%`
            }
            labelStyle={{ fontWeight: 600 }}
          />
          {series.map((s, idx) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1.5, fill: 'hsl(var(--background))' }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
