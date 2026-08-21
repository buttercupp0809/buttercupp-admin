import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ reason: string; total: number }[]>(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ledger = await prisma.tokenLedger.groupBy({
      by: ["reason"],
      _sum: { delta: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return ledger.map((l) => ({ reason: l.reason, total: l._sum.delta ?? 0 }));
  }, []);
}
