import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const level = searchParams.get("level") ?? "all";
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (level !== "all") where.level = parseInt(level);

  const [events, total] = await Promise.all([
    prisma.crisisEvent.findMany({
      where,
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.crisisEvent.count({ where }),
  ]);

  return NextResponse.json({ events, total, page, limit });
}
