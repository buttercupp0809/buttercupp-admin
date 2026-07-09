import { NextResponse } from "next/server";
import { getDodoClient, getDodoEnvironment } from "@/lib/dodo";

// Lists existing Dodo products so the price-set editor can autocomplete a
// product id instead of pasting it. Read-only. The list response carries
// id/name/currency/price but NOT the billing interval, so both monthly and
// annual slots get the same suggestions; interval correctness is still
// enforced by validate-dodo on save.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 10_000;
const MAX_PRODUCTS = 200;

interface DodoProductOption {
  id: string;
  name: string;
  priceCents: number | null;
  currency: string | null;
  recurring: boolean;
}

let cache: { at: number; data: { products: DodoProductOption[]; environment: string } } | null = null;
const TTL_MS = 60_000;

export async function GET() {
  const environment = getDodoEnvironment();

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const client = getDodoClient();
  if (!client) {
    return NextResponse.json({ products: [], environment, error: "Dodo not configured" });
  }

  const deadline = Date.now() + TIMEOUT_MS;
  const products: DodoProductOption[] = [];

  try {
    // The SDK's list() auto-paginates via async iteration. Cap on both count
    // and wall-clock so a large catalog can't stall the editor.
    for await (const p of client.products.list()) {
      products.push({
        id: p.product_id,
        name: p.name ?? "(unnamed)",
        priceCents: typeof p.price === "number" ? p.price : null,
        currency: p.currency ?? null,
        recurring: Boolean(p.is_recurring),
      });
      if (products.length >= MAX_PRODUCTS || Date.now() > deadline) break;
    }

    const data = { products, environment };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[dodo-products/list] failed", err);
    // Fail open: the editor degrades to plain free-text product-id inputs.
    return NextResponse.json({ products: [], environment, error: "list failed" });
  }
}
