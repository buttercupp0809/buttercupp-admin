"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp } from "lucide-react";

interface VariantResult {
  variantKey: string;
  views: number;
  checkouts: number;
  purchases: number;
  viewToPurchasePct: number;
  significant: boolean | null;
  direction: "up" | "down" | null;
}

export interface ResultsResponse {
  days: number;
  results: VariantResult[];
}

export function ResultsView({ initial }: { initial: ResultsResponse | null }) {
  const [data, setData] = useState<ResultsResponse | null>(initial);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/paywall/results?days=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error("request failed");
      setData((await res.json()) as ResultsResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (initial) return;
    }
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm">Could not load results.</p>
        <Button variant="outline" size="sm" onClick={() => load(days)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return <div className="h-64 animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <div className={loading ? "space-y-6 opacity-50 transition-opacity" : "space-y-6 transition-opacity"}>
      <Tabs
        value={String(days)}
        onValueChange={(v) => {
          const n = parseInt(String(v), 10);
          if (!Number.isNaN(n)) setDays(n);
        }}
      >
        <TabsList>
          <TabsTrigger value="7">7d</TabsTrigger>
          <TabsTrigger value="14">14d</TabsTrigger>
          <TabsTrigger value="30">30d</TabsTrigger>
          <TabsTrigger value="90">90d</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Checkouts</TableHead>
              <TableHead className="text-right">Purchases</TableHead>
              <TableHead className="text-right">View → Purchase</TableHead>
              <TableHead>vs control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No data in this range.
                </TableCell>
              </TableRow>
            ) : (
              data.results.map((r) => (
                <TableRow key={r.variantKey}>
                  <TableCell className="font-mono text-xs">
                    {r.variantKey}
                    {r.variantKey === "control" && (
                      <Badge variant="outline" className="ml-2 text-[0.6rem]">
                        baseline
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.views.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.checkouts.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.purchases.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.viewToPurchasePct}%
                  </TableCell>
                  <TableCell>
                    {r.significant === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : r.significant ? (
                      <Badge
                        variant={r.direction === "up" ? "default" : "destructive"}
                        className="gap-1"
                      >
                        {r.direction === "up" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        significant
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">not significant</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
