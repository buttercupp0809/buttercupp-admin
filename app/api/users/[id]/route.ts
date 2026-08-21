import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (HIDDEN_USER_IDS.includes(id)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                style: true,
                contentRating: true,
                moderationStatus: true,
              },
            },
            messages: { take: 3, orderBy: { createdAt: "desc" } },
          },
          orderBy: { lastMessageAt: "desc" },
        },
        memories: { orderBy: { createdAt: "desc" }, take: 50 },
        subscription: true,
        tokenLedger: { orderBy: { createdAt: "desc" }, take: 100 },
        usageCounters: { orderBy: { period: "desc" }, take: 24 },
        crisisEvents: { orderBy: { createdAt: "desc" }, take: 20 },
        relationshipStates: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error(`GET /api/users/${id} failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminEmail();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (HIDDEN_USER_IDS.includes(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();
  const { subscriptionTier, freeMessagesUsed } = body as {
    subscriptionTier?: string;
    freeMessagesUsed?: number;
  };

  const data: Record<string, unknown> = {};
  if (subscriptionTier !== undefined) data.subscriptionTier = subscriptionTier;
  if (freeMessagesUsed !== undefined) data.freeMessagesUsed = freeMessagesUsed;

  const updatedUser = await prisma.user.update({ where: { id }, data });

  if (subscriptionTier !== undefined) {
    await prisma.subscription.updateMany({
      where: { userId: id },
      data: { tier: subscriptionTier as "free" | "premium" | "pro" },
    });
  }

  return NextResponse.json({
    subscriptionTier: updatedUser.subscriptionTier,
    freeMessagesUsed: updatedUser.freeMessagesUsed,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (HIDDEN_USER_IDS.includes(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
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
