import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const sha = (s: string) =>
  createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

const phoneSha = (s: string) =>
  createHash("sha256").update(s.replace(/\D/g, "")).digest("hex");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function splitName(full: string | null | undefined): {
  first?: string;
  last?: string;
} {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

interface UserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  country?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
}

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  if (!token || !pixelId) {
    return NextResponse.json(
      { error: "Missing META_CAPI_* env" },
      { status: 503 }
    );
  }

  const params = req.nextUrl.searchParams;

  const sinceParam = params.get("since");
  if (!sinceParam) {
    return NextResponse.json(
      { error: "Missing required `since` query param (ISO 8601)" },
      { status: 400 }
    );
  }
  const since = new Date(sinceParam);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "Invalid `since`: not a parseable date" },
      { status: 400 }
    );
  }
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (since.getTime() < sevenDaysAgo) {
    return NextResponse.json(
      { error: "`since` is older than 7 days; backfilling old data is not allowed" },
      { status: 400 }
    );
  }

  const dryRun = params.get("dryRun") !== "false";

  let limit = parseInt(params.get("limit") || "500", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 500;
  if (limit > 1000) limit = 1000;

  const rows = await prisma.analyticsEvent.findMany({
    where: { eventName: "purchase", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const counters = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    missingEventId: 0,
    skipped_no_user: 0,
  };
  const errors: { eventId: string; status: number; body: string }[] = [];
  const samplePayloads: unknown[] = [];

  const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  for (const row of rows) {
    if (!row.userId) {
      counters.skipped_no_user += 1;
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      include: { marketingLead: true },
    });
    if (!user) {
      counters.skipped_no_user += 1;
      continue;
    }

    const lead = user.marketingLead;

    const email = user.email || lead?.email || null;
    const phone = lead?.phone || null;
    const country = user.country || lead?.country || null;
    const { first, last } = splitName(user.name || lead?.name);

    const fbp = user.fbp || lead?.fbp || undefined;
    const fbc = user.fbc || lead?.fbc || undefined;
    const clientIp = user.lastClientIp || lead?.clientIp || undefined;
    const userAgent = user.lastUserAgent || lead?.clientUserAgent || undefined;

    const userData: UserData = {};
    if (email) userData.em = [sha(email)];
    if (phone) userData.ph = [phoneSha(phone)];
    if (first) userData.fn = [sha(first)];
    if (last) userData.ln = [sha(last)];
    if (country) userData.country = [sha(country)];
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;

    const props = (row.properties ?? {}) as Record<string, unknown>;
    let eventId: string;
    if (typeof props.event_id === "string" && props.event_id) {
      eventId = props.event_id;
    } else {
      eventId = `backfill_${row.id}`;
      counters.missingEventId += 1;
    }

    const value =
      typeof props.value === "number"
        ? props.value
        : typeof props.value === "string"
          ? Number(props.value) || 0
          : 0;
    const currency =
      typeof props.currency === "string" ? props.currency.toUpperCase() : "USD";

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(new Date(row.createdAt).getTime() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.vesspr.ai"}/onboard/payment?payment=returned`,
          user_data: userData,
          custom_data: { value, currency },
        },
      ],
    };

    if (samplePayloads.length < 3) samplePayloads.push(payload);

    if (dryRun) {
      counters.attempted += 1;
      continue;
    }

    counters.attempted += 1;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        counters.succeeded += 1;
      } else {
        counters.failed += 1;
        if (errors.length < 10) {
          errors.push({ eventId, status: res.status, body: await res.text() });
        }
      }
    } catch (e) {
      counters.failed += 1;
      if (errors.length < 10) {
        errors.push({
          eventId,
          status: 0,
          body: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    await sleep(200);
  }

  return NextResponse.json({
    rangeStart: since.toISOString(),
    rangeEnd: new Date().toISOString(),
    dryRun,
    counters,
    errors,
    ...(dryRun ? { samplePayloads: samplePayloads.slice(0, 3) } : {}),
  });
}
