'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { InsightButton } from '@/components/ai/insight-button';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210 80% 60%)',
  'hsl(280 70% 60%)',
  'hsl(160 60% 50%)',
];

interface SpendingChartProps {
  data: {
    categoryName: string | null;
    categoryIcon: string | null;
    total: number;
  }[];
}

export function SpendingChart({ data }: SpendingChartProps) {
  const chartData = data.slice(0, 8).map((item, i) => ({
    name: item.categoryName || 'Uncategorized',
    value: item.total,
    icon: item.categoryIcon || '📁',
    fill: COLORS[i % COLORS.length],
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              Spending by Category
            </CardTitle>
            <InsightButton widgetType="spending" />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground text-sm">No spending data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">
            Spending by Category
          </CardTitle>
          <InsightButton widgetType="spending" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground">
                    {item.icon} {item.name}
                  </span>
                </div>
                <span className="font-medium tabular-nums">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
            {total > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
