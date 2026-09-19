import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return safeRoute<{ tier: string; count: number }[]>(async () => {
    const tiers = await prisma.user.groupBy({
      by: ["subscriptionTier"],
      _count: { subscriptionTier: true },
    });
    return tiers.map((t) => ({ tier: t.subscriptionTier, count: t._count.subscriptionTier }));
  }, []);
}
