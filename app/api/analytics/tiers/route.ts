import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ tier: string; count: number }[]>(async () => {
    const tiers = await prisma.user.groupBy({
      by: ["subscriptionTier"],
      _count: { subscriptionTier: true },
    });
    return tiers.map((t) => ({ tier: t.subscriptionTier, count: t._count.subscriptionTier }));
  }, []);
}
