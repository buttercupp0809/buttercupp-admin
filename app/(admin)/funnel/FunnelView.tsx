"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STEPS = [
  "ad_lead_submit",
  "onboarding_started",
  "paywall_viewed",
  "begin_checkout",
  "purchase",
] as const;

type StepName = (typeof STEPS)[number];

const STEP_LABELS: Record<StepName, string> = {
  ad_lead_submit: "Lead submitted",
  onboarding_started: "Onboarding started",
  paywall_viewed: "Paywall viewed",
  begin_checkout: "Checkout started",
  purchase: "Purchase",
};

const STEP_COLORS: Record<StepName, string> = {
  ad_lead_submit: "#1D9EFF",
  onboarding_started: "#22C55E",
  paywall_viewed: "#F59E0B",
  begin_checkout: "#A855F7",
  purchase: "#EF4444",
};

type Totals = Record<StepName, number>;

interface Rates {
  lead_to_start: number;
  start_to_paywall: number;
  paywall_to_checkout: number;
  checkout_to_purchase: number;
}

export interface FunnelResponse {
  rangeDays: number;
  totals: Totals;
  conversionRates: Rates;
  byVariant: ({ variantId: string | null } & Totals & Rates)[];
  byCampaign: ({ utmCampaign: string | null } & Totals)[];
  daily: ({ date: string } & Totals)[];
}

type Slice = "none" | "variant" | "utm_campaign";

function stepConversion(totals: Totals, index: number): number | null {
  if (index === 0) return null;
  const prev = totals[STEPS[index - 1]];
  const curr = totals[STEPS[index]];
  if (!prev) return 0;
  return Math.round((curr / prev) * 1000) / 10;
}

export function FunnelView({ initial }: { initial: FunnelResponse | null }) {
  const [data, setData] = useState<FunnelResponse | null>(initial);
  const [rangeDays, setRangeDays] = useState(14);
  const [slice, setSlice] = useState<Slice>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/funnel?rangeDays=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("request failed");
      setData((await res.json()) as FunnelResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rangeDays === 14 && initial) return;
    // Fetching fresh funnel data on a range change is the intended effect; the
    // loading/error setState inside load() is not the render-time state sync
    // the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(rangeDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm">Could not load funnel data.</p>
        <Button variant="outline" size="sm" onClick={() => load(rangeDays)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-64 animate-pulse bg-muted rounded-lg" />
    );
  }

  return (
    <div className={loading ? "space-y-6 opacity-50 transition-opacity" : "space-y-6 transition-opacity"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={String(rangeDays)}
          onValueChange={(v) => {
            const n = parseInt(String(v), 10);
            if (!Number.isNaN(n)) setRangeDays(n);
          }}
        >
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="14">14d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={slice} onValueChange={(v) => v && setSlice(v as Slice)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No slice</SelectItem>
            <SelectItem value="variant">By Variant</SelectItem>
            <SelectItem value="utm_campaign">By Campaign</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Step</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STEPS.map((step, i) => {
              const conv = stepConversion(data.totals, i);
              return (
                <TableRow key={step}>
                  <TableCell className="font-medium">{STEP_LABELS[step]}</TableCell>
                  <TableCell className="text-right">
                    {data.totals[step].toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {conv === null ? "—" : `${conv}%`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {slice === "variant" && (
        <SliceTable
          title="By Variant"
          label="Variant"
          rows={data.byVariant.map((r) => ({
            key: r.variantId ?? "(none)",
            totals: r,
          }))}
        />
      )}

      {slice === "utm_campaign" && (
        <SliceTable
          title="By Campaign"
          label="Campaign"
          rows={data.byCampaign.map((r) => ({
            key: r.utmCampaign ?? "(none)",
            totals: r,
          }))}
        />
      )}

      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3">Daily trend</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatTick} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {STEPS.map((step) => (
              <Line
                key={step}
                type="monotone"
                dataKey={step}
                name={STEP_LABELS[step]}
                stroke={STEP_COLORS[step]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatTick(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function SliceTable({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: { key: string; totals: Totals }[];
}) {
  const totalRow = rows.reduce<Totals>(
    (acc, r) => {
      for (const step of STEPS) acc[step] += r.totals[step];
      return acc;
    },
    {
      ad_lead_submit: 0,
      onboarding_started: 0,
      paywall_viewed: 0,
      begin_checkout: 0,
      purchase: 0,
    }
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{label}</TableHead>
              {STEPS.map((step) => (
                <TableHead key={step} className="text-right">
                  {STEP_LABELS[step]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={STEPS.length + 1} className="text-center py-6 text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.key}</TableCell>
                    {STEPS.map((step) => (
                      <TableCell key={step} className="text-right">
                        {r.totals[step].toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="font-medium bg-muted/40">
                  <TableCell>Total</TableCell>
                  {STEPS.map((step) => (
                    <TableCell key={step} className="text-right">
                      {totalRow[step].toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
