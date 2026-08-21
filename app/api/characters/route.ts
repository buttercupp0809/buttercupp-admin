import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const status = searchParams.get("status") ?? "all";
  const rating = searchParams.get("rating") ?? "all";
  const style = searchParams.get("style") ?? "all";
  const search = searchParams.get("search")?.trim() ?? "";
  const limit = 25;

  const where: Record<string, unknown> = {};
  if (status !== "all") where.moderationStatus = status;
  if (rating !== "all") where.contentRating = rating;
  if (style !== "all") where.style = style;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [characters, total, pendingCount] = await Promise.all([
    prisma.character.findMany({
      where,
      include: { owner: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.character.count({ where }),
    prisma.character.count({ where: { moderationStatus: "pending" } }),
  ]);

  return NextResponse.json({ characters, total, pendingCount, page, limit });
}
