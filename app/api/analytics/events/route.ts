import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute<{ name: string; count: number }[]>(async () => {
    const events = await prisma.analyticsEvent.groupBy({
      by: ["name"],
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 20,
    });
    return events.map((e) => ({ name: e.name, count: e._count.name }));
  }, []);
}
