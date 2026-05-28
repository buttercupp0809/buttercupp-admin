import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await prisma.analyticsEvent.groupBy({
    by: ["eventName"],
    where: { createdAt: { gte: since } },
    _count: { eventName: true },
    orderBy: { _count: { eventName: "desc" } },
    take: 20,
  });

  const data = results.map((r) => ({
    eventName: r.eventName,
    count: r._count.eventName,
  }));

  return NextResponse.json(data);
}
