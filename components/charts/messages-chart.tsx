"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";

interface RawData {
  date: string;
  platform: string;
  count: number;
}

interface Props {
  data: RawData[];
}

const COLORS: Record<string, string> = {
  telegram: "#1D9EFF",
  whatsapp: "#25D366",
  imessage: "#007AFF",
  web: "#6B7280",
};

function formatTick(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MessagesChart({ data }: Props) {
  const platforms = [...new Set(data.map((d) => d.platform))];

  const byDate = new Map<string, Record<string, number | string>>();
  for (const d of data) {
    const existing = byDate.get(d.date) || { date: d.date };
    existing[d.platform] = ((existing[d.platform] as number) || 0) + d.count;
    byDate.set(d.date, existing);
  }
  const chartData = [...byDate.values()].sort((a, b) =>
    (a.date as string).localeCompare(b.date as string)
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatTick} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={(v) => formatDate(v as string)} />
        {platforms.map((p) => (
          <Area
            key={p}
            type="monotone"
            dataKey={p}
            stackId="1"
            stroke={COLORS[p] || "#8884d8"}
            fill={COLORS[p] || "#8884d8"}
            fillOpacity={0.4}
            name={p}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
