import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = sp.get("period") || "weekly";
  const sort = sp.get("sort") || "score";
  const order = (sp.get("order") || "desc") as "asc" | "desc";
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "25")));
  const search = sp.get("search") || "";

  const now = new Date();
  let periodStart: Date;
  switch (period) {
    case "daily":
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "monthly":
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "quarterly":
      periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default: // weekly
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, messageCounts, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        platform: true,
        subscriptionTier: true,
        country: true,
        createdAt: true,
      },
    }),
    prisma.message.groupBy({
      by: ["userId"],
      where: { sender: "user", sentAt: { gte: periodStart } },
      _count: { _all: true },
    }),
    prisma.user.count({ where }),
  ]);

  const scoreMap = new Map(
    messageCounts.map((m) => [m.userId, m._count._all])
  );

  let enriched = users.map((u) => ({
    ...u,
    score: scoreMap.get(u.id) || 0,
  }));

  // Sort
  enriched.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "score":
        cmp = a.score - b.score;
        break;
      case "name":
        cmp = (a.name || "").localeCompare(b.name || "");
        break;
      case "email":
        cmp = a.email.localeCompare(b.email);
        break;
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      default:
        cmp = a.score - b.score;
    }
    return order === "desc" ? -cmp : cmp;
  });

  // Paginate
  const start = (page - 1) * limit;
  const paginated = enriched.slice(start, start + limit);

  return NextResponse.json({
    users: paginated,
    total,
    page,
    limit,
  });
}
