import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const reason = searchParams.get("reason") ?? "all";
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (reason !== "all") where.reason = reason;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ledger, total, grantThisMonth, spentThisMonth] = await Promise.all([
    prisma.tokenLedger.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tokenLedger.count({ where }),
    prisma.tokenLedger.aggregate({
      where: { reason: "grant", createdAt: { gte: startOfMonth } },
      _sum: { delta: true },
    }),
    prisma.tokenLedger.aggregate({
      where: { delta: { lt: 0 }, createdAt: { gte: startOfMonth } },
      _sum: { delta: true },
    }),
  ]);

  return NextResponse.json({
    ledger,
    total,
    page,
    limit,
    summary: {
      grantThisMonth: grantThisMonth._sum.delta ?? 0,
      spentThisMonth: Math.abs(spentThisMonth._sum.delta ?? 0),
    },
  });
}
