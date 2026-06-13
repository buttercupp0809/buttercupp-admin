import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const VALID_PRIORITIES = ["critical", "important", "nice_to_have"] as const;
const VALID_CATEGORIES = ["bug", "feature", "improvement", "general"] as const;
const VALID_STATUSES = ["new", "acknowledged", "in_progress", "resolved"] as const;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const priority = sp.get("priority") || "";
  const category = sp.get("category") || "";
  const status = sp.get("status") || "";
  const search = sp.get("search") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "25")));

  const where: Prisma.FeedbackWhereInput = {};
  if (VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
    where.priority = priority;
  }
  if (VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    where.category = category;
  }
  if (VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [items, total, counts] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: [
        // Critical first, then newest.
        { priority: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({
      by: ["priority"],
      _count: { _all: true },
    }),
  ]);

  const priorityCounts = Object.fromEntries(
    counts.map((c) => [c.priority, c._count._all])
  );

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    priorityCounts,
  });
}
