import { cookies, headers } from "next/headers";
import { RulesView, type PaywallRule } from "./RulesView";

export const dynamic = "force-dynamic";

interface VariantOption {
  key: string;
  name: string;
  status: string;
}

async function getData(): Promise<{ rules: PaywallRule[]; variants: VariantOption[] }> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  if (!host) return { rules: [], variants: [] };

  const fetchOpts = {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store" as const,
  };

  try {
    const [rulesRes, variantsRes] = await Promise.all([
      fetch(`${protocol}://${host}/api/paywall/rules`, fetchOpts),
      fetch(`${protocol}://${host}/api/paywall/variants`, fetchOpts),
    ]);
    const rules = rulesRes.ok ? ((await rulesRes.json()).rules as PaywallRule[]) : [];
    const variants = variantsRes.ok ? ((await variantsRes.json()).variants as VariantOption[]) : [];
    return { rules, variants: variants.filter((v) => v.status === "active") };
  } catch {
    return { rules: [], variants: [] };
  }
}

export default async function RulesPage() {
  const { rules, variants } = await getData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paywall Rules</h1>
        <p className="text-muted-foreground mt-1">
          Binds a campaign or URL param to a variant. This is where an ad campaign gets
          its UI.
        </p>
      </div>

      <RulesView initial={rules} activeVariants={variants} />
    </div>
  );
}
