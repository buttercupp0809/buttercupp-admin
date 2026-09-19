import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return safeRoute<{ country: string; count: number }[]>(async () => {
    const countries = await prisma.user.groupBy({
      by: ["lastLoginCountry"],
      _count: { lastLoginCountry: true },
      where: { lastLoginCountry: { not: null } },
      orderBy: { _count: { lastLoginCountry: "desc" } },
      take: 20,
    });
    return countries.map((c) => ({ country: c.lastLoginCountry ?? "Unknown", count: c._count.lastLoginCountry }));
  }, []);
}
