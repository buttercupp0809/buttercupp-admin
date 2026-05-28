import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await prisma.user.groupBy({
    by: ["platform"],
    _count: { _all: true },
  });

  const data = results.map((r) => ({
    platform: r.platform,
    count: r._count._all,
  }));

  return NextResponse.json(data);
}
