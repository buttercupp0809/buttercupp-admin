import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ country: string; count: number }>(async () => {
    const rows = await prisma.user.groupBy({
      by: ["lastLoginCountry"],
      _count: { lastLoginCountry: true },
      where: {
        lastLoginCountry: { not: null },
        subscriptionTier: { in: ["premium", "pro"] },
      },
      orderBy: { _count: { lastLoginCountry: "desc" } },
      take: 1,
    });
    if (rows.length === 0) return { country: "", count: 0 };
    return { country: rows[0].lastLoginCountry ?? "", count: rows[0]._count.lastLoginCountry };
  }, { country: "", count: 0 });
}
