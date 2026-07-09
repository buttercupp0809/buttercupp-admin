import { cookies, headers } from "next/headers";
import { getDodoEnvironment } from "@/lib/dodo";
import { PriceSetsView, type PaywallPriceSet } from "./PriceSetsView";

export const dynamic = "force-dynamic";

async function getPriceSets(): Promise<PaywallPriceSet[]> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  if (!host) return [];

  try {
    const res = await fetch(`${protocol}://${host}/api/paywall/price-sets`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { priceSets: PaywallPriceSet[] };
    return data.priceSets;
  } catch {
    return [];
  }
}

export default async function PriceSetsPage() {
  const initial = await getPriceSets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Price Sets</h1>
        <p className="text-muted-foreground mt-1">
          Dodo product catalog for the paywall — every price shown to a user must
          resolve to a validated product here (display = charge).
        </p>
      </div>

      <PriceSetsView initial={initial} dodoEnvironment={getDodoEnvironment()} />
    </div>
  );
}
