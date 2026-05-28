"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, CreditCard } from "lucide-react";

type Period = "current" | "last" | "total";

interface ServiceCost {
  service: string;
  cost: number;
}

interface CostData {
  services: ServiceCost[];
  total: number;
  creditsRemaining: number;
  period: { start: string; end: string };
}

export default function AWSPage() {
  const [period, setPeriod] = useState<Period>("current");
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/aws/costs?period=${period}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AWS Costs</h1>
          <p className="text-muted-foreground mt-1">
            Infrastructure costs and credit tracking
          </p>
        </div>
        <div className="flex gap-1">
          {([
            ["current", "This Month"],
            ["last", "Last Month"],
            ["total", "All Time"],
          ] as [Period, string][]).map(([val, label]) => (
            <Button
              key={val}
              variant={period === val ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Make sure AWS credentials are configured in .env.local
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading AWS costs…</div>
      ) : data ? (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Spend ({period === "current" ? "This Month" : period === "last" ? "Last Month" : "All Time"})
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${data.total.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.period.start} → {data.period.end}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${data.creditsRemaining.toFixed(2)}</div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, (data.creditsRemaining / (data.creditsRemaining + data.total)) * 100))}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Service Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.services.map((s) => (
                    <TableRow key={s.service}>
                      <TableCell>{s.service}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${s.cost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {data.total > 0
                          ? ((s.cost / data.total) * 100).toFixed(1)
                          : "0"}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.services.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No cost data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
