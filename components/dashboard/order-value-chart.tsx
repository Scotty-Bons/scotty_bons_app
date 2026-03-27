"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";

export interface OrderValueDataPoint {
  month: string;
  [storeName: string]: number | string | undefined;
}

interface OrderValueChartProps {
  data: OrderValueDataPoint[];
  stores: { id: string; name: string }[];
  storeNames: string[];
  colors: Record<string, string>;
}

export function OrderValueChart({
  data,
  stores,
  storeNames,
  colors,
}: OrderValueChartProps) {
  const [filter, setFilter] = useState("all");

  // Build display data based on filter
  const displayData = data.map((point) => {
    if (filter === "all") {
      // Sum all stores into one "Total" bar
      let total = 0;
      for (const name of storeNames) {
        total += Number(point[name] ?? 0);
      }
      return { month: point.month, Total: total };
    }
    // Single store
    const storeName = stores.find((s) => s.id === filter)?.name;
    if (!storeName) return { month: point.month };
    return { month: point.month, [storeName]: point[storeName] ?? 0 };
  });

  const activeStoreNames =
    filter === "all"
      ? ["Total"]
      : [stores.find((s) => s.id === filter)?.name ?? ""];

  const barColor =
    filter === "all"
      ? "#3b82f6"
      : colors[activeStoreNames[0]] ?? "#3b82f6";

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">
            Monthly Order Value (Last 12 Months)
          </h2>
          <p className="text-sm text-muted-foreground text-center py-10">
            No orders in the last 12 months.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            Monthly Order Value (Last 12 Months)
          </h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              {activeStoreNames.map((name) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={barColor}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
