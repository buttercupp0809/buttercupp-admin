import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/countries";

// Feeds the paywall rule editor's autocomplete inputs with values that
// actually exist. Campaigns/variant-params are suggestions only (a new
// campaign is created before it has traffic, so free-text stays allowed).
// Countries come from the static ISO-2 list and are constrained on the client.
export const dynamic = "force-dynamic";

interface OptionsPayload {
  campaigns: string[];
  variantParams: string[];
  countries: { code: string; label: string }[];
}

let cache: { at: number; data: OptionsPayload } | null = null;
const TTL_MS = 60_000;

function dedupeSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const [userCampaigns, leadCampaigns, variants, userVariantIds] =
      await Promise.all([
        prisma.user.findMany({
          where: { utmCampaign: { not: null } },
          select: { utmCampaign: true },
          distinct: ["utmCampaign"],
        }),
        prisma.marketingLead.findMany({
          where: { utmCampaign: { not: null } },
          select: { utmCampaign: true },
          distinct: ["utmCampaign"],
        }),
        prisma.paywallVariant.findMany({ select: { key: true } }),
        prisma.user.findMany({
          where: { variantId: { not: null } },
          select: { variantId: true },
          distinct: ["variantId"],
        }),
      ]);

    const data: OptionsPayload = {
      campaigns: dedupeSorted([
        ...userCampaigns.map((u) => u.utmCampaign),
        ...leadCampaigns.map((l) => l.utmCampaign),
      ]),
      variantParams: dedupeSorted([
        ...variants.map((v) => v.key),
        ...userVariantIds.map((u) => u.variantId),
      ]),
      countries: COUNTRIES,
    };

    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[paywall/options] failed", err);
    // Fail open: the editor degrades to plain free-text inputs.
    return NextResponse.json({
      campaigns: [],
      variantParams: [],
      countries: COUNTRIES,
    } satisfies OptionsPayload);
  }
}
