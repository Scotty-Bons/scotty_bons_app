"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export interface OrderValueDataPoint {
  month: string;
  [storeName: string]: number | string | undefined;
}

interface OrderValueChartProps {
  data: OrderValueDataPoint[];
  storeNames: string[];
  colors: Record<string, string>;
  rangeLabel: string;
  /** When a single store is selected, show its name; otherwise show "Total" */
  selectedStoreName?: string;
}

export function OrderValueChart({
  data,
  storeNames,
  colors,
  rangeLabel,
  selectedStoreName,
}: OrderValueChartProps) {
  // Build display data — sum all stores into one bar, or show single store
  const displayData = data.map((point) => {
    if (selectedStoreName) {
      return { month: point.month, [selectedStoreName]: point[selectedStoreName] ?? 0 };
    }
    let total = 0;
    for (const name of storeNames) {
      total += Number(point[name] ?? 0);
    }
    return { month: point.month, Total: total };
  });

  const barLabel = selectedStoreName ?? "Total";
  const barColor = selectedStoreName
    ? colors[selectedStoreName] ?? "#3b82f6"
    : "#3b82f6";

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">
            Monthly Order Value ({rangeLabel})
          </h2>
          <p className="text-sm text-muted-foreground text-center py-10">
            No orders in this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold mb-4">
          Monthly Order Value ({rangeLabel})
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatPrice(v)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  fontSize: "13px",
                }}
                formatter={(value, name) => [formatPrice(Number(value)), name]}
              />
              <Bar
                dataKey={barLabel}
                fill={barColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
