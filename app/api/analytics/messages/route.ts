import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results: { day: Date; platform: string; count: bigint }[] =
    await prisma.$queryRawUnsafe(
      `SELECT date_trunc('day', "sentAt") as day,
              "platform",
              COUNT(*)::bigint as count
       FROM "Message"
       WHERE "sentAt" >= $1
       GROUP BY day, "platform"
       ORDER BY day`,
      since
    );

  const data = results.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    platform: r.platform,
    count: Number(r.count),
  }));

  return NextResponse.json(data);
}
