"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export interface AuditScoreDataPoint {
  date: string;
  [storeName: string]: number | string | undefined;
}

interface AuditScoreChartProps {
  data: AuditScoreDataPoint[];
  storeNames: string[];
  colors: Record<string, string>;
}

export function AuditScoreChart({
  data,
  storeNames,
  colors,
}: AuditScoreChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">Audit Scores Over Time</h2>
          <p className="text-sm text-muted-foreground text-center py-10">
            No completed audits yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold mb-4">Audit Scores Over Time</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  fontSize: "13px",
                }}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }}
              />
              {storeNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[name] ?? "#8884d8"}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
