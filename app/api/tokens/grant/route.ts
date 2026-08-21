import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, amount, note } = await req.json();
  if (!email || !amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "email and positive amount required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, tokenBalance: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newBalance = user.tokenBalance + amount;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { tokenBalance: newBalance } }),
    prisma.tokenLedger.create({
      data: {
        userId: user.id,
        delta: amount,
        reason: "grant",
        balanceAfter: newBalance,
        refId: note || `admin-grant-${adminEmail}`,
      },
    }),
  ]);

  return NextResponse.json({ success: true, newBalance });
}
