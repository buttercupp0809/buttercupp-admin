import { cookies, headers } from "next/headers";
import { VariantsView, type PaywallVariant } from "./VariantsView";

export const dynamic = "force-dynamic";

async function getVariants(): Promise<PaywallVariant[]> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  if (!host) return [];

  try {
    const res = await fetch(`${protocol}://${host}/api/paywall/variants`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { variants: PaywallVariant[] };
    return data.variants;
  } catch {
    return [];
  }
}

export default async function VariantsPage() {
  const initial = await getVariants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paywall Variants</h1>
        <p className="text-muted-foreground mt-1">
          Typed copy/layout variants for the payment page. Draft variants are only
          reachable via a signed preview link — never assigned to live traffic.
        </p>
      </div>

      <VariantsView initial={initial} />
    </div>
  );
}
