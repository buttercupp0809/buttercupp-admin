import { NextRequest, NextResponse } from "next/server";
import { getDodoClient, getDodoEnvironment } from "@/lib/dodo";

// Mirrors the timeout pattern in lib/backend.ts: don't let a slow Dodo
// endpoint stall the request indefinitely.
const TIMEOUT_MS = 15_000;

interface CreateProductBody {
  label?: string;
  name?: string;
  interval?: "monthly" | "annual";
  priceCents?: number;
  trialPeriodDays?: number;
}

// Create-only: mints a brand-new Dodo product every call, never mutates an
// existing one (prices are effectively immutable and a live product may
// already have subscribers). Gated by the standard admin middleware. Never
// auto-fired — only reachable via an explicit button click from the editor.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CreateProductBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = (body.label || "").trim();
  const customName = (body.name || "").trim();
  const interval = body.interval;
  const priceCents = body.priceCents;
  const trialPeriodDays = body.trialPeriodDays ?? 0;

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (interval !== "monthly" && interval !== "annual") {
    return NextResponse.json({ error: "interval must be monthly or annual" }, { status: 400 });
  }
  if (!Number.isInteger(priceCents) || priceCents === undefined || priceCents <= 0) {
    return NextResponse.json({ error: "priceCents must be a positive integer" }, { status: 400 });
  }
  if (!Number.isInteger(trialPeriodDays) || trialPeriodDays < 0) {
    return NextResponse.json(
      { error: "trialPeriodDays must be a non-negative integer" },
      { status: 400 },
    );
  }

  const client = getDodoClient();
  if (!client) {
    return NextResponse.json({ error: "Dodo Payments not configured" }, { status: 503 });
  }

  const environment = getDodoEnvironment();
  const periodInterval = interval === "annual" ? "Year" : "Month";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Verified schema (docs.dodopayments.com/api-reference/products/post-products).
    // For annual, priceCents is the FULL YEARLY total (e.g. 14400 = $144/yr),
    // matching how fetchDodoPlanPrices divides by 12 for the per-month display.
    // Use the explicit name when the editor provides one; else derive a
    // sensible default from the slot label + interval.
    const productName = customName || `${label} (${interval})`;
    const product = await client.products.create(
      {
        name: productName,
        tax_category: "saas",
        price: {
          type: "recurring_price",
          currency: "USD",
          price: priceCents,
          discount: 0,
          purchasing_power_parity: false,
          payment_frequency_interval: periodInterval,
          payment_frequency_count: 1,
          subscription_period_interval: periodInterval,
          subscription_period_count: 1,
          trial_period_days: trialPeriodDays,
        },
      },
      { signal: controller.signal },
    );

    return NextResponse.json({
      productId: product.product_id,
      priceCents,
      trialPeriodDays,
      interval,
      environment,
    });
  } catch (err) {
    // Full detail server-side only; the client gets a short, safe message.
    console.error("[dodo-products/create] failed", err);
    const message = err instanceof Error ? err.message : "Dodo product creation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
