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

interface Props {
  data: { period: string; count: number }[];
}

function formatTick(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function GrowthChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={formatTick} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={(v) => formatDate(v as string)} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#1D9EFF"
          fill="#1D9EFF"
          fillOpacity={0.2}
          name="Signups"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
