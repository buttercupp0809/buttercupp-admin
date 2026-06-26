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
import { formatCountry } from "@/lib/utils";

interface Props {
  data: { country: string; count: number }[];
  topN?: number;
}

export function CountryBarChart({ data, topN = 10 }: Props) {
  const named = data.map((d) => ({ ...d, country: formatCountry(d.country) }));
  const top = named.slice(0, topN);
  const rest = named.slice(topN);
  const restTotal = rest.reduce((sum, d) => sum + d.count, 0);
  const display = restTotal > 0
    ? [...top, { country: `Other (${rest.length})`, count: restTotal }]
    : top;

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, display.length * 28)}>
      <BarChart data={display} layout="vertical" margin={{ left: 20, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
        <YAxis dataKey="country" type="category" tick={{ fontSize: 12 }} width={140} />
        <Tooltip />
        <Bar dataKey="count" fill="#1D9EFF" name="Users" />
      </BarChart>
    </ResponsiveContainer>
  );
}
