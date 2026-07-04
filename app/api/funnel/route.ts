import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALLOWED_RANGES = [7, 14, 30, 90] as const;

const STEPS = [
  "ad_lead_submit",
  "onboarding_started",
  "paywall_viewed",
  "begin_checkout",
  "purchase",
] as const;

type StepName = (typeof STEPS)[number];
type Totals = Record<StepName, number>;

interface RawRow {
  event_name: string;
  variant_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  event_date: Date;
  user_count: bigint | number;
  event_count: bigint | number;
}

function emptyTotals(): Totals {
  return {
    ad_lead_submit: 0,
    onboarding_started: 0,
    paywall_viewed: 0,
    begin_checkout: 0,
    purchase: 0,
  };
}

function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function ratesFrom(totals: Totals) {
  return {
    lead_to_start: rate(totals.onboarding_started, totals.ad_lead_submit),
    start_to_paywall: rate(totals.paywall_viewed, totals.onboarding_started),
    paywall_to_checkout: rate(totals.begin_checkout, totals.paywall_viewed),
    checkout_to_purchase: rate(totals.purchase, totals.begin_checkout),
  };
}

function isStep(name: string): name is StepName {
  return (STEPS as readonly string[]).includes(name);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const rawRange = parseInt(params.get("rangeDays") || "14", 10);
  const rangeDays = (ALLOWED_RANGES as readonly number[]).includes(rawRange)
    ? rawRange
    : 14;

  const variantId = params.get("variantId")?.trim() || null;
  const utmSource = params.get("utmSource")?.trim() || null;
  const utmCampaign = params.get("utmCampaign")?.trim() || null;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= NOW() - (${rangeDays} || ' days')::interval`,
    Prisma.sql`"eventName" IN ('ad_lead_submit', 'onboarding_started', 'paywall_viewed', 'begin_checkout', 'purchase')`,
  ];
  if (variantId) {
    conditions.push(Prisma.sql`(properties->>'variant_id') = ${variantId}`);
  }
  if (utmSource) {
    conditions.push(Prisma.sql`(properties->>'utm_source') = ${utmSource}`);
  }
  if (utmCampaign) {
    conditions.push(Prisma.sql`(properties->>'utm_campaign') = ${utmCampaign}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT
      "eventName"                   AS event_name,
      (properties->>'variant_id')   AS variant_id,
      (properties->>'utm_source')   AS utm_source,
      (properties->>'utm_campaign') AS utm_campaign,
      DATE("createdAt")             AS event_date,
      COUNT(DISTINCT "userId")      AS user_count,
      COUNT(*)                      AS event_count
    FROM "AnalyticsEvent"
    WHERE ${whereClause}
    GROUP BY event_name, variant_id, utm_source, utm_campaign, event_date
    ORDER BY event_date DESC
  `);

  const totals = emptyTotals();
  const byVariantMap = new Map<string | null, Totals>();
  const byCampaignMap = new Map<string | null, Totals>();
  const dailyMap = new Map<string, Totals>();

  for (const row of rows) {
    const name = row.event_name;
    if (!isStep(name)) continue;
    const count = Number(row.event_count);

    totals[name] += count;

    const variantTotals = byVariantMap.get(row.variant_id) ?? emptyTotals();
    variantTotals[name] += count;
    byVariantMap.set(row.variant_id, variantTotals);

    const campaignTotals = byCampaignMap.get(row.utm_campaign) ?? emptyTotals();
    campaignTotals[name] += count;
    byCampaignMap.set(row.utm_campaign, campaignTotals);

    const dateKey =
      row.event_date instanceof Date
        ? row.event_date.toISOString().slice(0, 10)
        : String(row.event_date).slice(0, 10);
    const dayTotals = dailyMap.get(dateKey) ?? emptyTotals();
    dayTotals[name] += count;
    dailyMap.set(dateKey, dayTotals);
  }

  const byVariant = [...byVariantMap.entries()]
    .map(([variantId, t]) => ({ variantId, ...t, ...ratesFrom(t) }))
    .sort((a, b) => b.ad_lead_submit - a.ad_lead_submit);

  const byCampaign = [...byCampaignMap.entries()]
    .map(([utmCampaign, t]) => ({ utmCampaign, ...t }))
    .sort((a, b) => b.ad_lead_submit - a.ad_lead_submit);

  const daily = [...dailyMap.entries()]
    .map(([date, t]) => ({ date, ...t }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const payload = {
    rangeDays,
    totals,
    conversionRates: ratesFrom(totals),
    byVariant,
    byCampaign,
    daily,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
