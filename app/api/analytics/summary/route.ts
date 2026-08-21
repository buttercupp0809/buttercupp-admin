import { prisma } from "@/lib/prisma";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return safeRoute(
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalUsers, activeToday, messagesToday, paidSubscribers, pendingModeration] = await Promise.all([
        prisma.user.count(),
        prisma.conversation.count({ where: { updatedAt: { gte: today } } }),
        prisma.message.count({ where: { createdAt: { gte: today } } }),
        prisma.subscription.count({ where: { status: "active", tier: { not: "free" } } }),
        prisma.character.count({ where: { moderationStatus: "pending" } }),
      ]);

      return { totalUsers, activeToday, messagesToday, paidSubscribers, pendingModeration };
    },
    { totalUsers: 0, activeToday: 0, messagesToday: 0, paidSubscribers: 0, pendingModeration: 0 }
  );
}
