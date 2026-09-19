import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return safeRoute<{ name: string; count: number }[]>(async () => {
    const events = await prisma.analyticsEvent.groupBy({
      by: ["name"],
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 20,
    });
    return events.map((e) => ({ name: e.name, count: e._count.name }));
  }, []);
}
