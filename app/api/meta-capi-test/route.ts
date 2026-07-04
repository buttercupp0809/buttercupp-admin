import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

const ALLOWED_EVENTS = [
  "Purchase",
  "Lead",
  "InitiateCheckout",
  "AddPaymentInfo",
  "StartTrial",
  "Subscribe",
] as const;

type MetaEvent = (typeof ALLOWED_EVENTS)[number];

const sha = (s: string) =>
  createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;

  if (!token || !pixelId || !testEventCode) {
    return NextResponse.json(
      { error: "Missing META_CAPI_* env" },
      { status: 503 }
    );
  }

  let parsed: {
    eventName?: string;
    email?: string;
    value?: number;
    currency?: string;
  };
  try {
    parsed = await req.json();
  } catch {
    parsed = {};
  }

  const eventName: MetaEvent = (ALLOWED_EVENTS as readonly string[]).includes(
    parsed.eventName ?? ""
  )
    ? (parsed.eventName as MetaEvent)
    : "Purchase";

  const email = parsed.email?.trim();
  const value = typeof parsed.value === "number" ? parsed.value : undefined;
  const currency = parsed.currency?.trim();

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: `admin_test_${Date.now()}`,
        action_source: "website",
        event_source_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.vesspr.ai"}/onboard/payment?payment=returned`,
        user_data: email ? { em: [sha(email)] } : {},
        custom_data: {
          value: value ?? 1,
          currency: (currency ?? "USD").toUpperCase(),
        },
      },
    ],
    test_event_code: testEventCode,
  };

  const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    const text = await res.text();
    return NextResponse.json(
      { status: res.status, body: text, requestPayload: body },
      { status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ status: 0, error: message }, { status: 502 });
  }
}
