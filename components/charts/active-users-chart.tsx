"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";

interface Props {
  data: { date: string; count: number }[];
}

function formatTick(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ActiveUsersChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatTick} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={(v) => formatDate(v as string)} />
        <Bar dataKey="count" fill="#1D9EFF" name="Daily Active Users" />
      </BarChart>
    </ResponsiveContainer>
  );
}
