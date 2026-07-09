import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALLOWED_RANGES = [7, 14, 30, 90] as const;
const STEPS = ["paywall_viewed", "begin_checkout", "purchase"] as const;
type StepName = (typeof STEPS)[number];

interface RawRow {
  variant_key: string;
  event_name: string;
  event_count: bigint | number;
}

interface VariantTotals {
  views: number;
  checkouts: number;
  purchases: number;
}

interface VariantResult extends VariantTotals {
  variantKey: string;
  viewToPurchasePct: number;
  significant: boolean | null; // null = not compared (control itself, or no data)
  direction: "up" | "down" | null;
}

function isStep(name: string): name is StepName {
  return (STEPS as readonly string[]).includes(name);
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// Two-proportion z-test, purchases/views for `variant` vs the control's
// purchases/views. |z| > 1.96 flags a 95% confidence difference. Returns
// null when either side has no views (nothing to compare).
function zTestVsControl(
  control: VariantTotals,
  variant: VariantTotals,
): { significant: boolean; direction: "up" | "down" } | null {
  const n1 = control.views;
  const n2 = variant.views;
  if (n1 === 0 || n2 === 0) return null;

  const x1 = control.purchases;
  const x2 = variant.purchases;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return { significant: false, direction: p2 >= p1 ? "up" : "down" };

  const z = (p2 - p1) / se;
  return { significant: Math.abs(z) > 1.96, direction: z >= 0 ? "up" : "down" };
}

export async function GET(req: NextRequest) {
  const rawRange = parseInt(req.nextUrl.searchParams.get("days") || "14", 10);
  const days = (ALLOWED_RANGES as readonly number[]).includes(rawRange) ? rawRange : 14;

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT
      (properties->>'paywall_variant_key') AS variant_key,
      "eventName"                          AS event_name,
      COUNT(*)                             AS event_count
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
      AND "eventName" IN ('paywall_viewed', 'begin_checkout', 'purchase')
      AND (properties->>'paywall_variant_key') IS NOT NULL
    GROUP BY variant_key, event_name
  `);

  const byVariant = new Map<string, VariantTotals>();
  for (const row of rows) {
    if (!isStep(row.event_name)) continue;
    const totals = byVariant.get(row.variant_key) ?? { views: 0, checkouts: 0, purchases: 0 };
    const count = Number(row.event_count);
    if (row.event_name === "paywall_viewed") totals.views += count;
    if (row.event_name === "begin_checkout") totals.checkouts += count;
    if (row.event_name === "purchase") totals.purchases += count;
    byVariant.set(row.variant_key, totals);
  }

  const control = byVariant.get("control") ?? { views: 0, checkouts: 0, purchases: 0 };

  const results: VariantResult[] = [...byVariant.entries()]
    .map(([variantKey, totals]) => {
      const isControl = variantKey === "control";
      const test = isControl ? null : zTestVsControl(control, totals);
      return {
        variantKey,
        ...totals,
        viewToPurchasePct: pct(totals.purchases, totals.views),
        significant: test ? test.significant : null,
        direction: test ? test.direction : null,
      };
    })
    .sort((a, b) => b.views - a.views);

  return NextResponse.json(
    { days, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
