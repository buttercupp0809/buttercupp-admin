import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  return safeRoute<{ date: string; count: number }[]>(async () => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const results: { day: Date; count: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
       FROM "User"
       WHERE "createdAt" >= $1
       GROUP BY day
       ORDER BY day`,
      since
    );

    return results.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
  }, []);
}
