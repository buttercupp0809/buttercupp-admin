import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ country: string; count: number }[]>(async () => {
    const countries = await prisma.user.groupBy({
      by: ["lastLoginCountry"],
      _count: { lastLoginCountry: true },
      where: { lastLoginCountry: { not: null } },
      orderBy: { _count: { lastLoginCountry: "desc" } },
      take: 20,
    });
    return countries.map((c) => ({ country: c.lastLoginCountry ?? "Unknown", count: c._count.lastLoginCountry }));
  }, []);
}
