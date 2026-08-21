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
  const { amount, note } = await req.json();
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { tokenBalance: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newBalance = user.tokenBalance + amount;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { tokenBalance: newBalance } }),
    prisma.tokenLedger.create({
      data: {
        userId: id,
        delta: amount,
        reason: "grant",
        balanceAfter: newBalance,
        refId: note || `admin-grant-${adminEmail}`,
      },
    }),
  ]);

  return NextResponse.json({ success: true, newBalance });
}
