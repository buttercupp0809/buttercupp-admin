import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const results: { day: Date; dau: bigint }[] = await prisma.$queryRawUnsafe(
    `SELECT date_trunc('day', "sentAt") as day,
            COUNT(DISTINCT "userId")::bigint as dau
     FROM "Message"
     WHERE "sender" = 'user' AND "sentAt" >= $1
     GROUP BY day
     ORDER BY day`,
    since
  );

  const data = results.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    dau: Number(r.dau),
  }));

  return NextResponse.json(data);
}
