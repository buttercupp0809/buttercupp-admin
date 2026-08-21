import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export const dynamic = "force-dynamic";

export async function GET() {
  // Users with highest total messageCount across all conversations
  const conversations = await prisma.conversation.groupBy({
    by: ["userId"],
    _sum: { messageCount: true },
    orderBy: { _sum: { messageCount: "desc" } },
    take: 50,
    where: { userId: { notIn: HIDDEN_USER_IDS } },
  });

  const userIds = conversations.map((c) => c.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, NOT: { id: { in: HIDDEN_USER_IDS } } },
    select: { id: true, email: true, subscriptionTier: true, tokenBalance: true, createdAt: true },
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const result = conversations
    .filter((c) => userMap[c.userId])
    .map((c) => ({
      ...userMap[c.userId],
      totalMessages: c._sum.messageCount ?? 0,
    }));

  return NextResponse.json(result);
}
