import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_DAYS = [3, 7, 14, 30] as const;
type AllowedDays = (typeof ALLOWED_DAYS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const days: AllowedDays = body.days;

  if (!(ALLOWED_DAYS as readonly number[]).includes(days)) {
    return NextResponse.json(
      { error: `days must be one of: ${ALLOWED_DAYS.join(", ")}` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, trialEndsAt: true, trialStatus: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  // If trial is still active (future end date), extend from that date.
  // If expired or no trial, start fresh from now.
  const base = user.trialEndsAt && user.trialEndsAt > now ? user.trialEndsAt : now;
  const newTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      trialEndsAt: newTrialEndsAt,
      trialStatus: "active",
    },
    select: { trialEndsAt: true, trialStatus: true },
  });

  return NextResponse.json({
    success: true,
    daysAdded: days,
    trialEndsAt: updated.trialEndsAt,
    trialStatus: updated.trialStatus,
  });
}
