import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      personality: true,
      archetypeAnswers: true,
      memories: { take: 50, orderBy: { createdAt: "desc" } },
      events: { take: 50, orderBy: { eventDate: "desc" } },
      messages: { take: 100, orderBy: { sentAt: "desc" } },
      boundary: true,
      subscription: true,
      arcs: { orderBy: { weekNumber: "desc" }, take: 10 },
      initiativeLogs: { take: 50, orderBy: { createdAt: "desc" } },
      crisisEvents: { orderBy: { createdAt: "desc" } },
      emotionalPatterns: true,
      conversationChunks: { take: 20, orderBy: { createdAt: "desc" } },
      usageCounters: { orderBy: { periodStart: "desc" }, take: 12 },
      scheduledPings: { orderBy: { scheduledAt: "desc" }, take: 20 },
      persona: true,
      memorySummaries: { orderBy: { periodEnd: "desc" }, take: 10 },
      emotionalContexts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { confirmEmail } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (confirmEmail !== user.email) {
    return NextResponse.json(
      { error: "Confirmation email does not match" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true, deleted: user.email });
}
