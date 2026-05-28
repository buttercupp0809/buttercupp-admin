import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const granularity = req.nextUrl.searchParams.get("granularity") || "day";
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const trunc = granularity === "month" ? "month" : granularity === "week" ? "week" : "day";

  const results: { period: Date; count: bigint }[] = await prisma.$queryRawUnsafe(
    `SELECT date_trunc($1, "createdAt") as period, COUNT(*)::bigint as count
     FROM "User"
     WHERE "createdAt" >= $2
     GROUP BY period
     ORDER BY period`,
    trunc,
    since
  );

  const data = results.map((r) => ({
    period: r.period.toISOString().slice(0, 10),
    count: Number(r.count),
  }));

  return NextResponse.json(data);
}
