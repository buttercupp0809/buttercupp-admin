import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await prisma.user.groupBy({
    by: ["subscriptionTier"],
    _count: { _all: true },
  });

  const data = results.map((r) => ({
    tier: r.subscriptionTier,
    count: r._count._all,
  }));

  return NextResponse.json(data);
}
