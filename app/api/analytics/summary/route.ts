import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers, activeToday, messagesToday, paidSubscribers] =
    await Promise.all([
      prisma.user.count(),
      prisma.message.findMany({
        where: { sender: "user", sentAt: { gte: today } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.message.count({ where: { sentAt: { gte: today } } }),
      prisma.user.count({
        where: { subscriptionTier: { not: "free" } },
      }),
    ]);

  return NextResponse.json({
    totalUsers,
    activeToday: activeToday.length,
    messagesToday,
    paidSubscribers,
  });
}
