import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await prisma.user.groupBy({
    by: ["country"],
    _count: { _all: true },
  });

  const data = results
    .map((r) => ({
      country: r.country || "Unknown",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(data);
}
