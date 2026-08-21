import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminEmail();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (HIDDEN_USER_IDS.includes(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();
  const { days, tier } = body as { days: number; tier: string };

  if (!days || days < 1 || days > 365) {
    return NextResponse.json({ error: "days must be between 1 and 365" }, { status: 400 });
  }
  if (tier !== "premium" && tier !== "pro") {
    return NextResponse.json({ error: "tier must be premium or pro" }, { status: 400 });
  }

  const currentPeriodEnd = new Date(Date.now() + days * 86400000);

  const subscription = await prisma.subscription.upsert({
    where: { userId: id },
    create: {
      userId: id,
      provider: "admin_trial",
      tier: tier as "premium" | "pro",
      plan: "trial",
      status: "active",
      currentPeriodEnd,
    },
    update: {
      tier: tier as "premium" | "pro",
      plan: "trial",
      status: "active",
      currentPeriodEnd,
    },
  });

  await prisma.user.update({
    where: { id },
    data: { subscriptionTier: tier as "premium" | "pro" },
  });

  return NextResponse.json({
    success: true,
    currentPeriodEnd: subscription.currentPeriodEnd,
    subscriptionTier: tier,
  });
}
