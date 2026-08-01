import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const ago7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [trialUsers, highEngResult] = await Promise.all([
    prisma.user.findMany({
      where: { trialEndsAt: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        platform: true,
        country: true,
        subscriptionTier: true,
        trialEndsAt: true,
        trialStatus: true,
        onboardingComplete: true,
        createdAt: true,
      },
      orderBy: { trialEndsAt: "asc" },
    }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM (
        SELECT m."userId"
        FROM "Message" m
        INNER JOIN "User" u ON u.id = m."userId"
        WHERE u."subscriptionTier" = 'free'
          AND m.sender = 'user'
          AND m."sentAt" >= ${ago7Days}
        GROUP BY m."userId"
        HAVING COUNT(*) > 5
      ) AS subq
    `,
  ]);

  const withDays = trialUsers.map((u) => {
    const daysLeft = Math.ceil(
      (u.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      ...u,
      trialEndsAt: u.trialEndsAt!.toISOString(),
      createdAt: u.createdAt.toISOString(),
      daysLeft,
    };
  });

  const active = withDays.filter((u) => u.daysLeft > 0 && u.subscriptionTier === "free");
  const expiring3d = active.filter((u) => u.daysLeft <= 3);
  const expiring7d = active.filter((u) => u.daysLeft <= 7);
  const expired = withDays.filter((u) => u.daysLeft <= 0 && u.subscriptionTier === "free");
  const converted = withDays.filter((u) => u.subscriptionTier !== "free");

  // Urgent list: expiring in next 7 days + expired in last 7 days (sorted by urgency)
  const urgentUsers = [
    ...expiring7d,
    ...expired.filter((u) => Math.abs(u.daysLeft) <= 7),
  ].sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 20);

  return NextResponse.json({
    total: trialUsers.length,
    active: active.length,
    expiring3d: expiring3d.length,
    expiring7d: expiring7d.length,
    expired: expired.length,
    converted: converted.length,
    highEngagementFree: Number(highEngResult[0]?.count ?? 0),
    urgentUsers,
  });
}
