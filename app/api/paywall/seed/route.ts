import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-off bootstrap for the paywall experimentation tables (master-prd-21,
// Prompt 5.1). Idempotent upsert so it is safe to hit more than once — the
// UI built in later prompts (5.2-5.4) takes over managing these rows after
// this baseline exists. Gated by the standard admin middleware (no public
// path entry for /api/paywall).
export async function POST() {
  const [variant, priceSet] = await Promise.all([
    prisma.paywallVariant.upsert({
      where: { key: "control" },
      update: {},
      create: {
        key: "control",
        name: "Control",
        status: "active",
        content: {},
      },
    }),
    prisma.paywallPriceSet.upsert({
      where: { key: "default" },
      update: {},
      create: {
        key: "default",
        label: "Default (env PPP)",
        dodoProducts: {},
        active: true,
      },
    }),
  ]);

  return NextResponse.json({ variant, priceSet });
}
