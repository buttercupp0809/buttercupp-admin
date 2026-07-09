import { NextRequest, NextResponse } from "next/server";
import { getDodoClient, getDodoEnvironment } from "@/lib/dodo";
import { burstProductListCache } from "@/lib/dodo-product-list-cache";

const TIMEOUT_MS = 15_000;

interface UpdateProductBody {
  productId?: string;
  name?: string;
  interval?: "monthly" | "annual";
  priceCents?: number;
  trialPeriodDays?: number;
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as UpdateProductBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productId = (body.productId || "").trim();
  const name = (body.name || "").trim();
  const interval = body.interval;
  const priceCents = body.priceCents;
  const trialPeriodDays = body.trialPeriodDays;

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  if (interval !== "monthly" && interval !== "annual") {
    return NextResponse.json({ error: "interval must be monthly or annual" }, { status: 400 });
  }
  if (!Number.isInteger(priceCents) || priceCents === undefined || priceCents <= 0) {
    return NextResponse.json({ error: "priceCents must be a positive integer" }, { status: 400 });
  }
  if (trialPeriodDays !== undefined && (!Number.isInteger(trialPeriodDays) || trialPeriodDays < 0)) {
    return NextResponse.json({ error: "trialPeriodDays must be a non-negative integer" }, { status: 400 });
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
    await client.products.update(
      productId,
      {
        ...(name ? { name } : {}),
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
          ...(trialPeriodDays !== undefined ? { trial_period_days: trialPeriodDays } : {}),
        },
      },
      { signal: controller.signal },
    );

    burstProductListCache();
    return NextResponse.json({ productId, priceCents, trialPeriodDays, interval, environment });
  } catch (err) {
    console.error("[dodo-products/update] failed", err);
    const message = err instanceof Error ? err.message : "Dodo product update failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
