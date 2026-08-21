import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const status = searchParams.get("status") ?? "all";
  const kind = searchParams.get("kind") ?? "all";
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (kind !== "all") where.kind = kind;

  const [assets, total, summary] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const counts = Object.fromEntries(summary.map((s) => [s.status, s._count.status]));
  return NextResponse.json({ assets, total, page, limit, counts });
}
