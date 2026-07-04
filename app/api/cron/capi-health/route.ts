import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TRACKED_EVENTS = [
  "ad_lead_submit",
  "onboarding_started",
  "paywall_viewed",
  "begin_checkout",
  "purchase",
  "trial_started",
] as const;

async function getSentryFailureCount(): Promise<number | null> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const project = process.env.SENTRY_PROJECT_SLUG;
  const org = process.env.SENTRY_ORG_SLUG;
  if (!token || !project || !org) return null;

  try {
    const url = `https://sentry.io/api/0/projects/${org}/${project}/events/?query=${encodeURIComponent(
      'message:"Meta CAPI failure"'
    )}&statsPeriod=24h`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as unknown[];
    return Array.isArray(items) ? items.length : null;
  } catch (e) {
    console.warn("Sentry CAPI failure query failed:", e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron");
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!isVercelCron && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["eventName"],
    where: {
      createdAt: { gte: since },
      eventName: { in: [...TRACKED_EVENTS] },
    },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const event of TRACKED_EVENTS) counts[event] = 0;
  for (const g of grouped) counts[g.eventName] = g._count._all;

  const capiFailures = await getSentryFailureCount();

  const summary = `CAPI 24h: ${counts.purchase} purchases, ${counts.trial_started} trials, ${counts.begin_checkout} checkouts, ${counts.paywall_viewed} paywall views, ${counts.ad_lead_submit} leads. CAPI failures (Sentry): ${capiFailures ?? "n/a"}.`;

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.warn("SLACK_WEBHOOK_URL unset; skipping Slack post.");
    return NextResponse.json({ ok: true, posted: false, counts, capiFailures });
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: summary }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.warn("Slack post failed:", e);
    return NextResponse.json({ ok: true, posted: false, counts, capiFailures });
  }

  return NextResponse.json({ ok: true, posted: true, counts, capiFailures });
}
