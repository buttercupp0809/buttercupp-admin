import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const tier = searchParams.get("tier") ?? "all";
  const search = searchParams.get("search")?.trim() ?? "";
  const limit = 25;

  const where: Record<string, unknown> = { id: { notIn: HIDDEN_USER_IDS } };
  if (tier !== "all") where.subscriptionTier = tier;
  if (search) where.email = { contains: search, mode: "insensitive" };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        tokenBalance: true,
        ageVerificationLevel: true,
        completedOnboardingAt: true,
        createdAt: true,
        // Login-device tracking (see poppy/packages/database schema): the
        // list view only needs the coarse bucket + timestamp. The raw UA
        // is heavy and only surfaced on the user detail page.
        lastLoginAt: true,
        lastLoginDeviceType: true,
        lastLoginCountry: true,
        profile: { select: { displayName: true, gender: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}
