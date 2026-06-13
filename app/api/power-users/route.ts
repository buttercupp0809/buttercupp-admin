import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Period = "daily" | "weekly" | "monthly" | "quarterly";

function periodStart(period: Period, now = new Date()): Date {
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "monthly":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "quarterly":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "weekly":
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = (sp.get("period") || "weekly") as Period;
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50")));

  const start = periodStart(period);

  const grouped = await prisma.message.groupBy({
    by: ["userId"],
    where: { sender: "user", sentAt: { gte: start } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) {
    return NextResponse.json({ users: [], period, periodStart: start.toISOString() });
  }

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      platform: true,
      subscriptionTier: true,
      createdAt: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const ranked = grouped
    .map((g, idx) => {
      const u = userMap.get(g.userId);
      if (!u) return null;
      return {
        rank: idx + 1,
        ...u,
        messageCount: g._count._all,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({
    users: ranked,
    period,
    periodStart: start.toISOString(),
  });
}
