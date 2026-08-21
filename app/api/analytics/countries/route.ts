import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ country: string; count: number }[]>(async () => {
    const countries = await prisma.user.groupBy({
      by: ["jurisdiction"],
      _count: { jurisdiction: true },
      where: { jurisdiction: { not: null } },
      orderBy: { _count: { jurisdiction: "desc" } },
      take: 20,
    });
    return countries.map((c) => ({ country: c.jurisdiction ?? "Unknown", count: c._count.jurisdiction }));
  }, []);
}
