import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (HIDDEN_USER_IDS.includes(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const { days } = await req.json();
  if (!days || typeof days !== "number" || days <= 0) {
    return NextResponse.json({ error: "Invalid days" }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({ where: { userId: id } });
  if (!sub) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

  const base =
    sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
      ? sub.currentPeriodEnd
      : new Date();
  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const updated = await prisma.subscription.update({
    where: { userId: id },
    data: { currentPeriodEnd: newEnd },
  });

  return NextResponse.json({ success: true, currentPeriodEnd: updated.currentPeriodEnd });
}
