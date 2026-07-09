/**
 * Dodo Payments client for the paywall price-set catalog (master-prd-21).
 * Mirrors Pellow's client init exactly (frontend/lib/payments/dodo.ts) so
 * admin validates/creates products against the same account + environment.
 */
import DodoPayments from "dodopayments";

let _client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments | null {
  if (_client) return _client;
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) return null;
  _client = new DodoPayments({
    bearerToken: apiKey,
    environment:
      process.env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });
  return _client;
}

export function getDodoEnvironment(): "live_mode" | "test_mode" {
  return process.env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export const PPP_TIERS = ["T0", "T1", "T2", "T3", "T4"] as const;
export type DodoTier = (typeof PPP_TIERS)[number];
export type DodoSlot = "monthly" | "annual";

// Matches the PaywallPriceSet.dodoProducts JSON shape (see prisma/schema.prisma).
export type DodoProductsMap = Partial<
  Record<DodoTier, Partial<Record<DodoSlot, string>>>
>;

export interface DodoValidationResult {
  ok: boolean;
  priceCents?: number;
  currency?: string;
  interval?: DodoSlot;
  error?: string;
}

// Mirrors the SDK's Price.RecurringPrice shape without importing SDK
// sub-paths that may change (same rationale as Pellow's dodo-fetcher.ts).
interface DodoRecurringPrice {
  price: number;
  currency: string;
  payment_frequency_interval?: string;
}

const LOOKUP_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Dodo lookup timed out")), ms),
    ),
  ]);
}

async function retrieveProduct(
  client: DodoPayments,
  productId: string,
): Promise<DodoValidationResult> {
  try {
    const product = await withTimeout(
      client.products.retrieve(productId),
      LOOKUP_TIMEOUT_MS,
    );
    const price = product.price as DodoRecurringPrice;
    const interval: DodoSlot =
      price.payment_frequency_interval === "Year" ? "annual" : "monthly";
    return {
      ok: true,
      priceCents: price.price,
      currency: price.currency || "USD",
      interval,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Dodo lookup failed",
    };
  }
}

/**
 * Validates every product id present in `dodoProducts`. A slot is only
 * valid when: the id resolves, its actual interval matches the slot it was
 * registered under (monthly must be Month, annual must be Year), and — when
 * both slots are set for the same tier — their currencies agree. Results are
 * keyed `${tier}.${slot}` so the UI/save logic can address each cell.
 */
export async function validateDodoProducts(
  dodoProducts: DodoProductsMap,
): Promise<{ results: Record<string, DodoValidationResult>; valid: boolean }> {
  const results: Record<string, DodoValidationResult> = {};
  const client = getDodoClient();

  const entries: { tier: DodoTier; slot: DodoSlot; id: string }[] = [];
  for (const tier of PPP_TIERS) {
    for (const slot of ["monthly", "annual"] as const) {
      const id = dodoProducts[tier]?.[slot];
      if (id) entries.push({ tier, slot, id });
    }
  }

  if (entries.length === 0) {
    return { results, valid: false };
  }

  if (!client) {
    for (const { tier, slot } of entries) {
      results[`${tier}.${slot}`] = {
        ok: false,
        error: "DODO_API_KEY not configured",
      };
    }
    return { results, valid: false };
  }

  await Promise.all(
    entries.map(async ({ tier, slot, id }) => {
      const result = await retrieveProduct(client, id);
      if (result.ok && result.interval !== slot) {
        result.ok = false;
        result.error = `Product is ${result.interval} but registered as the ${slot} slot`;
      }
      results[`${tier}.${slot}`] = result;
    }),
  );

  // Cross-check monthly/annual currency agreement per tier, after individual
  // lookups so a currency mismatch fails both slots explicitly rather than
  // silently producing an inconsistent snapshot.
  for (const tier of PPP_TIERS) {
    const monthly = results[`${tier}.monthly`];
    const annual = results[`${tier}.annual`];
    if (monthly?.ok && annual?.ok && monthly.currency !== annual.currency) {
      const msg = `Currency mismatch: monthly=${monthly.currency}, annual=${annual.currency}`;
      monthly.ok = false;
      monthly.error = msg;
      annual.ok = false;
      annual.error = msg;
    }
  }

  const valid = entries.every(
    ({ tier, slot }) => results[`${tier}.${slot}`]?.ok,
  );

  return { results, valid };
}

// Builds the display-only PaywallPriceSet.priceSnapshot from validation
// results. Annual is stored as the full yearly total (matches how
// fetchDodoPlanPrices divides by 12 for the per-month display).
export function buildPriceSnapshot(
  dodoProducts: DodoProductsMap,
  results: Record<string, DodoValidationResult>,
): Record<string, { monthlyCents?: number; annualYearlyCents?: number; currency?: string }> {
  const snapshot: Record<
    string,
    { monthlyCents?: number; annualYearlyCents?: number; currency?: string }
  > = {};

  for (const tier of PPP_TIERS) {
    const monthly = results[`${tier}.monthly`];
    const annual = results[`${tier}.annual`];
    if (!monthly && !annual) continue;

    snapshot[tier] = {
      ...(monthly?.ok ? { monthlyCents: monthly.priceCents } : {}),
      ...(annual?.ok ? { annualYearlyCents: annual.priceCents } : {}),
      currency: monthly?.currency ?? annual?.currency,
    };
  }

  return snapshot;
}
