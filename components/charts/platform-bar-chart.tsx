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

interface Props {
  data: { platform: string; count: number }[];
}

export function PlatformBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="platform" type="category" tick={{ fontSize: 12 }} width={80} />
        <Tooltip />
        <Bar dataKey="count" fill="#1D9EFF" name="Users" />
      </BarChart>
    </ResponsiveContainer>
  );
}
